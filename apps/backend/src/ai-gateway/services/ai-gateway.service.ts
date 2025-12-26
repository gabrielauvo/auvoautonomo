/**
 * AI Gateway Service
 * Main orchestration layer for AI Copilot
 * This is the ONLY entry point for LLM interactions
 */

import { Injectable, Logger, BadRequestException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiConversationService } from './ai-conversation.service';
import { AiPlanService } from './ai-plan.service';
import { ToolRegistryService } from './tool-registry.service';
import { AiAuditService } from './ai-audit.service';
import { ChatOrchestratorService, OrchestrationResult } from './chat-orchestrator.service';
import { ToolContext, ToolResult } from '../interfaces/tool.interface';
import { AiAuditCategory } from '../enums';
import { ConversationState } from '../state-machine';

// Rate limiting constants
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_FAILED_REQUESTS_PER_HOUR = 50;

export interface ChatRequest {
  conversationId?: string;
  message: string;
  /** Client-provided context (optional) */
  context?: Record<string, unknown>;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  /** Current conversation state */
  state?: ConversationState;
  /** If the AI wants to execute actions, a plan is returned for confirmation */
  plan?: {
    id?: string;
    summary?: string;
    action?: string;
    params?: Record<string, unknown>;
    missingFields?: string[];
    actions?: Array<{
      id: string;
      description: string;
      type: string;
      requiresConfirmation: boolean;
    }>;
    hasPaymentActions?: boolean;
    expiresAt?: Date;
  };
  /** For read-only queries, data is returned directly */
  data?: unknown;
  /** Executed tools and their results */
  executedTools?: Array<{
    tool: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
  /** Token usage for billing */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationService: AiConversationService,
    private readonly planService: AiPlanService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly auditService: AiAuditService,
    @Optional() private readonly orchestrator?: ChatOrchestratorService,
  ) {}

  /**
   * Main chat endpoint - processes user messages and returns AI responses
   */
  async chat(
    userId: string,
    request: ChatRequest,
    context: Partial<ToolContext>,
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // Rate limiting check
    await this.checkRateLimit(userId);

    // Get or create conversation
    let conversationId = request.conversationId;
    if (!conversationId) {
      const conversation = await this.conversationService.createConversation(userId);
      conversationId = conversation.id;
    }

    // Build tool context
    const toolContext: ToolContext = {
      userId,
      conversationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    try {
      // Store user message
      await this.conversationService.addMessage(conversationId, userId, {
        role: 'user',
        content: request.message,
      });

      let result: OrchestrationResult;

      // Use orchestrator if available, otherwise fallback to simple processing
      if (this.orchestrator) {
        result = await this.orchestrator.processMessage(
          userId,
          conversationId,
          request.message,
          toolContext,
        );
      } else {
        // Fallback for when orchestrator is not injected
        result = await this.processWithFallback(
          userId,
          conversationId,
          request.message,
          toolContext,
        );
      }

      // Store assistant message
      await this.conversationService.addMessage(conversationId, userId, {
        role: 'assistant',
        content: result.message,
        toolCalls: result.executedTools,
        tokenCount: result.tokenUsage?.total,
        latencyMs: Date.now() - startTime,
      });

      return {
        conversationId,
        message: result.message,
        state: result.state,
        plan: result.pendingPlan ? {
          action: result.pendingPlan.action,
          params: result.pendingPlan.params,
          missingFields: result.pendingPlan.missingFields,
        } : undefined,
        data: result.data,
        executedTools: result.executedTools,
        tokenUsage: result.tokenUsage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.auditService.log({
        userId,
        conversationId,
        category: AiAuditCategory.ACTION_FAILED,
        action: 'chat_error',
        success: false,
        errorMessage,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Fallback processing when orchestrator is not available
   */
  private async processWithFallback(
    userId: string,
    conversationId: string,
    message: string,
    context: ToolContext,
  ): Promise<OrchestrationResult> {
    this.logger.warn('Using fallback processing - orchestrator not available');

    // Simple pattern matching for fallback
    const isReadOperation = message.toLowerCase().includes('listar') ||
                           message.toLowerCase().includes('buscar') ||
                           message.toLowerCase().includes('mostrar');

    const isWriteOperation = message.toLowerCase().includes('criar') ||
                            message.toLowerCase().includes('cadastrar') ||
                            message.toLowerCase().includes('enviar') ||
                            message.toLowerCase().includes('cobrar');

    if (isReadOperation) {
      return {
        message: 'Aqui estão os resultados da sua busca. [Modo fallback - configure LLM_PROVIDER para usar LLM real]',
        state: ConversationState.IDLE,
        data: { placeholder: true, note: 'LLM not configured' },
        tokenUsage: { input: 100, output: 50, total: 150 },
      };
    }

    if (isWriteOperation) {
      return {
        message: 'Por favor, configure um provedor LLM (ANTHROPIC_API_KEY ou OPENAI_API_KEY) para executar operações de escrita.',
        state: ConversationState.IDLE,
        tokenUsage: { input: 50, output: 30, total: 80 },
      };
    }

    return {
      message: 'Olá! Sou o AI Copilot do Auvo. Posso ajudar você a gerenciar clientes, orçamentos, ordens de serviço e cobranças. O que você gostaria de fazer?',
      state: ConversationState.IDLE,
      tokenUsage: { input: 50, output: 30, total: 80 },
    };
  }

  /**
   * Confirm a pending plan
   */
  async confirmPlan(userId: string, planId: string, context: Partial<ToolContext>) {
    const toolContext: ToolContext = {
      userId,
      conversationId: '',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    return this.planService.confirmPlan(planId, userId, toolContext);
  }

  /**
   * Reject a pending plan
   */
  async rejectPlan(userId: string, planId: string, context: Partial<ToolContext>) {
    const toolContext: ToolContext = {
      userId,
      conversationId: '',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    return this.planService.rejectPlan(planId, userId, toolContext);
  }

  /**
   * Get pending plans for a user
   */
  async getPendingPlans(userId: string) {
    return this.planService.getPendingPlans(userId);
  }

  /**
   * Get conversation history
   */
  async getConversation(userId: string, conversationId: string) {
    return this.conversationService.getConversation(conversationId, userId);
  }

  /**
   * Get recent conversations
   */
  async getRecentConversations(userId: string, limit = 10) {
    return this.conversationService.getRecentConversations(userId, limit);
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(userId: string): Promise<void> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Count recent requests
    const recentRequestCount = await this.prisma.aiMessage.count({
      where: {
        conversation: { userId },
        role: 'user',
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentRequestCount >= MAX_REQUESTS_PER_MINUTE) {
      await this.auditService.log({
        userId,
        category: AiAuditCategory.RATE_LIMIT,
        action: 'requests_per_minute_exceeded',
        success: false,
        errorMessage: `Exceeded ${MAX_REQUESTS_PER_MINUTE} requests per minute`,
      });

      throw new BadRequestException(
        'Você está enviando muitas mensagens. Por favor, aguarde um momento.',
      );
    }

    // Count failed requests in the last hour
    const failedCount = await this.auditService.countFailedOperations(userId, 60 * 60 * 1000);

    if (failedCount >= MAX_FAILED_REQUESTS_PER_HOUR) {
      await this.auditService.log({
        userId,
        category: AiAuditCategory.RATE_LIMIT,
        action: 'failed_requests_exceeded',
        success: false,
        errorMessage: `Exceeded ${MAX_FAILED_REQUESTS_PER_HOUR} failed requests per hour`,
      });

      throw new BadRequestException(
        'Muitas operações falharam recentemente. Por favor, tente novamente mais tarde.',
      );
    }
  }

  /**
   * Execute a tool directly (for read operations)
   */
  async executeTool(
    userId: string,
    toolName: string,
    params: Record<string, unknown>,
    context: Partial<ToolContext>,
  ): Promise<ToolResult> {
    const tool = this.toolRegistry.getTool(toolName);

    if (!tool) {
      return { success: false, error: 'Tool not found' };
    }

    // Only allow direct execution for read operations
    if (this.toolRegistry.requiresConfirmation(toolName)) {
      return {
        success: false,
        error: 'This operation requires confirmation. Please use the chat interface.',
      };
    }

    const toolContext: ToolContext = {
      userId,
      conversationId: '',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    };

    return this.toolRegistry.executeTool(toolName, params, toolContext);
  }
}
