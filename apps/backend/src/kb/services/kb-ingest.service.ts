/**
 * Knowledge Base Ingest Service
 * Pipeline: read -> chunk -> embed -> store
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KbEmbeddingService } from './kb-embedding.service';
import { KbVectorStore } from './kb-vector-store.service';
import { KbDocument, KbIngestResult, KbIndexProgress } from '../interfaces/kb.interface';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface ChunkOptions {
  /** Maximum characters per chunk */
  maxChunkSize?: number;
  /** Overlap between chunks */
  overlap?: number;
  /** Split on these characters preferentially */
  separators?: string[];
}

@Injectable()
export class KbIngestService {
  private readonly logger = new Logger(KbIngestService.name);
  private readonly defaultChunkOptions: Required<ChunkOptions> = {
    maxChunkSize: 1000,
    overlap: 200,
    separators: ['\n\n', '\n', '. ', ' '],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KbEmbeddingService,
    private readonly vectorStore: KbVectorStore,
  ) {}

  /**
   * Calculate SHA256 hash of content
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Split text into chunks
   */
  private chunkText(
    text: string,
    options: ChunkOptions = {},
  ): Array<{ content: string; startChar: number; endChar: number }> {
    const opts = { ...this.defaultChunkOptions, ...options };
    const chunks: Array<{ content: string; startChar: number; endChar: number }> = [];

    if (text.length <= opts.maxChunkSize) {
      return [{ content: text, startChar: 0, endChar: text.length }];
    }

    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + opts.maxChunkSize, text.length);

      // If not at the end, try to find a good break point
      if (end < text.length) {
        let bestBreak = end;
        let bestSeparatorPriority = opts.separators.length;

        // Look for separators near the end of the chunk
        const searchStart = Math.max(start + opts.maxChunkSize / 2, start);
        const searchText = text.substring(searchStart, end);

        for (let i = 0; i < opts.separators.length; i++) {
          const sep = opts.separators[i];
          const lastIdx = searchText.lastIndexOf(sep);

          if (lastIdx !== -1 && i < bestSeparatorPriority) {
            bestBreak = searchStart + lastIdx + sep.length;
            bestSeparatorPriority = i;
          }
        }

        end = bestBreak;
      }

      const chunk = text.substring(start, end).trim();
      if (chunk.length > 0) {
        chunks.push({
          content: chunk,
          startChar: start,
          endChar: end,
        });
      }

      // Move start with overlap
      start = end - opts.overlap;
      if (start <= chunks[chunks.length - 1]?.startChar) {
        start = end;
      }
    }

    return chunks;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string, fallback: string): string {
    // Try to find H1 header
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }

    // Try to find first line of content
    const firstLine = content.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) {
      return firstLine;
    }

    return fallback;
  }

  /**
   * Ingest a single document
   */
  async ingestDocument(
    document: KbDocument,
    options: ChunkOptions = {},
  ): Promise<KbIngestResult> {
    const startTime = Date.now();

    try {
      // Calculate content hash
      const hash = this.hashContent(document.content);

      // Check if reindexing is needed
      const needsReindex = await this.vectorStore.needsReindex(
        document.source,
        document.sourceId,
        hash,
      );

      if (!needsReindex) {
        this.logger.debug(`Document ${document.sourceId} unchanged, skipping`);
        return {
          documentId: '',
          chunksCreated: 0,
          success: true,
        };
      }

      // Chunk the content
      const textChunks = this.chunkText(document.content, options);
      this.logger.debug(
        `Document ${document.sourceId} split into ${textChunks.length} chunks`,
      );

      // Generate embeddings for all chunks
      const embeddings = await this.embeddingService.embedBatch(
        textChunks.map((c) => c.content),
      );

      // Prepare chunks with embeddings
      const chunks = textChunks.map((chunk, index) => ({
        content: chunk.content,
        chunkIndex: index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        embedding: embeddings[index].embedding,
        metadata: document.metadata,
      }));

      // Store document and chunks
      const docId = await this.vectorStore.storeDocument(
        {
          source: document.source,
          sourceId: document.sourceId,
          title: document.title || this.extractTitle(document.content, document.sourceId),
          content: document.content,
          hash,
          metadata: document.metadata,
        },
        chunks,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `Ingested document ${document.sourceId}: ${chunks.length} chunks in ${duration}ms`,
      );

      return {
        documentId: docId,
        chunksCreated: chunks.length,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to ingest document ${document.sourceId}: ${errorMessage}`);

      return {
        documentId: '',
        chunksCreated: 0,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Ingest all markdown files from a directory
   */
  async ingestDocsFolder(
    docsPath: string,
    options: ChunkOptions = {},
  ): Promise<KbIndexProgress> {
    // Create index job
    const job = await this.prisma.kbIndexJob.create({
      data: {
        source: 'DOCS',
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    try {
      // Find all markdown files
      const files = this.findMarkdownFiles(docsPath);

      await this.prisma.kbIndexJob.update({
        where: { id: job.id },
        data: { totalDocs: files.length },
      });

      this.logger.log(`Found ${files.length} markdown files in ${docsPath}`);

      let processedDocs = 0;
      let failedDocs = 0;

      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(docsPath, filePath);

          const result = await this.ingestDocument(
            {
              source: 'DOCS',
              sourceId: relativePath,
              title: this.extractTitle(content, path.basename(filePath, '.md')),
              content,
              metadata: {
                filePath: relativePath,
                fileName: path.basename(filePath),
              },
            },
            options,
          );

          if (result.success) {
            processedDocs++;
          } else {
            failedDocs++;
          }

          // Update progress
          await this.prisma.kbIndexJob.update({
            where: { id: job.id },
            data: { processedDocs },
          });
        } catch (error) {
          this.logger.error(`Failed to process file ${filePath}: ${error}`);
          failedDocs++;
        }
      }

      // Mark job as completed
      await this.prisma.kbIndexJob.update({
        where: { id: job.id },
        data: {
          status: failedDocs === files.length ? 'FAILED' : 'COMPLETED',
          completedAt: new Date(),
          errorMessage: failedDocs > 0 ? `${failedDocs} documents failed` : null,
        },
      });

      return {
        jobId: job.id,
        status: failedDocs === files.length ? 'FAILED' : 'COMPLETED',
        totalDocs: files.length,
        processedDocs,
        errorMessage: failedDocs > 0 ? `${failedDocs} documents failed` : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.prisma.kbIndexJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage,
        },
      });

      return {
        jobId: job.id,
        status: 'FAILED',
        totalDocs: 0,
        processedDocs: 0,
        errorMessage,
      };
    }
  }

  /**
   * Find all markdown files in a directory recursively
   */
  private findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      this.logger.warn(`Directory not found: ${dir}`);
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.findMarkdownFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Ingest FAQ entries from a JSON file or array
   */
  async ingestFaqs(
    faqs: Array<{
      question: string;
      answer: string;
      category?: string;
      keywords?: string[];
      priority?: number;
    }>,
  ): Promise<{ total: number; success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const faq of faqs) {
      try {
        // Generate embedding for the question
        const { embedding } = await this.embeddingService.embed(faq.question);

        // Store FAQ
        await this.vectorStore.storeFaq({
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          keywords: faq.keywords,
          priority: faq.priority,
          embedding,
        });

        success++;
      } catch (error) {
        this.logger.error(`Failed to ingest FAQ: ${faq.question} - ${error}`);
        failed++;
      }
    }

    this.logger.log(`Ingested FAQs: ${success} success, ${failed} failed`);

    return { total: faqs.length, success, failed };
  }

  /**
   * Get indexing job status
   */
  async getJobStatus(jobId: string): Promise<KbIndexProgress | null> {
    const job = await this.prisma.kbIndexJob.findUnique({
      where: { id: jobId },
    });

    if (!job) return null;

    return {
      jobId: job.id,
      status: job.status,
      totalDocs: job.totalDocs,
      processedDocs: job.processedDocs,
      errorMessage: job.errorMessage || undefined,
    };
  }

  /**
   * Reindex all documents from a source
   */
  async reindexSource(
    source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM',
  ): Promise<number> {
    // Mark all documents from source as needing reindex
    const result = await this.prisma.kbDocument.updateMany({
      where: { source },
      data: { hash: '' }, // Reset hash to force reindex
    });

    this.logger.log(`Marked ${result.count} documents for reindex from source: ${source}`);
    return result.count;
  }
}
