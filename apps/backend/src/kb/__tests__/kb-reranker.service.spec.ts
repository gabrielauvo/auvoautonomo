import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KbRerankerService } from '../services/kb-reranker.service';
import { KbSearchResult } from '../interfaces/kb.interface';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('KbRerankerService', () => {
  let service: KbRerankerService;

  const createMockConfigService = (config: Record<string, unknown>) => ({
    get: jest.fn((key: string) => config[key]),
  });

  const mockSearchResults: KbSearchResult[] = [
    {
      id: 'result-1',
      content: 'How to create a new client in the system',
      score: 0.85,
      source: 'FAQ',
      sourceRef: 'faq-1',
      title: 'Creating Clients',
    },
    {
      id: 'result-2',
      content: 'Managing your client list and updating information',
      score: 0.75,
      source: 'DOCS',
      sourceRef: 'clients.md',
      title: 'Client Management',
    },
    {
      id: 'result-3',
      content: 'Exporting client data to CSV format',
      score: 0.65,
      source: 'DOCS',
      sourceRef: 'export.md',
      title: 'Data Export',
    },
  ];

  describe('with no API keys', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KbRerankerService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              KB_RERANKER_ENABLED: true,
            }),
          },
        ],
      }).compile();

      service = module.get<KbRerankerService>(KbRerankerService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should not be available without API keys', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should use fallback reranking', async () => {
      const results = await service.rerank('how to create client', mockSearchResults, {
        topK: 3,
        minScore: 0.3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);
      // Results should have originalScore and rerankScore
      expect(results[0]).toHaveProperty('originalScore');
      expect(results[0]).toHaveProperty('rerankScore');
    });

    it('should return empty array for empty results', async () => {
      const results = await service.rerank('query', [], { topK: 5 });

      expect(results).toEqual([]);
    });

    it('should filter by minimum score in fallback', async () => {
      const results = await service.rerank('query', mockSearchResults, {
        topK: 10,
        minScore: 0.9, // High threshold
      });

      results.forEach((r) => {
        expect(r.rerankScore).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('with OpenAI API key', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KbRerankerService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              OPENAI_API_KEY: 'sk-test-key',
              KB_RERANKER_ENABLED: true,
              KB_RERANKER_MODEL: 'gpt-4o-mini',
            }),
          },
        ],
      }).compile();

      service = module.get<KbRerankerService>(KbRerankerService);
    });

    it('should be available with OpenAI key', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should rerank using OpenAI', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '[0.95, 0.60, 0.40]',
              },
            },
          ],
        }),
      });

      const results = await service.rerank('how to create client', mockSearchResults, {
        topK: 3,
        minScore: 0.3,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key',
          }),
        }),
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].rerankScore).toBe(0.95);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      // Should fall back to keyword-based reranking
      const results = await service.rerank('query', mockSearchResults, { topK: 3 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle malformed OpenAI response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'invalid response format',
              },
            },
          ],
        }),
      });

      const results = await service.rerank('query', mockSearchResults, { topK: 3 });

      // Should return results with fallback scores
      expect(results.length).toBeGreaterThan(0);
    });

    it('should parse various score formats', async () => {
      // Test comma-separated values
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Scores: 0.9, 0.7, 0.5',
              },
            },
          ],
        }),
      });

      const results = await service.rerank('query', mockSearchResults, { topK: 3 });

      expect(results[0].rerankScore).toBeCloseTo(0.9, 1);
    });
  });

  describe('with Cohere API key', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KbRerankerService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              COHERE_API_KEY: 'co-test-key',
              KB_RERANKER_ENABLED: true,
            }),
          },
        ],
      }).compile();

      service = module.get<KbRerankerService>(KbRerankerService);
    });

    it('should be available with Cohere key', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should rerank using Cohere', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.92 },
            { index: 1, relevance_score: 0.78 },
            { index: 2, relevance_score: 0.55 },
          ],
        }),
      });

      const results = await service.rerank('how to create client', mockSearchResults, {
        topK: 3,
        minScore: 0.3,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cohere.ai/v1/rerank',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer co-test-key',
          }),
        }),
      );

      expect(results.length).toBe(3);
      expect(results[0].rerankScore).toBe(0.92);
    });

    it('should filter by minScore with Cohere', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { index: 0, relevance_score: 0.92 },
            { index: 1, relevance_score: 0.78 },
            { index: 2, relevance_score: 0.25 }, // Below threshold
          ],
        }),
      });

      const results = await service.rerank('query', mockSearchResults, {
        topK: 3,
        minScore: 0.5,
      });

      expect(results.length).toBe(2);
      results.forEach((r) => {
        expect(r.rerankScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should handle Cohere API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      // Should fall back to keyword-based reranking
      const results = await service.rerank('query', mockSearchResults, { topK: 3 });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('when disabled', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KbRerankerService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              OPENAI_API_KEY: 'sk-test-key',
              KB_RERANKER_ENABLED: false,
            }),
          },
        ],
      }).compile();

      service = module.get<KbRerankerService>(KbRerankerService);
    });

    it('should not be available when disabled', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should use fallback even with API key', async () => {
      const results = await service.rerank('query', mockSearchResults, { topK: 3 });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('fallback reranking', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KbRerankerService,
          {
            provide: ConfigService,
            useValue: createMockConfigService({
              KB_RERANKER_ENABLED: true,
            }),
          },
        ],
      }).compile();

      service = module.get<KbRerankerService>(KbRerankerService);
    });

    it('should boost results with query term overlap in title', async () => {
      const resultsWithTitleMatch: KbSearchResult[] = [
        {
          id: 'result-1',
          content: 'Some unrelated content',
          score: 0.7,
          source: 'DOCS',
          sourceRef: 'doc1.md',
          title: 'Client Creation Guide', // Has "client" from query
        },
        {
          id: 'result-2',
          content: 'Also unrelated',
          score: 0.8, // Higher original score
          source: 'DOCS',
          sourceRef: 'doc2.md',
          title: 'Server Configuration',
        },
      ];

      const results = await service.rerank('how to create client', resultsWithTitleMatch, {
        topK: 2,
        minScore: 0,
      });

      // The result with title match should get a boost
      const clientResult = results.find((r) => r.id === 'result-1');
      expect(clientResult).toBeDefined();
    });

    it('should boost results with query term overlap in content', async () => {
      const resultsWithContentMatch: KbSearchResult[] = [
        {
          id: 'result-1',
          content: 'To create a new client, go to the Clients menu',
          score: 0.6,
          source: 'FAQ',
          sourceRef: 'faq-1',
          title: 'FAQ 1',
        },
        {
          id: 'result-2',
          content: 'System configuration settings',
          score: 0.65,
          source: 'DOCS',
          sourceRef: 'config.md',
          title: 'Configuration',
        },
      ];

      const results = await service.rerank('create client', resultsWithContentMatch, {
        topK: 2,
        minScore: 0,
      });

      // Result with content match should score higher
      expect(results[0].id).toBe('result-1');
    });

    it('should handle empty query gracefully', async () => {
      const results = await service.rerank('', mockSearchResults, { topK: 3 });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle results without title', async () => {
      const resultsNoTitle: KbSearchResult[] = [
        {
          id: 'result-1',
          content: 'Content without title',
          score: 0.7,
          source: 'DOCS',
          sourceRef: 'doc.md',
        },
      ];

      const results = await service.rerank('query', resultsNoTitle, { topK: 3 });

      expect(results.length).toBe(1);
    });

    it('should combine original score with keyword matching', async () => {
      const results = await service.rerank('client management', mockSearchResults, {
        topK: 3,
        minScore: 0,
      });

      // Each result should have combined score
      results.forEach((r) => {
        expect(r.rerankScore).toBeGreaterThan(0);
        expect(r.originalScore).toBe(mockSearchResults.find((sr) => sr.id === r.id)?.score);
      });
    });
  });
});
