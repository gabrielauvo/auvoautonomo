/**
 * Tool Registry Service
 * Manages all available AI tools and their execution
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ITool, ToolMetadata, ToolContext, ToolResult } from '../interfaces/tool.interface';
import { AiAuditService } from './ai-audit.service';
import { AiAuditCategory } from '../enums';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, ITool>();

  constructor(private readonly auditService: AiAuditService) {}

  onModuleInit() {
    this.logger.log(`Tool registry initialized with ${this.tools.size} tools`);
  }

  /**
   * Register a tool in the registry
   */
  registerTool(tool: ITool): void {
    const name = tool.metadata.name;
    if (this.tools.has(name)) {
      this.logger.warn(`Tool ${name} already registered, overwriting`);
    }
    this.tools.set(name, tool);
    this.logger.log(`Registered tool: ${name} (${tool.metadata.actionType})`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool metadata for LLM function calling
   */
  getAllToolMetadata(): ToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => tool.metadata);
  }

  /**
   * Get tools available for a specific user based on permissions
   */
  async getAvailableTools(context: ToolContext): Promise<ToolMetadata[]> {
    const available: ToolMetadata[] = [];

    for (const tool of this.tools.values()) {
      const hasPermission = await tool.checkPermission(context);
      if (hasPermission) {
        available.push(tool.metadata);
      }
    }

    return available;
  }

  /**
   * Execute a tool with full validation and audit logging
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolName);

    if (!tool) {
      await this.auditService.log({
        userId: context.userId,
        conversationId: context.conversationId,
        planId: context.planId,
        category: AiAuditCategory.SECURITY_BLOCK,
        tool: toolName,
        action: 'tool_not_found',
        inputPayload: params,
        success: false,
        errorMessage: `Tool '${toolName}' not found`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: `Tool '${toolName}' not found`,
      };
    }

    // Check permission
    const hasPermission = await tool.checkPermission(context);
    if (!hasPermission) {
      await this.auditService.log({
        userId: context.userId,
        conversationId: context.conversationId,
        planId: context.planId,
        category: AiAuditCategory.SECURITY_BLOCK,
        tool: toolName,
        action: 'permission_denied',
        inputPayload: params,
        success: false,
        errorMessage: 'Permission denied for this tool',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: 'Permission denied for this tool',
      };
    }

    // Validate parameters
    const validationResult = await tool.validate(params, context);
    if (validationResult !== true) {
      await this.auditService.log({
        userId: context.userId,
        conversationId: context.conversationId,
        planId: context.planId,
        category: AiAuditCategory.TOOL_CALL,
        tool: toolName,
        action: 'validation_failed',
        inputPayload: params,
        success: false,
        errorMessage: validationResult,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs: Date.now() - startTime,
      });

      return {
        success: false,
        error: validationResult,
      };
    }

    // Execute tool
    try {
      const result = await tool.execute(params, context);
      const durationMs = Date.now() - startTime;

      await this.auditService.log({
        userId: context.userId,
        conversationId: context.conversationId,
        planId: context.planId,
        category: result.success ? AiAuditCategory.ACTION_SUCCESS : AiAuditCategory.ACTION_FAILED,
        tool: toolName,
        action: 'execute',
        entityType: result.affectedEntities?.[0]?.type,
        entityId: result.affectedEntities?.[0]?.id,
        inputPayload: params,
        outputPayload: result.success ? result.data : undefined,
        success: result.success,
        errorMessage: result.error,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Tool ${toolName} execution failed: ${errorMessage}`, error);

      await this.auditService.log({
        userId: context.userId,
        conversationId: context.conversationId,
        planId: context.planId,
        category: AiAuditCategory.ACTION_FAILED,
        tool: toolName,
        action: 'execute_error',
        inputPayload: params,
        success: false,
        errorMessage,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        durationMs,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a tool requires confirmation before execution
   */
  requiresConfirmation(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) return true; // Default to requiring confirmation for unknown tools

    const writeActions = ['CREATE', 'UPDATE', 'DELETE', 'SEND', 'PAYMENT_CREATE', 'PAYMENT_SEND'];
    return writeActions.includes(tool.metadata.actionType);
  }

  /**
   * Check if a tool requires payment preview
   */
  requiresPaymentPreview(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    return tool?.metadata.requiresPaymentPreview ?? false;
  }
}
