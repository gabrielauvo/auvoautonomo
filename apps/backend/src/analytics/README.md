# Analytics Module - Dashboard & Métricas

## Visão Geral

O módulo Analytics fornece endpoints para visualização de métricas do negócio, incluindo:
- Visão geral do dashboard
- Funil de conversão de orçamentos
- Produtividade de ordens de serviço
- Receita por período
- Top clientes e serviços
- Análise de inadimplência

## Período Padrão

Quando `startDate` e `endDate` não são fornecidos, o sistema usa os **últimos 30 dias** como período padrão.

Formato de data: `YYYY-MM-DD` (ISO 8601)

## Endpoints

### 1. Visão Geral (Overview)

```
GET /analytics/overview?startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  },
  "quotes": {
    "total": 25,
    "draft": 5,
    "sent": 10,
    "approved": 8,
    "rejected": 2,
    "expired": 0,
    "conversionRate": 0.4
  },
  "workOrders": {
    "created": 18,
    "completed": 16,
    "canceled": 2,
    "inProgress": 0,
    "scheduled": 0,
    "avgCompletionTimeHours": 4.5
  },
  "revenue": {
    "invoiced": 12000,
    "received": 9000,
    "overdue": 2000,
    "canceled": 1000,
    "invoicedCount": 30,
    "paidCount": 22,
    "overdueCount": 6,
    "averageTicketPaid": 409.09
  },
  "clients": {
    "total": 50,
    "active": 35,
    "new": 5,
    "delinquent": 4
  }
}
```

**Métricas explicadas:**
- `quotes.conversionRate`: approved / (sent + approved + rejected)
- `workOrders.avgCompletionTimeHours`: média de (executionEnd - executionStart) em horas
- `revenue.invoiced`: soma de todos os pagamentos (exceto cancelados)
- `revenue.received`: soma dos pagamentos com status CONFIRMED, RECEIVED, RECEIVED_IN_CASH
- `clients.active`: clientes com pelo menos 1 OS ou pagamento no período

---

### 2. Funil de Orçamentos

```
GET /analytics/quotes-funnel?startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "steps": [
    { "stage": "CREATED", "count": 40 },
    { "stage": "SENT", "count": 30 },
    { "stage": "APPROVED", "count": 18 },
    { "stage": "REJECTED", "count": 7 },
    { "stage": "CONVERTED_TO_WORK_ORDER", "count": 15 }
  ],
  "conversionRates": {
    "sentOverCreated": 0.75,
    "approvedOverSent": 0.60,
    "convertedOverApproved": 0.83
  }
}
```

**Métricas explicadas:**
- `CREATED`: total de orçamentos criados no período (por createdAt)
- `SENT`: status SENT + APPROVED + REJECTED (orçamentos que foram enviados)
- `APPROVED`: status APPROVED
- `REJECTED`: status REJECTED
- `CONVERTED_TO_WORK_ORDER`: orçamentos que geraram WorkOrder (quoteId not null)

---

### 3. Analytics de Ordens de Serviço

```
GET /analytics/work-orders?startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "total": 25,
  "byStatus": {
    "SCHEDULED": 5,
    "IN_PROGRESS": 3,
    "DONE": 15,
    "CANCELED": 2
  },
  "avgCompletionTimeHours": 3.8,
  "completionTimeDistribution": [
    { "bucket": "0-2h", "count": 5 },
    { "bucket": "2-4h", "count": 7 },
    { "bucket": "4-8h", "count": 3 },
    { "bucket": ">8h", "count": 0 }
  ],
  "checklistCompletionRate": 0.9
}
```

**Métricas explicadas:**
- `total`: todas as OS criadas no período (por createdAt)
- `avgCompletionTimeHours`: média de tempo das OS com status DONE
- `completionTimeDistribution`: distribuição em buckets fixos
- `checklistCompletionRate`: checklists completos / total de checklists

---

### 4. Receita por Período

```
GET /analytics/revenue-by-period?groupBy=day&startDate=2025-01-01&endDate=2025-01-31
```

**Query Params:**
- `groupBy`: `day` | `week` | `month` (default: `day`)

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "groupBy": "day",
  "series": [
    { "date": "2025-01-01", "invoiced": 1200, "received": 800, "overdue": 200 },
    { "date": "2025-01-02", "invoiced": 500, "received": 500, "overdue": 0 },
    ...
  ],
  "totals": {
    "invoiced": 15000,
    "received": 12000,
    "overdue": 1500
  }
}
```

**Métricas explicadas:**
- `invoiced`: baseado em dueDate
- `received`: baseado em paidAt (pagamentos confirmados)
- `overdue`: pagamentos com status OVERDUE no período

**Agrupamentos:**
- `day`: YYYY-MM-DD
- `week`: YYYY-MM-DD (segunda-feira da semana)
- `month`: YYYY-MM

---

### 5. Top Clientes

```
GET /analytics/top-clients?limit=10&startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "clients": [
    {
      "clientId": "uuid",
      "name": "Cliente XPTO",
      "totalPaid": 5000,
      "ordersCount": 8,
      "lastServiceAt": "2025-01-10T14:30:00.000Z"
    }
  ]
}
```

**Métricas explicadas:**
- `totalPaid`: soma de pagamentos CONFIRMED/RECEIVED/RECEIVED_IN_CASH
- `ordersCount`: WorkOrders com status DONE
- `lastServiceAt`: última executionEnd

---

### 6. Top Serviços

```
GET /analytics/top-services?limit=10&startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "services": [
    {
      "name": "Instalação de Ar",
      "type": "SERVICE",
      "totalRevenue": 8000,
      "count": 20,
      "avgTicket": 400
    }
  ]
}
```

**Métricas explicadas:**
- Agregação por `name` dos WorkOrderItems de OS concluídas
- `totalRevenue`: soma de totalPrice
- `count`: quantidade de WorkOrderItems
- `avgTicket`: totalRevenue / count

---

### 7. Inadimplência

```
GET /analytics/delinquency?startDate=2025-01-01&endDate=2025-01-31
```

**Resposta:**
```json
{
  "period": { "startDate": "2025-01-01", "endDate": "2025-01-31" },
  "summary": {
    "totalOverdue": 3000,
    "overdueCount": 7,
    "avgDaysOverdue": 12.5
  },
  "byClient": [
    {
      "clientId": "uuid",
      "name": "Cliente Devedor",
      "overdueTotal": 1000,
      "overdueCount": 3,
      "maxDaysOverdue": 30
    }
  ]
}
```

**Métricas explicadas:**
- Considera pagamentos com status = OVERDUE
- `avgDaysOverdue`: média de (hoje - dueDate) em dias
- `maxDaysOverdue`: máximo de dias em atraso do cliente

---

## Tabelas Utilizadas

| Endpoint | Tabelas |
|----------|---------|
| overview | Quote, WorkOrder, ClientPayment, Client |
| quotes-funnel | Quote, WorkOrder |
| work-orders | WorkOrder, WorkOrderChecklist, ChecklistTemplateItem |
| revenue-by-period | ClientPayment |
| top-clients | ClientPayment, WorkOrder, Client |
| top-services | WorkOrderItem, WorkOrder |
| delinquency | ClientPayment, Client |

---

## Segurança

- Todos os endpoints requerem autenticação JWT
- Todas as queries filtram por `userId`
- Nenhum dado de outros usuários é exposto

---

## Testes

```bash
npm test -- --testPathPattern=analytics
```

---

## Integração Frontend

Exemplo de uso no React:

```typescript
// Buscar overview do dashboard
const response = await api.get('/analytics/overview', {
  params: { startDate: '2025-01-01', endDate: '2025-01-31' }
});

// Buscar receita por mês
const revenueResponse = await api.get('/analytics/revenue-by-period', {
  params: {
    groupBy: 'month',
    startDate: '2025-01-01',
    endDate: '2025-12-31'
  }
});
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Web/Mobile)                │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 AnalyticsController                     │
│  GET /overview, /quotes-funnel, /work-orders, etc.     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   AnalyticsService                      │
│  Aggregation logic, calculations, transformations      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    PrismaService                        │
│  groupBy, aggregate, findMany (optimized queries)      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│  Quote │ WorkOrder │ ClientPayment │ Client │ Items    │
└─────────────────────────────────────────────────────────┘
```
