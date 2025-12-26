/**
 * Knowledge Base Reranker Service
 * Implements cross-encoder reranking for improved search relevance
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KbSearchResult } from '../interfaces/kb.interface';

export interface RerankedResult extends KbSearchResult {
  originalScore: number;
  rerankScore: number;
}

export interface RerankOptions {
  topK?: number;
  minScore?: number;
  model?: string;
}

@Injectable()
export class KbRerankerService {
  private readonly logger = new Logger(KbRerankerService.name);
  private readonly openaiApiKey?: string;
  private readonly cohereApiKey?: string;
  private readonly enabled: boolean;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.openaiApiKey = this.config.get<string>('OPENAI_API_KEY');
    this.cohereApiKey = this.config.get<string>('COHERE_API_KEY');
    this.enabled = this.config.get<boolean>('KB_RERANKER_ENABLED') !== false;
    this.defaultModel = this.config.get<string>('KB_RERANKER_MODEL') || 'gpt-4o-mini';

    if (this.enabled && (this.openaiApiKey || this.cohereApiKey)) {
      this.logger.log(`Reranker initialized with model: ${this.defaultModel}`);
    } else if (this.enabled) {
      this.logger.warn('Reranker enabled but no API key found - using fallback scoring');
    }
  }

  /**
   * Check if reranker is available
   */
  isAvailable(): boolean {
    return this.enabled && (!!this.openaiApiKey || !!this.cohereApiKey);
  }

  /**
   * Rerank search results using cross-encoder
   */
  async rerank(
    query: string,
    results: KbSearchResult[],
    options: RerankOptions = {},
  ): Promise<RerankedResult[]> {
    const { topK = 5, minScore = 0.3 } = options;

    if (results.length === 0) {
      return [];
    }

    // If reranker is not available, use fallback
    if (!this.isAvailable()) {
      return this.fallbackRerank(query, results, topK, minScore);
    }

    try {
      // Use Cohere rerank if available (purpose-built for this)
      if (this.cohereApiKey) {
        return await this.rerankWithCohere(query, results, topK, minScore);
      }

      // Otherwise use OpenAI for cross-encoder style reranking
      return await this.rerankWithOpenAI(query, results, topK, minScore);
    } catch (error) {
      this.logger.error(`Reranking failed, using fallback: ${error}`);
      return this.fallbackRerank(query, results, topK, minScore);
    }
  }

  /**
   * Rerank using Cohere Rerank API
   */
  private async rerankWithCohere(
    query: string,
    results: KbSearchResult[],
    topK: number,
    minScore: number,
  ): Promise<RerankedResult[]> {
    const documents = results.map((r) => r.content);

    const response = await fetch('https://api.cohere.ai/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.cohereApiKey}`,
      },
      body: JSON.stringify({
        model: 'rerank-english-v3.0',
        query,
        documents,
        top_n: topK,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    const reranked: RerankedResult[] = data.results
      .filter((r: { relevance_score: number }) => r.relevance_score >= minScore)
      .map((r: { index: number; relevance_score: number }) => ({
        ...results[r.index],
        originalScore: results[r.index].score,
        rerankScore: r.relevance_score,
        score: r.relevance_score,
      }));

    this.logger.debug(`Cohere reranked ${results.length} -> ${reranked.length} results`);

    return reranked;
  }

  /**
   * Rerank using OpenAI for cross-encoder style scoring
   */
  private async rerankWithOpenAI(
    query: string,
    results: KbSearchResult[],
    topK: number,
    minScore: number,
  ): Promise<RerankedResult[]> {
    // Build prompt for cross-encoder style scoring
    const scoringPrompt = this.buildScoringPrompt(query, results);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are a relevance scoring system. Given a query and documents, score each document's relevance from 0.0 to 1.0.
Output ONLY a JSON array of scores in the same order as the documents.
Example output: [0.95, 0.72, 0.45, 0.88]
Be precise and consistent in your scoring.`,
          },
          {
            role: 'user',
            content: scoringPrompt,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    // Parse scores from response
    const scores = this.parseScores(content, results.length);

    // Combine with original results and filter/sort
    const reranked: RerankedResult[] = results
      .map((result, index) => ({
        ...result,
        originalScore: result.score,
        rerankScore: scores[index],
        score: scores[index],
      }))
      .filter((r) => r.rerankScore >= minScore)
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);

    this.logger.debug(`OpenAI reranked ${results.length} -> ${reranked.length} results`);

    return reranked;
  }

  /**
   * Fallback reranking using keyword matching and original scores
   */
  private fallbackRerank(
    query: string,
    results: KbSearchResult[],
    topK: number,
    minScore: number,
  ): RerankedResult[] {
    const queryTerms = this.tokenize(query);

    const reranked: RerankedResult[] = results.map((result) => {
      const contentTerms = this.tokenize(result.content);
      const titleTerms = this.tokenize(result.title || '');

      // Calculate keyword overlap score
      const contentOverlap = this.calculateOverlap(queryTerms, contentTerms);
      const titleOverlap = this.calculateOverlap(queryTerms, titleTerms);

      // Combine original score with keyword matching
      // Weight: 60% original score, 25% content match, 15% title match
      const rerankScore =
        result.score * 0.6 +
        contentOverlap * 0.25 +
        titleOverlap * 0.15;

      return {
        ...result,
        originalScore: result.score,
        rerankScore,
        score: rerankScore,
      };
    });

    // Filter and sort
    return reranked
      .filter((r) => r.rerankScore >= minScore)
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);
  }

  /**
   * Build scoring prompt for OpenAI
   */
  private buildScoringPrompt(query: string, results: KbSearchResult[]): string {
    const documents = results
      .map((r, i) => `Document ${i + 1}:\nTitle: ${r.title || 'N/A'}\nContent: ${r.content.substring(0, 500)}`)
      .join('\n\n');

    return `Query: "${query}"\n\n${documents}\n\nScore each document's relevance to the query (0.0 to 1.0):`;
  }

  /**
   * Parse scores from LLM response
   */
  private parseScores(content: string, expectedCount: number): number[] {
    try {
      // Try to extract JSON array from response
      const match = content.match(/\[[\d.,\s]+\]/);
      if (match) {
        const scores = JSON.parse(match[0]) as number[];
        if (scores.length === expectedCount) {
          return scores.map((s) => Math.min(1, Math.max(0, s)));
        }
      }

      // Try parsing comma-separated values
      const numbers = content.match(/\d+\.?\d*/g);
      if (numbers && numbers.length >= expectedCount) {
        return numbers.slice(0, expectedCount).map((n) => {
          const score = parseFloat(n);
          return Math.min(1, Math.max(0, score));
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to parse scores: ${error}`);
    }

    // Return original normalized scores as fallback
    this.logger.warn('Could not parse rerank scores, using defaults');
    return new Array(expectedCount).fill(0.5);
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): Set<string> {
    const normalized = text.toLowerCase();
    const words = normalized.match(/\b\w{2,}\b/g) || [];
    return new Set(words);
  }

  /**
   * Calculate overlap between two term sets
   */
  private calculateOverlap(queryTerms: Set<string>, docTerms: Set<string>): number {
    if (queryTerms.size === 0 || docTerms.size === 0) {
      return 0;
    }

    let overlap = 0;
    for (const term of queryTerms) {
      if (docTerms.has(term)) {
        overlap++;
      }
    }

    return overlap / queryTerms.size;
  }
}
