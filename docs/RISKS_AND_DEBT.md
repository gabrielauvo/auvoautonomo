# Riscos Técnicos e Dívida Técnica

## Riscos Críticos

### 1. Sincronização Offline (Mobile)

**Risco:** Perda de dados ou corrupção durante sync

**Áreas afetadas:**
- `apps/mobile/src/sync/SyncEngine.ts`
- `apps/mobile/src/queue/MutationQueue.ts`
- `apps/mobile/src/modules/checklists/services/ChecklistSyncService.ts`

**Observações:**
- Sistema complexo com múltiplas camadas de retry
- Conflitos resolvidos via last-write-wins (pode perder dados em edge cases)
- Lock de sincronização (`syncLock`) previne race conditions, mas não é infalível
- Mutações com status `FAILED` podem acumular se servidor estiver indisponível

**Mitigações atuais:**
- Reset de mutações falhas uma vez por sessão
- Verificação de pendentes antes de sobrescrever dados locais
- Idempotência via mutationId único

---

### 2. Integridade de Dados entre Mobile e Backend

**Risco:** Inconsistência entre banco local (SQLite) e PostgreSQL

**Cenários problemáticos:**
- OS criada offline, servidor não recebe antes de 404 em endpoints relacionados
- Checklist preenchido offline, instância ainda não existe no servidor
- Fotos/assinaturas na fila de upload por tempo indeterminado

**Áreas afetadas:**
- `apps/mobile/src/modules/checklists/services/ChecklistSyncService.ts:245-467`
- Tratamento de 404 como "OS local-only"

---

### 3. Segurança de API Keys (Asaas)

**Risco:** Exposição de credenciais de pagamento

**Situação atual:**
- API keys do Asaas armazenadas com criptografia AES-256-GCM
- Logs mascarados para evitar vazamento
- Webhook com validação de assinatura

**Atenção:**
- `ASAAS_API_KEY` deve ser rotacionada periodicamente
- Verificar se não há logs expondo dados em produção

---

### 4. Escalabilidade do Sistema de Filas

**Risco:** Jobs acumulados podem sobrecarregar BullMQ/Redis

**Cenários:**
- Geração massiva de PDFs
- Importação de muitos clientes
- Upload de muitas fotos de checklist

**Mitigação:** Limites de rate e processamento em batches

---

## Dívida Técnica Identificada

### 1. @ts-nocheck em Arquivos Críticos

**Arquivos afetados:**
- `apps/mobile/src/modules/checklists/services/ChecklistSyncService.ts` (linha 1)

**Impacto:** TypeScript não valida tipos, bugs podem passar despercebidos

**Recomendação:** Remover progressivamente e tipar corretamente

---

### 2. Módulos Legados

**Identificados:**
- `apps/backend/src/items/` - Catálogo antigo (substituído por `products/`)
- `apps/backend/src/work-order-checklists/` - Checklists antigos

**Impacto:** Código duplicado, confusão sobre qual usar

**Recomendação:** Remover após migração completa dos dados

---

### 3. Tipagem Inconsistente em Sync

**Exemplo:**
```typescript
// ChecklistSyncService.ts:756-767
type: answer.type, // Corrigido: era answer.questionType
```

**Impacto:** Campo `type` vs `questionType` causa confusão

**Recomendação:** Padronizar nomenclatura em todo o projeto

---

### 4. Acesso Direto a Propriedades Internas

**Exemplo:**
```typescript
// ChecklistSyncService.ts:166
const engine = syncEngine as any;
```

**Impacto:** Quebra encapsulamento, difícil de manter

**Recomendação:** Expor métodos públicos no SyncEngine

---

### 5. Banco Local sem Constraints de FK

**Situação:** SQLite mobile não tem foreign keys ativas por padrão

**Impacto:** Pode haver dados órfãos (respostas sem instância, etc.)

**Mitigação atual:** Validação em código antes de operações

---

### 6. Timeouts Hardcoded

**Exemplos:**
- `SyncEngine.ts:421` - 45s para pull
- `SyncEngine.ts:709` - 60s para push
- `ChecklistSyncService.ts:269` - 30s para fetch

**Impacto:** Difícil ajustar para diferentes condições de rede

**Recomendação:** Centralizar em configuração

---

### 7. Console.logs Excessivos em Produção

**Situação:** Muitos `console.log` de debug não removidos

**Exemplos:**
- `SyncEngine.ts` - ~50 console.log
- `ChecklistSyncService.ts` - ~80 console.log

**Impacto:** Performance e poluição de logs

**Recomendação:** Usar logger com níveis (debug/info/warn/error)

---

## Áreas Frágeis (Propensas a Bugs)

### 1. Conversão Quote → WorkOrder

**Local:** `apps/backend/src/work-orders/work-orders.service.ts`

**Fragilidade:** Múltiplas validações sequenciais, qualquer falha deixa estado inconsistente

---

### 2. Cálculo de Progresso de Checklist

**Local:** `apps/mobile/src/modules/checklists/`

**Fragilidade:** Depende de templateVersionSnapshot estar correto e parseável

---

### 3. Upload de Anexos com Base64

**Local:** `apps/mobile/src/modules/checklists/services/AttachmentUploadService.ts`

**Fragilidade:**
- Base64 grandes podem estourar memória
- Retry pode duplicar uploads
- Limpeza de dados inválidos pode perder fotos legítimas

---

### 4. Webhook do Asaas

**Local:** `apps/backend/src/webhooks/`

**Fragilidade:**
- Se webhook falha, pagamento fica desatualizado
- Não há retry automático do lado do Asaas
- Logs insuficientes para debugging

---

### 5. Migrations do SQLite Mobile

**Local:** `apps/mobile/src/db/database.ts`

**Fragilidade:**
- Migrations são sequenciais e não podem falhar
- Rollback não existe
- Versão `CURRENT_DB_VERSION = 14` - cada bump requer cuidado

---

## Código Legado Crítico

### Não Modificar Sem Análise Completa:

1. **Prisma Schema** (`apps/backend/prisma/schema.prisma`)
   - Qualquer mudança requer migration coordenada

2. **SyncEngine** (`apps/mobile/src/sync/SyncEngine.ts`)
   - Motor central do offline-first, altamente acoplado

3. **AuthService Mobile** (`apps/mobile/src/services/AuthService.ts`)
   - SecureStore keys hardcoded, mudar quebra login existente

4. **MutationQueue** (`apps/mobile/src/queue/MutationQueue.ts`)
   - Fila de mutações, estrutura de dados sensível

---

## Recomendações Prioritárias

### Curto Prazo (Alto Impacto):
1. Remover `@ts-nocheck` do ChecklistSyncService
2. Centralizar configuração de timeouts
3. Implementar logger com níveis

### Médio Prazo:
1. Remover módulos legados (items, work-order-checklists)
2. Padronizar nomenclatura type/questionType
3. Adicionar monitoramento de fila de mutações

### Longo Prazo:
1. Considerar estratégia de conflito mais sofisticada que last-write-wins
2. Implementar sync incremental mais granular
3. Adicionar testes de integração para fluxo offline→online
