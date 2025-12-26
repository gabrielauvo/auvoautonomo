/**
 * Embedding Cache Service
 * Caches frequently queried embeddings to reduce API calls and improve performance
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface CachedEmbedding {
  embedding: number[];
  model: string;
  fromCache: boolean;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

@Injectable()
export class KbEmbeddingCacheService {
  private readonly logger = new Logger(KbEmbeddingCacheService.name);
  private readonly cacheTtlMs: number;
  private readonly maxCacheSize: number;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Cache TTL in milliseconds (default: 24 hours)
    this.cacheTtlMs = this.config.get<number>('KB_CACHE_TTL_MS') || 24 * 60 * 60 * 1000;
    // Maximum cache entries (default: 10000)
    this.maxCacheSize = this.config.get<number>('KB_CACHE_MAX_SIZE') || 10000;
    // Enable/disable cache (default: true)
    this.enabled = this.config.get<boolean>('KB_CACHE_ENABLED') !== false;

    if (this.enabled) {
      this.logger.log(`Embedding cache initialized (TTL: ${this.cacheTtlMs}ms, Max: ${this.maxCacheSize} entries)`);
    } else {
      this.logger.log('Embedding cache is disabled');
    }
  }

  /**
   * Generate SHA256 hash of text for cache key
   */
  hashText(text: string): string {
    const normalized = text.toLowerCase().trim();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Get embedding from cache if exists and not expired
   */
  async get(text: string): Promise<CachedEmbedding | null> {
    if (!this.enabled) {
      return null;
    }

    const textHash = this.hashText(text);

    try {
      const cached = await this.prisma.kbEmbeddingCache.findUnique({
        where: { textHash },
      });

      if (!cached) {
        return null;
      }

      // Check if expired
      if (cached.expiresAt < new Date()) {
        // Delete expired entry asynchronously
        this.deleteExpired(textHash).catch((err) =>
          this.logger.error(`Failed to delete expired cache entry: ${err}`),
        );
        return null;
      }

      // Update hit count and last accessed time asynchronously
      this.updateHitStats(textHash).catch((err) =>
        this.logger.error(`Failed to update cache stats: ${err}`),
      );

      this.logger.debug(`Cache hit for text hash: ${textHash.substring(0, 8)}...`);

      return {
        embedding: cached.embedding,
        model: cached.model,
        fromCache: true,
      };
    } catch (error) {
      this.logger.error(`Cache get error: ${error}`);
      return null;
    }
  }

  /**
   * Store embedding in cache
   */
  async set(text: string, embedding: number[], model: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const textHash = this.hashText(text);
    const expiresAt = new Date(Date.now() + this.cacheTtlMs);

    try {
      await this.prisma.kbEmbeddingCache.upsert({
        where: { textHash },
        create: {
          textHash,
          embedding,
          model,
          expiresAt,
          hitCount: 0,
        },
        update: {
          embedding,
          model,
          expiresAt,
          lastAccessedAt: new Date(),
        },
      });

      this.logger.debug(`Cached embedding for text hash: ${textHash.substring(0, 8)}...`);

      // Check if we need to evict old entries
      await this.evictIfNeeded();
    } catch (error) {
      this.logger.error(`Cache set error: ${error}`);
    }
  }

  /**
   * Get multiple embeddings from cache (batch)
   */
  async getMany(texts: string[]): Promise<Map<string, CachedEmbedding>> {
    if (!this.enabled || texts.length === 0) {
      return new Map();
    }

    const hashes = texts.map((t) => this.hashText(t));
    const result = new Map<string, CachedEmbedding>();

    try {
      const cached = await this.prisma.kbEmbeddingCache.findMany({
        where: {
          textHash: { in: hashes },
          expiresAt: { gt: new Date() },
        },
      });

      for (const entry of cached) {
        const textIndex = hashes.indexOf(entry.textHash);
        if (textIndex !== -1) {
          result.set(texts[textIndex], {
            embedding: entry.embedding,
            model: entry.model,
            fromCache: true,
          });

          // Update hit stats asynchronously
          this.updateHitStats(entry.textHash).catch(() => {});
        }
      }

      this.logger.debug(`Cache batch: ${result.size}/${texts.length} hits`);
    } catch (error) {
      this.logger.error(`Cache getMany error: ${error}`);
    }

    return result;
  }

  /**
   * Store multiple embeddings in cache (batch)
   */
  async setMany(
    entries: Array<{ text: string; embedding: number[]; model: string }>,
  ): Promise<void> {
    if (!this.enabled || entries.length === 0) {
      return;
    }

    const expiresAt = new Date(Date.now() + this.cacheTtlMs);

    try {
      // Use transaction for batch insert
      await this.prisma.$transaction(
        entries.map((entry) => {
          const textHash = this.hashText(entry.text);
          return this.prisma.kbEmbeddingCache.upsert({
            where: { textHash },
            create: {
              textHash,
              embedding: entry.embedding,
              model: entry.model,
              expiresAt,
              hitCount: 0,
            },
            update: {
              embedding: entry.embedding,
              model: entry.model,
              expiresAt,
              lastAccessedAt: new Date(),
            },
          });
        }),
      );

      this.logger.debug(`Cached ${entries.length} embeddings`);

      // Check if we need to evict old entries
      await this.evictIfNeeded();
    } catch (error) {
      this.logger.error(`Cache setMany error: ${error}`);
    }
  }

  /**
   * Delete a specific cache entry
   */
  async delete(text: string): Promise<boolean> {
    const textHash = this.hashText(text);
    return this.deleteExpired(textHash);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<number> {
    try {
      const result = await this.prisma.kbEmbeddingCache.deleteMany({});
      this.logger.log(`Cleared ${result.count} cache entries`);
      return result.count;
    } catch (error) {
      this.logger.error(`Cache clear error: ${error}`);
      return 0;
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.kbEmbeddingCache.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired cache entries`);
      }

      return result.count;
    } catch (error) {
      this.logger.error(`Cache cleanup error: ${error}`);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const [count, totalHits, oldest, newest] = await Promise.all([
        this.prisma.kbEmbeddingCache.count(),
        this.prisma.kbEmbeddingCache.aggregate({
          _sum: { hitCount: true },
        }),
        this.prisma.kbEmbeddingCache.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.kbEmbeddingCache.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      return {
        totalEntries: count,
        totalHits: totalHits._sum.hitCount || 0,
        oldestEntry: oldest?.createdAt || null,
        newestEntry: newest?.createdAt || null,
      };
    } catch (error) {
      this.logger.error(`Cache stats error: ${error}`);
      return {
        totalEntries: 0,
        totalHits: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Delete expired entry by hash
   */
  private async deleteExpired(textHash: string): Promise<boolean> {
    try {
      await this.prisma.kbEmbeddingCache.delete({
        where: { textHash },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update hit statistics
   */
  private async updateHitStats(textHash: string): Promise<void> {
    await this.prisma.kbEmbeddingCache.update({
      where: { textHash },
      data: {
        hitCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Evict old entries if cache is full
   */
  private async evictIfNeeded(): Promise<void> {
    try {
      const count = await this.prisma.kbEmbeddingCache.count();

      if (count > this.maxCacheSize) {
        // Delete oldest 10% of entries based on last access time
        const toDelete = Math.ceil(this.maxCacheSize * 0.1);

        const oldestEntries = await this.prisma.kbEmbeddingCache.findMany({
          orderBy: { lastAccessedAt: 'asc' },
          take: toDelete,
          select: { id: true },
        });

        await this.prisma.kbEmbeddingCache.deleteMany({
          where: {
            id: { in: oldestEntries.map((e) => e.id) },
          },
        });

        this.logger.log(`Evicted ${oldestEntries.length} old cache entries`);
      }
    } catch (error) {
      this.logger.error(`Cache eviction error: ${error}`);
    }
  }
}
