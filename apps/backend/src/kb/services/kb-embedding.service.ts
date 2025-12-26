/**
 * Knowledge Base Embedding Service
 * Generates vector embeddings for text using OpenAI or local fallback
 * Includes caching support for frequently queried texts
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KbEmbeddingCacheService } from './kb-embedding-cache.service';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount?: number;
  fromCache?: boolean;
}

@Injectable()
export class KbEmbeddingService {
  private readonly logger = new Logger(KbEmbeddingService.name);
  private readonly openaiApiKey?: string;
  private readonly embeddingModel: string;
  private readonly embeddingDimension: number;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => KbEmbeddingCacheService))
    private readonly cacheService: KbEmbeddingCacheService,
  ) {
    this.openaiApiKey = this.config.get<string>('OPENAI_API_KEY');
    this.embeddingModel = this.config.get<string>('KB_EMBEDDING_MODEL') || 'text-embedding-3-small';
    this.embeddingDimension = this.getModelDimension(this.embeddingModel);

    if (this.openaiApiKey) {
      this.logger.log(`Embedding service initialized with OpenAI model: ${this.embeddingModel}`);
    } else {
      this.logger.warn('No OPENAI_API_KEY found - using simple hash-based embeddings (not recommended for production)');
    }
  }

  /**
   * Get embedding dimension for a model
   */
  private getModelDimension(model: string): number {
    const dimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
    return dimensions[model] || 1536;
  }

  /**
   * Get the dimension of embeddings produced by this service
   */
  getDimension(): number {
    return this.embeddingDimension;
  }

  /**
   * Check if real embeddings are available
   */
  isAvailable(): boolean {
    return !!this.openaiApiKey;
  }

  /**
   * Generate embedding for a single text (with cache support)
   */
  async embed(text: string, useCache = true): Promise<EmbeddingResult> {
    // Try cache first
    if (useCache && this.cacheService.isEnabled()) {
      const cached = await this.cacheService.get(text);
      if (cached) {
        return {
          embedding: cached.embedding,
          model: cached.model,
          fromCache: true,
        };
      }
    }

    // Generate embedding
    const result = this.openaiApiKey
      ? await this.embedWithOpenAI(text)
      : this.embedWithHash(text);

    // Store in cache (async, don't wait)
    if (useCache && this.cacheService.isEnabled()) {
      this.cacheService.set(text, result.embedding, result.model).catch((err) =>
        this.logger.error(`Failed to cache embedding: ${err}`),
      );
    }

    return { ...result, fromCache: false };
  }

  /**
   * Generate embeddings for multiple texts (batch, with cache support)
   */
  async embedBatch(texts: string[], useCache = true): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    const results: EmbeddingResult[] = new Array(texts.length);
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for all texts
    if (useCache && this.cacheService.isEnabled()) {
      const cachedMap = await this.cacheService.getMany(texts);

      for (let i = 0; i < texts.length; i++) {
        const cached = cachedMap.get(texts[i]);
        if (cached) {
          results[i] = {
            embedding: cached.embedding,
            model: cached.model,
            fromCache: true,
          };
        } else {
          uncachedTexts.push(texts[i]);
          uncachedIndices.push(i);
        }
      }

      this.logger.debug(`Batch embed: ${texts.length - uncachedTexts.length}/${texts.length} from cache`);
    } else {
      // No cache, all texts need embedding
      uncachedTexts.push(...texts);
      for (let i = 0; i < texts.length; i++) {
        uncachedIndices.push(i);
      }
    }

    // Generate embeddings for uncached texts
    if (uncachedTexts.length > 0) {
      const newEmbeddings = this.openaiApiKey
        ? await this.embedBatchWithOpenAI(uncachedTexts)
        : uncachedTexts.map((text) => this.embedWithHash(text));

      // Place results in correct positions
      for (let i = 0; i < newEmbeddings.length; i++) {
        const originalIndex = uncachedIndices[i];
        results[originalIndex] = { ...newEmbeddings[i], fromCache: false };
      }

      // Store in cache (async)
      if (useCache && this.cacheService.isEnabled()) {
        const cacheEntries = uncachedTexts.map((text, i) => ({
          text,
          embedding: newEmbeddings[i].embedding,
          model: newEmbeddings[i].model,
        }));
        this.cacheService.setMany(cacheEntries).catch((err) =>
          this.logger.error(`Failed to cache batch embeddings: ${err}`),
        );
      }
    }

    return results;
  }

  /**
   * Generate embedding using OpenAI API
   */
  private async embedWithOpenAI(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatchWithOpenAI([text]);
    return results[0];
  }

  /**
   * Generate embeddings batch using OpenAI API
   */
  private async embedBatchWithOpenAI(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: texts,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return data.data.map((item: { embedding: number[]; index: number }) => ({
        embedding: item.embedding,
        model: this.embeddingModel,
        tokenCount: data.usage?.total_tokens,
      }));
    } catch (error) {
      this.logger.error(`Failed to generate OpenAI embeddings: ${error}`);
      throw error;
    }
  }

  /**
   * Generate simple hash-based embedding (fallback when no API key)
   * This is NOT suitable for production - just for development/testing
   */
  private embedWithHash(text: string): EmbeddingResult {
    // Simple deterministic pseudo-random embedding based on text hash
    const embedding: number[] = new Array(this.embeddingDimension).fill(0);

    // Normalize text
    const normalized = text.toLowerCase().trim();

    // Generate pseudo-random values based on character codes
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash * 31 + normalized.charCodeAt(i)) % 2147483647;
      const idx = hash % this.embeddingDimension;
      embedding[idx] += Math.sin(hash) * 0.1;
    }

    // Add word-based features
    const words = normalized.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let wordHash = 0;
      for (let j = 0; j < word.length; j++) {
        wordHash = (wordHash * 31 + word.charCodeAt(j)) % 2147483647;
      }
      const idx = wordHash % this.embeddingDimension;
      embedding[idx] += 0.1;
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return {
      embedding,
      model: 'hash-fallback',
    };
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Embedding dimensions don't match: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.cacheService.isEnabled()) {
      return null;
    }
    return this.cacheService.getStats();
  }

  /**
   * Clear the embedding cache
   */
  async clearCache(): Promise<number> {
    if (!this.cacheService.isEnabled()) {
      return 0;
    }
    return this.cacheService.clear();
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupCache(): Promise<number> {
    if (!this.cacheService.isEnabled()) {
      return 0;
    }
    return this.cacheService.cleanupExpired();
  }
}
