# Sync Chunk Processing Optimization

## Overview

Esta otimização resolve o problema de bloqueio da UI durante o processamento de grandes volumes de dados no sync (1000+ registros). O problema original causava travamentos perceptíveis em celulares de baixo desempenho.

## Problema Original

O loop em `SyncEngine.saveToLocalDb()` (linhas 508-522) processava todos os registros sequencialmente sem liberar o event loop:

```typescript
// ANTES: Bloqueia a main thread
for (const item of safeData) {
  const record = item as Record<string, unknown>;
  for (const col of columns) {
    // ... processamento síncrono
  }
  values.push(now); // syncedAt
}
```

**Impacto em cenários reais:**
- 1000 registros × 10 colunas = 10.000 operações sem yield
- Tempo estimado em CPU lenta: 50-200ms bloqueando a UI
- Usuário percebe "travamento" ou "engasgada"

## Solução Implementada

### Arquivos Modificados/Criados

1. **`src/config/syncFlags.ts`** (novo)
   - Feature flags para controle da otimização
   - Permite desabilitar sem rebuild em casos de emergência

2. **`src/sync/SyncMetrics.ts`** (novo)
   - Sistema de métricas e observabilidade
   - Coleta tempo por chunk, memória estimada, etc.
   - Alerta quando chunks demoram >50ms

3. **`src/sync/SyncEngine.ts`** (modificado)
   - `buildValuesSync()`: comportamento original (fallback)
   - `buildValuesInChunks()`: novo comportamento otimizado
   - `yieldToEventLoop()`: libera o event loop entre chunks

### Feature Flags

```typescript
// src/config/syncFlags.ts
export const SYNC_FLAGS = {
  SYNC_OPT_CHUNK_PROCESSING: true,  // Ativar/desativar chunking
  CHUNK_SIZE: 100,                   // Itens por chunk
  CHUNK_YIELD_DELAY_MS: 0,          // Delay entre chunks
};
```

### Como Funciona

1. Se `data.length > CHUNK_SIZE` e flag ativada → usa chunking
2. Processa 100 itens por vez
3. Entre cada chunk, chama `setTimeout(0)` para liberar o event loop
4. UI permanece responsiva durante o processamento

## Validação Manual

### No Android Fraco (Samsung A10, Moto G4, etc.)

1. **Preparar cenário:**
   ```sql
   -- No backend, criar 1000+ clientes para o técnico de teste
   INSERT INTO clients (id, name, technician_id, ...)
   SELECT gen_random_uuid(), 'Cliente ' || generate_series, 'tech-123', ...
   FROM generate_series(1, 1000);
   ```

2. **Testar com flag ON (default):**
   - Fazer logout e login para forçar sync completo
   - Observar que a UI responde durante o sync
   - Verificar logs: `[SyncEngine] Chunk processing complete: X chunks, Y items`

3. **Testar com flag OFF (rollback):**
   - Editar `syncFlags.ts`: `SYNC_OPT_CHUNK_PROCESSING: false`
   - Rebuild e repetir teste
   - Comparar tempo de bloqueio

4. **Verificar consistência:**
   - Após sync, verificar se todos os 1000 clientes estão no SQLite local
   - Comparar contagem com backend

### Métricas nos Logs

Procure por:
```
[SyncMetrics] [sync-xxx] saveToLocalDb completed {
  entity: "clients",
  totalItems: 1000,
  chunkCount: 10,
  avgChunkDurationMs: 8,
  maxChunkDurationMs: 15,
  usedChunkProcessing: true
}
```

### Alerta de Performance

Se aparecer:
```
[SyncMetrics] ⚠️ Slow chunk detected for clients: 75ms (threshold: 50ms)
```

Significa que mesmo com chunking, um chunk demorou muito. Considere:
- Reduzir `CHUNK_SIZE` para 50
- Investigar a complexidade dos dados

## Rollback

### Opção 1: Desabilitar via Flag (sem rebuild)

```typescript
// src/config/syncFlags.ts
SYNC_OPT_CHUNK_PROCESSING: false,
```

### Opção 2: Reverter Commits

```bash
# Identificar o commit desta feature
git log --oneline --grep="chunk processing"

# Reverter
git revert <commit-hash>
```

### Opção 3: Restaurar Código Original

O código original está preservado em `buildValuesSync()`. Para forçar uso:

```typescript
// Em saveToLocalDb(), trocar:
if (useChunkProcessing) {
  values = await this.buildValuesInChunks(...);
} else {
  values = this.buildValuesSync(...);
}

// Para:
values = this.buildValuesSync(safeData, columns, now);
```

## Testes

### Arquivos de Teste

- `__tests__/config/syncFlags.test.ts`
- `__tests__/sync/SyncMetrics.test.ts`
- `__tests__/sync/SyncEngine.chunkProcessing.test.ts`

### Executar Testes

```bash
cd apps/mobile
pnpm test -- --testPathPattern="chunkProcessing|SyncMetrics|syncFlags"
```

### Testes de Consistência

O teste `SyncEngine.chunkProcessing.test.ts` verifica que:
1. O array `values` é idêntico com flag ON e OFF
2. Booleanos são convertidos corretamente (true → 1, false → 0)
3. Valores undefined são convertidos para null
4. Métricas são coletadas corretamente

## Compatibilidade

- ✅ Não altera SQL final
- ✅ Não altera schema de tabelas
- ✅ Não altera payloads de API
- ✅ Não altera regras de merge/conflito
- ✅ Resultado idêntico ao comportamento anterior

## Próximos Passos

1. Monitorar métricas em produção por 1-2 semanas
2. Se estável, considerar reduzir `CHUNK_SIZE` para 50 em dispositivos muito lentos
3. Avaliar aplicar padrão similar em outras operações pesadas
