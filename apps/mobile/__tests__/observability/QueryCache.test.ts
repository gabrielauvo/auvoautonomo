/**
 * Query Cache Tests
 */

import {
  queryCache,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheHas,
  cacheGetOrSet,
  invalidateEntity,
  invalidateAll,
  createCacheKey,
  screenCacheKey,
} from '../../src/observability/QueryCache';

describe('QueryCache', () => {
  beforeEach(() => {
    queryCache.clear();
    queryCache.resetStats();
  });

  describe('basic operations', () => {
    it('should set and get cached values', () => {
      cacheSet('test-key', { data: 'test-value' });

      const result = cacheGet<{ data: string }>('test-key');

      expect(result).toBeDefined();
      expect(result?.data).toBe('test-value');
    });

    it('should return null for missing keys', () => {
      const result = cacheGet('missing-key');

      expect(result).toBeNull();
    });

    it('should delete cached values', () => {
      cacheSet('delete-key', 'value');
      expect(cacheHas('delete-key')).toBe(true);

      cacheDelete('delete-key');

      expect(cacheHas('delete-key')).toBe(false);
    });

    it('should check key existence', () => {
      expect(cacheHas('check-key')).toBe(false);

      cacheSet('check-key', 'value');

      expect(cacheHas('check-key')).toBe(true);
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      cacheSet('ttl-key', 'value', { ttl: 50 }); // 50ms TTL

      expect(cacheGet('ttl-key')).toBe('value');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(cacheGet('ttl-key')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      queryCache.configure({ defaultTtl: 1000 });

      cacheSet('default-ttl-key', 'value');

      // Should still be available
      expect(cacheGet('default-ttl-key')).toBe('value');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cacheSet('existing-key', 'cached');

      const factoryMock = jest.fn().mockResolvedValue('new');

      const result = await cacheGetOrSet('existing-key', factoryMock);

      expect(result).toBe('cached');
      expect(factoryMock).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factoryMock = jest.fn().mockResolvedValue('new-value');

      const result = await cacheGetOrSet('new-key', factoryMock);

      expect(result).toBe('new-value');
      expect(factoryMock).toHaveBeenCalledTimes(1);

      // Should be cached now
      const cachedResult = await cacheGetOrSet('new-key', factoryMock);
      expect(cachedResult).toBe('new-value');
      expect(factoryMock).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('entity invalidation', () => {
    it('should invalidate all entries for an entity', () => {
      cacheSet('client-1', 'data1', { entity: 'clients' });
      cacheSet('client-2', 'data2', { entity: 'clients' });
      cacheSet('order-1', 'data3', { entity: 'orders' });

      const invalidated = invalidateEntity('clients');

      expect(invalidated).toBe(2);
      expect(cacheHas('client-1')).toBe(false);
      expect(cacheHas('client-2')).toBe(false);
      expect(cacheHas('order-1')).toBe(true);
    });
  });

  describe('pattern invalidation', () => {
    it('should invalidate entries matching pattern', () => {
      cacheSet('user:1:profile', 'data1');
      cacheSet('user:1:settings', 'data2');
      cacheSet('user:2:profile', 'data3');

      const invalidated = queryCache.invalidatePattern(/^user:1:/);

      expect(invalidated).toBe(2);
      expect(cacheHas('user:1:profile')).toBe(false);
      expect(cacheHas('user:1:settings')).toBe(false);
      expect(cacheHas('user:2:profile')).toBe(true);
    });
  });

  describe('invalidateAll', () => {
    it('should clear all entries', () => {
      cacheSet('key1', 'value1');
      cacheSet('key2', 'value2');
      cacheSet('key3', 'value3');

      invalidateAll();

      expect(cacheHas('key1')).toBe(false);
      expect(cacheHas('key2')).toBe(false);
      expect(cacheHas('key3')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cacheSet('stats-key', 'value');

      cacheGet('stats-key'); // hit
      cacheGet('stats-key'); // hit
      cacheGet('missing');   // miss

      const stats = queryCache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      cacheSet('rate-key', 'value');

      cacheGet('rate-key'); // hit
      cacheGet('rate-key'); // hit
      cacheGet('rate-key'); // hit
      cacheGet('missing');   // miss

      const hitRate = queryCache.getHitRate();

      expect(hitRate).toBe(0.75);
    });
  });

  describe('key helpers', () => {
    it('should create cache keys from parts', () => {
      const key = createCacheKey('user', 123, 'profile');

      expect(key).toBe('user:123:profile');
    });

    it('should handle null and undefined in key parts', () => {
      const key = createCacheKey('user', null, 'profile', undefined);

      expect(key).toBe('user::profile:');
    });

    it('should create screen-specific keys', () => {
      const key = screenCacheKey('ClientList', 'getAllClients', { page: 1 });

      expect(key).toContain('screen:ClientList');
      expect(key).toContain('getAllClients');
    });
  });

  describe('eviction', () => {
    it('should evict old entries when max size is exceeded', () => {
      queryCache.configure({ maxSize: 100 }); // Very small max size

      // Add entries until eviction occurs
      for (let i = 0; i < 100; i++) {
        cacheSet(`evict-key-${i}`, 'x'.repeat(10));
      }

      // Some older entries should have been evicted
      const stats = queryCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });
});
