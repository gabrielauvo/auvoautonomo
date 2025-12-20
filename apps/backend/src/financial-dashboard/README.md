# Financial Dashboard Module

## Visão Geral

O módulo **Financial Dashboard** fornece uma visão completa da saúde financeira do autônomo, utilizando exclusivamente dados internos do sistema (tabela `ClientPayment`). Nenhuma chamada à API do Asaas é realizada - todos os dados são derivados do banco de dados local.

## Características Principais

- ✅ **Overview financeiro** com métricas agregadas
- ✅ **Receita por dia** com gráfico temporal
- ✅ **Receita por cliente** com ranking
- ✅ **Listagem filtrável** de pagamentos
- ✅ **Extrato por cliente** com histórico completo
- ✅ **Extrato por OS** (Work Order)
- ✅ **Isolamento total por userId** em todas as queries
- ✅ **Índices otimizados** para performance
- ✅ **API pronta para Mobile** (valores numéricos, datas ISO)

## Regras Fundamentais

### 1. Isolamento de Dados
Todas as queries DEVEM filtrar por `userId`. Nunca um usuário pode ver dados de outro.

### 2. Campos de Data
- **`paidAt`**: Data real do pagamento (usado para cálculos de receita)
- **`dueDate`**: Data de vencimento (usado para pendências e vencidos)

### 3. Categorização de Status

| Categoria | Status incluídos |
|-----------|-----------------|
| **PAID** (Recebido) | `RECEIVED`, `CONFIRMED` |
| **PENDING** (Pendente) | `PENDING`, `AUTHORIZED`, `AWAITING_RISK_ANALYSIS` |
| **OVERDUE** (Vencido) | `OVERDUE` + PENDING com dueDate < hoje |
| **CANCELED** (Cancelado) | `DELETED` |
| **REFUSED** (Recusado) | `REFUNDED`, `PARTIALLY_REFUNDED`, `REFUND_IN_PROGRESS`, `REFUND_REQUESTED`, `CHARGEBACK_REQUESTED`, `CHARGEBACK_DISPUTE`, `AWAITING_CHARGEBACK_REVERSAL` |

## Endpoints

### 1. GET /financial/dashboard/overview

Retorna métricas agregadas do período especificado.

**Query Parameters:**
- `period`: `current_month` | `last_month` | `current_year` | `custom`
- `startDate`: Data início (ISO) - requerido se period=custom
- `endDate`: Data fim (ISO) - requerido se period=custom

**Response:**
```json
{
  "period": "current_month",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-01-31T23:59:59.999Z",
  "received": 1500.00,
  "pending": 500.00,
  "overdue": 200.00,
  "canceled": 100.00,
  "refused": 50.00,
  "totalExpected": 2200.00,
  "netRevenue": 1500.00,
  "invoicedCount": 10,
  "paidCount": 6,
  "overdueCount": 2,
  "averageTicket": 220.00,
  "averageTicketPaid": 250.00,
  "paymentDistribution": {
    "PIX": 800.00,
    "BOLETO": 500.00,
    "CREDIT_CARD": 200.00
  }
}
```

### 2. GET /financial/dashboard/revenue-by-day

Retorna receita diária para o período especificado.

**Query Parameters:**
- `startDate`: Data início (ISO) - default: início do mês atual
- `endDate`: Data fim (ISO) - default: fim do mês atual

**Response:**
```json
[
  { "date": "2025-01-01", "value": 350.00 },
  { "date": "2025-01-02", "value": 0.00 },
  { "date": "2025-01-03", "value": 150.00 }
]
```

**Notas:**
- Usa `paidAt` como referência
- Apenas status PAID (RECEIVED, CONFIRMED)
- Dias sem receita são preenchidos com zero

### 3. GET /financial/dashboard/revenue-by-client

Retorna receita agrupada por cliente.

**Query Parameters:**
- `period`: `current_month` | `last_month` | `current_year` | `all_time`
- `startDate`: Data início para range customizado
- `endDate`: Data fim para range customizado

**Response:**
```json
[
  {
    "clientId": "uuid-1",
    "name": "Cliente XPTO",
    "totalPaid": 2500.00,
    "count": 5
  },
  {
    "clientId": "uuid-2",
    "name": "Cliente ABC",
    "totalPaid": 1200.00,
    "count": 3
  }
]
```

**Notas:**
- Ordenado por `totalPaid` decrescente
- Apenas pagamentos PAID

### 4. GET /financial/dashboard/payments

Retorna listagem filtrável de pagamentos.

**Query Parameters:**
- `status`: Filtrar por status (`PENDING`, `RECEIVED`, etc.)
- `billingType`: Filtrar por tipo (`PIX`, `BOLETO`, `CREDIT_CARD`)
- `startDate`: Data início do range
- `endDate`: Data fim do range
- `dateField`: Campo de data para filtro (`paidAt` | `dueDate`) - default: `dueDate`
- `clientId`: Filtrar por cliente
- `workOrderId`: Filtrar por OS
- `quoteId`: Filtrar por orçamento
- `sortBy`: Campo de ordenação (`createdAt` | `dueDate` | `paidAt` | `value`)
- `sortOrder`: Ordem (`asc` | `desc`) - default: `desc`

**Response:**
```json
[
  {
    "id": "uuid",
    "asaasPaymentId": "pay_123",
    "clientId": "uuid",
    "clientName": "João da Silva",
    "workOrderId": "uuid",
    "workOrderTitle": "Manutenção AC",
    "quoteId": null,
    "billingType": "PIX",
    "value": 250.00,
    "description": "Serviço de manutenção",
    "dueDate": "2025-01-20T00:00:00.000Z",
    "status": "RECEIVED",
    "paidAt": "2025-01-18T14:30:00.000Z",
    "canceledAt": null,
    "createdAt": "2025-01-10T10:00:00.000Z"
  }
]
```

### 5. GET /financial/dashboard/client/:clientId

Retorna extrato financeiro de um cliente específico.

**Response:**
```json
{
  "clientId": "uuid",
  "clientName": "João da Silva",
  "totalPaid": 5000.00,
  "totalPending": 1200.00,
  "totalOverdue": 300.00,
  "history": [
    {
      "paymentId": "uuid",
      "value": 500.00,
      "status": "RECEIVED",
      "dueDate": "2025-01-15T00:00:00.000Z",
      "paidAt": "2025-01-14T10:00:00.000Z",
      "description": "Instalação de AC"
    }
  ]
}
```

### 6. GET /financial/dashboard/work-order/:workOrderId

Retorna extrato financeiro de uma OS específica.

**Response:**
```json
{
  "workOrderId": "uuid",
  "workOrderTitle": "Manutenção Preventiva",
  "totalPaid": 800.00,
  "totalPending": 200.00,
  "totalOverdue": 0.00,
  "payments": [
    {
      "paymentId": "uuid",
      "value": 400.00,
      "status": "RECEIVED",
      "billingType": "PIX",
      "dueDate": "2025-01-10T00:00:00.000Z",
      "paidAt": "2025-01-09T15:00:00.000Z",
      "description": "Parcela 1/2"
    }
  ]
}
```

## Fórmulas de Cálculo

| Métrica | Fórmula |
|---------|---------|
| `received` | Soma de `value` onde status ∈ PAID_STATUSES e `paidAt` no período |
| `pending` | Soma de `value` onde status ∈ PENDING_STATUSES e `dueDate` >= hoje |
| `overdue` | Soma de `value` onde status = OVERDUE OU (status ∈ PENDING e dueDate < hoje) |
| `canceled` | Soma de `value` onde status = DELETED |
| `refused` | Soma de `value` onde status ∈ REFUSED_STATUSES |
| `totalExpected` | received + pending + overdue |
| `netRevenue` | received (receita líquida = receita recebida) |
| `averageTicket` | totalValue / invoicedCount |
| `averageTicketPaid` | paidTotalValue / paidCount |
| `paymentDistribution` | Soma de `value` por `billingType` para pagamentos PAID |

## Índices de Performance

O modelo `ClientPayment` possui os seguintes índices otimizados:

```prisma
@@index([userId])
@@index([clientId])
@@index([asaasPaymentId])
@@index([status])
@@index([dueDate])
@@index([paidAt])
@@index([billingType])
@@index([userId, status])
@@index([userId, paidAt])
@@index([userId, dueDate])
```

## Arquitetura

```
financial-dashboard/
├── dto/
│   ├── index.ts
│   ├── overview-query.dto.ts
│   ├── payments-query.dto.ts
│   └── revenue-query.dto.ts
├── financial-dashboard.controller.ts
├── financial-dashboard.controller.spec.ts
├── financial-dashboard.service.ts
├── financial-dashboard.service.spec.ts
├── financial-dashboard.module.ts
└── README.md
```

## Testes

### Unitários
- Cálculo de todas as métricas do overview
- Revenue-by-day com dias sem receita
- Revenue-by-client com ordenação
- Todos os filtros do endpoint payments
- Extratos por client e OS
- Tratamento de erros (NotFoundException)

### Integração (E2E)
- Overview com diferentes cenários
- Filtros por billingType/status
- Isolamento de dados entre usuários
- Acesso negado a recursos de outros usuários
- Todos os endpoints autenticados

### Executar Testes

```bash
# Unitários
pnpm test financial-dashboard

# E2E
pnpm test:e2e financial-dashboard
```

## Segurança

1. **Autenticação obrigatória** - Todos os endpoints protegidos por JwtAuthGuard
2. **Isolamento por userId** - Queries sempre filtram por userId do token
3. **Validação de propriedade** - Client e WorkOrder verificados antes de retornar dados
4. **Input validation** - DTOs com class-validator

## Considerações para Mobile

- Todos os valores são numéricos (não strings)
- Datas em formato ISO 8601
- Respostas leves e diretas
- Nenhum cálculo necessário no client
- Suporte a ranges customizados

## Próximos Passos (Melhorias Futuras)

- [ ] Cache de métricas agregadas (Redis)
- [ ] Comparativo período atual vs anterior
- [ ] Projeção de receita futura
- [ ] Exportação para PDF/Excel
- [ ] Notificações de pagamentos vencidos
- [ ] Dashboard de metas financeiras
