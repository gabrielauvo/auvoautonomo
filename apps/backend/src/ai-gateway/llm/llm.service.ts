/**
 * LLM Service
 * Factory and manager for LLM providers
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ILLMProvider,
  LLMCompletionRequest,
  LLMResponse,
  LLMProviderConfig,
} from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { FakeLLMProvider } from './fake-provider';

@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);
  private provider: ILLMProvider;
  private fallbackProvider: ILLMProvider;

  constructor(private readonly configService: ConfigService) {
    // Initialize with fake provider as fallback
    this.fallbackProvider = new FakeLLMProvider();
    this.provider = this.fallbackProvider;
  }

  onModuleInit() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    // Try to configure primary provider
    const providerType = this.configService.get<string>('LLM_PROVIDER') || 'auto';

    this.logger.log(`Initializing LLM provider: ${providerType}`);

    if (providerType === 'fake') {
      this.provider = new FakeLLMProvider();
      this.logger.log('Using FakeLLM provider');
      return;
    }

    // Try Anthropic first
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && (providerType === 'anthropic' || providerType === 'auto')) {
      const anthropic = new AnthropicProvider({
        apiKey: anthropicKey,
        model: this.configService.get<string>('ANTHROPIC_MODEL'),
      });

      if (anthropic.isAvailable()) {
        this.provider = anthropic;
        this.logger.log('Using Anthropic provider');
        return;
      }
    }

    // Try OpenAI
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey && (providerType === 'openai' || providerType === 'auto')) {
      const openai = new OpenAIProvider({
        apiKey: openaiKey,
        model: this.configService.get<string>('OPENAI_MODEL'),
      });

      if (openai.isAvailable()) {
        this.provider = openai;
        this.logger.log('Using OpenAI provider');
        return;
      }
    }

    // Fall back to fake provider
    this.logger.warn('No LLM API keys configured, using FakeLLM provider');
    this.provider = this.fallbackProvider;
  }

  /**
   * Get current provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Check if using real LLM
   */
  isUsingRealLLM(): boolean {
    return this.provider.name !== 'fake';
  }

  /**
   * Complete a request using the configured provider
   */
  async complete(request: LLMCompletionRequest): Promise<LLMResponse> {
    try {
      return await this.provider.complete(request);
    } catch (error) {
      this.logger.error(`LLM completion failed: ${error}`);

      // If using real provider, try fallback
      if (this.provider !== this.fallbackProvider) {
        this.logger.warn('Falling back to FakeLLM provider');
        return await this.fallbackProvider.complete(request);
      }

      throw error;
    }
  }

  /**
   * Create a provider instance manually (for testing)
   */
  createProvider(config: LLMProviderConfig): ILLMProvider {
    switch (config.provider) {
      case 'anthropic':
        return new AnthropicProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
        });
      case 'openai':
        return new OpenAIProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
        });
      case 'fake':
      default:
        return new FakeLLMProvider();
    }
  }
}
