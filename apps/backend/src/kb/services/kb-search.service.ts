/**
 * Knowledge Base Search Service
 * Main search interface for RAG queries with reranking support
 */

import { Injectable, Logger } from '@nestjs/common';
import { KbEmbeddingService } from './kb-embedding.service';
import { KbVectorStore } from './kb-vector-store.service';
import { KbRerankerService, RerankedResult } from './kb-reranker.service';
import { KbSearchResult, KbSearchOptions } from '../interfaces/kb.interface';

export interface KbSearchResponse {
  query: string;
  results: KbSearchResult[];
  totalResults: number;
  searchTimeMs: number;
  /** Whether results were reranked */
  reranked: boolean;
  /** Whether pgvector was used */
  pgvectorUsed: boolean;
  /** Formatted context for LLM consumption */
  formattedContext?: string;
}

export interface ExtendedSearchOptions extends KbSearchOptions {
  /** Enable reranking (default: true if available) */
  enableReranking?: boolean;
  /** Number of initial results to fetch before reranking */
  initialTopK?: number;
}

@Injectable()
export class KbSearchService {
  private readonly logger = new Logger(KbSearchService.name);

  constructor(
    private readonly embeddingService: KbEmbeddingService,
    private readonly vectorStore: KbVectorStore,
    private readonly rerankerService: KbRerankerService,
  ) {}

  /**
   * Search the knowledge base for relevant content
   * This is the main entry point for RAG queries
   */
  async search(query: string, options: ExtendedSearchOptions = {}): Promise<KbSearchResponse> {
    const startTime = Date.now();
    const {
      topK = 5,
      minScore = 0.5,
      sources,
      includeMetadata = false,
      enableReranking = true,
      initialTopK = 20, // Fetch more results initially for reranking
    } = options;

    try {
      // Generate query embedding
      const { embedding, fromCache } = await this.embeddingService.embed(query);

      if (fromCache) {
        this.logger.debug('Query embedding retrieved from cache');
      }

      // Determine search parameters based on reranking
      const useReranking = enableReranking && this.rerankerService.isAvailable();
      const searchTopK = useReranking ? Math.max(topK, initialTopK) : topK;

      // Search in parallel: chunks and FAQs
      const [chunkResults, faqResults] = await Promise.all([
        this.vectorStore.searchChunks(embedding, { topK: searchTopK, minScore: minScore * 0.8, sources }),
        sources?.includes('FAQ') !== false
          ? this.vectorStore.searchFaqs(embedding, { topK: searchTopK, minScore: minScore * 0.8 })
          : Promise.resolve([]),
      ]);

      // Merge and sort results
      let allResults: KbSearchResult[] = [...chunkResults, ...faqResults];
      allResults.sort((a, b) => b.score - a.score);

      // Apply reranking if available
      let reranked = false;
      if (useReranking && allResults.length > 0) {
        const rerankedResults = await this.rerankerService.rerank(query, allResults, {
          topK,
          minScore,
        });

        if (rerankedResults.length > 0) {
          allResults = rerankedResults.map((r: RerankedResult) => ({
            id: r.id,
            content: r.content,
            score: r.score,
            source: r.source,
            sourceRef: r.sourceRef,
            title: r.title,
            metadata: r.metadata,
          }));
          reranked = true;
        }
      }

      // Take top K from results if not already limited by reranker
      const topResults = reranked ? allResults : allResults.slice(0, topK).filter((r) => r.score >= minScore);

      // Remove metadata if not requested
      if (!includeMetadata) {
        topResults.forEach((r) => {
          delete r.metadata;
        });
      }

      const searchTimeMs = Date.now() - startTime;

      this.logger.debug(
        `Search completed: query="${query.substring(0, 50)}..." found ${topResults.length} results in ${searchTimeMs}ms (reranked: ${reranked})`,
      );

      return {
        query,
        results: topResults,
        totalResults: topResults.length,
        searchTimeMs,
        reranked,
        pgvectorUsed: this.vectorStore.isPgVectorEnabled(),
        formattedContext: this.formatContextForLLM(topResults),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Search failed for query "${query}": ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Quick search optimized for FAQ-style questions
   * Prioritizes FAQ entries and uses higher similarity threshold
   */
  async searchFaq(query: string, topK = 3): Promise<KbSearchResult[]> {
    const { embedding } = await this.embeddingService.embed(query);

    const results = await this.vectorStore.searchFaqs(embedding, {
      topK: topK * 2, // Get more for potential reranking
      minScore: 0.5, // Lower initial threshold
    });

    // Apply reranking if available
    if (this.rerankerService.isAvailable() && results.length > 0) {
      const reranked = await this.rerankerService.rerank(query, results, {
        topK,
        minScore: 0.6,
      });
      return reranked;
    }

    return results.filter((r) => r.score >= 0.6).slice(0, topK);
  }

  /**
   * Search specifically in documentation
   */
  async searchDocs(query: string, topK = 5): Promise<KbSearchResult[]> {
    const { embedding } = await this.embeddingService.embed(query);

    const results = await this.vectorStore.searchChunks(embedding, {
      topK: topK * 2,
      minScore: 0.4,
      sources: ['DOCS'],
    });

    // Apply reranking if available
    if (this.rerankerService.isAvailable() && results.length > 0) {
      const reranked = await this.rerankerService.rerank(query, results, {
        topK,
        minScore: 0.5,
      });
      return reranked;
    }

    return results.filter((r) => r.score >= 0.5).slice(0, topK);
  }

  /**
   * Semantic search without reranking (for testing/comparison)
   */
  async searchSemanticOnly(query: string, options: KbSearchOptions = {}): Promise<KbSearchResponse> {
    return this.search(query, { ...options, enableReranking: false });
  }

  /**
   * Format search results as context for LLM
   */
  private formatContextForLLM(results: KbSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const sections: string[] = [];

    for (const result of results) {
      const source = this.formatSource(result);
      const header = result.title
        ? `### ${result.title} (${source})`
        : `### ${source}`;

      sections.push(`${header}\n${result.content}`);
    }

    return `## Informações da Base de Conhecimento\n\n${sections.join('\n\n---\n\n')}`;
  }

  /**
   * Format source reference
   */
  private formatSource(result: KbSearchResult): string {
    switch (result.source) {
      case 'FAQ':
        return 'FAQ';
      case 'DOCS':
        return `Documentação: ${result.sourceRef}`;
      case 'HELP_CENTER':
        return 'Central de Ajuda';
      case 'CUSTOM':
        return result.sourceRef;
      default:
        return 'Base de Conhecimento';
    }
  }

  /**
   * Check if a query is likely a support question
   */
  isSupportQuestion(message: string): boolean {
    const normalized = message.toLowerCase().trim();

    // Keywords that indicate a support/help question
    const supportKeywords = [
      'como faço',
      'como fazer',
      'como posso',
      'como eu',
      'como funciona',
      'o que é',
      'o que significa',
      'qual a diferença',
      'para que serve',
      'onde encontro',
      'onde fica',
      'preciso de ajuda',
      'não consigo',
      'não estou conseguindo',
      'não funciona',
      'está dando erro',
      'deu erro',
      'problema com',
      'dúvida sobre',
      'duvida sobre',
      'pode me explicar',
      'me explica',
      'como configuro',
      'como configurar',
      'como ativo',
      'como ativar',
      'como desativo',
      'como desativar',
      'tutorial',
      'passo a passo',
      // English variants
      'how do i',
      'how can i',
      'how to',
      'what is',
      "what's",
      'where is',
      'where can i find',
      'help me',
      'i need help',
      "can't",
      "doesn't work",
      'not working',
      'error',
    ];

    // Check if message contains any support keyword
    for (const keyword of supportKeywords) {
      if (normalized.includes(keyword)) {
        return true;
      }
    }

    // Check for question marks at the end (common for support questions)
    if (normalized.endsWith('?') && normalized.length > 10) {
      // Additional heuristic: short questions are often support-related
      return true;
    }

    return false;
  }

  /**
   * Get KB statistics
   */
  async getStats() {
    const vectorStats = await this.vectorStore.getStats();
    const cacheStats = await this.embeddingService.getCacheStats();

    return {
      ...vectorStats,
      rerankerAvailable: this.rerankerService.isAvailable(),
      cacheStats,
    };
  }
}
