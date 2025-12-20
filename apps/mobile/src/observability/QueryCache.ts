/**
 * Query Cache
 *
 * Cache de queries para memoização de resultados com TTL,
 * invalidação por entidade e eviction policy.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  entity?: string;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  currentSize: number;
  maxSize: number;
  entryCount: number;
}

export interface CacheOptions {
  maxSize?: number; // Max size in bytes (rough estimate)
  defaultTtl?: number; // Default TTL in ms
  onEvict?: (key: string) => void;
}

// =============================================================================
// CACHE CLASS
// =============================================================================

class QueryCacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number = 50 * 1024 * 1024; // 50MB default
  private defaultTtl: number = 60 * 1000; // 1 minute default
  private currentSize: number = 0;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    currentSize: 0,
    maxSize: this.maxSize,
    entryCount: 0,
  };
  private onEvict?: (key: string) => void;

  constructor(options?: CacheOptions) {
    if (options) {
      this.configure(options);
    }
  }

  /**
   * Configure cache options
   */
  configure(options: CacheOptions): void {
    if (options.maxSize !== undefined) {
      this.maxSize = options.maxSize;
      this.stats.maxSize = options.maxSize;
    }
    if (options.defaultTtl !== undefined) {
      this.defaultTtl = options.defaultTtl;
    }
    if (options.onEvict) {
      this.onEvict = options.onEvict;
    }
  }

  // =============================================================================
  // CACHE OPERATIONS
  // =============================================================================

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set cached value
   */
  set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; entity?: string }
  ): void {
    const ttl = options?.ttl ?? this.defaultTtl;
    const size = this.estimateSize(data);

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const old = this.cache.get(key)!;
      this.currentSize -= old.size;
    }

    // Evict if needed
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
      entity: options?.entity,
      size,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
    this.currentSize += size;
    this.updateStats();
  }

  /**
   * Delete cached value
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      this.updateStats();
      return true;
    }
    return false;
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or set cached value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: { ttl?: number; entity?: string }
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, options);
    return data;
  }

  /**
   * Get or set cached value (sync)
   */
  getOrSetSync<T>(
    key: string,
    factory: () => T,
    options?: { ttl?: number; entity?: string }
  ): T {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = factory();
    this.set(key, data, options);
    return data;
  }

  // =============================================================================
  // INVALIDATION
  // =============================================================================

  /**
   * Invalidate all entries for an entity
   */
  invalidateEntity(entity: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.entity === entity) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Invalidate all entries
   */
  invalidateAll(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.updateStats();
  }

  // =============================================================================
  // EVICTION
  // =============================================================================

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;

      if (this.onEvict) {
        this.onEvict(oldestKey);
      }
    }
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.delete(key);
        count++;
      }
    }

    return count;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private estimateSize(data: unknown): number {
    // Rough estimate of object size in bytes
    try {
      return JSON.stringify(data).length * 2; // UTF-16
    } catch {
      return 1000; // Default estimate
    }
  }

  private updateStats(): void {
    this.stats.currentSize = this.currentSize;
    this.stats.entryCount = this.cache.size;
  }

  // =============================================================================
  // STATS
  // =============================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.invalidateAll();
    this.resetStats();
  }

  // =============================================================================
  // UTILITY
  // =============================================================================

  /**
   * Create a cache key from parts
   */
  static createKey(...parts: Array<string | number | boolean | null | undefined>): string {
    return parts
      .map((p) => (p === null || p === undefined ? '' : String(p)))
      .join(':');
  }

  /**
   * Create a cache key for a screen query
   */
  static screenKey(
    screen: string,
    query: string,
    params?: Record<string, unknown>
  ): string {
    const paramsStr = params ? JSON.stringify(params) : '';
    return `screen:${screen}:${query}:${paramsStr}`;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const queryCache = new QueryCacheManager();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const cacheGet = queryCache.get.bind(queryCache);
export const cacheSet = queryCache.set.bind(queryCache);
export const cacheDelete = queryCache.delete.bind(queryCache);
export const cacheHas = queryCache.has.bind(queryCache);
export const cacheGetOrSet = queryCache.getOrSet.bind(queryCache);
export const invalidateEntity = queryCache.invalidateEntity.bind(queryCache);
export const invalidateAll = queryCache.invalidateAll.bind(queryCache);
export const createCacheKey = QueryCacheManager.createKey;
export const screenCacheKey = QueryCacheManager.screenKey;

export default queryCache;
