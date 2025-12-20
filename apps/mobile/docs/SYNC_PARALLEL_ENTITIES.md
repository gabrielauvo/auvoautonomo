# Sync Parallel Entities Optimization

## Overview

Esta otimização reduz o tempo total do `syncAll()` ao sincronizar entidades independentes em paralelo, mantendo a ordem correta para entidades com dependências.

## Problema Original

O `syncAll()` sincronizava todas as entidades sequencialmente:

```typescript
// ANTES: Todas as entidades em série
for (const [name, config] of Array.from(this.configs.entries())) {
  const result = await this.syncEntity(name, config);  // Espera cada uma terminar
}
```

**Impacto:**
- 5 entidades × 500ms cada = 2.5 segundos
- Usuário espera desnecessariamente
- Rede subutilizada

## Solução Implementada

### Mapa de Dependências

```
INDEPENDENTES (podem rodar em paralelo):
├── clients ─────────────── Sem dependências
├── categories ──────────── Sem dependências
└── checklistTemplates ──── Sem dependências (antecipado)

DEPENDENTES (ordem importa):
├── catalogItems ────────── DEPENDE de categories (categoryId)
├── quotes ──────────────── DEPENDE de clients (clientId)
├── work_orders ─────────── DEPENDE de clients + quotes
└── checklists/* ────────── DEPENDE de work_orders
```

### Estratégia de Execução

```
FASE 1: Paralelo (clients + categories)
        ┌─────────────┐
        │   clients   │────┐
        └─────────────┘    │
                           ├── Rodam ao mesmo tempo
        ┌─────────────┐    │   (até MAX_PARALLEL_ENTITIES)
        │ categories  │────┘
        └─────────────┘
              │
              ▼
FASE 2: Sequencial (dependentes)
        ┌─────────────┐
        │catalogItems │──── Espera categories
        └─────────────┘
              │
        ┌─────────────┐
        │   quotes    │──── Espera clients
        └─────────────┘
              │
        ┌─────────────┐
        │ work_orders │──── Espera clients + quotes
        └─────────────┘
```

### Arquivos Modificados/Criados

| Arquivo | Mudança |
|---------|---------|
| [src/config/syncFlags.ts](apps/mobile/src/config/syncFlags.ts) | Novas flags de paralelismo |
| [src/sync/SyncMetrics.ts](apps/mobile/src/sync/SyncMetrics.ts) | Métricas de entidades e paralelismo |
| [src/sync/SyncEngine.ts](apps/mobile/src/sync/SyncEngine.ts) | Métodos `syncEntitiesWithParallelism` e `runWithConcurrencyLimit` |

### Feature Flags

```typescript
// src/config/syncFlags.ts
export const SYNC_FLAGS = {
  // Ativar/desativar paralelismo
  SYNC_OPT_PARALLEL_ENTITIES: true,

  // Máximo de entidades simultâneas (evita race conditions no SQLite)
  MAX_PARALLEL_ENTITIES: 2,

  // Entidades seguras para paralelismo (sem dependências entre si)
  PARALLEL_SAFE_ENTITIES: ['clients', 'categories'],

  // Entidades que devem rodar sequencialmente (têm dependências)
  SEQUENTIAL_ENTITIES: ['catalogItems', 'quotes', 'work_orders'],
};
```

### Pool de Concorrência

Implementação própria (sem lib externa) para controle preciso:

```typescript
private async runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const runNext = async (): Promise<void> => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runNext()
  );
  await Promise.all(workers);

  return results;
}
```

## Validação Manual

### 1. Verificar Logs de Paralelismo

Após fazer sync, procure nos logs:

```
[SyncEngine] [sync-xxx] Starting parallel sync:
  parallel=clients,categories
  sequential=catalogItems,quotes,work_orders
  unclassified=

[SyncMetrics] Entity ✓ clients { parallelGroup: 'parallel', durationMs: 250 }
[SyncMetrics] Entity ✓ categories { parallelGroup: 'parallel', durationMs: 180 }
[SyncMetrics] Entity ✓ catalogItems { parallelGroup: 'sequential', durationMs: 300 }

[SyncMetrics] Parallel sync summary {
  parallelDurationMs: 280,      // Max do grupo paralelo
  sequentialDurationMs: 520,    // Soma do grupo sequencial
  totalDurationMs: 800,         // Total real
  speedup: '20% faster'
}
```

### 2. Comparar Tempos

| Cenário | Tempo Esperado |
|---------|----------------|
| 5 entidades × 200ms (sequencial) | ~1000ms |
| 2 paralelas + 3 sequenciais (paralelo) | ~800ms |
| Economia | ~20% |

### 3. Verificar Consistência de Dados

```bash
# No SQLite do app, verificar contagens:
SELECT 'clients' as entity, COUNT(*) as count FROM clients
UNION ALL
SELECT 'categories', COUNT(*) FROM product_categories
UNION ALL
SELECT 'catalog_items', COUNT(*) FROM catalog_items
UNION ALL
SELECT 'quotes', COUNT(*) FROM quotes
UNION ALL
SELECT 'work_orders', COUNT(*) FROM work_orders;
```

Comparar com backend para garantir que sync foi completo.

## Rollback

### Opção 1: Desabilitar via Flag

```typescript
// src/config/syncFlags.ts
SYNC_OPT_PARALLEL_ENTITIES: false,  // Volta ao sequencial
```

### Opção 2: Reduzir Concorrência

```typescript
// Para um comportamento "quase sequencial"
MAX_PARALLEL_ENTITIES: 1,
```

### Opção 3: Reverter Commit

```bash
git log --oneline --grep="parallel entities"
git revert <commit-hash>
```

## Riscos e Mitigações

### Risk 1: Race Conditions no SQLite

**Problema:** Duas escritas simultâneas na mesma tabela podem causar locks.

**Mitigação:**
- `MAX_PARALLEL_ENTITIES: 2` limita concorrência
- Entidades paralelas escrevem em tabelas diferentes
- SQLite WAL mode suporta escritas concorrentes

### Risk 2: Dependência de Dados

**Problema:** catalogItems precisa de categories para FK.

**Mitigação:**
- categories está no grupo PARALLEL
- catalogItems está no grupo SEQUENTIAL
- catalogItems só roda após TODAS as paralelas terminarem

### Risk 3: Erro em Uma Entidade

**Problema:** Erro em clients não deveria parar categories.

**Mitigação:**
- Cada entidade tem try/catch individual
- Erro é registrado nas métricas
- Outras entidades continuam normalmente

## Métricas Disponíveis

### EntitySyncMetrics

```typescript
{
  entity: 'clients',
  durationMs: 250,
  itemsPulled: 150,
  success: true,
  retries: 0,
  parallelGroup: 'parallel' | 'sequential'
}
```

### ParallelSyncMetrics

```typescript
{
  parallelEntities: ['clients', 'categories'],
  sequentialEntities: ['catalogItems', 'quotes', 'work_orders'],
  parallelDurationMs: 280,      // Tempo da fase paralela
  sequentialDurationMs: 520,    // Tempo da fase sequencial
  totalDurationMs: 800,
  maxConcurrency: 2,
  usedParallelSync: true
}
```

## Testes

### Arquivos de Teste

- `__tests__/sync/SyncEngine.parallelEntities.test.ts`

### Executar Testes

```bash
cd apps/mobile
pnpm test -- --testPathPattern="parallelEntities"
```

### Cenários Testados

1. Entidades paralelas rodam de fato em paralelo
2. Entidades sequenciais vêm após paralelas
3. Resultado final idêntico com flag on/off
4. Erro em uma entidade não para as outras
5. Métricas são coletadas corretamente
6. Entidades não classificadas vão para sequencial

## Próximos Passos

1. **Monitorar em produção** por 1-2 semanas
2. **Expandir grupo paralelo** se estável:
   - Adicionar `checklistTemplates` ao paralelo (é independente)
3. **Ajustar MAX_PARALLEL_ENTITIES** baseado em métricas reais
4. **Considerar paralelismo no pós-processamento** (checklists, attachments)
