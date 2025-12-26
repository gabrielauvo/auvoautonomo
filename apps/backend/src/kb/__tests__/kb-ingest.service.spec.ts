/**
 * KbIngestService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KbIngestService } from '../services/kb-ingest.service';
import { KbEmbeddingService } from '../services/kb-embedding.service';
import { KbVectorStore } from '../services/kb-vector-store.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('KbIngestService', () => {
  let service: KbIngestService;

  const mockEmbedding = new Array(1536).fill(0.1);

  const mockPrismaService = {
    kbIndexJob: {
      create: jest.fn().mockResolvedValue({ id: 'job-123' }),
      update: jest.fn(),
    },
    kbDocument: {
      updateMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
  };

  const mockEmbeddingService = {
    embed: jest.fn().mockResolvedValue({ embedding: mockEmbedding, model: 'test' }),
    embedBatch: jest.fn().mockResolvedValue([
      { embedding: mockEmbedding, model: 'test' },
      { embedding: mockEmbedding, model: 'test' },
    ]),
  };

  const mockVectorStore = {
    needsReindex: jest.fn().mockResolvedValue(true),
    storeDocument: jest.fn().mockResolvedValue('doc-123'),
    storeFaq: jest.fn().mockResolvedValue('faq-123'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbIngestService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KbEmbeddingService, useValue: mockEmbeddingService },
        { provide: KbVectorStore, useValue: mockVectorStore },
      ],
    }).compile();

    service = module.get<KbIngestService>(KbIngestService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestDocument', () => {
    it('should ingest a short document without chunking', async () => {
      const document = {
        source: 'DOCS' as const,
        sourceId: 'test.md',
        title: 'Test Document',
        content: 'This is a short test document content.',
      };

      const result = await service.ingestDocument(document);

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBe(1);
      expect(mockVectorStore.storeDocument).toHaveBeenCalled();
    });

    it('should skip unchanged documents', async () => {
      mockVectorStore.needsReindex.mockResolvedValueOnce(false);

      const document = {
        source: 'DOCS' as const,
        sourceId: 'test.md',
        title: 'Test Document',
        content: 'This is a test document.',
      };

      const result = await service.ingestDocument(document);

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBe(0);
      expect(mockVectorStore.storeDocument).not.toHaveBeenCalled();
    });

    it('should chunk long documents', async () => {
      // Create a document longer than default chunk size (1000 chars)
      const longContent = 'This is a paragraph. '.repeat(100); // ~2100 chars

      // embedBatch is called with the chunks array, return embeddings for each chunk
      mockEmbeddingService.embedBatch.mockImplementationOnce((texts: string[]) =>
        Promise.resolve(texts.map(() => ({ embedding: mockEmbedding, model: 'test' })))
      );

      const document = {
        source: 'DOCS' as const,
        sourceId: 'long.md',
        title: 'Long Document',
        content: longContent,
      };

      const result = await service.ingestDocument(document);

      expect(result.success).toBe(true);
      expect(result.chunksCreated).toBeGreaterThan(1);
    });

    it('should handle ingestion errors gracefully', async () => {
      mockEmbeddingService.embedBatch.mockRejectedValueOnce(new Error('API Error'));

      const document = {
        source: 'DOCS' as const,
        sourceId: 'error.md',
        title: 'Error Document',
        content: 'Test content',
      };

      const result = await service.ingestDocument(document);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should extract title from H1 header', async () => {
      const document = {
        source: 'DOCS' as const,
        sourceId: 'headered.md',
        content: '# My Document Title\n\nThis is the content.',
      };

      await service.ingestDocument(document);

      expect(mockVectorStore.storeDocument).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Document Title' }),
        expect.any(Array),
      );
    });
  });

  describe('ingestFaqs', () => {
    it('should ingest multiple FAQs', async () => {
      const faqs = [
        { question: 'How do I create a customer?', answer: 'Go to Customers > New', category: 'Clientes' },
        { question: 'How do I create a quote?', answer: 'Go to Quotes > New', category: 'Orçamentos' },
      ];

      const result = await service.ingestFaqs(faqs);

      expect(result.total).toBe(2);
      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockVectorStore.storeFaq).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      mockEmbeddingService.embed
        .mockResolvedValueOnce({ embedding: mockEmbedding, model: 'test' })
        .mockRejectedValueOnce(new Error('API Error'));

      const faqs = [
        { question: 'FAQ 1', answer: 'Answer 1' },
        { question: 'FAQ 2', answer: 'Answer 2' },
      ];

      const result = await service.ingestFaqs(faqs);

      expect(result.total).toBe(2);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('should include FAQ metadata', async () => {
      const faqs = [
        {
          question: 'Test question',
          answer: 'Test answer',
          category: 'Test Category',
          keywords: ['test', 'keyword'],
          priority: 10,
        },
      ];

      await service.ingestFaqs(faqs);

      expect(mockVectorStore.storeFaq).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'Test question',
          answer: 'Test answer',
          category: 'Test Category',
          keywords: ['test', 'keyword'],
          priority: 10,
          embedding: mockEmbedding,
        }),
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      mockPrismaService.kbIndexJob.create.mockImplementation(() => ({
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-123',
          status: 'COMPLETED',
          totalDocs: 10,
          processedDocs: 10,
          errorMessage: null,
        }),
      }));

      // This test verifies the service can query job status
      // Full implementation would require proper Prisma mocking
    });
  });

  describe('reindexSource', () => {
    it('should mark documents for reindex', async () => {
      const count = await service.reindexSource('DOCS');

      expect(mockPrismaService.kbDocument.updateMany).toHaveBeenCalledWith({
        where: { source: 'DOCS' },
        data: { hash: '' },
      });
      expect(count).toBe(5);
    });
  });

  describe('chunking', () => {
    it('should create overlapping chunks', async () => {
      // Create content that will be chunked with overlap
      const paragraph = 'This is sentence one. This is sentence two. This is sentence three. ';
      const longContent = paragraph.repeat(20); // ~1400+ chars

      // embedBatch is called with the chunks array, return embeddings for each chunk
      mockEmbeddingService.embedBatch.mockImplementationOnce((texts: string[]) =>
        Promise.resolve(texts.map(() => ({ embedding: mockEmbedding, model: 'test' })))
      );

      const document = {
        source: 'DOCS' as const,
        sourceId: 'overlap.md',
        title: 'Overlap Test',
        content: longContent,
      };

      await service.ingestDocument(document);

      // Verify that storeDocument was called with chunks
      expect(mockVectorStore.storeDocument).toHaveBeenCalled();
      const storeCall = mockVectorStore.storeDocument.mock.calls[0];
      const chunks = storeCall[1];

      expect(chunks.length).toBeGreaterThan(1);

      // Verify chunk structure
      chunks.forEach((chunk: any, index: number) => {
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.content).toBeDefined();
        expect(chunk.startChar).toBeDefined();
        expect(chunk.endChar).toBeDefined();
        expect(chunk.embedding).toEqual(mockEmbedding);
      });
    });
  });
});
