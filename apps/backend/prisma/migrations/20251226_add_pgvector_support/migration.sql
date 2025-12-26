-- Enable pgvector extension for native vector search
-- Note: This requires PostgreSQL with pgvector extension installed
-- Install: CREATE EXTENSION IF NOT EXISTS vector;

-- Enable the vector extension (requires superuser or extension privileges)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector columns to kb_chunks table
-- Using vector(1536) for OpenAI text-embedding-3-small model
ALTER TABLE kb_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Add vector column to kb_faqs table
ALTER TABLE kb_faqs ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create indexes for vector similarity search using HNSW (Hierarchical Navigable Small World)
-- HNSW provides faster queries than IVFFlat at the cost of slower builds
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_vector
ON kb_chunks USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_kb_faqs_embedding_vector
ON kb_faqs USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Migrate existing Float[] embeddings to vector type
-- This converts the existing embedding arrays to the native vector format
UPDATE kb_chunks
SET embedding_vector = embedding::vector(1536)
WHERE embedding IS NOT NULL
  AND array_length(embedding, 1) = 1536
  AND embedding_vector IS NULL;

UPDATE kb_faqs
SET embedding_vector = embedding::vector(1536)
WHERE embedding IS NOT NULL
  AND array_length(embedding, 1) = 1536
  AND embedding_vector IS NULL;

-- Add embedding cache table for frequently queried embeddings
CREATE TABLE IF NOT EXISTS kb_embedding_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_hash VARCHAR(64) NOT NULL UNIQUE,
    embedding vector(1536) NOT NULL,
    model VARCHAR(100) NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Index for cache lookup by hash
CREATE INDEX IF NOT EXISTS idx_kb_embedding_cache_text_hash ON kb_embedding_cache(text_hash);

-- Index for cache cleanup by expiration
CREATE INDEX IF NOT EXISTS idx_kb_embedding_cache_expires_at ON kb_embedding_cache(expires_at);

-- Comment on the tables
COMMENT ON TABLE kb_embedding_cache IS 'Cache for frequently queried embeddings to reduce API calls';
COMMENT ON COLUMN kb_chunks.embedding_vector IS 'Native pgvector embedding for fast similarity search';
COMMENT ON COLUMN kb_faqs.embedding_vector IS 'Native pgvector embedding for fast similarity search';