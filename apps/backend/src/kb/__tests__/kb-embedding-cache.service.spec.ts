import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KbEmbeddingCacheService } from '../services/kb-embedding-cache.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('KbEmbeddingCacheService', () => {
  let service: KbEmbeddingCacheService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    kbEmbeddingCache: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, unknown> = {
        KB_CACHE_TTL_MS: 3600000, // 1 hour
        KB_CACHE_MAX_SIZE: 1000,
        KB_CACHE_ENABLED: true,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbEmbeddingCacheService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
    prismaService = module.get(PrismaService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should respect disabled configuration', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'KB_CACHE_ENABLED') return false;
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          KbEmbeddingCacheService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('hashText', () => {
    it('should generate consistent hash for same text', () => {
      const hash1 = service.hashText('Hello World');
      const hash2 = service.hashText('Hello World');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should normalize text before hashing', () => {
      const hash1 = service.hashText('Hello World');
      const hash2 = service.hashText('  hello world  ');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different text', () => {
      const hash1 = service.hashText('Hello World');
      const hash2 = service.hashText('Goodbye World');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('get', () => {
    const mockEmbedding = new Array(1536).fill(0.1);
    const mockCacheEntry = {
      id: 'cache-1',
      textHash: 'abc123',
      embedding: mockEmbedding,
      model: 'text-embedding-3-small',
      hitCount: 5,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };

    it('should return null when cache is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'KB_CACHE_ENABLED') return false;
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          KbEmbeddingCacheService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
      const result = await disabledService.get('test');

      expect(result).toBeNull();
    });

    it('should return cached embedding if exists and not expired', async () => {
      mockPrismaService.kbEmbeddingCache.findUnique.mockResolvedValue(mockCacheEntry);
      mockPrismaService.kbEmbeddingCache.update.mockResolvedValue(mockCacheEntry);

      const result = await service.get('test text');

      expect(result).not.toBeNull();
      expect(result?.embedding).toEqual(mockEmbedding);
      expect(result?.model).toBe('text-embedding-3-small');
      expect(result?.fromCache).toBe(true);
    });

    it('should return null if cache entry does not exist', async () => {
      mockPrismaService.kbEmbeddingCache.findUnique.mockResolvedValue(null);

      const result = await service.get('uncached text');

      expect(result).toBeNull();
    });

    it('should return null and delete expired entry', async () => {
      const expiredEntry = {
        ...mockCacheEntry,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };
      mockPrismaService.kbEmbeddingCache.findUnique.mockResolvedValue(expiredEntry);
      mockPrismaService.kbEmbeddingCache.delete.mockResolvedValue(expiredEntry);

      const result = await service.get('expired text');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.kbEmbeddingCache.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await service.get('error text');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    const mockEmbedding = new Array(1536).fill(0.1);

    it('should not set when cache is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'KB_CACHE_ENABLED') return false;
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          KbEmbeddingCacheService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
      await disabledService.set('test', mockEmbedding, 'model');

      expect(mockPrismaService.kbEmbeddingCache.upsert).not.toHaveBeenCalled();
    });

    it('should upsert cache entry', async () => {
      mockPrismaService.kbEmbeddingCache.upsert.mockResolvedValue({ id: 'cache-1' });
      mockPrismaService.kbEmbeddingCache.count.mockResolvedValue(100);

      await service.set('test text', mockEmbedding, 'text-embedding-3-small');

      expect(mockPrismaService.kbEmbeddingCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ textHash: expect.any(String) }),
          create: expect.objectContaining({
            embedding: mockEmbedding,
            model: 'text-embedding-3-small',
          }),
        }),
      );
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.kbEmbeddingCache.upsert.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.set('test', mockEmbedding, 'model')).resolves.not.toThrow();
    });
  });

  describe('getMany', () => {
    const mockEmbedding = new Array(1536).fill(0.1);

    it('should return empty map when cache is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'KB_CACHE_ENABLED') return false;
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          KbEmbeddingCacheService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
      const result = await disabledService.getMany(['text1', 'text2']);

      expect(result.size).toBe(0);
    });

    it('should return empty map for empty input', async () => {
      const result = await service.getMany([]);

      expect(result.size).toBe(0);
    });

    it('should return cached embeddings for multiple texts', async () => {
      const text1Hash = service.hashText('text1');
      const text2Hash = service.hashText('text2');

      mockPrismaService.kbEmbeddingCache.findMany.mockResolvedValue([
        {
          id: 'cache-1',
          textHash: text1Hash,
          embedding: mockEmbedding,
          model: 'model1',
          expiresAt: new Date(Date.now() + 3600000),
        },
      ]);
      mockPrismaService.kbEmbeddingCache.update.mockResolvedValue({});

      const result = await service.getMany(['text1', 'text2']);

      expect(result.size).toBe(1);
      expect(result.has('text1')).toBe(true);
      expect(result.has('text2')).toBe(false);
    });
  });

  describe('setMany', () => {
    const mockEmbedding = new Array(1536).fill(0.1);

    it('should not set when cache is disabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'KB_CACHE_ENABLED') return false;
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [
          KbEmbeddingCacheService,
          { provide: PrismaService, useValue: mockPrismaService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const disabledService = module.get<KbEmbeddingCacheService>(KbEmbeddingCacheService);
      await disabledService.setMany([{ text: 'test', embedding: mockEmbedding, model: 'model' }]);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should batch upsert cache entries', async () => {
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockPrismaService.kbEmbeddingCache.count.mockResolvedValue(100);

      await service.setMany([
        { text: 'text1', embedding: mockEmbedding, model: 'model1' },
        { text: 'text2', embedding: mockEmbedding, model: 'model2' },
      ]);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should delete all cache entries', async () => {
      mockPrismaService.kbEmbeddingCache.deleteMany.mockResolvedValue({ count: 50 });

      const result = await service.clear();

      expect(result).toBe(50);
      expect(mockPrismaService.kbEmbeddingCache.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired entries', async () => {
      mockPrismaService.kbEmbeddingCache.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.cleanupExpired();

      expect(result).toBe(10);
      expect(mockPrismaService.kbEmbeddingCache.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockPrismaService.kbEmbeddingCache.count.mockResolvedValue(100);
      mockPrismaService.kbEmbeddingCache.aggregate.mockResolvedValue({
        _sum: { hitCount: 500 },
      });
      mockPrismaService.kbEmbeddingCache.findFirst
        .mockResolvedValueOnce({ createdAt: new Date('2024-01-01') })
        .mockResolvedValueOnce({ createdAt: new Date('2024-12-26') });

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(100);
      expect(stats.totalHits).toBe(500);
      expect(stats.oldestEntry).toEqual(new Date('2024-01-01'));
      expect(stats.newestEntry).toEqual(new Date('2024-12-26'));
    });

    it('should handle empty cache', async () => {
      mockPrismaService.kbEmbeddingCache.count.mockResolvedValue(0);
      mockPrismaService.kbEmbeddingCache.aggregate.mockResolvedValue({
        _sum: { hitCount: null },
      });
      mockPrismaService.kbEmbeddingCache.findFirst.mockResolvedValue(null);

      const stats = await service.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a specific cache entry', async () => {
      mockPrismaService.kbEmbeddingCache.delete.mockResolvedValue({});

      const result = await service.delete('test text');

      expect(result).toBe(true);
    });

    it('should return false if entry does not exist', async () => {
      mockPrismaService.kbEmbeddingCache.delete.mockRejectedValue(new Error('Not found'));

      const result = await service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
