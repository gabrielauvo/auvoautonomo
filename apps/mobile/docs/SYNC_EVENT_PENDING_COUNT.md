# Event-Driven Pending Count (Item 5)

## Overview

Esta otimização remove o polling de 5 segundos para contagem de mutações pendentes e substitui por um modelo event-driven. Reduz consultas ao SQLite e consumo de bateria.

## Problema Original

O hook `useSyncStatus` usava polling para atualizar a contagem de mutações pendentes:

```
ANTES (Polling cada 5s):
┌─────────────────────────────────────────────────────────────────────┐
│  useSyncStatus Hook                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  setInterval(5000)                                              ││
│  │       │                                                         ││
│  │       ▼ (cada 5s, mesmo sem mudanças)                          ││
│  │  MutationQueue.countPending()                                   ││
│  │       │                                                         ││
│  │       ▼                                                         ││
│  │  SELECT COUNT(*) FROM mutations_queue WHERE status = 'pending'  ││
│  │       │                                                         ││
│  │       ▼                                                         ││
│  │  setPendingCount(count)                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Problemas:                                                          │
│  - 12 queries/minuto mesmo sem atividade                            │
│  - 720 queries/hora                                                  │
│  - Consumo de bateria desnecessário                                  │
│  - UI pode mostrar contagem desatualizada por até 5s                │
└─────────────────────────────────────────────────────────────────────┘
```

## Solução Implementada

### Diagrama de Fluxo

```
DEPOIS (Event-driven):
┌─────────────────────────────────────────────────────────────────────┐
│  MutationQueue                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  enqueue()      ──► emit('mutation_added', { count })           ││
│  │  markCompleted() ──► emit('mutation_completed', { count })      ││
│  │  markFailed()   ──► emit('mutation_failed', { count })          ││
│  │  remove()       ──► emit('mutation_removed', { count })         ││
│  │  resetFailed()  ──► emit('mutations_reset', { count })          ││
│  │  cleanup()      ──► emit('mutations_cleanup', { count })        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                    │                                                 │
│                    │ eventos                                         │
│                    ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  useSyncStatus Hook                                             ││
│  │                                                                 ││
│  │  useEffect(() => {                                              ││
│  │    // 1. Query inicial (cold start)                             ││
│  │    const count = await countPending();                          ││
│  │    setPendingCount(count);                                      ││
│  │                                                                 ││
│  │    // 2. Assinar eventos                                        ││
│  │    const unsubscribe = MutationQueue.subscribe((event) => {     ││
│  │      setPendingCount(event.pendingCount);                       ││
│  │    });                                                          ││
│  │                                                                 ││
│  │    return () => unsubscribe();                                  ││
│  │  }, []);                                                        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Benefícios:                                                         │
│  - 0 queries sem atividade                                          │
│  - UI atualiza instantaneamente                                      │
│  - Bateria preservada                                                │
│  - Fallback: polling atrás de flag SYNC_OPT_EVENT_PENDING_COUNT     │
└─────────────────────────────────────────────────────────────────────┘
```

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `src/config/syncFlags.ts` | Novas flags EVENT_PENDING_COUNT |
| `src/queue/MutationQueue.ts` | Sistema de eventos adicionado |
| `src/sync/useSyncStatus.ts` | Usa eventos quando flag ativada |
| `__tests__/queue/MutationQueue.test.ts` | Testes para eventos |

### Feature Flags

```typescript
// src/config/syncFlags.ts
export const SYNC_FLAGS = {
  // Ativar/desativar modelo event-driven
  SYNC_OPT_EVENT_PENDING_COUNT: true,

  // Intervalo de polling fallback em ms
  // Usado apenas quando SYNC_OPT_EVENT_PENDING_COUNT = false
  PENDING_COUNT_POLL_INTERVAL_MS: 5000,
};
```

## API do Sistema de Eventos

### Tipos de Evento

```typescript
type MutationQueueEventType =
  | 'mutation_added'      // Nova mutação enfileirada
  | 'mutation_completed'  // Mutação sincronizada com sucesso
  | 'mutation_failed'     // Mutação falhou
  | 'mutation_removed'    // Mutação removida manualmente
  | 'mutations_reset'     // Mutações falhas resetadas para retry
  | 'mutations_cleanup';  // Cleanup de mutações antigas

interface MutationQueueEvent {
  type: MutationQueueEventType;
  pendingCount: number;    // Contagem atualizada após a operação
  mutationId?: number;     // ID da mutação afetada
  entity?: string;         // Entidade (clients, workOrders, etc.)
  entityId?: string;       // ID da entidade
  timestamp: Date;         // Quando o evento ocorreu
}
```

### Assinatura de Eventos

```typescript
import { MutationQueue } from '@/queue/MutationQueue';

// Assinar eventos
const unsubscribe = MutationQueue.subscribe((event) => {
  console.log(`Evento: ${event.type}, pendingCount: ${event.pendingCount}`);

  if (event.type === 'mutation_added') {
    console.log(`Nova mutação: ${event.entity}:${event.entityId}`);
  }
});

// Cancelar assinatura
unsubscribe();
```

### Integração com React

```typescript
// Hook customizado usando eventos
function usePendingCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Query inicial
    MutationQueue.countPending().then(setCount);

    // Assinar eventos
    const unsubscribe = MutationQueue.subscribe((event) => {
      setCount(event.pendingCount);
    });

    return unsubscribe;
  }, []);

  return count;
}
```

## Comparação de Performance

| Métrica | Polling (5s) | Event-driven | Melhoria |
|---------|--------------|--------------|----------|
| Queries/minuto (idle) | 12 | 0 | 100% |
| Queries/hora (idle) | 720 | 0 | 100% |
| Latência de atualização | 0-5000ms | <10ms | ~99% |
| Uso de bateria | Alto | Mínimo | Significativo |

## Validação Manual

### 1. Verificar Logs

Com eventos ativados, você não deve ver queries periódicas. Apenas quando mutações são criadas/atualizadas:

```
// Quando cria mutação offline:
[MutationQueue] Enqueued create for clients:c-123, insertId: 42
[MutationQueue] Event: mutation_added, pendingCount: 1

// Quando sync completa:
[MutationQueue] Mutation 42 completed
[MutationQueue] Event: mutation_completed, pendingCount: 0
```

### 2. Teste de UI

1. Abrir tela com indicador de pendentes (ex: badge no header)
2. Desconectar internet (modo avião)
3. Fazer alteração (ex: criar cliente)
4. Observar: **UI deve atualizar instantaneamente** (não após 5s)
5. Reconectar internet
6. Observar: contagem deve zerar após sync

### 3. Comparar com Polling

Para comparar comportamentos:

```typescript
// Desativar temporariamente para teste
SYNC_OPT_EVENT_PENDING_COUNT: false
```

Com polling:
- UI atualiza apenas a cada 5s
- Logs mostram queries periódicas

Com eventos:
- UI atualiza instantaneamente
- Sem queries periódicas

### 4. Verificar Listeners Ativos

```typescript
// Para debug: verificar número de listeners
console.log('Listeners ativos:', MutationQueue.getListenerCount());
```

Esperado: 1 listener por componente usando `useSyncStatus`.

## Rollback

### Opção 1: Desabilitar via Flag

```typescript
// src/config/syncFlags.ts
SYNC_OPT_EVENT_PENDING_COUNT: false,  // Volta ao polling
```

Com a flag desabilitada:
- Hook volta a usar `setInterval(5000)`
- Comportamento idêntico ao original
- Sem impacto em funcionalidade

### Opção 2: Ajustar Intervalo de Polling

```typescript
// Polling mais frequente (se necessário)
PENDING_COUNT_POLL_INTERVAL_MS: 2000,  // 2 segundos
```

### Opção 3: Reverter Commit

```bash
git log --oneline --grep="event pending"
git revert <commit-hash>
```

## Riscos e Mitigações

### Risk 1: Eventos perdidos

**Problema:** Se componente monta após mutação, pode não receber evento inicial.

**Mitigação:**
- Query inicial no `useEffect` garante contagem correta no mount
- Eventos são apenas para atualizações subsequentes

### Risk 2: Memory leak de listeners

**Problema:** Listeners não removidos podem causar memory leak.

**Mitigação:**
- `useEffect` retorna função de cleanup que remove listener
- React garante cleanup no unmount

### Risk 3: Múltiplos listeners duplicados

**Problema:** Re-renders podem criar listeners duplicados.

**Mitigação:**
- `useEffect` com `[]` como deps garante execução única
- Cleanup remove listener antes de criar novo

### Risk 4: Contador temporariamente incorreto

**Problema:** Query de contagem é assíncrona.

**Mitigação:**
- Contagem é calculada no momento do evento
- Event payload já inclui `pendingCount` atualizado
- Não há race condition entre operação e contagem

## Testes

### Executar Testes

```bash
cd apps/mobile
pnpm test -- MutationQueue --no-coverage
```

### Cenários Testados

1. **subscribe/unsubscribe** - Adiciona e remove listeners corretamente
2. **mutation_added** - Emite evento no enqueue
3. **mutation_completed** - Emite evento no markCompleted
4. **mutation_failed** - Emite evento no markFailed
5. **mutation_removed** - Emite evento no remove
6. **mutations_reset** - Emite evento no resetFailed (com mudanças)
7. **mutations_cleanup** - Emite evento no cleanup (com mudanças)
8. **pendingCount** - Todos eventos incluem contagem atualizada
9. **error handling** - Listener com erro não afeta outros listeners

## Métricas Disponíveis

### getListenerCount()

```typescript
// Útil para debug e monitoramento
const count = MutationQueue.getListenerCount();
console.log(`Listeners ativos: ${count}`);
```

### Eventos para Observabilidade

Cada evento inclui:
- `type`: Tipo de operação
- `pendingCount`: Contagem atual
- `mutationId`: ID da mutação (quando aplicável)
- `entity` / `entityId`: Contexto da entidade
- `timestamp`: Momento exato do evento

Exemplo de logging:

```typescript
MutationQueue.subscribe((event) => {
  console.log(JSON.stringify({
    event: event.type,
    pending: event.pendingCount,
    mutation: event.mutationId,
    entity: `${event.entity}:${event.entityId}`,
    ts: event.timestamp.toISOString(),
  }));
});
```

## Próximos Passos

1. **Monitorar em produção** por 1-2 semanas
2. **Verificar uso de bateria** em devices reais
3. **Considerar debounce** se muitas mutações em sequência
4. **Adicionar eventos** para outras operações (ex: sync progress)
