/**
 * KbSearchService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KbSearchService } from '../services/kb-search.service';
import { KbEmbeddingService } from '../services/kb-embedding.service';
import { KbVectorStore } from '../services/kb-vector-store.service';
import { KbRerankerService } from '../services/kb-reranker.service';

describe('KbSearchService', () => {
  let service: KbSearchService;

  const mockEmbedding = new Array(1536).fill(0.1);

  const mockEmbeddingService = {
    embed: jest.fn().mockResolvedValue({ embedding: mockEmbedding, model: 'test', fromCache: false }),
    embedBatch: jest.fn(),
    cosineSimilarity: jest.fn(),
    getCacheStats: jest.fn().mockResolvedValue({
      totalEntries: 0,
      totalHits: 0,
      oldestEntry: null,
      newestEntry: null,
    }),
  };

  const mockVectorStore = {
    searchChunks: jest.fn().mockResolvedValue([]),
    searchFaqs: jest.fn().mockResolvedValue([]),
    isPgVectorEnabled: jest.fn().mockReturnValue(false),
    getStats: jest.fn().mockResolvedValue({
      totalDocuments: 10,
      totalChunks: 50,
      totalFaqs: 20,
      bySource: { DOCS: 5, FAQ: 5 },
      pgvectorEnabled: false,
    }),
  };

  const mockRerankerService = {
    isAvailable: jest.fn().mockReturnValue(false),
    rerank: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbSearchService,
        { provide: KbEmbeddingService, useValue: mockEmbeddingService },
        { provide: KbVectorStore, useValue: mockVectorStore },
        { provide: KbRerankerService, useValue: mockRerankerService },
      ],
    }).compile();

    service = module.get<KbSearchService>(KbSearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should call embedding service and vector store', async () => {
      mockVectorStore.searchChunks.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          content: 'Test content',
          score: 0.9,
          source: 'DOCS',
          sourceRef: 'test.md',
          title: 'Test Doc',
        },
      ]);

      const result = await service.search('test query');

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('test query');
      expect(mockVectorStore.searchChunks).toHaveBeenCalled();
      expect(mockVectorStore.searchFaqs).toHaveBeenCalled();
      expect(result.query).toBe('test query');
      expect(result.results.length).toBe(1);
    });

    it('should merge and sort results from chunks and FAQs', async () => {
      mockVectorStore.searchChunks.mockResolvedValueOnce([
        { id: 'chunk-1', content: 'Doc content', score: 0.8, source: 'DOCS', sourceRef: 'doc.md', title: 'Doc' },
      ]);
      mockVectorStore.searchFaqs.mockResolvedValueOnce([
        { id: 'faq-1', content: 'FAQ answer', score: 0.9, source: 'FAQ', sourceRef: 'faq-1', title: 'FAQ Question' },
      ]);

      const result = await service.search('test query');

      expect(result.results.length).toBe(2);
      // Results should be sorted by score descending
      expect(result.results[0].score).toBe(0.9);
      expect(result.results[1].score).toBe(0.8);
    });

    it('should respect topK limit', async () => {
      mockVectorStore.searchChunks.mockResolvedValueOnce([
        { id: 'chunk-1', content: 'Content 1', score: 0.9, source: 'DOCS', sourceRef: 'd1.md', title: 'D1' },
        { id: 'chunk-2', content: 'Content 2', score: 0.8, source: 'DOCS', sourceRef: 'd2.md', title: 'D2' },
        { id: 'chunk-3', content: 'Content 3', score: 0.7, source: 'DOCS', sourceRef: 'd3.md', title: 'D3' },
      ]);
      mockVectorStore.searchFaqs.mockResolvedValueOnce([
        { id: 'faq-1', content: 'FAQ 1', score: 0.85, source: 'FAQ', sourceRef: 'faq-1', title: 'Q1' },
        { id: 'faq-2', content: 'FAQ 2', score: 0.75, source: 'FAQ', sourceRef: 'faq-2', title: 'Q2' },
      ]);

      const result = await service.search('test query', { topK: 3 });

      expect(result.results.length).toBe(3);
      expect(result.results[0].score).toBe(0.9);
      expect(result.results[1].score).toBe(0.85);
      expect(result.results[2].score).toBe(0.8);
    });

    it('should include search time', async () => {
      const result = await service.search('test query');

      expect(result.searchTimeMs).toBeDefined();
      expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should format context for LLM', async () => {
      mockVectorStore.searchChunks.mockResolvedValueOnce([
        { id: 'chunk-1', content: 'Test content', score: 0.9, source: 'DOCS', sourceRef: 'test.md', title: 'Test Doc' },
      ]);

      const result = await service.search('test query');

      expect(result.formattedContext).toBeDefined();
      expect(result.formattedContext).toContain('Base de Conhecimento');
      expect(result.formattedContext).toContain('Test Doc');
      expect(result.formattedContext).toContain('Test content');
    });

    it('should return empty formatted context when no results', async () => {
      const result = await service.search('test query');

      expect(result.formattedContext).toBe('');
    });
  });

  describe('searchFaq', () => {
    it('should search only FAQs with higher threshold', async () => {
      mockVectorStore.searchFaqs.mockResolvedValueOnce([
        { id: 'faq-1', content: 'FAQ answer', score: 0.9, source: 'FAQ', sourceRef: 'faq-1', title: 'Question' },
      ]);

      const results = await service.searchFaq('how to do something');

      // Note: searchFaq multiplies topK by 2 for potential reranking
      expect(mockVectorStore.searchFaqs).toHaveBeenCalledWith(
        mockEmbedding,
        expect.objectContaining({ topK: 6, minScore: 0.5 }),
      );
      expect(results.length).toBe(1);
    });
  });

  describe('searchDocs', () => {
    it('should search only DOCS source', async () => {
      mockVectorStore.searchChunks.mockResolvedValueOnce([
        { id: 'chunk-1', content: 'Doc content', score: 0.8, source: 'DOCS', sourceRef: 'doc.md', title: 'Doc' },
      ]);

      const results = await service.searchDocs('documentation query');

      expect(mockVectorStore.searchChunks).toHaveBeenCalledWith(
        mockEmbedding,
        expect.objectContaining({ sources: ['DOCS'] }),
      );
      expect(results.length).toBe(1);
    });
  });

  describe('isSupportQuestion', () => {
    it('should detect Portuguese support keywords', () => {
      expect(service.isSupportQuestion('como faço para criar um cliente')).toBe(true);
      expect(service.isSupportQuestion('como funciona o sistema')).toBe(true);
      expect(service.isSupportQuestion('o que é orçamento')).toBe(true);
      expect(service.isSupportQuestion('onde encontro as cobranças')).toBe(true);
      expect(service.isSupportQuestion('não consigo enviar a cobrança')).toBe(true);
      expect(service.isSupportQuestion('está dando erro ao criar cliente')).toBe(true);
      expect(service.isSupportQuestion('preciso de ajuda com ordens')).toBe(true);
      expect(service.isSupportQuestion('como configuro o pix')).toBe(true);
    });

    it('should detect English support keywords', () => {
      expect(service.isSupportQuestion('how do I create a customer')).toBe(true);
      expect(service.isSupportQuestion('how to add a work order')).toBe(true);
      expect(service.isSupportQuestion('what is a quote')).toBe(true);
      expect(service.isSupportQuestion('where can I find settings')).toBe(true);
      expect(service.isSupportQuestion("it doesn't work"  )).toBe(true);
      expect(service.isSupportQuestion('help me with billing')).toBe(true);
    });

    it('should detect questions ending with ?', () => {
      expect(service.isSupportQuestion('qual o valor mínimo de cobrança?')).toBe(true);
      expect(service.isSupportQuestion('posso editar uma ordem de serviço?')).toBe(true);
    });

    it('should not detect non-support messages', () => {
      expect(service.isSupportQuestion('crie um cliente João')).toBe(false);
      expect(service.isSupportQuestion('busque ordens pendentes')).toBe(false);
      expect(service.isSupportQuestion('mostre as cobranças de hoje')).toBe(false);
      expect(service.isSupportQuestion('olá')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return KB statistics', async () => {
      const stats = await service.getStats();

      expect(mockVectorStore.getStats).toHaveBeenCalled();
      expect(stats.totalDocuments).toBe(10);
      expect(stats.totalChunks).toBe(50);
      expect(stats.totalFaqs).toBe(20);
    });
  });
});
