# RAG (Retrieval-Augmented Generation) - Base de Conhecimento

Este documento descreve o sistema RAG implementado no AI Copilot para responder perguntas de suporte usando uma base de conhecimento.

## Visão Geral

O sistema RAG permite que o AI Copilot responda perguntas de suporte ("como faço X?", "o que é Y?") usando informações da documentação e FAQs, em vez de depender apenas do conhecimento do modelo LLM.

### Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Query    │────>│  KB Search      │────>│  Vector Store   │
│  "como faço X?" │     │  Service        │     │  (PostgreSQL +  │
└─────────────────┘     └─────────────────┘     │   pgvector)     │
                               │                └─────────────────┘
                               v                        │
                        ┌─────────────────┐             │
                        │  Embedding      │             v
                        │  Service        │     ┌─────────────────┐
                        │  (+ Cache)      │     │  HNSW Index     │
                        └─────────────────┘     │  (fast search)  │
                               │                └─────────────────┘
                               v
                        ┌─────────────────┐
                        │  Reranker       │
                        │  (cross-encoder)│
                        └─────────────────┘
```

### Novas Funcionalidades (v2.0)

1. **pgvector**: Busca vetorial nativa no PostgreSQL com índices HNSW
2. **Embedding Cache**: Cache de embeddings frequentes com TTL configurável
3. **Cross-Encoder Reranking**: Reordenação de resultados para melhor relevância

## Pipeline de Ingestão

### Fontes de Dados

1. **Documentação** (`/docs`): Arquivos Markdown do repositório
2. **FAQs**: Seeds de perguntas frequentes pré-definidas
3. **Help Center**: Conteúdo de central de ajuda (futuro)
4. **Custom**: Conteúdo customizado por tenant (futuro)

### Processo de Ingestão

```
Read → Chunk → Embed → Store → Index (pgvector)
```

1. **Read**: Lê o conteúdo do arquivo/entrada
2. **Chunk**: Divide em pedaços de ~1000 caracteres com 200 de overlap
3. **Embed**: Gera embeddings usando OpenAI `text-embedding-3-small`
4. **Store**: Armazena no PostgreSQL com vetor de 1536 dimensões
5. **Index**: Cria índice HNSW para busca rápida (quando pgvector está habilitado)

### Chunking

O chunking usa separadores inteligentes para não quebrar no meio de frases:

```typescript
separators: ['\\n\\n', '\\n', '. ', ' ']
```

- Prioriza quebra em parágrafos (`\n\n`)
- Depois em linhas (`\n`)
- Depois em sentenças (`. `)
- Por último em palavras (` `)

## Como Indexar Conteúdo

### 1. Adicionar FAQs

Edite o arquivo `apps/backend/src/kb/data/faq-seeds.ts`:

```typescript
export const FAQ_SEEDS = [
  {
    question: 'Como faço para criar um cliente?',
    answer: 'Acesse Cadastros > Clientes > Novo Cliente. Preencha os dados...',
    category: 'Clientes',
    keywords: ['cliente', 'cadastro', 'novo'],
    priority: 10,
  },
  // Adicione mais FAQs aqui
];
```

### 2. Adicionar Documentação

Coloque arquivos `.md` na pasta `/docs`. O sistema indexa automaticamente:

```markdown
# Título do Documento

Conteúdo que será indexado e usado para responder perguntas.

## Seção

Mais conteúdo...
```

### 3. Executar Seed

```bash
# Via NestJS CLI (recomendado)
npm run seed:kb

# Ou via código
await kbSeedCommand.seedAll();
```

### 4. Re-indexar

Para forçar re-indexação de uma fonte:

```typescript
await kbIngestService.reindexSource('DOCS');
await kbSeedCommand.seedDocs();
```

### 5. Migrar para pgvector

Se pgvector foi instalado após a ingestão inicial:

```typescript
// Migra embeddings existentes para formato vector nativo
await kbVectorStore.migrateToVector();
```

## Busca

### Detecção Automática

O sistema detecta automaticamente perguntas de suporte usando keywords:

```typescript
// Palavras que indicam suporte
const supportKeywords = [
  'como faço', 'como funciona', 'o que é',
  'onde encontro', 'não consigo', 'problema com',
  'how do i', 'how to', 'what is',
  // ...
];
```

### Processo de Busca (com Reranking)

1. Usuário envia mensagem
2. `isSupportQuestion()` verifica se é pergunta de suporte
3. Se sim, gera embedding da query (com cache)
4. Busca na KB usando pgvector (ou in-memory fallback)
5. **Reranking**: Cross-encoder reordena resultados por relevância
6. Retorna top-K resultados com score > minScore
7. Contexto é adicionado ao prompt do LLM

### Parâmetros de Busca

```typescript
interface ExtendedSearchOptions {
  topK?: number;           // Número máximo de resultados (default: 5)
  minScore?: number;       // Score mínimo de similaridade (default: 0.5)
  sources?: string[];      // Filtrar por fonte: 'DOCS', 'FAQ', etc.
  includeMetadata?: boolean; // Incluir metadata nos resultados
  enableReranking?: boolean; // Usar reranking (default: true)
  initialTopK?: number;    // Resultados iniciais antes de reranking (default: 20)
}
```

### Resposta de Busca

```typescript
interface KbSearchResponse {
  query: string;
  results: KbSearchResult[];
  totalResults: number;
  searchTimeMs: number;
  reranked: boolean;        // Se reranking foi aplicado
  pgvectorUsed: boolean;    // Se pgvector foi usado
  formattedContext?: string; // Contexto formatado para LLM
}
```

## pgvector - Busca Vetorial Nativa

### Instalação

```sql
-- Requer PostgreSQL com extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

### Migration

Execute a migration para adicionar suporte pgvector:

```bash
cd apps/backend
npx prisma migrate deploy
```

A migration `20251226_add_pgvector_support` irá:
1. Criar extensão vector
2. Adicionar colunas `embedding_vector` nas tabelas
3. Criar índices HNSW para busca rápida
4. Migrar embeddings existentes

### Índices HNSW

```sql
-- Índice para chunks
CREATE INDEX idx_kb_chunks_embedding_vector
ON kb_chunks USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para FAQs
CREATE INDEX idx_kb_faqs_embedding_vector
ON kb_faqs USING hnsw (embedding_vector vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Fallback Automático

Se pgvector não estiver disponível, o sistema usa busca in-memory automaticamente:

```typescript
// Verificar status
const stats = await kbSearchService.getStats();
console.log(stats.pgvectorEnabled); // true/false
```

## Cache de Embeddings

### Configuração

```env
# Habilitar/desabilitar cache (default: true)
KB_CACHE_ENABLED=true

# TTL do cache em ms (default: 24 horas)
KB_CACHE_TTL_MS=86400000

# Máximo de entradas no cache (default: 10000)
KB_CACHE_MAX_SIZE=10000
```

### Funcionamento

1. Query embedding é verificada no cache antes de chamar OpenAI
2. Cache hits economizam chamadas de API e reduzem latência
3. Entradas expiradas são limpas automaticamente
4. LRU eviction quando cache atinge tamanho máximo

### Estatísticas

```typescript
const cacheStats = await kbEmbeddingService.getCacheStats();
// {
//   totalEntries: 150,
//   totalHits: 1200,
//   oldestEntry: Date,
//   newestEntry: Date
// }
```

### Manutenção

```typescript
// Limpar cache manualmente
await kbEmbeddingService.clearCache();

// Limpar apenas entradas expiradas
await kbEmbeddingService.cleanupCache();
```

## Reranking (Cross-Encoder)

### Visão Geral

O reranking melhora a relevância dos resultados usando um modelo cross-encoder que avalia query+documento juntos.

### Providers Suportados

1. **Cohere Rerank** (recomendado): API dedicada para reranking
2. **OpenAI GPT**: Usa o LLM para scoring de relevância
3. **Fallback**: Reranking baseado em overlap de keywords

### Configuração

```env
# API do Cohere (recomendado para reranking)
COHERE_API_KEY=co-...

# Ou usar OpenAI
OPENAI_API_KEY=sk-...

# Habilitar/desabilitar reranking (default: true)
KB_RERANKER_ENABLED=true

# Modelo para reranking OpenAI (default: gpt-4o-mini)
KB_RERANKER_MODEL=gpt-4o-mini
```

### Pipeline de Reranking

1. Busca inicial retorna ~20 resultados
2. Cross-encoder avalia relevância de cada resultado
3. Resultados são reordenados por score de relevância
4. Top-K finais são retornados

### Fallback (Sem API)

Quando nenhuma API está configurada:
- Combina score original (60%) + overlap de conteúdo (25%) + overlap de título (15%)
- Funciona offline mas com menor precisão

## Estrutura do Banco

### Tabelas

```sql
-- Documentos indexados
CREATE TABLE kb_documents (
  id UUID PRIMARY KEY,
  source VARCHAR,      -- DOCS, FAQ, HELP_CENTER, CUSTOM
  source_id VARCHAR,   -- Identificador único da fonte
  title VARCHAR,
  content TEXT,
  hash VARCHAR,        -- SHA256 do conteúdo (para detectar mudanças)
  metadata JSONB,
  is_active BOOLEAN,
  indexed_at TIMESTAMP
);

-- Chunks com embeddings
CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES kb_documents,
  content TEXT,
  chunk_index INT,
  start_char INT,
  end_char INT,
  embedding FLOAT[],           -- Vetor de 1536 dimensões
  embedding_vector vector(1536), -- pgvector nativo
  metadata JSONB
);

-- FAQs com embeddings
CREATE TABLE kb_faqs (
  id UUID PRIMARY KEY,
  question TEXT,
  answer TEXT,
  category VARCHAR,
  keywords VARCHAR[],
  priority INT,
  embedding FLOAT[],
  embedding_vector vector(1536), -- pgvector nativo
  is_active BOOLEAN
);

-- Cache de embeddings
CREATE TABLE kb_embedding_cache (
  id UUID PRIMARY KEY,
  text_hash VARCHAR(64) UNIQUE,
  embedding vector(1536),
  model VARCHAR(100),
  hit_count INT,
  created_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

## Configuração

### Variáveis de Ambiente

```env
# API key do OpenAI (obrigatório para embeddings de produção)
OPENAI_API_KEY=sk-...

# API key do Cohere (opcional, para reranking)
COHERE_API_KEY=co-...

# Modelo de embedding (opcional, default: text-embedding-3-small)
KB_EMBEDDING_MODEL=text-embedding-3-small

# Configuração de cache
KB_CACHE_ENABLED=true
KB_CACHE_TTL_MS=86400000
KB_CACHE_MAX_SIZE=10000

# Configuração de reranking
KB_RERANKER_ENABLED=true
KB_RERANKER_MODEL=gpt-4o-mini
```

### Fallback Local

Sem `OPENAI_API_KEY`, o sistema usa um fallback hash-based:
- **Não recomendado para produção**
- Útil para desenvolvimento/testes locais
- Gera embeddings determinísticos baseados no hash do texto

## Monitoramento

### Estatísticas

```typescript
const stats = await kbSearchService.getStats();
// {
//   totalDocuments: 10,
//   totalChunks: 50,
//   totalFaqs: 20,
//   bySource: { DOCS: 5, FAQ: 5 },
//   pgvectorEnabled: true,
//   rerankerAvailable: true,
//   cacheStats: {
//     totalEntries: 150,
//     totalHits: 1200,
//     oldestEntry: Date,
//     newestEntry: Date
//   }
// }
```

### Logs

O sistema loga:
- Início/fim de ingestão com contagem de chunks
- Buscas com query, resultados e tempo (incluindo se reranked)
- Cache hits/misses
- Erros de embedding, reranking ou armazenamento

## Boas Práticas

### Para FAQs

1. **Perguntas claras**: Use linguagem natural, como o usuário perguntaria
2. **Respostas completas**: Inclua passo a passo quando necessário
3. **Keywords**: Adicione sinônimos e termos relacionados
4. **Categorias**: Organize por área funcional
5. **Prioridade**: Use valores maiores para FAQs mais importantes

### Para Documentação

1. **Títulos H1**: Cada documento deve ter um título claro
2. **Estrutura**: Use headers para organizar o conteúdo
3. **Tamanho**: Documentos menores e focados são melhores
4. **Linguagem**: Use termos que os usuários usariam

### Performance

1. **pgvector**: Sempre que possível, use pgvector para melhor performance
2. **Cache**: Mantenha o cache habilitado para reduzir latência
3. **Reranking**: Use Cohere para melhor qualidade de reranking
4. **Top-K**: 3-5 resultados finais são suficientes para contexto

## Limitações Atuais

1. ~~Busca vetorial simples: Não usa pgvector extension ainda~~ ✅ RESOLVIDO
2. ~~Sem reranking: Resultados são ordenados apenas por similaridade~~ ✅ RESOLVIDO
3. ~~Sem cache: Embeddings são gerados a cada busca~~ ✅ RESOLVIDO
4. **Single-tenant**: Sem separação por tenant ainda

## Próximos Passos

- [x] Integrar pgvector para busca vetorial nativa
- [x] Adicionar cache de embeddings de queries frequentes
- [x] Implementar reranking com cross-encoder
- [ ] Suporte multi-tenant
- [ ] Interface web para gerenciar FAQs
- [ ] Indexação automática de changelog/releases
