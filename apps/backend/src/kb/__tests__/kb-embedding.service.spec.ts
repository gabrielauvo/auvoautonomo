/**
 * KbEmbeddingService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KbEmbeddingService } from '../services/kb-embedding.service';
import { KbEmbeddingCacheService } from '../services/kb-embedding-cache.service';

const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  getMany: jest.fn().mockResolvedValue(new Map()),
  setMany: jest.fn().mockResolvedValue(undefined),
  getStats: jest.fn().mockResolvedValue({
    totalEntries: 0,
    totalHits: 0,
    oldestEntry: null,
    newestEntry: null,
  }),
  isEnabled: jest.fn().mockReturnValue(true),
};

describe('KbEmbeddingService', () => {
  let service: KbEmbeddingService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return undefined; // Use hash fallback
      if (key === 'KB_EMBEDDING_MODEL') return 'text-embedding-3-small';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbEmbeddingService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: KbEmbeddingCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<KbEmbeddingService>(KbEmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDimension', () => {
    it('should return correct dimension for default model', () => {
      expect(service.getDimension()).toBe(1536);
    });
  });

  describe('isAvailable', () => {
    it('should return false when no API key is configured', () => {
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('embed (hash fallback)', () => {
    it('should generate embedding with correct dimension', async () => {
      const result = await service.embed('test query');

      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(1536);
      expect(result.model).toBe('hash-fallback');
    });

    it('should generate consistent embeddings for same input', async () => {
      const result1 = await service.embed('test query');
      const result2 = await service.embed('test query');

      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should generate different embeddings for different inputs', async () => {
      const result1 = await service.embed('query one');
      const result2 = await service.embed('query two');

      expect(result1.embedding).not.toEqual(result2.embedding);
    });

    it('should normalize embeddings to unit vector', async () => {
      const result = await service.embed('test query');

      const magnitude = Math.sqrt(
        result.embedding.reduce((sum, val) => sum + val * val, 0),
      );

      // Unit vector magnitude should be approximately 1
      expect(magnitude).toBeCloseTo(1, 5);
    });

    it('should return cached embedding when available', async () => {
      const cachedEmbedding = {
        embedding: new Array(1536).fill(0.1),
        model: 'cached-model',
        fromCache: true,
      };
      mockCacheService.get.mockResolvedValueOnce(cachedEmbedding);

      const result = await service.embed('test query');

      expect(result.fromCache).toBe(true);
      expect(result.embedding).toEqual(cachedEmbedding.embedding);
    });
  });

  describe('embedBatch', () => {
    it('should return empty array for empty input', async () => {
      const results = await service.embedBatch([]);
      expect(results).toEqual([]);
    });

    it('should embed multiple texts', async () => {
      const texts = ['query one', 'query two', 'query three'];
      const results = await service.embedBatch(texts);

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.embedding.length).toBe(1536);
        expect(result.model).toBe('hash-fallback');
      });
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vector = [1, 0, 0, 0];
      const similarity = service.cosineSimilarity(vector, vector);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vector1 = [1, 0, 0, 0];
      const vector2 = [0, 1, 0, 0];
      const similarity = service.cosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vector1 = [1, 0, 0, 0];
      const vector2 = [-1, 0, 0, 0];
      const similarity = service.cosineSimilarity(vector1, vector2);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [1, 0, 0, 0];
      expect(() => service.cosineSimilarity(vector1, vector2)).toThrow();
    });

    it('should return 0 for zero vectors', () => {
      const vector1 = [0, 0, 0, 0];
      const vector2 = [1, 0, 0, 0];
      const similarity = service.cosineSimilarity(vector1, vector2);
      expect(similarity).toBe(0);
    });

    it('should calculate correct similarity for normalized vectors', async () => {
      const result1 = await service.embed('how do I create a customer');
      const result2 = await service.embed('how to add a new client');

      const similarity = service.cosineSimilarity(result1.embedding, result2.embedding);

      // Similar queries should have positive similarity
      expect(similarity).toBeGreaterThan(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        totalEntries: 0,
        totalHits: 0,
        oldestEntry: null,
        newestEntry: null,
      });
    });
  });
});

describe('KbEmbeddingService (with OpenAI)', () => {
  let service: KbEmbeddingService;

  const mockConfigServiceWithApiKey = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') return 'test-api-key';
      if (key === 'KB_EMBEDDING_MODEL') return 'text-embedding-3-small';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbEmbeddingService,
        { provide: ConfigService, useValue: mockConfigServiceWithApiKey },
        { provide: KbEmbeddingCacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<KbEmbeddingService>(KbEmbeddingService);
  });

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });
});
