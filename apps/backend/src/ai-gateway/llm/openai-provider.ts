/**
 * OpenAI LLM Provider
 * Integration with OpenAI API (GPT-4, etc.)
 */

import { Logger } from '@nestjs/common';
import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMResponse,
  LLMMessage,
  LLMToolDefinition,
} from './llm-provider.interface';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements ILLMProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const { messages, tools, temperature = 0.7, maxTokens = 4096 } = request;

      // Convert messages to OpenAI format
      const openaiMessages = this.convertMessages(messages);

      // Convert tools to OpenAI format
      const openaiTools = tools?.map(this.convertTool);

      const body: Record<string, unknown> = {
        model: this.model,
        messages: openaiMessages,
        max_tokens: maxTokens,
        temperature,
      };

      if (openaiTools?.length) {
        body.tools = openaiTools;
        body.tool_choice = 'auto';
      }

      this.logger.debug(`Calling OpenAI API with model ${this.model}`);

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`OpenAI API error: ${response.status} - ${error}`);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenAIResponse;

      return this.convertResponse(data);
    } catch (error) {
      this.logger.error(`OpenAI completion failed: ${error}`);
      throw error;
    }
  }

  private convertMessages(messages: LLMMessage[]): OpenAIMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private convertTool(tool: LLMToolDefinition): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    };
  }

  private convertResponse(response: OpenAIResponse): LLMResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No completion choice returned');
    }

    const message = choice.message;
    const content = message.content || '';

    const toolCalls = message.tool_calls?.map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        this.logger.warn(`Failed to parse tool arguments: ${tc.function.arguments}`);
      }

      return {
        id: tc.id,
        name: tc.function.name,
        arguments: args,
      };
    });

    return {
      content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      finishReason: choice.finish_reason,
    };
  }
}
