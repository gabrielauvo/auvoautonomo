/**
 * Knowledge Base Interfaces
 */

export interface KbSearchResult {
  /** Unique ID of the chunk or FAQ */
  id: string;
  /** The matching content */
  content: string;
  /** Similarity score (0-1, higher is better) */
  score: number;
  /** Source type */
  source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM';
  /** Source reference (file path, FAQ ID, etc) */
  sourceRef: string;
  /** Document title if available */
  title?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface KbSearchOptions {
  /** Maximum number of results to return */
  topK?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
  /** Filter by source types */
  sources?: Array<'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM'>;
  /** Include metadata in results */
  includeMetadata?: boolean;
}

export interface KbDocument {
  source: 'DOCS' | 'FAQ' | 'HELP_CENTER' | 'CUSTOM';
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface KbChunkInput {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, unknown>;
}

export interface KbIngestResult {
  documentId: string;
  chunksCreated: number;
  success: boolean;
  error?: string;
}

export interface KbIndexProgress {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalDocs: number;
  processedDocs: number;
  errorMessage?: string;
}
