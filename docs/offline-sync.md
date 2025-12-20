# Arquitetura Offline-First e Sincronizacao

Este documento detalha a estrategia offline-first implementada no app mobile Auvo Field.

## Indice

1. [Visao Geral](#visao-geral)
2. [Armazenamento Local](#armazenamento-local)
3. [Fila de Mutacoes](#fila-de-mutacoes)
4. [Motor de Sincronizacao](#motor-de-sincronizacao)
5. [Resolucao de Conflitos](#resolucao-de-conflitos)
6. [Estados e Transicoes](#estados-e-transicoes)
7. [Upload de Midia](#upload-de-midia)
8. [Limitacoes Conhecidas](#limitacoes-conhecidas)

---

## Visao Geral

### Principio Fundamental

O app mobile opera em modo **offline-first**, significando que:

1. **Todas as operacoes sao salvas localmente primeiro** (otimista)
2. **A UI reflete imediatamente** as mudancas locais
3. **A sincronizacao ocorre em background** quando ha rede
4. **O app funciona 100% sem internet** com dados ja sincronizados

### Diagrama de Alto Nivel

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   UI Component   |---->|   Service Layer  |---->|   Repository     |
|                  |     |   (Business)     |     |   (SQLite)       |
|                  |     |                  |     |                  |
+------------------+     +--------+---------+     +------------------+
                                 |
                                 v
                         +-------+--------+
                         |                |
                         | Mutation Queue |
                         |   (SQLite)     |
                         |                |
                         +-------+--------+
                                 |
                         +-------+--------+
                         |                |
                         |  Sync Engine   |<---- Network Events
                         |                |
                         +-------+--------+
                                 |
                                 v
                         +-------+--------+
                         |                |
                         |  Backend API   |
                         |  (REST + Sync) |
                         |                |
                         +----------------+
```

### Fluxo Completo

```
[Usuario cria/edita]
        |
        v
[Salva no SQLite local] <-- IMEDIATO (otimista)
        |
        v
[Enfileira mutacao]
        |
        v
[Online?]--No--> [Aguarda rede]
   |                    |
  Yes                   |
   |                    v
   v              [Network event]
[Debounce 2s]           |
        |               |
        v<--------------+
[PUSH: Envia mutacoes]
        |
        v
[PULL: Busca atualizacoes]
        |
        v
[Atualiza SQLite local]
        |
        v
[Notifica UI via eventos]
```

---

## Armazenamento Local

### Banco de Dados

- **Tecnologia**: Expo SQLite
- **Arquivo**: `prodesign.db`
- **Otimizacoes**: WAL mode, foreign keys, indexes

### Tabelas de Dados

| Tabela | Tipo | Sync | Descricao |
|--------|------|------|-----------|
| `clients` | Dados | Bidirecional | Clientes do tecnico |
| `work_orders` | Dados | Bidirecional | Ordens de servico |
| `quotes` | Dados | Bidirecional | Orcamentos |
| `quote_items` | Dados | Bidirecional | Itens dos orcamentos |
| `invoices` | Dados | Bidirecional | Faturas |
| `product_categories` | Catalogo | Pull-only | Categorias de produtos |
| `catalog_items` | Catalogo | Pull-only | Produtos/servicos |
| `bundle_items` | Catalogo | Pull-only | Componentes de kits |
| `checklist_templates` | Config | Pull-only | Templates de checklist |
| `checklist_instances` | Dados | Bidirecional | Checklists preenchidos |
| `checklist_answers` | Dados | Bidirecional | Respostas |
| `checklist_attachments` | Dados | Bidirecional | Fotos/assinaturas |

### Tabelas de Controle

| Tabela | Proposito |
|--------|-----------|
| `mutations_queue` | Fila de mutacoes pendentes |
| `sync_meta` | Metadata de sync (cursor, ultimo sync) |
| `upload_queue` | Fila de uploads de midia |

### Denormalizacao

Para funcionamento offline, dados sao duplicados:

```sql
-- work_orders armazena dados do cliente
clientName TEXT,
clientPhone TEXT,
clientAddress TEXT

-- catalog_items armazena dados da categoria
categoryName TEXT,
categoryColor TEXT
```

**Motivo**: Exibir informacoes completas sem JOINs quando offline.

---

## Fila de Mutacoes

### Estrutura da Fila

```sql
CREATE TABLE mutations_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,        -- 'clients', 'quotes', etc
  entityId TEXT NOT NULL,      -- UUID do registro
  operation TEXT NOT NULL,     -- 'create', 'update', 'delete'
  payload TEXT NOT NULL,       -- JSON com dados
  status TEXT DEFAULT 'pending', -- 'pending'|'processing'|'failed'|'completed'
  attempts INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  lastAttempt TEXT,
  errorMessage TEXT
);
```

### Ciclo de Vida da Mutacao

```
[PENDING] --> [PROCESSING] --> [COMPLETED]
    |              |
    |              v
    |         [FAILED] (attempts < 3)
    |              |
    |              v
    +--------> [FAILED] (attempts >= 3) --> Requer intervencao
```

### API do MutationQueue

```typescript
// Enfileirar mutacao
await MutationQueue.enqueue('clients', id, 'create', clientData);

// Obter pendentes por entidade
const pending = await MutationQueue.getPendingByEntity('clients');

// Marcar como processando
await MutationQueue.markProcessing(mutationId);

// Marcar como concluida
await MutationQueue.markCompleted(mutationId);

// Marcar como falha
await MutationQueue.markFailed(mutationId, 'Error message');

// Contar pendentes
const count = await MutationQueue.countPending();
```

### Debounce e Batching

- **Debounce**: 2 segundos apos ultima mutacao
- **Batching**: Mutacoes da mesma entidade sao enviadas juntas
- **Ordenacao**: Respeitada ordem de criacao (FIFO)

---

## Motor de Sincronizacao

### SyncEngine (Singleton)

Localização: `apps/mobile/src/sync/SyncEngine.ts`

### Configuracao

```typescript
syncEngine.configure({
  baseUrl: 'https://api.auvo.com',
  authToken: 'Bearer xyz...',
  technicianId: 'uuid-do-tecnico'
});
```

### Ciclo de Sync

```typescript
async syncAll() {
  // 1. PUSH: Envia mutacoes pendentes
  await this.pushPendingMutations();

  // 2. PULL: Para cada entidade registrada
  for (const config of this.entities) {
    await this.pullEntity(config);
  }

  // 3. Atualiza metadata
  await this.updateSyncMeta();
}
```

### Push (Envio de Mutacoes)

```
1. Agrupa mutacoes por entidade
2. Ordena por dependencia (clients antes de quotes)
3. Para cada grupo:
   a. POST /sync/{entity}/mutations
   b. Corpo: { mutations: [...] }
4. Para cada resultado:
   a. 'applied' -> markCompleted
   b. 'rejected' -> markFailed (com server record para merge)
```

### Pull (Recebimento de Dados)

```
1. Obtem lastCursor e lastSyncAt da sync_meta
2. GET /sync/{entity}?since={lastSyncAt}&cursor={cursor}&limit=100
3. Resposta: { items, nextCursor, hasMore, serverTime }
4. Filtra items com mutacoes pendentes (protecao)
5. UPSERT no SQLite local
6. Atualiza sync_meta com novo cursor
7. Se hasMore, repete do passo 2
```

### Protecao de Registros Pendentes

```typescript
// Durante o PULL, nao sobrescreve registros com mutacoes pendentes
const pendingIds = new Set(
  await MutationQueue.getPendingEntityIds(entity)
);

const safeToUpdate = serverItems.filter(
  item => !pendingIds.has(item.id)
);
```

---

## Resolucao de Conflitos

### Estrategia: Last-Write-Wins (LWW)

```
Servidor:  { name: "ACME Corp", updatedAt: "2025-12-17T15:00:00Z" }
Local:     { name: "ACME",      updatedAt: "2025-12-17T15:05:00Z" }

Resultado: Local vence (mais recente)
```

### Fluxo de Conflito

```
[Push mutacao local]
        |
        v
[Servidor compara timestamps]
        |
    +---+---+
    |       |
  Local   Server
  Newer   Newer
    |       |
    v       v
 APPLIED  REJECTED
            |
            v
    [Retorna server record]
            |
            v
    [App decide: aceitar ou retry]
```

### Protecao Contra Perda de Dados

1. **Mutacoes pendentes nao sao sobrescritas** durante PULL
2. **Mutacoes rejeitadas mantem copia local** com flag
3. **Retry automatico** ate 3 tentativas
4. **Erro visivel na UI** apos 3 falhas

### Cenarios de Conflito

| Cenario | Comportamento |
|---------|---------------|
| Edicao local, sem sync | Local salvo, enfileirado |
| Edicao local + servidor atualizou antes | Local sobrescreve servidor |
| Edicao local + servidor atualizou depois | Servidor rejeita, app recebe versao nova |
| Delete local + servidor editou | Delete aplicado (delete vence) |
| Edicao local + servidor deletou | Conflito - registro pode ser recriado |

---

## Estados e Transicoes

### Diagrama de Estados do Registro

```
                    +-------------+
                    |             |
          +-------->|   SYNCED    |<--------+
          |         |             |         |
          |         +------+------+         |
          |                |                |
     [Sync OK]        [Usuario edita]   [Pull recebe]
          |                |                |
          |                v                |
          |         +------+------+         |
          |         |             |         |
          +---------+   PENDING   +---------+
                    |   SYNC      |
                    +------+------+
                           |
                      [Online]
                           |
                           v
                    +------+------+
                    |             |
                    |  SYNCING    |
                    |             |
                    +------+------+
                           |
                    +------+------+
                    |             |
               [Success]    [Failure]
                    |             |
                    v             v
              [SYNCED]      [FAILED]
                            (retry < 3)
```

### Estados da Sync Engine

```typescript
type SyncState = {
  status: 'idle' | 'syncing' | 'error';
  lastSyncAt: Date | null;
  currentEntity: string | null;
  progress: number; // 0-100
  error: SyncError | null;
};
```

### Eventos de Sync

```typescript
type SyncEvent =
  | { type: 'sync_started' }
  | { type: 'sync_progress', entity: string, progress: number }
  | { type: 'sync_completed', stats: SyncStats }
  | { type: 'sync_error', error: SyncError }
  | { type: 'online_detected' }
  | { type: 'offline_detected' }
  | { type: 'mutation_pushed', entityId: string }
  | { type: 'mutation_failed', entityId: string, error: string };
```

---

## Upload de Midia

### Tipos de Midia

- **PHOTO**: Fotos de checklist (comprimidas)
- **SIGNATURE**: Assinaturas digitais (PNG base64)
- **FILE**: Documentos genericos

### Fluxo de Upload

```
[Usuario tira foto]
        |
        v
[Salva localmente]
  - localPath: /documents/photo_123.jpg
  - syncStatus: 'PENDING'
        |
        v
[Enfileira upload]
        |
        v
[Online?]--No--> [Aguarda]
   |
  Yes
   |
   v
[Comprime imagem] (800x800, quality 0.5)
        |
        v
[Converte para base64]
        |
        v
[POST /attachments/base64]
        |
        v
[Recebe remotePath]
        |
        v
[Atualiza registro]
  - remotePath: https://...
  - syncStatus: 'SYNCED'
        |
        v
[Deleta arquivo local] (opcional)
```

### Retry com Exponential Backoff

```typescript
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms

async function uploadWithRetry(attachment, attempt = 0) {
  try {
    return await upload(attachment);
  } catch (error) {
    if (attempt < RETRY_DELAYS.length) {
      await delay(RETRY_DELAYS[attempt]);
      return uploadWithRetry(attachment, attempt + 1);
    }
    throw error;
  }
}
```

### Concorrencia

- **Max 2 uploads simultaneos**
- **Fila FIFO** para uploads pendentes
- **Prioridade**: Assinaturas > Fotos > Arquivos

---

## Limitacoes Conhecidas

### 1. Perda de Dados em Conflito

**Cenario**: Usuario A edita offline, Usuario B edita online, A sincroniza.

**Resultado**: Dados de B podem ser perdidos (LWW).

**Mitigacao**:
- Sistema e single-user por tecnico
- Dados criticos (assinaturas) nao sao editaveis

### 2. Ordem de Dependencias

**Cenario**: Criar quote com client novo, ambos offline.

**Resultado**: Se client push falha, quote tambem falha.

**Mitigacao**:
- Push respeita ordem de dependencia
- Client sempre antes de Quote/WorkOrder

### 3. Espaco em Disco

**Cenario**: Muitas fotos tiradas offline.

**Resultado**: Pode esgotar armazenamento.

**Mitigacao**:
- Compressao agressiva de imagens
- Limpeza de cache apos sync
- Limite de tamanho por checklist

### 4. Sync Parcial

**Cenario**: App fechado durante sync.

**Resultado**: Dados incompletos.

**Mitigacao**:
- Cursor-based pagination permite retomar
- Sync atomico por entidade
- Background sync no iOS/Android

### 5. Relogio Desincronizado

**Cenario**: Dispositivo com hora errada.

**Resultado**: Conflitos inesperados no LWW.

**Mitigacao**:
- Usar `serverTime` retornado pelo backend
- Alertar usuario sobre hora incorreta

---

## Monitoramento e Debug

### Logs

```typescript
// Habilitar logs detalhados
Logger.setLevel('debug');

// Logs aparecem com prefixo
[SyncEngine] Starting sync...
[SyncEngine] Pushing 3 mutations for clients
[SyncEngine] Pull clients: 150 items, cursor: abc123
[MutationQueue] Enqueued: create client xyz
```

### DevTools

- **Sync Status**: Badge na UI com contagem de pendentes
- **Force Sync**: Botao para sincronizar manualmente
- **Clear Cache**: Opcao para limpar dados locais
- **Export Logs**: Exportar logs para debug

### Metricas

```typescript
// Disponivel via useSyncStatus()
{
  pendingCount: number,      // Mutacoes pendentes
  lastSyncAt: Date | null,   // Ultimo sync bem-sucedido
  isSyncing: boolean,        // Sync em andamento
  isOnline: boolean,         // Status da rede
  errors: SyncError[]        // Erros recentes
}
```

---

## Arquivos-Chave

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/db/database.ts` | Conexao e helpers SQLite |
| `src/db/schema.ts` | Definicoes de tabelas e migrations |
| `src/queue/MutationQueue.ts` | Fila de mutacoes offline |
| `src/sync/SyncEngine.ts` | Motor principal de sync |
| `src/sync/SyncOptimizer.ts` | Debounce e coalescing |
| `src/sync/types.ts` | Tipos e interfaces |
| `src/sync/entities/*.ts` | Configuracoes por entidade |
| `src/sync/useSyncStatus.ts` | Hook para UI |
| `src/modules/*/Service.ts` | Logica de negocio offline-first |

---

*Ultima atualizacao: 2025-12-17*
