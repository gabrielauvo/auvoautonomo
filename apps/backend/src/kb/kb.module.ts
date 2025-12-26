/**
 * Knowledge Base Module
 * RAG (Retrieval-Augmented Generation) for support questions
 *
 * Features:
 * - pgvector support for native vector search
 * - Embedding cache for frequently queried texts
 * - Cross-encoder reranking for improved relevance
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { KbSearchService } from './services/kb-search.service';
import { KbEmbeddingService } from './services/kb-embedding.service';
import { KbEmbeddingCacheService } from './services/kb-embedding-cache.service';
import { KbIngestService } from './services/kb-ingest.service';
import { KbVectorStore } from './services/kb-vector-store.service';
import { KbRerankerService } from './services/kb-reranker.service';
import { KbSeedCommand } from './kb-seed.command';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [
    KbEmbeddingCacheService,
    KbEmbeddingService,
    KbVectorStore,
    KbRerankerService,
    KbIngestService,
    KbSearchService,
    KbSeedCommand,
  ],
  exports: [
    KbSearchService,
    KbIngestService,
    KbSeedCommand,
    KbEmbeddingService,
    KbVectorStore,
    KbRerankerService,
    KbEmbeddingCacheService,
  ],
})
export class KbModule {}
