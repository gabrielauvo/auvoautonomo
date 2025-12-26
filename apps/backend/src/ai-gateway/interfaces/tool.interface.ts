/**
 * AI Gateway Tool Interfaces
 * Defines the contract for all AI tools
 */

import { AiActionType } from '../enums';

/**
 * Result of a tool execution
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Entities affected by the operation */
  affectedEntities?: AffectedEntity[];
}

/**
 * Entity affected by a tool operation
 */
export interface AffectedEntity {
  type: string;
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'read';
}

/**
 * Context passed to every tool execution
 */
export interface ToolContext {
  userId: string;
  conversationId: string;
  planId?: string;
  /** IP address for audit */
  ipAddress?: string;
  /** User agent for audit */
  userAgent?: string;
  /** Idempotency key for write operations */
  idempotencyKey?: string;
}

/**
 * Tool metadata for registration
 */
export interface ToolMetadata {
  /** Unique tool name (e.g., 'clients.list', 'quotes.create') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Type of action - determines if confirmation is needed */
  actionType: AiActionType;
  /** Required permissions/features for this tool */
  requiredFeatures?: string[];
  /** JSON Schema for parameters */
  parametersSchema: Record<string, unknown>;
  /** If true, requires payment preview before execution */
  requiresPaymentPreview?: boolean;
}

/**
 * Base interface for all AI tools
 */
export interface ITool<TParams = unknown, TResult = unknown> {
  /** Tool metadata */
  readonly metadata: ToolMetadata;

  /**
   * Validate parameters before execution
   * @returns true if valid, error message if invalid
   */
  validate(params: TParams, context: ToolContext): Promise<true | string>;

  /**
   * Execute the tool
   * @param params - Tool parameters
   * @param context - Execution context with userId, etc.
   */
  execute(params: TParams, context: ToolContext): Promise<ToolResult<TResult>>;

  /**
   * Check if user has permission to use this tool
   */
  checkPermission(context: ToolContext): Promise<boolean>;
}

/**
 * Payment preview data for dry-run
 */
export interface PaymentPreviewData {
  clientId: string;
  clientName: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  dueDate: Date;
  description?: string;
}

/**
 * Action in a plan
 */
export interface PlanAction {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  actionType: AiActionType;
  /** For payment actions, the preview data */
  paymentPreview?: PaymentPreviewData;
}

/**
 * Plan summary for confirmation UI
 */
export interface PlanSummary {
  id: string;
  summary: string;
  actions: PlanAction[];
  requiresConfirmation: boolean;
  hasPaymentActions: boolean;
  expiresAt: Date;
}
