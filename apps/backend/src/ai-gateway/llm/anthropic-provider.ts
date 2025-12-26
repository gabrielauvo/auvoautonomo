/**
 * Anthropic LLM Provider
 * Integration with Claude API
 */

import { Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMResponse,
  LLMMessage,
  LLMToolDefinition,
} from './llm-provider.interface';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string }>;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('Anthropic API key not configured');
    }

    try {
      const { messages, tools, temperature = 0.7, maxTokens = 4096 } = request;

      // Convert messages to Anthropic format
      const { system, anthropicMessages } = this.convertMessages(messages);

      // Convert tools to Anthropic format
      const anthropicTools = tools?.map(this.convertTool);

      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: maxTokens,
        messages: anthropicMessages,
      };

      if (system) {
        body.system = system;
      }

      if (anthropicTools?.length) {
        body.tools = anthropicTools;
      }

      if (temperature !== undefined) {
        body.temperature = temperature;
      }

      this.logger.debug(`Calling Anthropic API with model ${this.model}`);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Anthropic API error: ${response.status} - ${error}`);
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = (await response.json()) as AnthropicResponse;

      return this.convertResponse(data);
    } catch (error) {
      this.logger.error(`Anthropic completion failed: ${error}`);
      throw error;
    }
  }

  private convertMessages(messages: LLMMessage[]): {
    system: string | undefined;
    anthropicMessages: AnthropicMessage[];
  } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    return { system, anthropicMessages };
  }

  private convertTool(tool: LLMToolDefinition): AnthropicTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    };
  }

  private convertResponse(response: AnthropicResponse): LLMResponse {
    const textContent = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    const toolCalls = response.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id!,
        name: c.name!,
        arguments: c.input || {},
      }));

    let finishReason: LLMResponse['finishReason'] = 'stop';
    if (response.stop_reason === 'tool_use') {
      finishReason = 'tool_calls';
    } else if (response.stop_reason === 'max_tokens') {
      finishReason = 'length';
    }

    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason,
    };
  }
}
