/**
 * Chat Orchestrator Service
 * Handles the orchestration logic between LLM, state machine, and tool execution
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService, LLMMessage } from '../llm';
import {
  LLMResponseParser,
  responseParser,
  LLMStructuredResponse,
  PlanResponse,
  CallToolResponse,
} from '../llm/response-parser';
import {
  ConversationState,
  ConversationStateService,
  isConfirmation,
  isRejection,
  isModificationRequest,
} from '../state-machine';
import { formatAgentPrompt, formatToolList, TOOL_DESCRIPTIONS } from '../prompts/agent-policy.prompt';
import { ToolExecutorService, TOOLS_METADATA } from './tool-executor.service';
import { IdempotencyService } from './idempotency.service';
import { AiAuditService } from './ai-audit.service';
import { AiAuditCategory } from '../enums';
import { ToolContext, ToolResult } from '../interfaces/tool.interface';
import { planHasPermission, SubscriptionPlan } from '../guards/tool-permission.guard';
import { KbSearchService } from '../../kb/services/kb-search.service';

export interface OrchestrationResult {
  message: string;
  state: ConversationState;
  data?: unknown;
  pendingPlan?: {
    action: string;
    params: Record<string, unknown>;
    missingFields: string[];
  };
  executedTools?: Array<{
    tool: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);
  private readonly parser: LLMResponseParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
    private readonly stateService: ConversationStateService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AiAuditService,
    private readonly kbSearchService: KbSearchService,
  ) {
    this.parser = responseParser;
  }

  /**
   * Process a user message with full orchestration
   */
  async processMessage(
    userId: string,
    conversationId: string,
    message: string,
    context: ToolContext,
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();

    // Get current conversation state
    const stateData = await this.stateService.getState(conversationId);
    this.logger.log(`Processing message in state: ${stateData.state}`);

    try {
      // Handle based on current state
      switch (stateData.state) {
        case ConversationState.AWAITING_CONFIRMATION:
          return await this.handleConfirmationState(
            userId,
            conversationId,
            message,
            context,
            stateData.pendingPlan!,
          );

        case ConversationState.PLANNING:
          return await this.handlePlanningState(
            userId,
            conversationId,
            message,
            context,
            stateData.pendingPlan,
          );

        case ConversationState.EXECUTING:
          // Should not receive messages while executing
          return {
            message: 'Uma operação está em execução. Por favor, aguarde.',
            state: ConversationState.EXECUTING,
          };

        case ConversationState.IDLE:
        default:
          return await this.handleIdleState(userId, conversationId, message, context);
      }
    } catch (error) {
      this.logger.error(`Orchestration error: ${error}`);

      await this.auditService.log({
        userId,
        conversationId,
        category: AiAuditCategory.ACTION_FAILED,
        action: 'orchestration_error',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      });

      // Reset to idle on error
      await this.stateService.clearPendingPlan(conversationId);

      throw error;
    }
  }

  /**
   * Handle IDLE state - process new requests
   */
  private async handleIdleState(
    userId: string,
    conversationId: string,
    message: string,
    context: ToolContext,
  ): Promise<OrchestrationResult> {
    // Check if this is a support question - if so, search KB first
    let kbContext = '';
    if (this.kbSearchService.isSupportQuestion(message)) {
      try {
        this.logger.log(`Detected support question, searching KB: "${message.substring(0, 50)}..."`);
        const kbResult = await this.kbSearchService.search(message, { topK: 3, minScore: 0.5 });
        if (kbResult.results.length > 0 && kbResult.formattedContext) {
          kbContext = kbResult.formattedContext;
          this.logger.log(`Found ${kbResult.results.length} relevant KB results`);
        }
      } catch (error) {
        this.logger.warn(`KB search failed: ${error}`);
        // Continue without KB context
      }
    }

    // Get conversation history
    const history = await this.getConversationHistory(conversationId, 10);

    // Get available tools for user's plan
    const userPlan = await this.getUserPlan(userId);
    const availableTools = this.getAvailableToolNames(userPlan);

    // Build system prompt with KB context if available
    let systemPrompt = formatAgentPrompt({
      availableTools: formatToolList(availableTools),
      conversationState: 'IDLE - Nova requisição',
    });

    if (kbContext) {
      systemPrompt += `\n\n---\n\n${kbContext}\n\n---\n\nUse as informações acima da base de conhecimento para responder perguntas de suporte. Cite as fontes quando relevante.`;
    }

    // Build messages for LLM
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    // Call LLM
    const llmResponse = await this.llmService.complete({
      messages,
      temperature: 0.7,
      maxTokens: 2048,
    });

    // Parse response
    const parseResult = this.parser.parse(llmResponse.content);

    if (!parseResult.success || !parseResult.response) {
      this.logger.warn(`Failed to parse LLM response: ${parseResult.error}`);
      return {
        message: llmResponse.content || 'Desculpe, não entendi sua solicitação.',
        state: ConversationState.IDLE,
        tokenUsage: llmResponse.usage ? {
          input: llmResponse.usage.inputTokens,
          output: llmResponse.usage.outputTokens,
          total: llmResponse.usage.totalTokens,
        } : undefined,
      };
    }

    // Handle structured response
    return await this.handleStructuredResponse(
      userId,
      conversationId,
      parseResult.response,
      context,
      llmResponse.usage,
    );
  }

  /**
   * Handle PLANNING state - collecting fields or waiting for all info
   */
  private async handlePlanningState(
    userId: string,
    conversationId: string,
    message: string,
    context: ToolContext,
    pendingPlan?: { action: string; tool: string; params: Record<string, unknown>; collectedFields: Record<string, unknown>; missingFields: string[] },
  ): Promise<OrchestrationResult> {
    if (!pendingPlan) {
      // No pending plan, reset to idle
      await this.stateService.clearPendingPlan(conversationId);
      return this.handleIdleState(userId, conversationId, message, context);
    }

    // Check for cancellation
    if (isRejection(message)) {
      await this.stateService.clearPendingPlan(conversationId);
      return {
        message: 'Operação cancelada.',
        state: ConversationState.IDLE,
      };
    }

    // Use LLM to extract fields from user message
    const extractionPrompt = `
O usuário está fornecendo informações para a operação: ${pendingPlan.action}
Campos já coletados: ${JSON.stringify(pendingPlan.collectedFields)}
Campos faltantes: ${pendingPlan.missingFields.join(', ')}

Mensagem do usuário: "${message}"

Extraia os valores dos campos faltantes da mensagem. Retorne:
\`\`\`json
{
  "type": "PLAN",
  "action": "${pendingPlan.action}",
  "collectedFields": { ...campos_anteriores, ...novos_campos },
  "missingFields": [...campos_ainda_faltantes],
  "suggestedActions": [],
  "requiresConfirmation": true
}
\`\`\`
`;

    const llmResponse = await this.llmService.complete({
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.3,
      maxTokens: 1024,
    });

    const parseResult = this.parser.parse(llmResponse.content);

    if (parseResult.success && parseResult.response && this.parser.isPlanResponse(parseResult.response)) {
      const updatedPlan = parseResult.response;

      // Update pending plan
      await this.stateService.updatePendingPlan(conversationId, {
        collectedFields: updatedPlan.collectedFields,
        missingFields: updatedPlan.missingFields,
        params: { ...pendingPlan.params, ...updatedPlan.collectedFields },
      });

      if (updatedPlan.missingFields.length === 0) {
        // All fields collected, move to confirmation
        const summary = this.formatPlanSummary(pendingPlan.action, updatedPlan.collectedFields);
        return {
          message: `${summary}\n\nDeseja confirmar esta operação?`,
          state: ConversationState.AWAITING_CONFIRMATION,
          pendingPlan: {
            action: pendingPlan.action,
            params: { ...pendingPlan.params, ...updatedPlan.collectedFields },
            missingFields: [],
          },
        };
      } else {
        // Still missing fields
        return {
          message: `Ainda preciso das seguintes informações:\n${updatedPlan.missingFields.map(f => `- ${f}`).join('\n')}`,
          state: ConversationState.PLANNING,
          pendingPlan: {
            action: pendingPlan.action,
            params: { ...pendingPlan.params, ...updatedPlan.collectedFields },
            missingFields: updatedPlan.missingFields,
          },
        };
      }
    }

    // Failed to parse, ask again
    return {
      message: `Por favor, forneça: ${pendingPlan.missingFields.join(', ')}`,
      state: ConversationState.PLANNING,
      pendingPlan: {
        action: pendingPlan.action,
        params: pendingPlan.params,
        missingFields: pendingPlan.missingFields,
      },
    };
  }

  /**
   * Handle AWAITING_CONFIRMATION state
   */
  private async handleConfirmationState(
    userId: string,
    conversationId: string,
    message: string,
    context: ToolContext,
    pendingPlan: { action: string; tool: string; params: Record<string, unknown>; collectedFields: Record<string, unknown>; missingFields: string[] },
  ): Promise<OrchestrationResult> {
    // Check for rejection
    if (isRejection(message)) {
      await this.stateService.clearPendingPlan(conversationId);
      return {
        message: 'Operação cancelada.',
        state: ConversationState.IDLE,
      };
    }

    // Check for modification request
    if (isModificationRequest(message)) {
      // Go back to planning
      await this.stateService.setState(conversationId, ConversationState.PLANNING);
      return {
        message: 'O que você gostaria de alterar?',
        state: ConversationState.PLANNING,
        pendingPlan: {
          action: pendingPlan.action,
          params: pendingPlan.params,
          missingFields: [],
        },
      };
    }

    // Check for confirmation
    if (isConfirmation(message)) {
      // Execute the operation
      return await this.executePendingPlan(userId, conversationId, pendingPlan, context);
    }

    // Not a clear confirmation/rejection
    return {
      message: 'Por favor, confirme com "sim" ou "confirmo", ou cancele com "não" ou "cancelar".',
      state: ConversationState.AWAITING_CONFIRMATION,
      pendingPlan: {
        action: pendingPlan.action,
        params: pendingPlan.params,
        missingFields: [],
      },
    };
  }

  /**
   * Execute a confirmed plan
   */
  private async executePendingPlan(
    userId: string,
    conversationId: string,
    pendingPlan: { action: string; tool: string; params: Record<string, unknown>; collectedFields: Record<string, unknown> },
    context: ToolContext,
  ): Promise<OrchestrationResult> {
    await this.stateService.startExecution(conversationId);

    const toolName = pendingPlan.tool || pendingPlan.action;
    const params = { ...pendingPlan.params, ...pendingPlan.collectedFields };

    // Check if billing.createCharge requires preview first
    if (toolName === 'billing.createCharge') {
      const previewId = await this.stateService.getBillingPreviewId(conversationId);
      if (!previewId) {
        // Need to create preview first
        await this.stateService.clearPendingPlan(conversationId);
        return {
          message: 'Erro: É necessário criar um preview de cobrança antes de criar a cobrança real.',
          state: ConversationState.IDLE,
        };
      }
      params.previewId = previewId;
    }

    // Generate idempotency key if needed
    if (this.parser.isWriteTool(toolName) && !params.idempotencyKey) {
      params.idempotencyKey = `ai_${conversationId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Execute tool
    const result = await this.executeToolWithContext(userId, toolName, params, context);

    // Complete execution
    await this.stateService.completeExecution(conversationId, {
      tool: toolName,
      success: result.success,
      data: result.data,
      error: result.error,
    });

    // If billing preview, store the preview ID
    if (toolName === 'billing.previewCharge' && result.success && result.data) {
      const previewData = result.data as { previewId?: string };
      if (previewData.previewId) {
        await this.stateService.storeBillingPreview(conversationId, previewData.previewId);
      }
    }

    if (result.success) {
      const successMessage = this.formatSuccessMessage(toolName, result.data);
      return {
        message: successMessage,
        state: ConversationState.IDLE,
        data: result.data,
        executedTools: [{ tool: toolName, success: true, result: result.data }],
      };
    } else {
      return {
        message: `Erro ao executar operação: ${result.error}`,
        state: ConversationState.IDLE,
        executedTools: [{ tool: toolName, success: false, error: result.error }],
      };
    }
  }

  /**
   * Handle structured LLM response
   */
  private async handleStructuredResponse(
    userId: string,
    conversationId: string,
    response: LLMStructuredResponse,
    context: ToolContext,
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number },
  ): Promise<OrchestrationResult> {
    const tokenUsage = usage ? {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.totalTokens,
    } : undefined;

    if (this.parser.isPlanResponse(response)) {
      return await this.handlePlanResponse(userId, conversationId, response, context, tokenUsage);
    }

    if (this.parser.isToolCall(response)) {
      return await this.handleToolCall(userId, conversationId, response, context, tokenUsage);
    }

    if (this.parser.isAskUser(response)) {
      return {
        message: response.question,
        state: ConversationState.IDLE,
        tokenUsage,
      };
    }

    // Informative response
    return {
      message: response.message,
      state: ConversationState.IDLE,
      data: response.data,
      tokenUsage,
    };
  }

  /**
   * Handle PLAN response from LLM
   */
  private async handlePlanResponse(
    userId: string,
    conversationId: string,
    plan: PlanResponse,
    context: ToolContext,
    tokenUsage?: { input: number; output: number; total: number },
  ): Promise<OrchestrationResult> {
    // Create pending plan
    await this.stateService.createPendingPlan(conversationId, {
      action: plan.action,
      tool: plan.action,
      params: plan.collectedFields,
      collectedFields: plan.collectedFields,
      missingFields: plan.missingFields,
    });

    if (this.parser.planHasMissingFields(plan)) {
      // Need more information
      const message = plan.message ||
        `Para ${plan.action}, preciso das seguintes informações:\n${plan.missingFields.map(f => `- ${f}`).join('\n')}`;

      return {
        message,
        state: ConversationState.PLANNING,
        pendingPlan: {
          action: plan.action,
          params: plan.collectedFields,
          missingFields: plan.missingFields,
        },
        tokenUsage,
      };
    }

    // All fields collected, ask for confirmation
    const summary = this.formatPlanSummary(plan.action, plan.collectedFields);

    // For billing, show special warning
    if (plan.action.startsWith('billing.')) {
      return {
        message: `${summary}\n\n⚠️ ATENÇÃO: Esta operação irá gerar uma cobrança REAL.\nConfirma a operação? (responda "sim, confirmo")`,
        state: ConversationState.AWAITING_CONFIRMATION,
        pendingPlan: {
          action: plan.action,
          params: plan.collectedFields,
          missingFields: [],
        },
        tokenUsage,
      };
    }

    return {
      message: `${summary}\n\nDeseja confirmar esta operação?`,
      state: ConversationState.AWAITING_CONFIRMATION,
      pendingPlan: {
        action: plan.action,
        params: plan.collectedFields,
        missingFields: [],
      },
      tokenUsage,
    };
  }

  /**
   * Handle direct CALL_TOOL response from LLM (for read operations)
   */
  private async handleToolCall(
    userId: string,
    conversationId: string,
    toolCall: CallToolResponse,
    context: ToolContext,
    tokenUsage?: { input: number; output: number; total: number },
  ): Promise<OrchestrationResult> {
    const toolName = toolCall.tool;
    const params = toolCall.params;

    // Check if tool is a write operation
    if (this.parser.isWriteTool(toolName)) {
      // Write operations should go through plan flow
      await this.stateService.createPendingPlan(conversationId, {
        action: toolName,
        tool: toolName,
        params,
        collectedFields: params,
        missingFields: [],
      });

      const summary = this.formatPlanSummary(toolName, params);
      return {
        message: `${summary}\n\nDeseja confirmar esta operação?`,
        state: ConversationState.AWAITING_CONFIRMATION,
        pendingPlan: { action: toolName, params, missingFields: [] },
        tokenUsage,
      };
    }

    // Read operations can be executed directly
    const result = await this.executeToolWithContext(userId, toolName, params, context);

    if (result.success) {
      return {
        message: this.formatReadResult(toolName, result.data),
        state: ConversationState.IDLE,
        data: result.data,
        executedTools: [{ tool: toolName, success: true, result: result.data }],
        tokenUsage,
      };
    }

    return {
      message: `Erro ao buscar dados: ${result.error}`,
      state: ConversationState.IDLE,
      executedTools: [{ tool: toolName, success: false, error: result.error }],
      tokenUsage,
    };
  }

  /**
   * Execute tool with context
   */
  private async executeToolWithContext(
    userId: string,
    toolName: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const toolContext: ToolContext = {
      ...context,
      userId,
    };

    // Map tool names to executor methods
    const toolMap: Record<string, (params: any, ctx: ToolContext) => Promise<ToolResult>> = {
      'customers.search': (p, c) => this.toolExecutor.customersSearch(p, c),
      'customers.get': (p, c) => this.toolExecutor.customersGet(p, c),
      'customers.create': (p, c) => this.toolExecutor.customersCreate(p, c),
      'workOrders.search': (p, c) => this.toolExecutor.workOrdersSearch(p, c),
      'workOrders.get': (p, c) => this.toolExecutor.workOrdersGet(p, c),
      'workOrders.create': (p, c) => this.toolExecutor.workOrdersCreate(p, c),
      'quotes.search': (p, c) => this.toolExecutor.quotesSearch(p, c),
      'quotes.get': (p, c) => this.toolExecutor.quotesGet(p, c),
      'quotes.create': (p, c) => this.toolExecutor.quotesCreate(p, c),
      'billing.getCharge': (p, c) => this.toolExecutor.billingGetCharge(p, c),
      'billing.searchCharges': (p, c) => this.toolExecutor.billingSearchCharges(p, c),
      'billing.previewCharge': (p, c) => this.toolExecutor.billingPreviewCharge(p, c),
      'billing.createCharge': (p, c) => this.toolExecutor.billingCreateCharge(p, c),
      'kb.search': (p, c) => this.toolExecutor.kbSearch(p, c),
    };

    const executor = toolMap[toolName];
    if (!executor) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    return executor(params, toolContext);
  }

  /**
   * Get conversation history for LLM context
   */
  private async getConversationHistory(conversationId: string, limit: number): Promise<LLMMessage[]> {
    const messages = await this.prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages
      .reverse()
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }

  /**
   * Get user's subscription plan
   */
  private async getUserPlan(userId: string): Promise<SubscriptionPlan> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription?.plan) {
      return SubscriptionPlan.FREE;
    }

    const planTypeMap: Record<string, SubscriptionPlan> = {
      FREE: SubscriptionPlan.FREE,
      STARTER: SubscriptionPlan.STARTER,
      PROFESSIONAL: SubscriptionPlan.PROFESSIONAL,
      ENTERPRISE: SubscriptionPlan.ENTERPRISE,
    };

    return planTypeMap[subscription.plan.type] || SubscriptionPlan.FREE;
  }

  /**
   * Get available tool names for a plan
   */
  private getAvailableToolNames(plan: SubscriptionPlan): string[] {
    return Object.entries(TOOLS_METADATA)
      .filter(([, meta]) => planHasPermission(plan, meta.permission))
      .map(([name]) => name);
  }

  /**
   * Format plan summary for confirmation
   */
  private formatPlanSummary(action: string, params: Record<string, unknown>): string {
    const actionNames: Record<string, string> = {
      'customers.create': 'Criar cliente',
      'workOrders.create': 'Criar ordem de serviço',
      'quotes.create': 'Criar orçamento',
      'billing.previewCharge': 'Preview de cobrança',
      'billing.createCharge': 'Criar cobrança',
    };

    const actionName = actionNames[action] || action;
    const paramList = Object.entries(params)
      .filter(([k]) => !['idempotencyKey'].includes(k))
      .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');

    return `📋 **${actionName}**\n\n${paramList}`;
  }

  /**
   * Format success message after tool execution
   */
  private formatSuccessMessage(toolName: string, data: unknown): string {
    const messages: Record<string, string> = {
      'customers.create': '✅ Cliente criado com sucesso!',
      'workOrders.create': '✅ Ordem de serviço criada com sucesso!',
      'quotes.create': '✅ Orçamento criado com sucesso!',
      'billing.previewCharge': '✅ Preview de cobrança gerado. Deseja confirmar a criação da cobrança?',
      'billing.createCharge': '✅ Cobrança criada com sucesso!',
    };

    return messages[toolName] || '✅ Operação concluída com sucesso!';
  }

  /**
   * Format read operation results
   */
  private formatReadResult(toolName: string, data: unknown): string {
    if (!data) return 'Nenhum resultado encontrado.';

    const result = data as { items?: unknown[]; total?: number };

    if (result.items && Array.isArray(result.items)) {
      if (result.items.length === 0) {
        return 'Nenhum resultado encontrado.';
      }
      return `Encontrado(s) ${result.total || result.items.length} resultado(s).`;
    }

    return 'Dados recuperados com sucesso.';
  }
}
