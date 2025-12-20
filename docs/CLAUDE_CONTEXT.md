# Claude Context - Auvo Field Service

> **IMPORTANTE:** Este arquivo é a fonte primária de verdade para o Claude Code.
> Sempre que a conversa reiniciar, leia este arquivo primeiro.

---

## Resumo do Projeto

**Auvo Field Service** é um sistema de gestão de serviços de campo (FSM) para técnicos e empresas de manutenção. Permite gerenciar clientes, orçamentos, ordens de serviço, checklists dinâmicos e cobranças integradas.

### Arquitetura

```
Monorepo (pnpm workspaces)
├── apps/backend    → NestJS 10 + Prisma + PostgreSQL
├── apps/web        → Next.js 14 + React + Tailwind
├── apps/mobile     → Expo 51 + React Native (offline-first)
└── packages/       → shared-types, shared-utils
```

### Stack Principal

| Camada | Tecnologias |
|--------|-------------|
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Web | Next.js 14, React 18, TanStack Query, Tailwind |
| Mobile | Expo 51, React Native, SQLite, expo-secure-store |
| Infra | Docker, GitHub Actions, AWS (S3, RDS) |

---

## Regras do Projeto

### NUNCA fazer sem autorização explícita:

1. **Não alterar Prisma Schema** sem análise de impacto nas migrations
2. **Não modificar SyncEngine** sem entender todo o fluxo offline
3. **Não mudar estrutura de mutations_queue** - dados críticos
4. **Não remover console.logs** em massa sem substituir por logger
5. **Não alterar keys do SecureStore** - quebra login de usuários existentes
6. **Não fazer force push** em branches principais
7. **Não expor API keys ou tokens** em código ou logs

### SEMPRE verificar antes de modificar:

1. Existe migration pendente? (`pnpm prisma migrate status`)
2. Há testes que cobrem a área? (`pnpm test`)
3. O código mobile tem `@ts-nocheck`? (tipar antes de modificar)
4. A mudança afeta sync offline? (testar em modo avião)

---

## Premissas Técnicas

### Autenticação
- JWT com expiração de 7 dias
- Tokens no mobile via expo-secure-store
- Google OAuth disponível apenas na web

### Sincronização (Mobile)
- Offline-first: operações salvam local primeiro
- Push before pull: mutações locais têm prioridade
- Conflitos: last-write-wins baseado em updatedAt
- Idempotência: mutationId = `{entityId}-{operation}-{localId}`

### Banco de Dados
- PostgreSQL: fonte de verdade (backend)
- SQLite: cache local (mobile)
- Redis: cache e filas (backend)

### Planos e Limites
- FREE: 10 clientes, 50 quotes, 100 work orders
- PRO: Limites expandidos + recursos premium
- TEAM: Multi-usuário + automações

---

## Restrições Técnicas

### Mobile
- Migrations SQLite são irreversíveis
- `CURRENT_DB_VERSION` deve incrementar a cada mudança de schema
- Base64 de fotos pode estourar memória (processar em chunks)
- Expo SDK updates requerem coordenação com EAS

### Backend
- Rate limiting ativo (10/s, 100/min, 1000/h)
- Webhooks Asaas devem validar assinatura
- PDFs são gerados assincronamente via BullMQ
- API keys criptografadas com AES-256-GCM

### Web
- Server Components por padrão (Next.js 14)
- Autenticação via cookies HTTP-only
- Uploads vão direto para S3 (presigned URLs)

---

## Vocabulário do Projeto

| Termo | Significado |
|-------|-------------|
| Quote | Orçamento |
| Work Order (WO) | Ordem de Serviço (OS) |
| Checklist Instance | Checklist vinculado a uma OS |
| Checklist Template | Modelo reutilizável de checklist |
| Client Payment | Cobrança via Asaas |
| Technician | Técnico/usuário do app mobile |
| Bundle/Kit | Conjunto de produtos vendidos juntos |
| Mutation | Operação pendente de sync |
| Delta Sync | Sincronização apenas de alterações |

---

## Convenções de Código

### Nomenclatura
- **Entidades**: PascalCase singular (Client, Quote, WorkOrder)
- **Tabelas Prisma**: camelCase plural (clients, quotes, workOrders)
- **Arquivos**: kebab-case (client-service.ts, work-order-dto.ts)
- **Componentes React**: PascalCase (ClientCard.tsx, QuoteForm.tsx)

### Estrutura de Módulos (Backend)
```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
└── entities/ (se não usar Prisma model)
```

### Estrutura de Feature (Mobile)
```
modules/feature-name/
├── screens/
├── components/
├── services/
├── repositories/
└── hooks/
```

---

## Arquivos Críticos (Ler Antes de Modificar)

| Arquivo | Motivo |
|---------|--------|
| `apps/backend/prisma/schema.prisma` | Schema do banco - migrations |
| `apps/mobile/src/sync/SyncEngine.ts` | Motor de sincronização |
| `apps/mobile/src/db/database.ts` | Migrations SQLite |
| `apps/mobile/src/queue/MutationQueue.ts` | Fila offline |
| `apps/mobile/src/services/AuthService.ts` | Keys do SecureStore |
| `apps/backend/src/auth/auth.service.ts` | Lógica de autenticação |
| `apps/backend/src/webhooks/` | Webhooks de pagamento |

---

## Fluxos Principais

### Quote → WorkOrder
```
Quote.status = APPROVED
    ↓
POST /work-orders {quoteId}
    ↓
Validação: quote pertence ao usuário, não tem WO
    ↓
WorkOrder criada (status: SCHEDULED)
```

### Execução em Campo
```
Técnico abre OS → IN_PROGRESS
    ↓
Preenche checklists (offline OK)
    ↓
Tira fotos, coleta assinatura
    ↓
Finaliza → DONE
    ↓
Sync quando online
```

### Sync Mobile
```
1. Push mutações pendentes (local → servidor)
2. Pull entidades (servidor → local)
3. Sync checklists templates
4. Sync checklists de todas as OSs
5. Upload anexos pendentes
```

---

## Debug Rápido

### Ver status de sync (mobile)
```javascript
// No console do React Native Debugger
syncEngine.getState()
```

### Ver mutações pendentes
```sql
-- No SQLite (via Flipper ou adb shell)
SELECT * FROM mutations_queue WHERE status = 'pending';
```

### Forçar sync
```javascript
await syncEngine.syncAll();
```

### Ver logs do backend
```bash
DEBUG=* pnpm start:dev
```

---

## Contato e Recursos

- **Documentação completa:** `/docs/`
- **Swagger API:** `http://localhost:3001/api/docs`
- **Prisma Studio:** `pnpm prisma studio`

---

## Changelog de Contexto

| Data | Alteração |
|------|-----------|
| 2025-12-19 | Criação inicial do documento |

---

> **Lembrete:** Ao iniciar uma nova sessão, sempre diga:
> "Use o contexto do projeto" para que eu leia este arquivo.
