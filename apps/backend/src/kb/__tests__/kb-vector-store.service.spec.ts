import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KbVectorStore } from '../services/kb-vector-store.service';
import { KbEmbeddingService } from '../services/kb-embedding.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('KbVectorStore', () => {
  let service: KbVectorStore;
  let prismaService: jest.Mocked<PrismaService>;
  let embeddingService: jest.Mocked<KbEmbeddingService>;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    kbChunk: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    kbFaq: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    kbDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockEmbeddingService = {
    cosineSimilarity: jest.fn(),
    getDimension: jest.fn().mockReturnValue(1536),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbVectorStore,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KbEmbeddingService, useValue: mockEmbeddingService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KbVectorStore>(KbVectorStore);
    prismaService = module.get(PrismaService);
    embeddingService = module.get(KbEmbeddingService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should check pgvector support on module init', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: true }]);

      await service.onModuleInit();

      expect(service.isPgVectorEnabled()).toBe(true);
    });

    it('should handle pgvector not available', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);

      await service.onModuleInit();

      expect(service.isPgVectorEnabled()).toBe(false);
    });

    it('should handle pgvector check error gracefully', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection error'));

      await service.onModuleInit();

      expect(service.isPgVectorEnabled()).toBe(false);
    });
  });

  describe('searchChunks', () => {
    const mockEmbedding = new Array(1536).fill(0.1);

    describe('with pgvector disabled (in-memory)', () => {
      beforeEach(async () => {
        mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
        await service.onModuleInit();
      });

      it('should search chunks using in-memory similarity', async () => {
        const mockDocuments = [
          {
            id: 'doc-1',
            source: 'DOCS',
            sourceId: 'test.md',
            title: 'Test Doc',
            isActive: true,
            chunks: [
              {
                id: 'chunk-1',
                content: 'Test content 1',
                embedding: new Array(1536).fill(0.1),
                metadata: {},
              },
              {
                id: 'chunk-2',
                content: 'Test content 2',
                embedding: new Array(1536).fill(0.2),
                metadata: {},
              },
            ],
          },
        ];

        mockPrismaService.kbDocument.findMany.mockResolvedValue(mockDocuments);
        mockEmbeddingService.cosineSimilarity
          .mockReturnValueOnce(0.9)
          .mockReturnValueOnce(0.7);

        const results = await service.searchChunks(mockEmbedding, { topK: 5, minScore: 0.5 });

        expect(results).toHaveLength(2);
        expect(results[0].score).toBe(0.9);
        expect(results[1].score).toBe(0.7);
        expect(results[0].content).toBe('Test content 1');
      });

      it('should filter by minimum score', async () => {
        const mockDocuments = [
          {
            id: 'doc-1',
            source: 'DOCS',
            sourceId: 'test.md',
            title: 'Test Doc',
            isActive: true,
            chunks: [
              {
                id: 'chunk-1',
                content: 'High score content',
                embedding: new Array(1536).fill(0.1),
                metadata: {},
              },
              {
                id: 'chunk-2',
                content: 'Low score content',
                embedding: new Array(1536).fill(0.2),
                metadata: {},
              },
            ],
          },
        ];

        mockPrismaService.kbDocument.findMany.mockResolvedValue(mockDocuments);
        mockEmbeddingService.cosineSimilarity
          .mockReturnValueOnce(0.8)
          .mockReturnValueOnce(0.3);

        const results = await service.searchChunks(mockEmbedding, { minScore: 0.5 });

        expect(results).toHaveLength(1);
        expect(results[0].content).toBe('High score content');
      });

      it('should limit results to topK', async () => {
        const mockDocuments = [
          {
            id: 'doc-1',
            source: 'DOCS',
            sourceId: 'test.md',
            title: 'Test Doc',
            isActive: true,
            chunks: Array.from({ length: 10 }, (_, i) => ({
              id: `chunk-${i}`,
              content: `Content ${i}`,
              embedding: new Array(1536).fill(0.1),
              metadata: {},
            })),
          },
        ];

        mockPrismaService.kbDocument.findMany.mockResolvedValue(mockDocuments);
        mockEmbeddingService.cosineSimilarity.mockReturnValue(0.7);

        const results = await service.searchChunks(mockEmbedding, { topK: 3 });

        expect(results).toHaveLength(3);
      });

      it('should skip chunks without embeddings', async () => {
        const mockDocuments = [
          {
            id: 'doc-1',
            source: 'DOCS',
            sourceId: 'test.md',
            title: 'Test Doc',
            isActive: true,
            chunks: [
              {
                id: 'chunk-1',
                content: 'Has embedding',
                embedding: new Array(1536).fill(0.1),
                metadata: {},
              },
              {
                id: 'chunk-2',
                content: 'No embedding',
                embedding: [],
                metadata: {},
              },
            ],
          },
        ];

        mockPrismaService.kbDocument.findMany.mockResolvedValue(mockDocuments);
        mockEmbeddingService.cosineSimilarity.mockReturnValue(0.8);

        const results = await service.searchChunks(mockEmbedding, { minScore: 0.5 });

        expect(results).toHaveLength(1);
        expect(embeddingService.cosineSimilarity).toHaveBeenCalledTimes(1);
      });

      it('should filter by source', async () => {
        mockPrismaService.kbDocument.findMany.mockResolvedValue([]);

        await service.searchChunks(mockEmbedding, { sources: ['DOCS', 'FAQ'] });

        expect(mockPrismaService.kbDocument.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              source: { in: ['DOCS', 'FAQ'] },
            }),
          }),
        );
      });
    });

    describe('with pgvector enabled', () => {
      beforeEach(async () => {
        mockPrismaService.$queryRaw.mockResolvedValue([{ exists: true }]);
        await service.onModuleInit();
      });

      it('should use pgvector for search', async () => {
        const mockResults = [
          {
            id: 'chunk-1',
            content: 'Test content',
            document_id: 'doc-1',
            chunk_index: 0,
            metadata: {},
            doc_id: 'doc-1',
            doc_source: 'DOCS',
            doc_source_id: 'test.md',
            doc_title: 'Test Doc',
            similarity: 0.85,
          },
        ];

        mockPrismaService.$queryRaw.mockResolvedValue(mockResults);

        const results = await service.searchChunks(mockEmbedding, { topK: 5 });

        expect(results).toHaveLength(1);
        expect(results[0].score).toBe(0.85);
        expect(results[0].source).toBe('DOCS');
      });
    });
  });

  describe('searchFaqs', () => {
    const mockEmbedding = new Array(1536).fill(0.1);

    describe('with pgvector disabled', () => {
      beforeEach(async () => {
        mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
        await service.onModuleInit();
      });

      it('should search FAQs using in-memory similarity', async () => {
        const mockFaqs = [
          {
            id: 'faq-1',
            question: 'How to create client?',
            answer: 'Go to Clients > New',
            category: 'Clients',
            embedding: new Array(1536).fill(0.1),
          },
        ];

        mockPrismaService.kbFaq.findMany.mockResolvedValue(mockFaqs);
        mockEmbeddingService.cosineSimilarity.mockReturnValue(0.85);

        const results = await service.searchFaqs(mockEmbedding, { topK: 3, minScore: 0.5 });

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('How to create client?');
        expect(results[0].source).toBe('FAQ');
      });
    });
  });

  describe('storeDocument', () => {
    beforeEach(async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
      await service.onModuleInit();
    });

    it('should upsert document and create chunks', async () => {
      const document = {
        source: 'DOCS' as const,
        sourceId: 'test.md',
        title: 'Test Document',
        content: 'Full content here',
        hash: 'abc123',
      };

      const chunks = [
        {
          content: 'Chunk 1',
          chunkIndex: 0,
          startChar: 0,
          endChar: 100,
          embedding: new Array(1536).fill(0.1),
        },
      ];

      mockPrismaService.kbDocument.upsert.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.kbChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.kbChunk.createMany.mockResolvedValue({ count: 1 });

      const docId = await service.storeDocument(document, chunks);

      expect(docId).toBe('doc-1');
      expect(mockPrismaService.kbDocument.upsert).toHaveBeenCalled();
      expect(mockPrismaService.kbChunk.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1' },
      });
      expect(mockPrismaService.kbChunk.createMany).toHaveBeenCalled();
    });

    it('should update vector columns when pgvector is enabled', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: true }]);
      await service.onModuleInit();

      const document = {
        source: 'DOCS' as const,
        sourceId: 'test.md',
        title: 'Test',
        content: 'Content',
        hash: 'abc',
      };

      mockPrismaService.kbDocument.upsert.mockResolvedValue({ id: 'doc-1' });
      mockPrismaService.kbChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.kbChunk.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.$executeRaw.mockResolvedValue(1);

      await service.storeDocument(document, [
        { content: 'Chunk', chunkIndex: 0, startChar: 0, endChar: 5, embedding: new Array(1536).fill(0.1) },
      ]);

      expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('storeFaq', () => {
    beforeEach(async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
      await service.onModuleInit();
    });

    it('should create new FAQ', async () => {
      const faq = {
        question: 'How to do X?',
        answer: 'Do Y',
        category: 'General',
        keywords: ['x', 'y'],
        priority: 5,
        embedding: new Array(1536).fill(0.1),
      };

      mockPrismaService.kbFaq.create.mockResolvedValue({ id: 'faq-1', ...faq });

      const faqId = await service.storeFaq(faq);

      expect(faqId).toBe('faq-1');
      expect(mockPrismaService.kbFaq.create).toHaveBeenCalled();
    });

    it('should update existing FAQ', async () => {
      const faq = {
        id: 'faq-1',
        question: 'Updated question?',
        answer: 'Updated answer',
        embedding: new Array(1536).fill(0.1),
      };

      mockPrismaService.kbFaq.update.mockResolvedValue({ ...faq });

      const faqId = await service.storeFaq(faq);

      expect(faqId).toBe('faq-1');
      expect(mockPrismaService.kbFaq.update).toHaveBeenCalled();
    });
  });

  describe('needsReindex', () => {
    beforeEach(async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
      await service.onModuleInit();
    });

    it('should return true if document does not exist', async () => {
      mockPrismaService.kbDocument.findUnique.mockResolvedValue(null);

      const result = await service.needsReindex('DOCS', 'new.md', 'newhash');

      expect(result).toBe(true);
    });

    it('should return true if hash is different', async () => {
      mockPrismaService.kbDocument.findUnique.mockResolvedValue({ hash: 'oldhash' });

      const result = await service.needsReindex('DOCS', 'test.md', 'newhash');

      expect(result).toBe(true);
    });

    it('should return false if hash matches', async () => {
      mockPrismaService.kbDocument.findUnique.mockResolvedValue({ hash: 'samehash' });

      const result = await service.needsReindex('DOCS', 'test.md', 'samehash');

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: true }]);
      await service.onModuleInit();
    });

    it('should return statistics including pgvector status', async () => {
      mockPrismaService.kbDocument.count.mockResolvedValue(10);
      mockPrismaService.kbChunk.count.mockResolvedValue(50);
      mockPrismaService.kbFaq.count.mockResolvedValue(20);
      mockPrismaService.kbDocument.groupBy.mockResolvedValue([
        { source: 'DOCS', _count: 8 },
        { source: 'FAQ', _count: 2 },
      ]);

      const stats = await service.getStats();

      expect(stats.totalDocuments).toBe(10);
      expect(stats.totalChunks).toBe(50);
      expect(stats.totalFaqs).toBe(20);
      expect(stats.pgvectorEnabled).toBe(true);
      expect(stats.bySource).toEqual({ DOCS: 8, FAQ: 2 });
    });
  });

  describe('migrateToVector', () => {
    it('should throw error if pgvector is not available', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: false }]);
      await service.onModuleInit();

      await expect(service.migrateToVector()).rejects.toThrow('pgvector extension is not available');
    });

    it('should migrate embeddings when pgvector is available', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ exists: true }]);
      await service.onModuleInit();

      mockPrismaService.$executeRaw
        .mockResolvedValueOnce(10) // chunks
        .mockResolvedValueOnce(5);  // faqs

      const result = await service.migrateToVector();

      expect(result.chunks).toBe(10);
      expect(result.faqs).toBe(5);
    });
  });
});
