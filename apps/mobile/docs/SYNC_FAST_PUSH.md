# Fast Push Path (Item 7)

## Overview

Esta otimização substitui o padrão "syncAll a cada mutação" por um caminho rápido de push com throttling de sync completo. Reduz latência de envio e evita pulls desnecessários.

## Problema Original

O código anterior fazia `syncAll()` completo a cada mutação:

```
ANTES (syncAll a cada mutação):
┌─────────────────────────────────────────────────────────────────────┐
│  Mutação 1 ──► debounce 2s ──► syncAll() ──┐                        │
│  Mutação 2 ──► debounce 2s ──► syncAll() ──┼── Push + Pull (TUDO)   │
│  Mutação 3 ──► debounce 2s ──► syncAll() ──┘                        │
│                                                                      │
│  Problemas:                                                          │
│  - Pull desnecessário a cada mutação                                │
│  - Latência alta (pull pode levar 10-30s)                           │
│  - Consumo de dados/bateria                                         │
│  - Se 5 mutações em 10s → até 5 syncs completos                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Solução Implementada

### Diagrama de Fluxo

```
DEPOIS (Fast Push + Throttled Full Sync):
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  Mutação 1 ──┐                                                      │
│  Mutação 2 ──┼── coalesce ──► pushOnly() ──► Push apenas (rápido)   │
│  Mutação 3 ──┘  (1.5s)                   │                          │
│                                           │                          │
│  Mutação 4 ──┐                            │                          │
│  Mutação 5 ──┼── coalesce ──► pushOnly() ─┴─► Schedule fullSync     │
│                                                  │                   │
│                                                  ▼ (throttled: 5min) │
│                                              syncAll() ──► Pull     │
│                                                                      │
│  Benefícios:                                                         │
│  - 5 mutações em 10s → 1-2 pushes + 0-1 sync completo               │
│  - Dados chegam no server em <3s                                    │
│  - Pull só quando realmente precisa                                 │
│  - Economia de bateria/dados                                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  MutationQueue                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  enqueue()                                                       ││
│  │    │                                                             ││
│  │    ├── SYNC_OPT_FAST_PUSH_ONLY = true?                          ││
│  │    │   │                                                         ││
│  │    │   YES ──► FastPushService.notifyMutationAdded()            ││
│  │    │   │                                                         ││
│  │    │   NO ──► debounce 2s ──► syncEngine.syncAll()              ││
│  │    │        (comportamento original)                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  FastPushService                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  notifyMutationAdded()                                          ││
│  │    │                                                             ││
│  │    ├── Incrementar pendingCount                                  ││
│  │    │                                                             ││
│  │    ├── pendingCount >= MAX_BUFFER_SIZE?                         ││
│  │    │   │                                                         ││
│  │    │   YES ──► executeFastPush() imediato                       ││
│  │    │   │                                                         ││
│  │    │   NO ──► Reiniciar debounce timer                          ││
│  │    │          (FAST_PUSH_DEBOUNCE_MS = 1.5s)                    ││
│  │    │                                                             ││
│  │    └── Após debounce ──► executeFastPush()                      ││
│  │                           │                                      ││
│  │                           ├── syncEngine.pushOnly()             ││
│  │                           │                                      ││
│  │                           └── scheduleFullSync()                ││
│  │                               │                                  ││
│  │                               ├── Throttle ativo?                ││
│  │                               │   (último sync < 5min)           ││
│  │                               │                                  ││
│  │                               │   YES ──► Agendar para depois   ││
│  │                               │                                  ││
│  │                               │   NO ──► Executar syncAll()     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  SyncEngine                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  pushOnly()                                                      ││
│  │    │                                                             ││
│  │    ├── Sem lock separado (usa syncLock)                         ││
│  │    │                                                             ││
│  │    ├── Processar mutações pendentes                             ││
│  │    │                                                             ││
│  │    └── Retornar { pushed, failed }                              ││
│  │                                                                  ││
│  │  syncAll()                                                       ││
│  │    │                                                             ││
│  │    ├── pushPendingMutations()                                   ││
│  │    │                                                             ││
│  │    ├── Pull todas entidades                                     ││
│  │    │                                                             ││
│  │    └── FastPushService.notifyFullSyncCompleted()                ││
│  │        (atualiza timestamp do throttle)                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Arquivos Criados/Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/config/syncFlags.ts` | Novas flags FAST_PUSH_* |
| `src/sync/FastPushService.ts` | **Novo** - Serviço de fast push |
| `src/sync/SyncEngine.ts` | Novo método pushOnly() + integração |
| `src/queue/MutationQueue.ts` | Usa FastPushService quando flag ativada |
| `__tests__/sync/FastPushService.test.ts` | **Novo** - Testes |

### Feature Flags

```typescript
// src/config/syncFlags.ts
export const SYNC_FLAGS = {
  // Ativar/desativar fast push
  SYNC_OPT_FAST_PUSH_ONLY: true,

  // Debounce para agrupar mutações (ms)
  // Após última mutação, espera esse tempo antes de push
  FAST_PUSH_DEBOUNCE_MS: 1500,

  // Intervalo mínimo entre syncs completos (ms)
  // Durante throttle, apenas fast push é executado
  FULL_SYNC_THROTTLE_MS: 300000, // 5 minutos

  // Agendar sync completo após fast push?
  FAST_PUSH_SCHEDULE_FULL_SYNC: true,

  // Preferir WiFi para sync completo agendado?
  FULL_SYNC_PREFER_WIFI: false,

  // Máximo de mutações no buffer antes de forçar push
  FAST_PUSH_MAX_BUFFER_SIZE: 20,
};
```

## API do FastPushService

### Uso Interno

O serviço é usado internamente pelo MutationQueue e SyncEngine. Não precisa ser chamado diretamente pela aplicação.

```typescript
// Configurado automaticamente pelo SyncEngine
FastPushService.configure(
  () => syncEngine.pushOnly(),
  () => syncEngine.syncAll()
);

// Chamado pelo MutationQueue.enqueue()
FastPushService.notifyMutationAdded();

// Chamado pelo SyncEngine.syncAll() após sucesso
FastPushService.notifyFullSyncCompleted();
```

### Métodos Úteis

```typescript
// Forçar push imediato (ignora debounce)
// Útil quando app vai para background
await FastPushService.flushNow();

// Verificar se pode fazer sync completo (não está em throttle)
if (FastPushService.canExecuteFullSync()) {
  await syncEngine.syncAll();
}

// Obter tempo restante de throttle
const remainingMs = FastPushService.getThrottleRemainingMs();
console.log(`Próximo sync em ${remainingMs / 1000}s`);

// Obter métricas
const metrics = FastPushService.getMetrics();
console.log(`Pushes: ${metrics.pushCount}, Coalesced: ${metrics.mutationsCoalesced}`);
```

### Métricas

```typescript
interface FastPushMetrics {
  mutationsCoalesced: number;    // Total de mutações agrupadas
  pushCount: number;             // Número de pushes executados
  lastPushAt: number | null;     // Timestamp do último push
  lastFullSyncAt: number | null; // Timestamp do último sync completo
  fullSyncsThrottled: number;    // Syncs adiados por throttle
  scheduledFullSyncPending: boolean; // Sync agendado pendente
}
```

## Comparação de Performance

| Cenário | syncAll Original | Fast Push | Melhoria |
|---------|------------------|-----------|----------|
| 5 mutações em 10s | 1-5 syncs completos | 1-2 pushes + 0-1 sync | ~80% menos dados |
| Latência de envio | 10-30s (inclui pull) | <3s (só push) | ~90% mais rápido |
| Syncs completos/hora | 12+ (se ativo) | 1-2 (throttled) | ~90% menos |
| Pull desnecessário | Sim (a cada mutação) | Não (throttled) | 100% redução |

## Validação Manual

### 1. Verificar Logs

Com fast push ativado:

```
// Ao criar cliente:
[MutationQueue] Using fast push path (Item 7)
[FastPushService] Mutation added, pending: 1, coalesced total: 1

// Ao criar segundo cliente rapidamente:
[MutationQueue] Using fast push path (Item 7)
[FastPushService] Mutation added, pending: 2, coalesced total: 2

// Após debounce (1.5s):
[FastPushService] Executing fast push (2 mutations coalesced)
[SyncEngine] pushOnly: Starting push-only sync
[SyncEngine] pushOnly: Processing 2 mutations
[SyncEngine] pushOnly: Complete - pushed: 2, failed: 0

// Sync completo agendado:
[FastPushService] Scheduling full sync for next tick
```

### 2. Teste de Coalescing

1. Criar 5 clientes em rápida sucessão (<1.5s entre cada)
2. Observar logs:
   - `coalesced total: 5`
   - Apenas 1 chamada a `pushOnly`
3. Verificar no servidor: 5 clientes criados

### 3. Teste de Throttle

1. Fazer sync manual
2. Criar cliente
3. Observar logs:
   - `Throttle active, scheduling full sync in Xs`
4. Aguardar 5 minutos
5. Sync completo deve executar

### 4. Teste Offline

1. Desativar internet
2. Criar clientes
3. Observar logs:
   - `Using fast push path`
   - `Offline, skipping push`
4. Reativar internet
5. Push deve executar automaticamente

## Rollback

### Opção 1: Desabilitar via Flag

```typescript
// src/config/syncFlags.ts
SYNC_OPT_FAST_PUSH_ONLY: false,  // Volta ao syncAll original
```

Com a flag desabilitada:
- Volta ao comportamento original (debounce 2s → syncAll)
- Sem coalescing otimizado
- Sem throttle de sync completo

### Opção 2: Ajustar Parâmetros

```typescript
// Debounce menor para mais responsividade
FAST_PUSH_DEBOUNCE_MS: 500,

// Throttle menor para syncs mais frequentes
FULL_SYNC_THROTTLE_MS: 60000, // 1 minuto

// Buffer maior para menos pushes
FAST_PUSH_MAX_BUFFER_SIZE: 50,
```

### Opção 3: Reverter Commit

```bash
git log --oneline --grep="fast push"
git revert <commit-hash>
```

## Riscos e Mitigações

### Risk 1: Dados não sincronizados por throttle

**Problema:** Sync completo atrasado pode deixar dados locais desatualizados.

**Mitigação:**
- Push sempre envia mutações locais (dados não são perdidos)
- Sync manual (`sync()`) ignora throttle se usuário forçar
- Throttle de 5 min é balance entre performance e atualidade

### Risk 2: Buffer muito grande

**Problema:** Se MAX_BUFFER_SIZE for muito alto, pode demorar para enviar.

**Mitigação:**
- Default de 20 é conservador
- Push imediato quando buffer atinge limite
- Debounce curto (1.5s) já evita acúmulo

### Risk 3: Conflitos entre pushOnly e syncAll

**Problema:** pushOnly pode conflitar com syncAll em andamento.

**Mitigação:**
- pushOnly respeita `syncLock`
- Se syncAll estiver em andamento, pushOnly não executa
- Mutações serão processadas pelo syncAll

### Risk 4: Sync completo nunca executa

**Problema:** Se throttle for muito longo e app sempre ativo.

**Mitigação:**
- Sync agendado após cada push (FAST_PUSH_SCHEDULE_FULL_SYNC)
- Sync manual disponível para usuário
- Sync automático ao reconectar

## Testes

### Executar Testes

```bash
cd apps/mobile
pnpm test -- FastPushService
```

### Cenários Testados

1. **Debounce/coalescing** - Múltiplas mutações agrupadas em 1 push
2. **Buffer máximo** - Push imediato quando buffer cheio
3. **Throttle** - Sync completo respeitando intervalo
4. **Offline** - Skip de push quando offline
5. **Flush** - Push imediato forçado
6. **Métricas** - Contadores corretos
7. **Cenário real** - 5 clientes em sequência → 1 push

## Próximos Passos

1. **Monitorar em produção** por 1-2 semanas
2. **Ajustar FAST_PUSH_DEBOUNCE_MS** baseado em feedback
3. **Considerar FULL_SYNC_PREFER_WIFI** para economia de dados
4. **Adicionar telemetria** para métricas de produção
5. **Avaliar background sync** quando app minimizado
