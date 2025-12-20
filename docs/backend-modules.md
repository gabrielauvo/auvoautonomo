# Backend Modules - FieldFlow

Documentação dos módulos do backend do sistema FieldFlow.

## Visão Geral

O backend do FieldFlow é construído com NestJS e organizado em módulos funcionais. Cada módulo representa uma área de funcionalidade do sistema.

## Módulos Implementados

### 1. Auth Module
**Responsabilidade**: Autenticação e autorização de usuários.

**Funcionalidades**:
- Registro de novos usuários
- Login com email/senha
- Geração de tokens JWT
- Guards de autenticação
- Decorators (@CurrentUser)

**Endpoints principais**:
- `POST /auth/signup` - Registro
- `POST /auth/login` - Login

---

### 2. Plans Module
**Responsabilidade**: Gerenciamento de planos de assinatura.

**Funcionalidades**:
- CRUD de planos
- Controle de limites por plano (maxClients, maxQuotes, etc.)
- Validação de features por plano

**Endpoints principais**:
- `POST /plans` - Criar plano
- `GET /plans` - Listar planos
- `GET /plans/:id` - Buscar plano
- `PUT /plans/:id` - Atualizar plano
- `DELETE /plans/:id` - Deletar plano

---

### 3. Clients Module
**Responsabilidade**: Gerenciamento de clientes do autônomo.

**Funcionalidades**:
- CRUD de clientes
- Validação de limites do plano
- Vinculação com userId
- Dados de contato e endereço

**Endpoints principais**:
- `POST /clients` - Criar cliente
- `GET /clients` - Listar clientes do usuário
- `GET /clients/:id` - Buscar cliente
- `PUT /clients/:id` - Atualizar cliente
- `DELETE /clients/:id` - Deletar cliente

**Relacionamentos**:
- User (1:N) → Clients
- Clients (1:N) → Equipments
- Clients (1:N) → Quotes
- Clients (1:N) → WorkOrders

---

### 4. Items Module
**Responsabilidade**: Catálogo de produtos e serviços.

**Funcionalidades**:
- CRUD de items (produtos/serviços)
- Tipos: PRODUCT, SERVICE
- Preço unitário
- Unidade de medida

**Endpoints principais**:
- `POST /items` - Criar item
- `GET /items` - Listar items do usuário
- `GET /items/:id` - Buscar item
- `PUT /items/:id` - Atualizar item
- `DELETE /items/:id` - Deletar item

**Relacionamentos**:
- User (1:N) → Items
- Items (1:N) → QuoteItems (snapshot de preço)

---

### 5. Equipments Module
**Responsabilidade**: Gerenciamento de equipamentos dos clientes.

**Funcionalidades**:
- CRUD de equipamentos
- Vinculação com cliente
- Histórico de manutenções (futuro)
- Dados técnicos (marca, modelo, serial, garantia)

**Endpoints principais**:
- `POST /equipments` - Criar equipamento
- `GET /equipments` - Listar equipamentos (filtros: clientId, type)
- `GET /equipments/:id` - Buscar equipamento
- `PUT /equipments/:id` - Atualizar equipamento
- `DELETE /equipments/:id` - Deletar equipamento

**Relacionamentos**:
- User (1:N) → Equipments
- Clients (1:N) → Equipments
- Equipments (N:M) → WorkOrders (via WorkOrderEquipment)

---

### 6. Quotes Module
**Responsabilidade**: Gerenciamento de orçamentos.

**Funcionalidades**:
- CRUD de orçamentos
- Gestão de items do orçamento (QuoteItems)
- Cálculo automático de totais
- Aplicação de descontos
- Status machine (DRAFT→SENT→APPROVED/REJECTED→EXPIRED)
- Snapshot de preços (unitPrice copiado do catálogo)

**Endpoints principais**:
- `POST /quotes` - Criar orçamento
- `GET /quotes` - Listar orçamentos (filtros: clientId, status)
- `GET /quotes/:id` - Buscar orçamento
- `PUT /quotes/:id` - Atualizar orçamento
- `DELETE /quotes/:id` - Deletar orçamento
- `POST /quotes/:id/items` - Adicionar item
- `PUT /quotes/:id/items/:itemId` - Atualizar item
- `DELETE /quotes/:id/items/:itemId` - Remover item
- `PATCH /quotes/:id/status` - Atualizar status

**Regras de negócio**:
- `totalValue = Σ(QuoteItem.totalPrice) - discountValue`
- `QuoteItem.totalPrice = quantity * unitPrice`
- `unitPrice` é snapshot do Item no momento da criação
- Desconto não pode fazer total ficar negativo
- Transições de status validadas

**Relacionamentos**:
- User (1:N) → Quotes
- Clients (1:N) → Quotes
- Quotes (1:N) → QuoteItems
- Quotes (1:1?) → WorkOrder (quando aprovado)

---

### 7. WorkOrders Module
**Responsabilidade**: Gerenciamento de ordens de serviço (execução em campo).

**Funcionalidades**:
- CRUD de ordens de serviço
- Vinculação com cliente (obrigatório)
- Vinculação com orçamento aprovado (opcional)
- Gestão de equipamentos vinculados
- Status machine (SCHEDULED→IN_PROGRESS→DONE/CANCELED)
- Agendamento (datas e horários)
- Rastreamento de execução (executionStart, executionEnd)
- Endereço customizado por OS
- Notas e observações

**Endpoints principais**:
- `POST /work-orders` - Criar OS
- `GET /work-orders` - Listar OS (filtros: clientId, status, startDate, endDate)
- `GET /work-orders/:id` - Buscar OS
- `PUT /work-orders/:id` - Atualizar OS
- `DELETE /work-orders/:id` - Deletar OS
- `PATCH /work-orders/:id/status` - Atualizar status
- `POST /work-orders/:id/equipments` - Adicionar equipamento
- `DELETE /work-orders/:id/equipments/:equipmentId` - Remover equipamento

**Regras de negócio**:
- Cliente obrigatório e deve pertencer ao usuário
- Se `quoteId` fornecido:
  - Quote deve estar `APPROVED`
  - Quote não pode ter outra OS (relação 1:1)
  - Quote deve pertencer ao mesmo cliente
- Status inicial sempre `SCHEDULED`
- Transições válidas:
  - `SCHEDULED` → `IN_PROGRESS`, `CANCELED`
  - `IN_PROGRESS` → `DONE`, `CANCELED`
  - `DONE` → (nenhuma)
  - `CANCELED` → (nenhuma)
- Ao transitar para `IN_PROGRESS`: `executionStart` preenchido automaticamente
- Ao transitar para `DONE`: `executionEnd` preenchido automaticamente
- Não pode atualizar se status é `DONE` ou `CANCELED`
- Não pode deletar se status é `IN_PROGRESS` ou `DONE`

**Relacionamentos**:
- User (1:N) → WorkOrders
- Clients (1:N) → WorkOrders
- Quotes (1:1?) → WorkOrder
- WorkOrders (N:M) → Equipments (via WorkOrderEquipment)
- WorkOrders (1:1?) → Invoice (futuro - Dia 8)

**Preparado para evolução**:
- Checklists dinâmicos
- Upload de fotos (antes/depois)
- Assinatura digital do cliente
- Geolocalização (GPS tracking)
- Cobrança automática

---

### 8. ChecklistTemplates Module
**Responsabilidade**: Templates reutilizáveis de checklists para ordens de serviço.

**Funcionalidades**:
- CRUD de templates
- Gerenciamento de items do checklist
- Tipos de campo: TEXT, NUMERIC, BOOLEAN, PHOTO, SELECT
- Campos condicionais (lógica AND/OR)
- Validação de campos obrigatórios
- Ordenação de items

**Endpoints principais**:
- `POST /checklist-templates` - Criar template
- `GET /checklist-templates` - Listar templates
- `GET /checklist-templates/:id` - Buscar template (com items)
- `PATCH /checklist-templates/:id` - Atualizar template
- `DELETE /checklist-templates/:id` - Deletar template
- `POST /checklist-templates/:id/items` - Adicionar item
- `PATCH /checklist-templates/:templateId/items/:itemId` - Atualizar item
- `DELETE /checklist-templates/:templateId/items/:itemId` - Deletar item

**Operadores condicionais**:
- EQUALS, NOT_EQUALS
- GREATER_THAN, LESS_THAN
- GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL
- IN, NOT_IN

**Relacionamentos**:
- User (1:N) → ChecklistTemplates
- ChecklistTemplates (1:N) → ChecklistTemplateItems
- ChecklistTemplates (1:N) → WorkOrderChecklists (aplicações)

---

### 9. WorkOrderChecklists Module
**Responsabilidade**: Execução de checklists em ordens de serviço.

**Funcionalidades**:
- Aplicar templates a ordens
- Gerenciamento de respostas
- Validação condicional de campos
- Múltiplos checklists por ordem
- Respostas tipadas por campo

**Endpoints principais**:
- `POST /work-orders/:workOrderId/checklists` - Aplicar template
- `GET /work-orders/:workOrderId/checklists` - Listar checklists
- `GET /work-orders/:workOrderId/checklists/:checklistId` - Buscar (com answers)
- `POST /work-orders/:workOrderId/checklists/:checklistId/answers` - Enviar respostas
- `DELETE /work-orders/:workOrderId/checklists/:checklistId` - Deletar checklist

**Regras de negócio**:
- Template deve pertencer ao usuário
- WorkOrder deve pertencer ao usuário
- Campos obrigatórios validados
- Campos condicionais avaliados em tempo de submissão
- Respostas armazenadas em campos tipados (valueText, valueNumber, valueBoolean, valuePhoto, valueSelect)

**Relacionamentos**:
- WorkOrders (1:N) → WorkOrderChecklists
- ChecklistTemplates (1:N) → WorkOrderChecklists
- WorkOrderChecklists (1:N) → WorkOrderChecklistAnswers
- ChecklistTemplateItems (1:N) → WorkOrderChecklistAnswers

---

### 10. EncryptionModule (Global)
**Responsabilidade**: Criptografia de dados sensíveis (API Keys, etc.).

**Funcionalidades**:
- Algoritmo AES-256-CBC
- Geração de chaves seguras
- Criptografia/descriptografia de strings

**Métodos**:
- `encrypt(text: string): string` - Criptografa texto
- `decrypt(encryptedText: string): string` - Descriptografa texto
- `static generateKey(): string` - Gera chave de 32 bytes (64 hex)

**Configuração**:
```env
ENCRYPTION_KEY=64-caracteres-hexadecimais
```

**Uso**:
```typescript
constructor(private readonly encryption: EncryptionService) {}

const encrypted = this.encryption.encrypt('sensitive-data');
const decrypted = this.encryption.decrypt(encrypted);
```

---

### 11. AsaasIntegrationModule
**Responsabilidade**: Integração com conta Asaas do autônomo.

**Funcionalidades**:
- Conexão via API Key
- Suporte a Sandbox e Production
- Validação automática de credenciais
- API Key criptografada no banco

**Endpoints principais**:
- `POST /integrations/asaas/connect` - Conectar conta Asaas
- `GET /integrations/asaas/status` - Status da integração
- `DELETE /integrations/asaas/disconnect` - Desconectar

**Ambientes**:
- **SANDBOX**: https://api-sandbox.asaas.com/v3
- **PRODUCTION**: https://api.asaas.com/v3

**Relacionamentos**:
- User (1:1) → AsaasIntegration

---

### 12. ClientPaymentsModule
**Responsabilidade**: Criação e gerenciamento de cobranças via Asaas.

**Funcionalidades**:
- Sincronização de clientes com Asaas Customers
- Criação de cobranças (Boleto, Pix, Cartão)
- Listagem de pagamentos
- Atualização automática de status via webhook

**Endpoints principais**:
- `POST /clients/:clientId/sync-asaas` - Sincronizar cliente
- `POST /clients/:clientId/payments` - Criar cobrança
- `GET /clients/payments` - Listar cobranças (filtro: clientId)
- `GET /clients/payments/:paymentId` - Buscar cobrança

**Tipos de cobrança**:
- BOLETO: Boleto bancário
- PIX: Pagamento instantâneo
- CREDIT_CARD: Cartão de crédito

**Status de pagamento (16 tipos)**:
- PENDING, CONFIRMED, RECEIVED
- OVERDUE, REFUNDED, DELETED
- RECEIVED_IN_CASH, REFUND_REQUESTED
- REFUND_IN_PROGRESS, PARTIALLY_REFUNDED
- CHARGEBACK_REQUESTED, CHARGEBACK_DISPUTE
- AWAITING_CHARGEBACK_REVERSAL
- DUNNING_REQUESTED, DUNNING_RECEIVED
- AWAITING_RISK_ANALYSIS, AUTHORIZED

**Relacionamentos**:
- User (1:N) → ClientPayments
- Clients (1:N) → ClientPayments
- Quotes (1:N) → ClientPayments
- WorkOrders (1:N) → ClientPayments

---

### 13. WebhooksModule
**Responsabilidade**: Receber eventos do Asaas em tempo real.

**Funcionalidades**:
- Endpoint público para webhooks
- Processamento de 22 tipos de eventos
- Atualização automática de status de pagamentos
- Logs detalhados

**Endpoints**:
- `POST /webhooks/asaas` - Receber eventos (sem autenticação)

**Eventos processados**:
- PAYMENT_CREATED, PAYMENT_UPDATED
- PAYMENT_CONFIRMED, PAYMENT_RECEIVED
- PAYMENT_OVERDUE, PAYMENT_REFUNDED
- PAYMENT_CHARGEBACK_*, PAYMENT_DUNNING_*
- E mais 14 eventos...

**Ações automáticas**:
- Atualiza `status` do ClientPayment
- Preenche `paidAt` quando recebido
- Registra logs de todos os eventos

---

### 14. FinancialDashboardModule
**Responsabilidade**: Painel financeiro completo do autônomo.

**Funcionalidades**:
- Overview financeiro com métricas agregadas
- Receita por dia (gráfico temporal)
- Receita por cliente (ranking)
- Listagem filtrável de pagamentos
- Extrato financeiro por cliente
- Extrato financeiro por OS
- Índices otimizados para performance
- 100% baseado em dados internos (sem chamadas à API Asaas)

**Endpoints principais**:
- `GET /financial/dashboard/overview` - Métricas agregadas do período
- `GET /financial/dashboard/revenue-by-day` - Receita diária
- `GET /financial/dashboard/revenue-by-client` - Receita por cliente
- `GET /financial/dashboard/payments` - Lista filtrável de pagamentos
- `GET /financial/dashboard/client/:clientId` - Extrato do cliente
- `GET /financial/dashboard/work-order/:workOrderId` - Extrato da OS

**Métricas do Overview**:
- `received`: Pagamentos recebidos (RECEIVED, CONFIRMED)
- `pending`: Pagamentos pendentes (dueDate >= hoje)
- `overdue`: Pagamentos vencidos
- `canceled`: Pagamentos cancelados (DELETED)
- `refused`: Pagamentos recusados/estornados
- `totalExpected`: received + pending + overdue
- `netRevenue`: Receita líquida (= received)
- `averageTicket`: Ticket médio geral
- `averageTicketPaid`: Ticket médio dos pagos
- `paymentDistribution`: Distribuição por tipo (PIX, BOLETO, CREDIT_CARD)

**Filtros disponíveis** (endpoint /payments):
- `status`: Filtrar por status de pagamento
- `billingType`: PIX, BOLETO, CREDIT_CARD
- `startDate/endDate`: Range de datas
- `dateField`: Campo de data (paidAt ou dueDate)
- `clientId`: Filtrar por cliente
- `workOrderId`: Filtrar por OS
- `quoteId`: Filtrar por orçamento
- `sortBy/sortOrder`: Ordenação customizada

**Períodos suportados**:
- `current_month`: Mês atual (padrão)
- `last_month`: Mês anterior
- `current_year`: Ano atual
- `custom`: Range customizado (startDate/endDate)
- `all_time`: Todo o histórico

**Documentação completa**: `apps/backend/src/financial-dashboard/README.md`

---

## Fluxo Típico de Negócio

### Cenário 1: Orçamento → OS → Faturamento

```
1. Cliente solicita orçamento
   → POST /quotes (status: DRAFT)

2. Autônomo cria orçamento com items
   → POST /quotes/:id/items (adiciona serviços/produtos)

3. Autônomo envia orçamento ao cliente
   → PATCH /quotes/:id/status (DRAFT → SENT)

4. Cliente aprova orçamento
   → PATCH /quotes/:id/status (SENT → APPROVED)

5. Autônomo cria OS a partir do orçamento aprovado
   → POST /work-orders { quoteId, clientId, ... }
   → Status inicial: SCHEDULED

6. No dia agendado, autônomo inicia execução
   → PATCH /work-orders/:id/status (SCHEDULED → IN_PROGRESS)
   → executionStart preenchido automaticamente

7. Autônomo conclui serviço
   → PATCH /work-orders/:id/status (IN_PROGRESS → DONE)
   → executionEnd preenchido automaticamente

8. [Futuro - Dia 8] Sistema gera nota fiscal automaticamente
   → POST /invoices (baseado na OS concluída)
```

### Cenário 2: OS Direta (sem orçamento)

```
1. Cliente liga solicitando manutenção urgente
   → POST /work-orders { clientId, title, ... }
   → Sem quoteId
   → Status: SCHEDULED

2. Autônomo vai ao local e inicia
   → PATCH /work-orders/:id/status (SCHEDULED → IN_PROGRESS)

3. Autônomo conclui
   → PATCH /work-orders/:id/status (IN_PROGRESS → DONE)

4. [Futuro] Autônomo cria nota fiscal manualmente ou sistema sugere
   → POST /invoices (items adicionados manualmente)
```

---

## Tecnologias Utilizadas

- **Framework**: NestJS 10
- **ORM**: Prisma 5
- **Banco de dados**: PostgreSQL
- **Validação**: class-validator
- **Documentação**: Swagger/OpenAPI
- **Autenticação**: JWT (passport-jwt)
- **Testes**: Jest + Supertest

---

## Estrutura de Pastas

```
apps/backend/src/
├── auth/                  # Autenticação
├── prisma/                # PrismaService
├── plans/                 # Planos
├── clients/               # Clientes
├── items/                 # Catálogo
├── equipments/            # Equipamentos
├── quotes/                # Orçamentos
│   ├── dto/              # DTOs
│   ├── quotes.controller.ts
│   ├── quotes.service.ts
│   ├── quotes.module.ts
│   └── README.md
├── work-orders/           # Ordens de Serviço
│   ├── dto/              # DTOs
│   ├── work-orders.controller.ts
│   ├── work-orders.service.ts
│   ├── work-orders.module.ts
│   └── README.md
├── app.module.ts
└── main.ts
```

---

## Próximos Módulos (Roadmap)

### Dia 8: Invoices Module
- Geração de notas fiscais
- Vinculação com WorkOrders
- Cálculo de impostos
- Status de pagamento

### Futuro:
- **Reports Module**: Relatórios de produtividade
- **Notifications Module**: Push notifications
- **Files Module**: Upload de fotos/documentos
- **Sync Module**: Sincronização offline-first
- **Analytics Module**: Dashboard e métricas

---

## Convenções e Padrões

### Nomenclatura
- Módulos: PascalCase com sufixo `Module` (ex: `WorkOrdersModule`)
- Services: PascalCase com sufixo `Service` (ex: `WorkOrdersService`)
- Controllers: PascalCase com sufixo `Controller` (ex: `WorkOrdersController`)
- DTOs: PascalCase com sufixo `Dto` (ex: `CreateWorkOrderDto`)

### Validação
- Todos os DTOs usam `class-validator`
- Campos obrigatórios: `@IsNotEmpty()`
- UUIDs: `@IsUUID()`
- Enums: `@IsEnum()`
- Strings: `@IsString()`
- Numbers: `@IsNumber()`

### Autenticação
- Todos os endpoints (exceto auth) protegidos com `@UseGuards(JwtAuthGuard)`
- UserId extraído com `@CurrentUser() user`

### Ownership
- **Regra crítica**: Todos os recursos devem pertencer ao usuário autenticado
- Validação no service: `WHERE userId = ...`
- Exceções: `ForbiddenException` (403) ou `NotFoundException` (404)

### Swagger
- Todos os controllers: `@ApiTags()`
- Todos os endpoints: `@ApiOperation()`, `@ApiResponse()`
- Todos os DTOs: `@ApiProperty()`

### Testes
- Testes unitários: `*.service.spec.ts`
- Testes E2E: `test/*.e2e-spec.ts`
- Cobertura mínima: 80%

---

## Documentação por Módulo

Cada módulo possui seu próprio `README.md` com:
- Descrição do módulo
- Modelos Prisma
- Regras de negócio
- Endpoints com exemplos
- Fluxos de uso
- Casos de uso
- Testes

**Localização**: `apps/backend/src/{module-name}/README.md`

---

**Documentação Relacionada**:
- [Asaas Integration](./asaas-integration.md) - Documentação completa da integração Asaas
- [Architecture](./architecture.md) - Arquitetura geral do sistema
- [Plans and Limits](./plans-and-limits.md) - Sistema de planos e limites

---

Última atualização: Dia 10 (2025-12-09)
