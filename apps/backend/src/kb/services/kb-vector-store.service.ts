/**
 * Knowledge Base Vector Store
 * Stores and retrieves vector embeddings from PostgreSQL
 * Supports both pgvector (native) and in-memory similarity search
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { KbEmbeddingService } from './kb-embedding.service';
import { KbSearchResult, KbSearchOptions } from '../interfaces/kb.interface';

interface ChunkWithScore {
  id: string;
  content: string;
  documentId: string;
  chunkIndex: number;
  embedding: number[];
  metadata: unknown;
  document: {
    id: string;
    source: string;
    sourceId: string;
    title: string;
  };
}

interface FaqWithScore {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  embedding: number[];
}

interface PgVectorSearchResult {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
  metadata: unknown;
  doc_id: string;
  doc_source: string;
  doc_source_id: string;
  doc_title: string;
  similarity: number;
}

interface PgVectorFaqResult {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  similarity: number;
}

@Injectable()
export class KbVectorStore implements OnModuleInit {
  private readonly logger = new Logger(KbVectorStore.name);
  private pgvectorEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KbEmbeddingService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    // Check if pgvector is available
    await this.checkPgVectorSupport();
  }

  /**
   * Check if pgvector extension is available
   */
  private async checkPgVectorSupport(): Promise<void> {
    try {
      const result = await this.prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'vector'
        ) as exists
      `;

      this.pgvectorEnabled = result[0]?.exists === true;

      if (this.pgvectorEnabled) {
        this.logger.log('pgvector extension detected - using native vector search');
      } else {
        this.logger.warn('pgvector extension not found - using in-memory similarity search');
      }
    } catch (error) {
      this.logger.warn(`Could not check pgvector support: ${error}`);
      this.pgvectorEnabled = false;
    }
  }

  /**
   * Check if pgvector is enabled
   */
  isPgVectorEnabled(): boolean {
    return this.pgvectorEnabled;
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchChunks(
    queryEmbedding: number[],
    options: KbSearchOptions = {},
  ): Promise<KbSearchResult[]> {
    const { topK = 5, minScore = 0.5, sources } = options;

    // Use pgvector if available
    if (this.pgvectorEnabled) {
      return this.searchChunksWithPgVector(queryEmbedding, topK, minScore, sources);
    }

    // Fallback to in-memory search
    return this.searchChunksInMemory(queryEmbedding, topK, minScore, sources);
  }

  /**
   * Search chunks using pgvector native operators
   */
  private async searchChunksWithPgVector(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
    sources?: string[],
  ): Promise<KbSearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build source filter
    const sourceFilter = sources?.length
      ? Prisma.sql`AND d.source IN (${Prisma.join(sources)})`
      : Prisma.empty;

    // Use cosine similarity with pgvector
    // Note: pgvector uses <=> for cosine distance, we convert to similarity (1 - distance)
    const results = await this.prisma.$queryRaw<PgVectorSearchResult[]>`
      SELECT
        c.id,
        c.content,
        c.document_id,
        c.chunk_index,
        c.metadata,
        d.id as doc_id,
        d.source as doc_source,
        d.source_id as doc_source_id,
        d.title as doc_title,
        1 - (c.embedding_vector <=> ${embeddingStr}::vector) as similarity
      FROM kb_chunks c
      JOIN kb_documents d ON c.document_id = d.id
      WHERE d.is_active = true
        AND c.embedding_vector IS NOT NULL
        ${sourceFilter}
        AND 1 - (c.embedding_vector <=> ${embeddingStr}::vector) >= ${minScore}
      ORDER BY c.embedding_vector <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return results.map((r) => ({
      id: r.id,
      content: r.content,
      score: r.similarity,
      source: r.doc_source as 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
      sourceRef: r.doc_source_id,
      title: r.doc_title,
      metadata: r.metadata as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Search chunks using in-memory cosine similarity
   */
  private async searchChunksInMemory(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
    sources?: string[],
  ): Promise<KbSearchResult[]> {
    // Build source filter
    const sourceFilter = sources?.length
      ? { source: { in: sources } }
      : {};

    // Fetch all active chunks (with limit for performance)
    const chunks = await this.prisma.kbChunk.findMany({
      where: {
        document: {
          isActive: { equals: true },
          ...sourceFilter,
        },
      },
      include: {
        document: {
          select: {
            id: true,
            source: true,
            sourceId: true,
            title: true,
          },
        },
      },
      take: 1000, // Limit to prevent memory issues
    });

    // Calculate similarities
    const results: Array<{ chunk: typeof chunks[0]; score: number }> = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) {
        continue;
      }

      const score = this.embeddingService.cosineSimilarity(
        queryEmbedding,
        chunk.embedding,
      );

      if (score >= minScore) {
        results.push({
          chunk,
          score,
        });
      }
    }

    // Sort by score descending and take topK
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    return topResults.map((r) => ({
      id: r.chunk.id,
      content: r.chunk.content,
      score: r.score,
      source: r.chunk.document.source as 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
      sourceRef: r.chunk.document.sourceId,
      title: r.chunk.document.title,
      metadata: r.chunk.metadata as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Search FAQ entries using vector similarity
   */
  async searchFaqs(
    queryEmbedding: number[],
    options: KbSearchOptions = {},
  ): Promise<KbSearchResult[]> {
    const { topK = 5, minScore = 0.5 } = options;

    // Use pgvector if available
    if (this.pgvectorEnabled) {
      return this.searchFaqsWithPgVector(queryEmbedding, topK, minScore);
    }

    // Fallback to in-memory search
    return this.searchFaqsInMemory(queryEmbedding, topK, minScore);
  }

  /**
   * Search FAQs using pgvector native operators
   */
  private async searchFaqsWithPgVector(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
  ): Promise<KbSearchResult[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<PgVectorFaqResult[]>`
      SELECT
        id,
        question,
        answer,
        category,
        1 - (embedding_vector <=> ${embeddingStr}::vector) as similarity
      FROM kb_faqs
      WHERE is_active = true
        AND embedding_vector IS NOT NULL
        AND 1 - (embedding_vector <=> ${embeddingStr}::vector) >= ${minScore}
      ORDER BY embedding_vector <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return results.map((r) => ({
      id: r.id,
      content: r.answer,
      score: r.similarity,
      source: 'FAQ' as const,
      sourceRef: r.id,
      title: r.question,
      metadata: { category: r.category },
    }));
  }

  /**
   * Search FAQs using in-memory cosine similarity
   */
  private async searchFaqsInMemory(
    queryEmbedding: number[],
    topK: number,
    minScore: number,
  ): Promise<KbSearchResult[]> {
    // Fetch active FAQs
    const faqs = await this.prisma.kbFaq.findMany({
      where: {
        isActive: true,
      },
    });

    // Calculate similarities
    const results: Array<FaqWithScore & { score: number }> = [];

    for (const faq of faqs) {
      if (!faq.embedding || faq.embedding.length === 0) {
        continue;
      }

      const score = this.embeddingService.cosineSimilarity(
        queryEmbedding,
        faq.embedding,
      );

      if (score >= minScore) {
        results.push({
          ...faq,
          score,
        });
      }
    }

    // Sort by score descending and take topK
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, topK);

    return topResults.map((r) => ({
      id: r.id,
      content: r.answer,
      score: r.score,
      source: 'FAQ' as const,
      sourceRef: r.id,
      title: r.question,
      metadata: { category: r.category },
    }));
  }

  /**
   * Store a document with its chunks
   */
  async storeDocument(
    document: {
      source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM';
      sourceId: string;
      title: string;
      content: string;
      hash: string;
      metadata?: Record<string, unknown>;
    },
    chunks: Array<{
      content: string;
      chunkIndex: number;
      startChar: number;
      endChar: number;
      embedding: number[];
      metadata?: Record<string, unknown>;
    }>,
  ): Promise<string> {
    // Upsert document
    const doc = await this.prisma.kbDocument.upsert({
      where: {
        source_sourceId: {
          source: document.source,
          sourceId: document.sourceId,
        },
      },
      create: {
        source: document.source,
        sourceId: document.sourceId,
        title: document.title,
        content: document.content,
        hash: document.hash,
        metadata: document.metadata as Prisma.InputJsonValue,
        indexedAt: new Date(),
      },
      update: {
        title: document.title,
        content: document.content,
        hash: document.hash,
        metadata: document.metadata as Prisma.InputJsonValue,
        indexedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Delete existing chunks
    await this.prisma.kbChunk.deleteMany({
      where: { documentId: doc.id },
    });

    // Insert new chunks
    if (chunks.length > 0) {
      await this.prisma.kbChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: doc.id,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          embedding: chunk.embedding,
          metadata: chunk.metadata as Prisma.InputJsonValue,
        })),
      });

      // If pgvector is enabled, also update the vector column
      if (this.pgvectorEnabled) {
        await this.updateChunkVectors(doc.id);
      }
    }

    this.logger.log(
      `Stored document ${document.sourceId} with ${chunks.length} chunks`,
    );

    return doc.id;
  }

  /**
   * Update chunk vector columns from Float[] to vector type
   */
  private async updateChunkVectors(documentId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE kb_chunks
        SET embedding_vector = embedding::vector(1536)
        WHERE document_id = ${documentId}
          AND embedding IS NOT NULL
          AND array_length(embedding, 1) = 1536
      `;
    } catch (error) {
      this.logger.warn(`Failed to update chunk vectors: ${error}`);
    }
  }

  /**
   * Store or update a FAQ entry
   */
  async storeFaq(faq: {
    id?: string;
    question: string;
    answer: string;
    category?: string;
    keywords?: string[];
    priority?: number;
    embedding: number[];
  }): Promise<string> {
    let faqId: string;

    if (faq.id) {
      // Update existing
      const updated = await this.prisma.kbFaq.update({
        where: { id: faq.id },
        data: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          keywords: faq.keywords || [],
          priority: faq.priority || 0,
          embedding: faq.embedding,
        },
      });
      faqId = updated.id;
    } else {
      // Create new
      const created = await this.prisma.kbFaq.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          keywords: faq.keywords || [],
          priority: faq.priority || 0,
          embedding: faq.embedding,
        },
      });
      faqId = created.id;
    }

    // If pgvector is enabled, update the vector column
    if (this.pgvectorEnabled) {
      await this.updateFaqVector(faqId);
    }

    return faqId;
  }

  /**
   * Update FAQ vector column from Float[] to vector type
   */
  private async updateFaqVector(faqId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE kb_faqs
        SET embedding_vector = embedding::vector(1536)
        WHERE id = ${faqId}
          AND embedding IS NOT NULL
          AND array_length(embedding, 1) = 1536
      `;
    } catch (error) {
      this.logger.warn(`Failed to update FAQ vector: ${error}`);
    }
  }

  /**
   * Check if a document needs reindexing based on content hash
   */
  async needsReindex(
    source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
    sourceId: string,
    contentHash: string,
  ): Promise<boolean> {
    const existing = await this.prisma.kbDocument.findUnique({
      where: {
        source_sourceId: {
          source,
          sourceId,
        },
      },
      select: { hash: true },
    });

    if (!existing) {
      return true; // Document doesn't exist, needs indexing
    }

    return existing.hash !== contentHash;
  }

  /**
   * Get document by source
   */
  async getDocument(
    source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
    sourceId: string,
  ) {
    return this.prisma.kbDocument.findUnique({
      where: {
        source_sourceId: {
          source,
          sourceId,
        },
      },
      include: {
        chunks: true,
      },
    });
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(
    source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
    sourceId: string,
  ): Promise<boolean> {
    const result = await this.prisma.kbDocument.deleteMany({
      where: {
        source,
        sourceId,
      },
    });
    return result.count > 0;
  }

  /**
   * Get statistics about the knowledge base
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalFaqs: number;
    bySource: Record<string, number>;
    pgvectorEnabled: boolean;
  }> {
    const [documents, chunks, faqs, bySource] = await Promise.all([
      this.prisma.kbDocument.count({ where: { isActive: true } }),
      this.prisma.kbChunk.count(),
      this.prisma.kbFaq.count({ where: { isActive: true } }),
      this.prisma.kbDocument.groupBy({
        by: ['source'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    return {
      totalDocuments: documents,
      totalChunks: chunks,
      totalFaqs: faqs,
      bySource: bySource.reduce(
        (acc, item) => {
          acc[item.source] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      pgvectorEnabled: this.pgvectorEnabled,
    };
  }

  /**
   * Migrate all existing embeddings to pgvector format
   */
  async migrateToVector(): Promise<{ chunks: number; faqs: number }> {
    if (!this.pgvectorEnabled) {
      throw new Error('pgvector extension is not available');
    }

    // Migrate chunks
    const chunksResult = await this.prisma.$executeRaw`
      UPDATE kb_chunks
      SET embedding_vector = embedding::vector(1536)
      WHERE embedding IS NOT NULL
        AND array_length(embedding, 1) = 1536
        AND embedding_vector IS NULL
    `;

    // Migrate FAQs
    const faqsResult = await this.prisma.$executeRaw`
      UPDATE kb_faqs
      SET embedding_vector = embedding::vector(1536)
      WHERE embedding IS NOT NULL
        AND array_length(embedding, 1) = 1536
        AND embedding_vector IS NULL
    `;

    this.logger.log(`Migrated ${chunksResult} chunks and ${faqsResult} FAQs to pgvector`);

    return {
      chunks: Number(chunksResult),
      faqs: Number(faqsResult),
    };
  }
}
