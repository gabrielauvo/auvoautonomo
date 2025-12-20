/**
 * Image Cache
 *
 * Cache de imagens em disco para:
 * - Logos, avatares, e imagens de perfil
 * - Fotos de checklist
 * - Assinaturas
 *
 * Features:
 * - Armazenamento em disco persistente
 * - LRU eviction
 * - Tamanho máximo configurável
 * - Prefetch de imagens
 */

import * as FileSystem from 'expo-file-system';
import { logger } from '../observability/Logger';
import { perf } from '../observability/perf';

// =============================================================================
// TYPES
// =============================================================================

export interface CachedImage {
  uri: string;
  localPath: string;
  size: number;
  timestamp: number;
  lastAccessed: number;
}

export interface ImageCacheConfig {
  maxSizeBytes: number; // Max total cache size (50MB default - reduzido para economizar espaço)
  maxItems: number; // Max number of cached items (500 default)
  maxAgeDays: number; // Max age in days before auto cleanup (default 7)
  cacheDirectory: string;
}

export interface CacheStats {
  totalSize: number;
  itemCount: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
}

// =============================================================================
// IMAGE CACHE CLASS
// =============================================================================

class ImageCacheManager {
  private cache: Map<string, CachedImage> = new Map();
  private config: ImageCacheConfig = {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB - reduzido para economizar espaço
    maxItems: 500,
    maxAgeDays: 7, // Limpar imagens antigas após 7 dias
    cacheDirectory: '',
  };
  private currentSize = 0;
  private hitCount = 0;
  private missCount = 0;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      this.config.cacheDirectory = `${FileSystem.cacheDirectory}image_cache/`;

      // Create cache directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(this.config.cacheDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.config.cacheDirectory, {
          intermediates: true,
        });
      }

      // Load existing cache index
      await this.loadCacheIndex();

      // Limpar cache antigo na inicialização
      await this.clearOldCache(this.config.maxAgeDays);

      // Configurar limpeza automática diária
      this.startAutoCleanup();

      this.initialized = true;
      logger.info('ImageCache: Initialized', {
        cacheDir: this.config.cacheDirectory,
        itemCount: this.cache.size,
        totalSize: this.currentSize,
        maxSizeMB: this.config.maxSizeBytes / (1024 * 1024),
      });
    } catch (error) {
      logger.error('ImageCache: Initialization failed', { error: String(error) });
      throw error;
    }
  }

  /**
   * Iniciar limpeza automática diária
   */
  private startAutoCleanup(): void {
    // Limpar a cada 24 horas
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

    this.cleanupIntervalId = setInterval(() => {
      this.clearOldCache(this.config.maxAgeDays).catch((error) => {
        logger.error('ImageCache: Auto cleanup failed', { error: String(error) });
      });
    }, CLEANUP_INTERVAL);
  }

  /**
   * Parar limpeza automática
   */
  private stopAutoCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  // =============================================================================
  // CACHE OPERATIONS
  // =============================================================================

  /**
   * Get cached image URI (returns local path if cached, null otherwise)
   */
  async getCachedUri(uri: string): Promise<string | null> {
    await this.initialize();

    const key = this.getKey(uri);
    const cached = this.cache.get(key);

    if (!cached) {
      this.missCount++;
      return null;
    }

    // Verify file still exists
    const fileInfo = await FileSystem.getInfoAsync(cached.localPath);
    if (!fileInfo.exists) {
      this.cache.delete(key);
      this.currentSize -= cached.size;
      this.missCount++;
      return null;
    }

    // Update last accessed time
    cached.lastAccessed = Date.now();
    this.hitCount++;

    return cached.localPath;
  }

  /**
   * Get or download image (returns local path)
   */
  async getOrDownload(uri: string): Promise<string> {
    await this.initialize();

    // Check cache first
    const cached = await this.getCachedUri(uri);
    if (cached) {
      return cached;
    }

    // Download and cache
    return this.downloadAndCache(uri);
  }

  /**
   * Download and cache an image
   */
  async downloadAndCache(uri: string): Promise<string> {
    await this.initialize();

    const key = this.getKey(uri);
    const fileName = this.generateFileName(uri);
    const localPath = `${this.config.cacheDirectory}${fileName}`;

    const timer = perf.startTimer('image_cache_download');

    try {
      // Download image
      const downloadResult = await FileSystem.downloadAsync(uri, localPath);

      if (downloadResult.status !== 200) {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      const size = (fileInfo as any).size || 0;

      // Evict if necessary
      await this.evictIfNeeded(size);

      // Add to cache
      const cachedImage: CachedImage = {
        uri,
        localPath,
        size,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      };

      this.cache.set(key, cachedImage);
      this.currentSize += size;

      // Save cache index
      await this.saveCacheIndex();

      timer.stop();
      logger.debug('ImageCache: Downloaded and cached', { uri, size });

      return localPath;
    } catch (error) {
      timer.stop();
      logger.error('ImageCache: Download failed', { uri, error: String(error) });

      // Clean up partial download
      try {
        await FileSystem.deleteAsync(localPath, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Prefetch multiple images
   */
  async prefetch(uris: string[]): Promise<void> {
    await this.initialize();

    const uncached = uris.filter((uri) => !this.cache.has(this.getKey(uri)));

    if (uncached.length === 0) return;

    logger.debug('ImageCache: Prefetching images', { count: uncached.length });

    // Download in parallel with concurrency limit
    const concurrency = 3;
    for (let i = 0; i < uncached.length; i += concurrency) {
      const batch = uncached.slice(i, i + concurrency);
      await Promise.allSettled(batch.map((uri) => this.downloadAndCache(uri)));
    }
  }

  /**
   * Check if an image is cached
   */
  isCached(uri: string): boolean {
    return this.cache.has(this.getKey(uri));
  }

  /**
   * Remove an image from cache
   */
  async remove(uri: string): Promise<void> {
    await this.initialize();

    const key = this.getKey(uri);
    const cached = this.cache.get(key);

    if (!cached) return;

    try {
      await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
    } catch {
      // Ignore delete errors
    }

    this.cache.delete(key);
    this.currentSize -= cached.size;
    await this.saveCacheIndex();
  }

  /**
   * Clear all cached images
   */
  async clear(): Promise<void> {
    await this.initialize();

    try {
      // Parar limpeza automática
      this.stopAutoCleanup();

      // Delete all files in cache directory
      await FileSystem.deleteAsync(this.config.cacheDirectory, { idempotent: true });

      // Recreate directory
      await FileSystem.makeDirectoryAsync(this.config.cacheDirectory, {
        intermediates: true,
      });

      this.cache.clear();
      this.currentSize = 0;
      this.hitCount = 0;
      this.missCount = 0;

      // Reiniciar limpeza automática
      this.startAutoCleanup();

      logger.info('ImageCache: Cleared');
    } catch (error) {
      logger.error('ImageCache: Clear failed', { error: String(error) });
    }
  }

  /**
   * Limpar cache antigo (imagens não acessadas há mais de N dias)
   */
  async clearOldCache(daysOld: number = 30): Promise<number> {
    await this.initialize();

    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    const toDelete: string[] = [];

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastAccessed < cutoffTime) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      const cached = this.cache.get(key);
      if (cached) {
        try {
          await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
          this.cache.delete(key);
          this.currentSize -= cached.size;
          deletedCount++;
        } catch (error) {
          logger.warn('ImageCache: Failed to delete old cache file', {
            uri: cached.uri,
            error: String(error),
          });
        }
      }
    }

    await this.saveCacheIndex();

    logger.info('ImageCache: Cleared old cache', {
      daysOld,
      deletedCount,
      remainingCount: this.cache.size,
    });

    return deletedCount;
  }

  // =============================================================================
  // EVICTION
  // =============================================================================

  private async evictIfNeeded(requiredSpace: number): Promise<void> {
    // Check item count limit
    while (this.cache.size >= this.config.maxItems) {
      await this.evictLRU();
    }

    // Check size limit
    while (this.currentSize + requiredSpace > this.config.maxSizeBytes && this.cache.size > 0) {
      await this.evictLRU();
    }
  }

  private async evictLRU(): Promise<void> {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, cached] of this.cache.entries()) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const cached = this.cache.get(oldestKey)!;
      try {
        await FileSystem.deleteAsync(cached.localPath, { idempotent: true });
      } catch {
        // Ignore delete errors
      }

      this.cache.delete(oldestKey);
      this.currentSize -= cached.size;

      logger.debug('ImageCache: Evicted LRU', { uri: cached.uri });
    }
  }

  // =============================================================================
  // PERSISTENCE
  // =============================================================================

  private async loadCacheIndex(): Promise<void> {
    const indexPath = `${this.config.cacheDirectory}.index.json`;

    try {
      const indexInfo = await FileSystem.getInfoAsync(indexPath);
      if (!indexInfo.exists) return;

      const content = await FileSystem.readAsStringAsync(indexPath);
      const entries: CachedImage[] = JSON.parse(content);

      // Verify each cached file exists
      for (const entry of entries) {
        const fileInfo = await FileSystem.getInfoAsync(entry.localPath);
        if (fileInfo.exists) {
          this.cache.set(this.getKey(entry.uri), entry);
          this.currentSize += entry.size;
        }
      }
    } catch (error) {
      logger.warn('ImageCache: Failed to load index', { error: String(error) });
    }
  }

  private async saveCacheIndex(): Promise<void> {
    const indexPath = `${this.config.cacheDirectory}.index.json`;

    try {
      const entries = Array.from(this.cache.values());
      await FileSystem.writeAsStringAsync(indexPath, JSON.stringify(entries));
    } catch (error) {
      logger.warn('ImageCache: Failed to save index', { error: String(error) });
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private getKey(uri: string): string {
    // Create a hash-like key from URI
    let hash = 0;
    for (let i = 0; i < uri.length; i++) {
      const char = uri.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `img_${Math.abs(hash).toString(36)}`;
  }

  private generateFileName(uri: string): string {
    const key = this.getKey(uri);
    const ext = this.getExtension(uri);
    return `${key}${ext}`;
  }

  private getExtension(uri: string): string {
    const match = uri.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  }

  // =============================================================================
  // STATS
  // =============================================================================

  getStats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      totalSize: this.currentSize,
      itemCount: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
    };
  }

  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
  }

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  configure(config: Partial<ImageCacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const imageCache = new ImageCacheManager();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const getCachedImageUri = imageCache.getCachedUri.bind(imageCache);
export const getOrDownloadImage = imageCache.getOrDownload.bind(imageCache);
export const prefetchImages = imageCache.prefetch.bind(imageCache);
export const isImageCached = imageCache.isCached.bind(imageCache);
export const removeImageFromCache = imageCache.remove.bind(imageCache);
export const clearImageCache = imageCache.clear.bind(imageCache);
export const getImageCacheStats = imageCache.getStats.bind(imageCache);

export default imageCache;
