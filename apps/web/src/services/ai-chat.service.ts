/**
 * AI Chat Service
 * Client for AI Copilot chat API
 */

import { api, getErrorMessage } from './api';

// =============================================================================
// Types
// =============================================================================

export type ConversationState =
  | 'IDLE'
  | 'PLANNING'
  | 'AWAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** Plan data if this message contains a plan */
  plan?: PlanData;
  /** Executed tools results */
  executedTools?: ExecutedTool[];
  /** Entity links created */
  entityLinks?: EntityLink[];
}

export interface PlanData {
  action: string;
  params: Record<string, unknown>;
  missingFields: string[];
  summary?: string;
}

export interface ExecutedTool {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface EntityLink {
  type: 'customer' | 'workOrder' | 'quote' | 'charge';
  id: string;
  label: string;
  url: string;
}

export interface ChatContext {
  /** Current page the user is on */
  currentPage: string;
  /** Selected entity ID (if any) */
  entityId?: string;
  /** Entity type */
  entityType?: 'customer' | 'workOrder' | 'quote' | 'charge';
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

export interface SendMessageDto {
  message: string;
  conversationId?: string;
  context?: ChatContext;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  state: ConversationState;
  data?: unknown;
  pendingPlan?: PlanData;
  executedTools?: ExecutedTool[];
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface Conversation {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export class AiChatError extends Error {
  constructor(
    message: string,
    public readonly code: AiChatErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AiChatError';
  }
}

export enum AiChatErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// =============================================================================
// Service
// =============================================================================

class AiChatService {
  private readonly basePath = '/ai';

  /**
   * Send a message to the AI chat
   */
  async sendMessage(dto: SendMessageDto): Promise<ChatResponse> {
    try {
      const response = await api.post<ChatResponse>(`${this.basePath}/chat`, {
        message: dto.message,
        conversationId: dto.conversationId,
        context: dto.context,
      });

      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Send a confirmation for a pending plan
   */
  async confirmPlan(conversationId: string): Promise<ChatResponse> {
    return this.sendMessage({
      message: 'sim, confirmo',
      conversationId,
    });
  }

  /**
   * Cancel a pending plan
   */
  async cancelPlan(conversationId: string): Promise<ChatResponse> {
    return this.sendMessage({
      message: 'cancelar',
      conversationId,
    });
  }

  /**
   * Get conversation history
   */
  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    try {
      const response = await api.get<{ messages: ChatMessage[] }>(
        `${this.basePath}/conversations/${conversationId}`
      );

      return response.data.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * List recent conversations
   */
  async listConversations(limit = 10): Promise<Conversation[]> {
    try {
      const response = await api.get<{ conversations: Conversation[] }>(
        `${this.basePath}/conversations`,
        { params: { limit } }
      );

      return response.data.conversations.map((conv) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
      }));
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(): Promise<{ conversationId: string }> {
    try {
      const response = await api.post<{ conversationId: string }>(
        `${this.basePath}/conversations`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors and convert to AiChatError
   */
  private handleError(error: any): AiChatError {
    // Network error
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return new AiChatError(
          'A requisição demorou muito. Tente novamente.',
          AiChatErrorCode.TIMEOUT
        );
      }
      return new AiChatError(
        'Erro de conexão. Verifique sua internet.',
        AiChatErrorCode.NETWORK_ERROR
      );
    }

    const status = error.response.status;
    const data = error.response.data;

    // Permission denied
    if (status === 403) {
      return new AiChatError(
        data?.message || 'Você não tem permissão para usar o AI Copilot.',
        AiChatErrorCode.PERMISSION_DENIED,
        data
      );
    }

    // Validation error
    if (status === 400) {
      return new AiChatError(
        data?.message || 'Dados inválidos.',
        AiChatErrorCode.VALIDATION_ERROR,
        data?.errors
      );
    }

    // Rate limited
    if (status === 429) {
      return new AiChatError(
        'Muitas requisições. Aguarde um momento.',
        AiChatErrorCode.RATE_LIMITED
      );
    }

    // Server error
    if (status >= 500) {
      return new AiChatError(
        'Erro no servidor. Tente novamente mais tarde.',
        AiChatErrorCode.SERVER_ERROR
      );
    }

    // Unknown error
    return new AiChatError(
      getErrorMessage(error),
      AiChatErrorCode.UNKNOWN,
      data
    );
  }
}

// Export singleton instance
export const aiChatService = new AiChatService();

// Export individual functions for convenience
export const sendMessage = (dto: SendMessageDto) => aiChatService.sendMessage(dto);
export const confirmPlan = (conversationId: string) => aiChatService.confirmPlan(conversationId);
export const cancelPlan = (conversationId: string) => aiChatService.cancelPlan(conversationId);
export const getConversation = (conversationId: string) => aiChatService.getConversation(conversationId);
export const listConversations = (limit?: number) => aiChatService.listConversations(limit);
export const createConversation = () => aiChatService.createConversation();

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build entity link URL based on type and ID
 */
export function buildEntityUrl(type: EntityLink['type'], id: string): string {
  const routes: Record<EntityLink['type'], string> = {
    customer: '/clients',
    workOrder: '/work-orders',
    quote: '/quotes',
    charge: '/billing/charges',
  };
  return `${routes[type]}/${id}`;
}

/**
 * Extract entity links from executed tools results
 */
export function extractEntityLinks(executedTools?: ExecutedTool[]): EntityLink[] {
  if (!executedTools) return [];

  const links: EntityLink[] = [];

  for (const tool of executedTools) {
    if (!tool.success || !tool.result) continue;

    const result = tool.result as Record<string, unknown>;

    // Map tool names to entity types
    if (tool.tool === 'customers.create' && result.id) {
      links.push({
        type: 'customer',
        id: result.id as string,
        label: (result.name as string) || 'Cliente criado',
        url: buildEntityUrl('customer', result.id as string),
      });
    }

    if (tool.tool === 'workOrders.create' && result.id) {
      links.push({
        type: 'workOrder',
        id: result.id as string,
        label: (result.title as string) || 'Ordem de serviço criada',
        url: buildEntityUrl('workOrder', result.id as string),
      });
    }

    if (tool.tool === 'quotes.create' && result.id) {
      links.push({
        type: 'quote',
        id: result.id as string,
        label: (result.title as string) || 'Orçamento criado',
        url: buildEntityUrl('quote', result.id as string),
      });
    }

    if (tool.tool === 'billing.createCharge' && result.id) {
      links.push({
        type: 'charge',
        id: result.id as string,
        label: `Cobrança #${result.id}`,
        url: buildEntityUrl('charge', result.id as string),
      });
    }
  }

  return links;
}

/**
 * Format plan summary for display
 */
export function formatPlanSummary(plan: PlanData): string {
  if (plan.summary) return plan.summary;

  const actionNames: Record<string, string> = {
    'customers.create': 'Criar cliente',
    'workOrders.create': 'Criar ordem de serviço',
    'quotes.create': 'Criar orçamento',
    'billing.previewCharge': 'Preview de cobrança',
    'billing.createCharge': 'Criar cobrança',
  };

  const actionName = actionNames[plan.action] || plan.action;
  const params = Object.entries(plan.params)
    .filter(([k]) => !['idempotencyKey', 'previewId'].includes(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');

  return `${actionName}\n\n${params}`;
}
