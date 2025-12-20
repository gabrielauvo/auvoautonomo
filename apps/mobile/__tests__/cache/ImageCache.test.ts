/**
 * ImageCache Tests
 *
 * Testes para o cache de imagens com LRU eviction.
 */

// Mock expo-file-system
const mockGetInfoAsync = jest.fn();
const mockMakeDirectoryAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDownloadAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('expo-file-system', () => ({
  cacheDirectory: '/cache/',
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  makeDirectoryAsync: (...args: unknown[]) => mockMakeDirectoryAsync(...args),
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
  downloadAsync: (...args: unknown[]) => mockDownloadAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

// Mock Logger
jest.mock('../../src/observability/Logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock perf
jest.mock('../../src/observability/perf', () => ({
  perf: {
    startTimer: jest.fn(() => ({ stop: jest.fn() })),
  },
}));

// Import after mocks
import { imageCache } from '../../src/cache/ImageCache';

describe('ImageCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache state by accessing private properties
    (imageCache as any).cache = new Map();
    (imageCache as any).currentSize = 0;
    (imageCache as any).hitCount = 0;
    (imageCache as any).missCount = 0;
    (imageCache as any).initialized = false;
    (imageCache as any).initPromise = null;
  });

  describe('initialize', () => {
    it('should create cache directory if not exists', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });
      mockMakeDirectoryAsync.mockResolvedValue(undefined);
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false }); // index check

      await imageCache.initialize();

      expect(mockMakeDirectoryAsync).toHaveBeenCalled();
    });

    it('should not create directory if already exists', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true });
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false }); // index check

      await imageCache.initialize();

      expect(mockMakeDirectoryAsync).not.toHaveBeenCalled();
    });

    it('should load existing cache index', async () => {
      const cachedEntries = [
        {
          uri: 'https://example.com/image.jpg',
          localPath: '/cache/image_cache/img_abc.jpg',
          size: 1000,
          timestamp: Date.now(),
          lastAccessed: Date.now(),
        },
      ];

      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: true })  // cache dir
        .mockResolvedValueOnce({ exists: true })  // index file
        .mockResolvedValueOnce({ exists: true }); // cached file
      mockReadAsStringAsync.mockResolvedValue(JSON.stringify(cachedEntries));

      await imageCache.initialize();

      const stats = imageCache.getStats();
      expect(stats.itemCount).toBe(1);
      expect(stats.totalSize).toBe(1000);
    });

    it('should only initialize once', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');

      await Promise.all([
        imageCache.initialize(),
        imageCache.initialize(),
      ]);

      // makeDirectoryAsync should not be called multiple times
      expect(mockGetInfoAsync.mock.calls.length).toBeLessThanOrEqual(4);
    });
  });

  describe('getCachedUri', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should return null for uncached image', async () => {
      const result = await imageCache.getCachedUri('https://example.com/uncached.jpg');

      expect(result).toBeNull();
    });

    it('should return local path for cached image', async () => {
      // Add to cache manually
      const uri = 'https://example.com/cached.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/image_cache/cached.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now() - 1000,
      });

      mockGetInfoAsync.mockResolvedValue({ exists: true });

      const result = await imageCache.getCachedUri(uri);

      expect(result).toBe('/cache/image_cache/cached.jpg');
    });

    it('should remove from cache if file no longer exists', async () => {
      const uri = 'https://example.com/deleted.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/image_cache/deleted.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });
      (imageCache as any).currentSize = 1000;

      mockGetInfoAsync.mockResolvedValue({ exists: false });

      const result = await imageCache.getCachedUri(uri);

      expect(result).toBeNull();
      expect((imageCache as any).cache.has(key)).toBe(false);
      expect((imageCache as any).currentSize).toBe(0);
    });

    it('should track hit and miss counts', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });

      // Miss
      await imageCache.getCachedUri('https://example.com/miss1.jpg');
      await imageCache.getCachedUri('https://example.com/miss2.jpg');

      // Add to cache for hit
      const uri = 'https://example.com/hit.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/hit.jpg',
        size: 500,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });

      // Hit
      await imageCache.getCachedUri(uri);

      const stats = imageCache.getStats();
      expect(stats.missCount).toBe(2);
      expect(stats.hitCount).toBe(1);
    });
  });

  describe('downloadAndCache', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should download and cache image', async () => {
      const uri = 'https://example.com/new.jpg';
      mockDownloadAsync.mockResolvedValue({ status: 200 });
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2000 });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const result = await imageCache.downloadAndCache(uri);

      expect(mockDownloadAsync).toHaveBeenCalledWith(
        uri,
        expect.stringContaining('/cache/image_cache/')
      );
      expect(result).toContain('/cache/image_cache/');
    });

    it('should throw on download failure', async () => {
      const uri = 'https://example.com/fail.jpg';
      mockDownloadAsync.mockResolvedValue({ status: 404 });
      mockDeleteAsync.mockResolvedValue(undefined);

      await expect(imageCache.downloadAndCache(uri)).rejects.toThrow('Download failed with status 404');
    });

    it('should cleanup partial download on error', async () => {
      const uri = 'https://example.com/error.jpg';
      mockDownloadAsync.mockRejectedValue(new Error('Network error'));
      mockDeleteAsync.mockResolvedValue(undefined);

      await expect(imageCache.downloadAndCache(uri)).rejects.toThrow('Network error');
      expect(mockDeleteAsync).toHaveBeenCalled();
    });
  });

  describe('getOrDownload', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should return cached if available', async () => {
      const uri = 'https://example.com/cached.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/cached.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });

      mockGetInfoAsync.mockResolvedValue({ exists: true });

      const result = await imageCache.getOrDownload(uri);

      expect(result).toBe('/cache/cached.jpg');
      expect(mockDownloadAsync).not.toHaveBeenCalled();
    });

    it('should download if not cached', async () => {
      const uri = 'https://example.com/new.jpg';
      mockDownloadAsync.mockResolvedValue({ status: 200 });
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1000 });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      const result = await imageCache.getOrDownload(uri);

      expect(mockDownloadAsync).toHaveBeenCalled();
      expect(result).toContain('/cache/image_cache/');
    });
  });

  describe('prefetch', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should skip already cached images', async () => {
      const uris = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];

      // Cache one
      const key = (imageCache as any).getKey(uris[0]);
      (imageCache as any).cache.set(key, {
        uri: uris[0],
        localPath: '/cache/1.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });

      mockDownloadAsync.mockResolvedValue({ status: 200 });
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1000 });
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      await imageCache.prefetch(uris);

      // Only one download (the uncached one)
      expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
    });

    it('should do nothing for empty array', async () => {
      await imageCache.prefetch([]);

      expect(mockDownloadAsync).not.toHaveBeenCalled();
    });
  });

  describe('isCached', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should return true for cached image', () => {
      const uri = 'https://example.com/cached.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/cached.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });

      expect(imageCache.isCached(uri)).toBe(true);
    });

    it('should return false for uncached image', () => {
      expect(imageCache.isCached('https://example.com/uncached.jpg')).toBe(false);
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should remove cached image', async () => {
      const uri = 'https://example.com/remove.jpg';
      const key = (imageCache as any).getKey(uri);
      (imageCache as any).cache.set(key, {
        uri,
        localPath: '/cache/remove.jpg',
        size: 1000,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
      });
      (imageCache as any).currentSize = 1000;

      mockDeleteAsync.mockResolvedValue(undefined);
      mockWriteAsStringAsync.mockResolvedValue(undefined);

      await imageCache.remove(uri);

      expect(mockDeleteAsync).toHaveBeenCalledWith('/cache/remove.jpg', { idempotent: true });
      expect((imageCache as any).cache.has(key)).toBe(false);
      expect((imageCache as any).currentSize).toBe(0);
    });

    it('should do nothing for uncached image', async () => {
      await imageCache.remove('https://example.com/uncached.jpg');

      expect(mockDeleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should clear all cached images', async () => {
      // Add some items
      (imageCache as any).cache.set('key1', { size: 1000 });
      (imageCache as any).cache.set('key2', { size: 2000 });
      (imageCache as any).currentSize = 3000;
      (imageCache as any).hitCount = 10;
      (imageCache as any).missCount = 5;

      mockDeleteAsync.mockResolvedValue(undefined);
      mockMakeDirectoryAsync.mockResolvedValue(undefined);

      await imageCache.clear();

      expect(mockDeleteAsync).toHaveBeenCalled();
      expect(mockMakeDirectoryAsync).toHaveBeenCalled();
      expect((imageCache as any).cache.size).toBe(0);
      expect((imageCache as any).currentSize).toBe(0);
      expect((imageCache as any).hitCount).toBe(0);
      expect((imageCache as any).missCount).toBe(0);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });
      mockReadAsStringAsync.mockResolvedValue('[]');
      await imageCache.initialize();
    });

    it('should return cache statistics', () => {
      (imageCache as any).cache.set('key1', { size: 1000 });
      (imageCache as any).cache.set('key2', { size: 2000 });
      (imageCache as any).currentSize = 3000;
      (imageCache as any).hitCount = 8;
      (imageCache as any).missCount = 2;

      const stats = imageCache.getStats();

      expect(stats).toEqual({
        totalSize: 3000,
        itemCount: 2,
        hitCount: 8,
        missCount: 2,
        hitRate: 0.8,
      });
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = imageCache.getStats();

      expect(stats.hitRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset hit and miss counts', () => {
      (imageCache as any).hitCount = 100;
      (imageCache as any).missCount = 50;

      imageCache.resetStats();

      const stats = imageCache.getStats();
      expect(stats.hitCount).toBe(0);
      expect(stats.missCount).toBe(0);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      imageCache.configure({
        maxSizeBytes: 200 * 1024 * 1024,
        maxItems: 1000,
      });

      expect((imageCache as any).config.maxSizeBytes).toBe(200 * 1024 * 1024);
      expect((imageCache as any).config.maxItems).toBe(1000);
    });
  });

  describe('getKey', () => {
    it('should generate consistent keys', () => {
      const uri = 'https://example.com/image.jpg';
      const key1 = (imageCache as any).getKey(uri);
      const key2 = (imageCache as any).getKey(uri);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^img_/);
    });

    it('should generate different keys for different URIs', () => {
      const key1 = (imageCache as any).getKey('https://example.com/1.jpg');
      const key2 = (imageCache as any).getKey('https://example.com/2.jpg');

      expect(key1).not.toBe(key2);
    });
  });

  describe('getExtension', () => {
    it('should extract jpg extension', () => {
      expect((imageCache as any).getExtension('https://example.com/image.jpg')).toBe('.jpg');
    });

    it('should extract png extension', () => {
      expect((imageCache as any).getExtension('https://example.com/image.png')).toBe('.png');
    });

    it('should handle query parameters', () => {
      expect((imageCache as any).getExtension('https://example.com/image.jpg?token=abc')).toBe('.jpg');
    });

    it('should default to jpg for unknown extensions', () => {
      expect((imageCache as any).getExtension('https://example.com/image')).toBe('.jpg');
    });
  });
});
