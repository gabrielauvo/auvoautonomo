/**
 * LLM Provider Interface
 * Abstraction for different LLM providers
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface ILLMProvider {
  /**
   * Provider name for logging
   */
  readonly name: string;

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Generate a completion
   */
  complete(request: LLMCompletionRequest): Promise<LLMResponse>;
}

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  provider: 'anthropic' | 'openai' | 'fake';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
