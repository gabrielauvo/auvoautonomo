# AI Copilot - Arquitetura e Especificação

## 1. Visão Geral

O AI Copilot é um assistente transacional integrado ao SaaS Auvo Autônomo que permite aos usuários executar ações através de linguagem natural com **segurança de nível financeiro**.

### Princípios de Segurança

1. **Zero Trust LLM** - O LLM nunca acessa banco/APIs diretamente
2. **Gateway Obrigatório** - Todas as ações passam pelo `ai-gateway` service
3. **Confirmação Explícita** - Ações de escrita requerem PLAN → CONFIRM → EXECUTE
4. **Multi-tenant Strict** - Isolamento total por `userId`
5. **RBAC no Backend** - Permissões validadas no servidor, não no LLM
6. **Idempotência** - Todas as operações de escrita usam `idempotencyKey`
7. **Auditoria Completa** - Log de todas as ações com rastreabilidade

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────┐                                                        │
│  │  Chat UI    │ ─────────────────────────────────────────────┐         │
│  │  (Web/App)  │                                              │         │
│  └─────────────┘                                              │         │
└───────────────────────────────────────────────────────────────│─────────┘
                                                                │
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (NestJS)                               │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      AI-GATEWAY MODULE                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Controller │  │   Service   │  │    Tool Registry        │   │   │
│  │  │  /ai/chat   │──│  Orchestrator│──│  (validação + dispatch) │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │   │
│  │         │                │                      │                │   │
│  │         │                │                      │                │   │
│  │  ┌──────▼────────────────▼──────────────────────▼────────────┐   │   │
│  │  │                    TOOL EXECUTOR                           │   │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │   │
│  │  │  │ Plan     │ │ Preview  │ │ Confirm  │ │ Execute      │  │   │   │
│  │  │  │ Generator│ │ (dry-run)│ │ Handler  │ │ (idempotent) │  │   │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │   │   │
│  │  └───────────────────────────────────────────────────────────┘   │   │
│  │                              │                                    │   │
│  │  ┌───────────────────────────▼────────────────────────────────┐  │   │
│  │  │                    AUDIT SERVICE                            │  │   │
│  │  │  (userId, tool, payload, result, timestamps, entityIds)    │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         │                          │                          │         │
│         ▼                          ▼                          ▼         │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│  │   Clients   │           │   Quotes    │           │  Billing    │   │
│  │   Service   │           │   Service   │           │  Service    │   │
│  └─────────────┘           └─────────────┘           └─────────────┘   │
│         │                          │                          │         │
│         └──────────────────────────┼──────────────────────────┘         │
│                                    │                                     │
│                                    ▼                                     │
│                            ┌─────────────┐                              │
│                            │   Prisma    │                              │
│                            │   (userId   │                              │
│                            │   filter)   │                              │
│                            └─────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │      PostgreSQL       │
                        │   (multi-tenant by    │
                        │      userId)          │
                        └───────────────────────┘
```

---

## 3. Fluxo de Execução

### 3.1 Fluxo Padrão (Leitura)

```
User: "Quais são meus clientes com orçamentos pendentes?"

1. Frontend → POST /ai/chat { message, conversationId }
2. AI Gateway recebe, valida JWT, extrai userId
3. Orchestrator identifica intent: READ_CLIENTS_WITH_PENDING_QUOTES
4. Tool Executor chama: clients.findWithPendingQuotes(userId)
5. Service executa query com WHERE userId = $userId
6. Resultado retorna ao LLM para formatar resposta
7. Audit log registra: { userId, tool, result_count, timestamp }
8. Resposta formatada → Frontend
```

### 3.2 Fluxo de Escrita (PLAN → CONFIRM → EXECUTE)

```
User: "Crie um orçamento de R$500 para o cliente João Silva"

FASE 1 - PLAN:
1. AI Gateway identifica intent: CREATE_QUOTE
2. Tool Executor gera PLAN:
   {
     planId: "uuid",
     action: "CREATE_QUOTE",
     params: { clientId: "...", totalValue: 500 },
     preview: "Criar orçamento de R$500 para João Silva (ID: xxx)",
     requiresConfirmation: true
   }
3. Retorna ao usuário: "Vou criar um orçamento de R$500 para João Silva. Confirma?"

FASE 2 - CONFIRM:
4. User: "Sim, confirma"
5. AI Gateway recebe confirmação com planId
6. Valida que planId pertence ao userId
7. Status do plan → CONFIRMED

FASE 3 - EXECUTE:
8. Tool Executor executa com idempotencyKey
9. QuotesService.create({ ..., idempotencyKey })
10. Audit log: { userId, tool, payload, result, entityIds: [quoteId] }
11. Resposta: "Orçamento #123 criado com sucesso!"
```

### 3.3 Fluxo de Cobrança (PREVIEW obrigatório)

```
User: "Crie uma cobrança PIX de R$200 para o cliente Maria"

FASE 1 - PREVIEW (dry-run obrigatório):
1. AI Gateway identifica: CREATE_PAYMENT
2. Tool Executor chama: billing.previewPayment({ ... })
   - NÃO cria no Asaas
   - Valida dados do cliente
   - Calcula taxas
   - Retorna preview:
     {
       previewId: "uuid",
       clientName: "Maria Santos",
       amount: 200,
       fees: 1.99,
       netAmount: 198.01,
       billingType: "PIX",
       dueDate: "2025-01-03"
     }
3. Retorna: "Preview da cobrança: R$200 PIX para Maria. Taxa: R$1,99. Líquido: R$198,01. Confirma?"

FASE 2 - CONFIRM:
4. User confirma
5. Valida previewId pertence ao userId

FASE 3 - EXECUTE:
6. Tool Executor executa: billing.createPayment({ ..., idempotencyKey })
7. Asaas API é chamada APENAS aqui
8. Audit log completo
9. Resposta com link do PIX
```

---

## 4. Especificação das Tools

### 4.1 Tools de Leitura (sem confirmação)

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `clients.list` | Lista clientes | `{ search?, limit?, offset? }` |
| `clients.get` | Detalhe do cliente | `{ clientId }` |
| `clients.search` | Busca avançada | `{ query, filters? }` |
| `quotes.list` | Lista orçamentos | `{ status?, clientId?, limit? }` |
| `quotes.get` | Detalhe do orçamento | `{ quoteId }` |
| `workOrders.list` | Lista OS | `{ status?, clientId?, dateRange? }` |
| `workOrders.get` | Detalhe da OS | `{ workOrderId }` |
| `payments.list` | Lista cobranças | `{ status?, clientId?, limit? }` |
| `payments.get` | Detalhe da cobrança | `{ paymentId }` |
| `dashboard.summary` | Resumo do dashboard | `{ period? }` |

### 4.2 Tools de Escrita (requerem confirmação)

| Tool | Descrição | Parâmetros | Preview |
|------|-----------|------------|---------|
| `clients.create` | Criar cliente | `{ name, email?, phone?, ... }` | Sim |
| `clients.update` | Atualizar cliente | `{ clientId, data }` | Sim |
| `quotes.create` | Criar orçamento | `{ clientId, items[], discount? }` | Sim |
| `quotes.send` | Enviar orçamento | `{ quoteId }` | Sim |
| `quotes.updateStatus` | Mudar status | `{ quoteId, status }` | Sim |
| `workOrders.create` | Criar OS | `{ clientId, title, scheduledDate? }` | Sim |
| `workOrders.updateStatus` | Mudar status | `{ workOrderId, status }` | Sim |

### 4.3 Tools de Cobrança (PREVIEW obrigatório)

| Tool | Descrição | Parâmetros | Dry-run |
|------|-----------|------------|---------|
| `payments.preview` | Preview de cobrança | `{ clientId, amount, billingType, dueDate? }` | - |
| `payments.create` | Criar cobrança | `{ previewId, confirm: true }` | Obrigatório |
| `payments.cancel` | Cancelar cobrança | `{ paymentId }` | Sim |

---

## 5. Estrutura de Dados

### 5.1 Tabela: AiConversation

```prisma
model AiConversation {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  title         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  messages      AiMessage[]
  plans         AiPlan[]

  @@index([userId])
}
```

### 5.2 Tabela: AiMessage

```prisma
model AiMessage {
  id             String   @id @default(uuid())
  conversationId String
  conversation   AiConversation @relation(fields: [conversationId], references: [id])
  role           AiMessageRole  // USER, ASSISTANT, SYSTEM, TOOL
  content        String
  toolCalls      Json?    // Array de tool calls se role=ASSISTANT
  toolResults    Json?    // Resultados se role=TOOL
  createdAt      DateTime @default(now())

  @@index([conversationId])
}

enum AiMessageRole {
  USER
  ASSISTANT
  SYSTEM
  TOOL
}
```

### 5.3 Tabela: AiPlan

```prisma
model AiPlan {
  id             String   @id @default(uuid())
  conversationId String
  conversation   AiConversation @relation(fields: [conversationId], references: [id])
  userId         String

  action         String   // Nome da tool
  params         Json     // Parâmetros da ação
  preview        String   // Descrição human-readable
  status         AiPlanStatus @default(PENDING)

  idempotencyKey String   @unique

  executedAt     DateTime?
  result         Json?
  entityIds      String[] // IDs das entidades criadas/modificadas

  createdAt      DateTime @default(now())
  expiresAt      DateTime // Plans expiram em 5 minutos

  @@index([userId])
  @@index([idempotencyKey])
}

enum AiPlanStatus {
  PENDING
  CONFIRMED
  EXECUTED
  EXPIRED
  CANCELLED
}
```

### 5.4 Tabela: AiAuditLog

```prisma
model AiAuditLog {
  id             String   @id @default(uuid())
  userId         String
  conversationId String?
  planId         String?

  tool           String
  action         String   // read, create, update, delete, preview, execute
  params         Json
  result         Json?
  success        Boolean
  errorMessage   String?

  entityType     String?  // Client, Quote, WorkOrder, Payment
  entityIds      String[]

  ipAddress      String?
  userAgent      String?

  duration       Int      // ms
  createdAt      DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@index([tool])
}
```

### 5.5 Tabela: AiPaymentPreview

```prisma
model AiPaymentPreview {
  id             String   @id @default(uuid())
  userId         String
  conversationId String?

  clientId       String
  amount         Decimal  @db.Decimal(10, 2)
  billingType    BillingType
  dueDate        DateTime
  description    String?

  // Cálculos do preview
  fees           Decimal  @db.Decimal(10, 2)
  netAmount      Decimal  @db.Decimal(10, 2)

  status         AiPreviewStatus @default(PENDING)
  executedPaymentId String? // ID do ClientPayment se executado

  createdAt      DateTime @default(now())
  expiresAt      DateTime // Expira em 5 minutos

  @@index([userId])
}

enum AiPreviewStatus {
  PENDING
  EXECUTED
  EXPIRED
  CANCELLED
}
```

---

## 6. Contratos de API

### 6.1 POST /ai/chat

**Request:**
```typescript
interface AiChatRequest {
  message: string;
  conversationId?: string;  // Omitir para nova conversa
  confirmPlanId?: string;   // Para confirmar um plano pendente
  cancelPlanId?: string;    // Para cancelar um plano pendente
}
```

**Response:**
```typescript
interface AiChatResponse {
  conversationId: string;
  message: {
    id: string;
    role: 'ASSISTANT';
    content: string;
  };
  plan?: {
    id: string;
    action: string;
    preview: string;
    requiresConfirmation: boolean;
    expiresAt: string;  // ISO datetime
  };
  paymentPreview?: {
    id: string;
    clientName: string;
    amount: number;
    fees: number;
    netAmount: number;
    billingType: string;
    dueDate: string;
    expiresAt: string;
  };
}
```

### 6.2 GET /ai/conversations

**Response:**
```typescript
interface AiConversationsResponse {
  conversations: {
    id: string;
    title: string;
    lastMessage: string;
    updatedAt: string;
  }[];
}
```

### 6.3 GET /ai/conversations/:id

**Response:**
```typescript
interface AiConversationResponse {
  id: string;
  title: string;
  messages: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }[];
  pendingPlan?: {
    id: string;
    action: string;
    preview: string;
    expiresAt: string;
  };
}
```

---

## 7. Validações RBAC

Cada Tool implementa validação de permissão no backend:

```typescript
// Exemplo: clients.create
async validatePermission(userId: string, params: CreateClientParams): Promise<void> {
  // 1. Verificar se usuário existe e está ativo
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedException();

  // 2. Verificar limite do plano
  await this.planLimitsService.checkLimitOrThrow(userId, 'CLIENT');

  // 3. Validar dados específicos (não permite dados de outro usuário)
  // Neste caso, não há referência a outros recursos
}

// Exemplo: quotes.create
async validatePermission(userId: string, params: CreateQuoteParams): Promise<void> {
  // 1. Verificar se cliente pertence ao usuário
  const client = await this.prisma.client.findFirst({
    where: { id: params.clientId, userId, deletedAt: null }
  });
  if (!client) throw new ForbiddenException('Cliente não encontrado');

  // 2. Verificar limite do plano
  await this.planLimitsService.checkLimitOrThrow(userId, 'QUOTE');

  // 3. Se tem items do catálogo, verificar se pertencem ao usuário
  if (params.items?.some(i => i.itemId)) {
    const itemIds = params.items.filter(i => i.itemId).map(i => i.itemId);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, userId }
    });
    if (items.length !== itemIds.length) {
      throw new ForbiddenException('Item do catálogo não encontrado');
    }
  }
}
```

---

## 8. Idempotência

Todas as operações de escrita usam `idempotencyKey`:

```typescript
interface IdempotentOperation {
  idempotencyKey: string;  // UUID gerado no momento do PLAN
}

// No service:
async createQuote(params: CreateQuoteParams & IdempotentOperation) {
  // Verificar se já foi executado
  const existing = await this.prisma.quote.findFirst({
    where: { idempotencyKey: params.idempotencyKey, userId: params.userId }
  });

  if (existing) {
    // Retornar resultado existente (idempotente)
    return existing;
  }

  // Criar novo
  return this.prisma.quote.create({
    data: {
      ...params,
      idempotencyKey: params.idempotencyKey
    }
  });
}
```

---

## 9. Auditoria

Toda operação gera log de auditoria:

```typescript
interface AuditLogEntry {
  userId: string;
  conversationId?: string;
  planId?: string;
  tool: string;           // 'clients.create', 'quotes.send', etc.
  action: string;         // 'read', 'create', 'update', 'delete', 'preview', 'execute'
  params: object;         // Parâmetros da operação (sem dados sensíveis)
  result?: object;        // Resultado (resumido)
  success: boolean;
  errorMessage?: string;
  entityType?: string;    // 'Client', 'Quote', 'WorkOrder', 'Payment'
  entityIds: string[];    // IDs das entidades afetadas
  ipAddress?: string;
  userAgent?: string;
  duration: number;       // Tempo de execução em ms
  createdAt: Date;
}
```

---

## 10. Segurança Adicional

### 10.1 Rate Limiting

```typescript
// Por usuário, específico para AI
@Throttle({ ai: { limit: 30, ttl: 60000 } })  // 30 req/min
```

### 10.2 Timeout

```typescript
// Timeout para chamadas LLM
const AI_TIMEOUT_MS = 30000;  // 30 segundos
```

### 10.3 Sanitização de Dados

```typescript
// Nunca enviar ao LLM:
// - Senhas ou tokens
// - Chaves de API
// - Dados de cartão de crédito
// - CPF/CNPJ completos (mascarar)
```

### 10.4 Expiração de Planos

```typescript
// Planos pendentes expiram em 5 minutos
const PLAN_EXPIRATION_MS = 5 * 60 * 1000;

// Cron job para limpar planos expirados
@Cron('*/5 * * * *')
async cleanExpiredPlans() {
  await this.prisma.aiPlan.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() }
    },
    data: { status: 'EXPIRED' }
  });
}
```

---

## 11. Estrutura de Arquivos

```
apps/backend/src/ai-gateway/
├── ai-gateway.module.ts
├── ai-gateway.controller.ts
├── ai-gateway.service.ts           # Orchestrator
├── dto/
│   ├── ai-chat.dto.ts
│   └── ai-response.dto.ts
├── tools/
│   ├── tool-registry.ts            # Registro e dispatch de tools
│   ├── tool-executor.ts            # Executor com validação
│   ├── base-tool.ts                # Classe base
│   ├── clients/
│   │   ├── clients-list.tool.ts
│   │   ├── clients-get.tool.ts
│   │   ├── clients-create.tool.ts
│   │   └── clients-update.tool.ts
│   ├── quotes/
│   │   ├── quotes-list.tool.ts
│   │   ├── quotes-get.tool.ts
│   │   ├── quotes-create.tool.ts
│   │   └── quotes-send.tool.ts
│   ├── work-orders/
│   │   ├── work-orders-list.tool.ts
│   │   ├── work-orders-get.tool.ts
│   │   └── work-orders-create.tool.ts
│   └── payments/
│       ├── payments-list.tool.ts
│       ├── payments-preview.tool.ts
│       └── payments-create.tool.ts
├── services/
│   ├── plan.service.ts             # Gerenciamento de planos
│   ├── audit.service.ts            # Auditoria
│   └── llm.service.ts              # Integração com LLM (Claude)
└── guards/
    └── ai-rate-limit.guard.ts
```

---

## 12. Status da Implementação

### Concluído ✅

1. [x] Adicionar modelos Prisma ao schema
   - `AiConversation`, `AiMessage`, `AiPlan`, `AiPaymentPreview`, `AiAuditLog`
   - Enums: `AiConversationStatus`, `AiPlanStatus`, `AiActionType`, `AiAuditCategory`
   - Migration criada em `prisma/migrations/20251224_add_ai_copilot_module/`

2. [x] Criar módulo ai-gateway
   - `AiGatewayModule` registrado no `AppModule`
   - Controller com endpoints: `/ai/chat`, `/ai/plans/confirm`, `/ai/plans/reject`, `/ai/conversations`

3. [x] Implementar Tool Registry
   - `ToolRegistryService` - registro dinâmico de tools
   - Interface `ITool` para padronização
   - Validação automática de permissões

4. [x] Implementar Tools de leitura
   - `clients.list`, `clients.get`
   - `quotes.list`, `quotes.get`
   - `workOrders.list`, `workOrders.get`
   - `payments.list`

5. [x] Implementar fluxo PLAN → CONFIRM → EXECUTE
   - `AiPlanService` gerencia todo o fluxo
   - Expiração automática de planos (5 min)
   - Suporte a múltiplas ações em um plano

6. [x] Implementar Tools de escrita
   - `clients.create`, `clients.update`
   - `quotes.create`
   - `workOrders.create`, `workOrders.updateStatus`

7. [x] Implementar preview de cobranças (dry-run obrigatório)
   - `payments.preview` - validação completa sem criar no Asaas
   - `payments.create` - requer preview confirmado
   - Idempotência via `idempotencyKey`

8. [x] Sistema de auditoria completo
   - `AiAuditService` - log de todas as operações
   - Sanitização de dados sensíveis
   - Rastreabilidade por `conversationId`, `planId`, `entityId`

9. [x] Integrar com LLM Provider
   - `LLMService` com suporte a Anthropic Claude e OpenAI GPT
   - `FakeLLMProvider` para testes e fallback
   - Detecção automática de provider via variáveis de ambiente
   - Configuração: `LLM_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

10. [x] Implementar State Machine de conversas
    - Estados: `IDLE`, `PLANNING`, `AWAITING_CONFIRMATION`, `EXECUTING`
    - Transições válidas entre estados
    - Detecção de confirmação/rejeição/modificação em português e inglês
    - Persistência do estado no banco de dados

11. [x] Implementar Response Parser robusto
    - Parsing de respostas JSON do LLM com Zod
    - Tipos discriminados: `PLAN`, `CALL_TOOL`, `ASK_USER`, `RESPONSE`
    - Extração de JSON de markdown code blocks
    - Fallback para texto plano quando não há JSON válido

12. [x] Implementar Chat Orchestrator
    - `ChatOrchestratorService` - orquestração completa do fluxo de chat
    - Integração com LLM, State Machine, Tool Executor
    - Tratamento de cada estado da conversa
    - Suporte a idempotência via `IdempotencyService`

13. [x] Criar AgentPolicyPrompt
    - Prompt centralizado com regras comportamentais do agente
    - Regras específicas para operações READ e WRITE
    - Regras especiais para billing (preview obrigatório, dupla confirmação)
    - Formato de resposta JSON estruturado

14. [x] Criar testes unitários
    - Testes para `LLMResponseParser` (21 testes)
    - Testes para `ConversationState` (41 testes)
    - Cobertura de parsing, validação, e transições de estado

15. [x] Criar testes e2e
    - `test/ai-gateway.e2e-spec.ts` - fluxo completo de chat
    - Testes de autenticação, operações de leitura, escrita, confirmação, rejeição

### Pendente 📝

16. [ ] Criar UI de chat no frontend
    - Componente de chat com histórico
    - UI para confirmação de planos
    - Preview de cobranças com detalhes

17. [ ] Implementar streaming de respostas
    - SSE ou WebSocket para streaming do LLM
    - Indicador de "digitando" no frontend

---

## 13. Arquivos Implementados

```
apps/backend/src/ai-gateway/
├── index.ts                          # Exports principais
├── ai-gateway.module.ts              # Módulo NestJS
├── ai-gateway.controller.ts          # Endpoints REST
├── enums/                            # Enumerações
│   └── index.ts                      # AiAuditCategory, etc.
├── dto/
│   └── chat.dto.ts                   # DTOs de request/response
├── interfaces/
│   └── tool.interface.ts             # Interfaces base para tools
├── prompts/
│   └── agent-policy.prompt.ts        # System prompt centralizado
├── state-machine/
│   ├── index.ts                      # Exports
│   ├── conversation-state.ts         # Estados e transições
│   └── conversation-state.service.ts # Persistência de estado
├── llm/
│   ├── llm-provider.interface.ts     # Interface ILLMProvider
│   ├── anthropic-provider.ts         # Claude API provider
│   ├── openai-provider.ts            # OpenAI GPT provider
│   ├── fake-provider.ts              # FakeLLM para testes
│   ├── llm.service.ts                # Factory de providers
│   └── response-parser.ts            # Parsing JSON com Zod
├── services/
│   ├── ai-gateway.service.ts         # Orquestrador principal
│   ├── ai-conversation.service.ts    # Gerenciamento de conversas
│   ├── ai-plan.service.ts            # Fluxo PLAN → CONFIRM → EXECUTE
│   ├── ai-audit.service.ts           # Auditoria e logging
│   ├── chat-orchestrator.service.ts  # Orquestração de chat com LLM
│   ├── idempotency.service.ts        # Idempotência de operações
│   └── tool-registry.service.ts      # Registro e dispatch de tools
├── __tests__/
│   ├── response-parser.spec.ts       # Testes do parser (21 testes)
│   └── conversation-state.spec.ts    # Testes do state machine (41 testes)
└── tools/
    ├── index.ts                      # Exports de tools
    ├── base.tool.ts                  # Classe base abstrata
    ├── clients/
    │   ├── clients-list.tool.ts
    │   ├── clients-get.tool.ts
    │   ├── clients-create.tool.ts
    │   └── clients-update.tool.ts
    ├── quotes/
    │   ├── quotes-list.tool.ts
    │   ├── quotes-get.tool.ts
    │   └── quotes-create.tool.ts
    ├── work-orders/
    │   ├── work-orders-list.tool.ts
    │   ├── work-orders-get.tool.ts
    │   ├── work-orders-create.tool.ts
    │   └── work-orders-update-status.tool.ts
    └── payments/
        ├── payments-list.tool.ts
        ├── payments-preview.tool.ts
        └── payments-create.tool.ts

apps/backend/test/
└── ai-gateway.e2e-spec.ts            # Testes e2e do AI Gateway
```

## 14. Configuração do LLM Provider

### Variáveis de Ambiente

```bash
# Anthropic Claude (recomendado)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# OpenAI GPT (alternativa)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Modo de teste/fallback (sem API)
# Se nenhuma chave for configurada, usa FakeLLMProvider automaticamente
```

### Arquitetura do LLM Provider

```
┌─────────────────────────────────────────────────────────────┐
│                        LLMService                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 getAvailableProvider()                │    │
│  │  1. Verifica ANTHROPIC_API_KEY → AnthropicProvider   │    │
│  │  2. Verifica OPENAI_API_KEY → OpenAIProvider         │    │
│  │  3. Fallback → FakeLLMProvider                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ AnthropicProvider│ │ OpenAIProvider  │ │ FakeLLMProvider │
│ - Claude 3.5/4   │ │ - GPT-4o        │ │ - Pattern-based │
│ - Tool use       │ │ - Function call │ │ - Para testes   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 15. State Machine de Conversas

### Estados

| Estado | Descrição |
|--------|-----------|
| `IDLE` | Estado inicial, aguardando input do usuário |
| `PLANNING` | Coletando dados para uma operação de escrita |
| `AWAITING_CONFIRMATION` | Aguardando confirmação do usuário para executar |
| `EXECUTING` | Executando a operação |

### Transições Válidas

```
IDLE ──────────────────────────────────────────────┐
  │                                                 │
  │ (user message)                                 │
  ▼                                                │
PLANNING ────────────────────────────────────┐     │
  │                                           │     │
  │ (all fields collected)                   │     │
  ▼                                           │     │
AWAITING_CONFIRMATION ──┐                     │     │
  │                      │ (modification)     │     │
  │ (confirm)            └────────────────────┘     │
  ▼                                                 │
EXECUTING                                          │
  │                                                 │
  │ (complete or reject)                           │
  └────────────────────────────────────────────────┘
```

### Detecção de Intenção do Usuário

| Tipo | Exemplos (PT) | Exemplos (EN) |
|------|---------------|---------------|
| Confirmação | "sim", "confirmo", "ok", "pode" | "yes", "confirm" |
| Rejeição | "não", "cancelar", "para" | "no", "cancel" |
| Modificação | "alterar", "mudar", "corrigir" | "change", "modify" |

## 16. Response Parser

### Tipos de Resposta do LLM

```typescript
// PLAN - O LLM identificou uma operação de escrita
{
  "type": "PLAN",
  "action": "customers.create",
  "collectedFields": { "name": "João Silva", "email": "joao@email.com" },
  "missingFields": ["phone"],
  "requiresConfirmation": true,
  "message": "Preciso do telefone para criar o cliente."
}

// CALL_TOOL - Executar uma ferramenta diretamente (operações de leitura)
{
  "type": "CALL_TOOL",
  "tool": "customers.list",
  "params": { "search": "João" }
}

// ASK_USER - Pedir informação ao usuário
{
  "type": "ASK_USER",
  "question": "Qual o valor do orçamento?",
  "context": "Estou criando um orçamento para o cliente Maria",
  "options": ["R$100", "R$500", "Outro valor"]
}

// RESPONSE - Resposta informativa
{
  "type": "RESPONSE",
  "message": "Encontrei 3 clientes com o nome João.",
  "data": { "count": 3 }
}
```

### Extração de JSON

O parser suporta múltiplos formatos:

1. JSON direto: `{"type": "PLAN", ...}`
2. Markdown code block: `` ```json {...} ``` ``
3. JSON embutido no texto: `Vou criar... {"type": "PLAN", ...}`
