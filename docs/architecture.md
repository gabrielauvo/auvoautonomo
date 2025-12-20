# Auvo Field Service - Arquitetura do Sistema

## Visão Geral

Sistema de gestão de serviços de campo (Field Service Management) desenvolvido para autônomos e PMEs. Gerencia clientes, orçamentos, ordens de serviço, checklists dinâmicos e faturamento integrado.

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUVO FIELD SERVICE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌────────────────┐   │
│  │   Mobile    │      │     Web     │      │  Webhook/API   │   │
│  │ Expo/React  │      │  Next.js 14 │      │   (Asaas)      │   │
│  │  Native     │      │             │      │                │   │
│  └──────┬──────┘      └──────┬──────┘      └───────┬────────┘   │
│         │                    │                     │             │
│         └────────────────────┼─────────────────────┘             │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │    REST API       │                        │
│                    │    (NestJS 10)    │                        │
│                    │    Port: 3001     │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              │               │               │                  │
│        ┌─────▼─────┐   ┌─────▼─────┐   ┌────▼────┐             │
│        │PostgreSQL │   │  BullMQ   │   │  Redis  │             │
│        │ (Prisma)  │   │  (Jobs)   │   │ (Cache) │             │
│        └───────────┘   └───────────┘   └─────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Estrutura do Monorepo

```
monorepo/
├── apps/
│   ├── backend/      # API NestJS (porta 3001)
│   ├── web/          # Dashboard Next.js (porta 3000)
│   └── mobile/       # App Expo/React Native
├── packages/
│   ├── shared-types/ # Tipos TypeScript compartilhados
│   └── shared-utils/ # Utilitários compartilhados
├── docs/             # Documentação
└── scripts/          # Scripts de deploy/manutenção
```

## Backend - Estrutura de Módulos

```
apps/backend/src/
├── auth/                 # JWT + Google OAuth
├── prisma/               # Prisma Service
├── common/
│   ├── encryption/       # API keys (AES-256-GCM)
│   └── logging/          # Logger seguro
├── plans/                # Planos FREE/PRO/TEAM
├── billing/              # Limites de uso por plano
├── clients/              # CRUD clientes
├── products/             # Catálogo (produtos/serviços/kits)
├── quotes/               # Orçamentos
├── work-orders/          # Ordens de serviço
├── checklist-templates/  # Templates de checklist
├── checklist-instances/  # Instâncias em OS
├── invoices/             # Faturas
├── asaas-integration/    # Gateway Asaas
├── client-payments/      # Cobranças
├── webhooks/             # Webhooks Asaas
├── pdf/                  # Geração de PDFs
├── pdf-jobs/             # Fila BullMQ
├── file-storage/         # Upload de arquivos
├── signatures/           # Assinaturas digitais
├── analytics/            # Métricas
├── reports/              # Relatórios
└── health/               # Health check
```

## Mobile - Arquitetura Offline-First

```
apps/mobile/src/
├── app/                  # Expo Router
├── modules/
│   ├── checklists/       # Preenchimento offline
│   ├── quotes/           # Orçamentos
│   └── workorders/       # Execução em campo
├── db/
│   ├── schema.ts         # SQLite tables
│   └── database.ts       # Migrations
├── sync/
│   ├── SyncEngine.ts     # Motor 2-vias
│   └── types.ts
├── queue/
│   └── MutationQueue.ts  # Fila offline
└── services/
    └── AuthService.ts    # SecureStore
```

### Sincronização 2-vias

1. **Push**: Mutações locais → Servidor (via fila)
2. **Pull**: Servidor → SQLite local (delta sync)
3. **Conflitos**: Last-write-wins (updatedAt)
4. **Idempotência**: mutationId único por operação

## Fluxo de Negócio: Quote APPROVED → WorkOrder → Invoice

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    Quote     │       │  WorkOrder   │       │   Invoice    │
│  (APPROVED)  │──────>│  (SCHEDULED) │──────>│   (Futuro)   │
└──────────────┘       └──────────────┘       └──────────────┘
      │                      │                      │
      │                      │                      │
  totalValue           executionStart         Cobrança
  items snapshot       executionEnd           automática
  discountValue        equipments             (Dia 8)
      │                      │                      │
      v                      v                      v
  Orçamento            Execução em           Nota Fiscal
  aprovado             campo                  gerada
```

### Detalhamento do Fluxo

1. **Quote APPROVED**
   - Cliente aprova orçamento
   - Status: `DRAFT` → `SENT` → `APPROVED`
   - Preços "congelados" (snapshot)

2. **WorkOrder SCHEDULED**
   - Criada a partir do Quote aprovado
   - Vinculação 1:1 (quote pode ter no máximo 1 OS)
   - Status inicial: `SCHEDULED`
   - Equipamentos vinculados

3. **WorkOrder IN_PROGRESS**
   - Técnico inicia execução em campo
   - `executionStart` timestamp automático
   - Status: `SCHEDULED` → `IN_PROGRESS`

4. **WorkOrder DONE**
   - Serviço concluído
   - `executionEnd` timestamp automático
   - Status: `IN_PROGRESS` → `DONE`

5. **Invoice** (Dia 8 - Futuro)
   - Gerada automaticamente após OS concluída
   - Valores baseados no Quote original
   - Pode adicionar items extras

## Status Machines

### WorkOrder Status Flow

```
SCHEDULED ──────> IN_PROGRESS ──────> DONE
    │                  │
    │                  │
    v                  v
 CANCELED          CANCELED
```

**Regras de Transição**:
- `SCHEDULED` pode ir para: `IN_PROGRESS`, `CANCELED`
- `IN_PROGRESS` pode ir para: `DONE`, `CANCELED`
- `DONE`: estado final (sem transições)
- `CANCELED`: estado final (sem transições)

**Automações**:
- Ao transitar para `IN_PROGRESS`: Se `executionStart` vazio → preenche com timestamp atual
- Ao transitar para `DONE`: Se `executionEnd` vazio → preenche com timestamp atual

**Validações**:
- Não pode atualizar OS se status é `DONE` ou `CANCELED`
- Não pode deletar OS se status é `IN_PROGRESS` ou `DONE`
- Não pode adicionar/remover equipments se `DONE` ou `CANCELED`

## Regras de Negócio Críticas

### 1. Quote → WorkOrder

**Validações ao criar WorkOrder com quoteId**:
```typescript
if (quoteId) {
  // 1. Quote deve pertencer ao usuário
  // 2. Quote deve estar APPROVED
  // 3. Quote deve pertencer ao mesmo cliente
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      userId: user.id,
      clientId: createDto.clientId,
      status: 'APPROVED'
    }
  });

  if (!quote) {
    throw new ForbiddenException('Quote not found or not approved');
  }

  // 4. Quote não pode ter outra OS (relação 1:1)
  const existingWO = await prisma.workOrder.findFirst({
    where: { quoteId }
  });

  if (existingWO) {
    throw new BadRequestException('Quote already has a WorkOrder');
  }
}
```

### 2. Ownership Multi-nível

**Regra**: Todo recurso pertence a um único usuário.

```typescript
// WorkOrder
WHERE userId = user.id

// Client (ao criar WO)
WHERE clientId = X AND userId = user.id

// Quote (ao criar WO com quote)
WHERE quoteId = Y AND userId = user.id AND clientId = X

// Equipments (ao adicionar)
WHERE equipmentId = Z AND userId = user.id AND clientId = X
```

## Modelo de Dados

### Entidades Principais

```
User
  ├── Clients (1:N)
  ├── Items (1:N)
  ├── Equipments (1:N)
  ├── Quotes (1:N)
  ├── WorkOrders (1:N)
  └── Invoices (1:N)

Client
  ├── Equipments (1:N)
  ├── Quotes (1:N)
  ├── WorkOrders (1:N)
  └── Invoices (1:N)

Quote (APPROVED)
  └── WorkOrder (1:1?) ⭐

WorkOrder ⭐
  ├── Client (N:1)
  ├── Quote? (1:1)
  ├── Equipments (N:M via WorkOrderEquipment)
  └── Invoice? (1:1 - Futuro Dia 8)
```

### Tabela de Ligação: WorkOrderEquipment

```prisma
model WorkOrderEquipment {
  id          String    @id
  workOrderId String
  equipmentId String
  createdAt   DateTime

  workOrder   WorkOrder @relation(...)
  equipment   Equipment @relation(...)
}
```

**Purpose**: Permite vincular múltiplos equipamentos a uma OS.

## Diagrama de Sequência: Criar OS a partir de Quote

```
User          API          Service       Prisma        DB
 │             │              │             │           │
 │ POST        │              │             │           │
 │ /work-orders│              │             │           │
 ├────────────>│              │             │           │
 │             │ create()     │             │           │
 │             ├─────────────>│             │           │
 │             │              │ Validate    │           │
 │             │              │ Client      │           │
 │             │              ├────────────>│──────────>│
 │             │              │<────────────│<──────────│
 │             │              │             │           │
 │             │              │ Validate    │           │
 │             │              │ Quote       │           │
 │             │              ├────────────>│──────────>│
 │             │              │<────────────│<──────────│
 │             │              │             │           │
 │             │              │ Check       │           │
 │             │              │ APPROVED    │           │
 │             │              │             │           │
 │             │              │ Check       │           │
 │             │              │ existing WO │           │
 │             │              ├────────────>│──────────>│
 │             │              │<────────────│<──────────│
 │             │              │             │           │
 │             │              │ Create      │           │
 │             │              │ WorkOrder   │           │
 │             │              ├────────────>│──────────>│
 │             │              │<────────────│<──────────│
 │             │<─────────────│             │           │
 │<────────────│              │             │           │
 │ 201 Created │              │             │           │
```

## Preparação para Evolução

O módulo WorkOrders está preparado para futuras funcionalidades:

### Checklists (Futuro)
```prisma
model WorkOrderChecklist {
  id          String
  workOrderId String
  templateId  String?
  items       ChecklistItem[]
}

model ChecklistItem {
  id          String
  checklistId String
  description String
  checked     Boolean
  photoUrl    String?
}
```

### Fotos (Futuro)
```prisma
model WorkOrderPhoto {
  id          String
  workOrderId String
  type        PhotoType  // BEFORE, DURING, AFTER
  url         String
  uploadedAt  DateTime
}
```

### Assinatura Digital (Futuro)
```prisma
model WorkOrder {
  ...
  clientSignature     String?  // Base64 ou URL
  clientSignedAt      DateTime?
  clientSignatureName String?
}
```

### GPS Tracking (Futuro)
```prisma
model WorkOrder {
  ...
  startLatitude   Float?
  startLongitude  Float?
  endLatitude     Float?
  endLongitude    Float?
}
```

## Tecnologias

### Backend
- **Framework**: NestJS 10
- **ORM**: Prisma 5
- **Database**: PostgreSQL
- **Auth**: JWT (passport-jwt)
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Tests**: Jest + Supertest

### Convenções
- **Ownership**: Todos recursos isolados por `userId`
- **Status Machines**: Transições validadas
- **Timestamps Automáticos**: `executionStart`, `executionEnd`
- **Swagger**: Documentação completa de todos endpoints

---

**Última atualização**: Dia 7 (2025-12-09)
