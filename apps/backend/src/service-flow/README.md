# Service Flow Module

## Visao Geral

O modulo **Service Flow** orquestra o fluxo completo de atendimento ao cliente, integrando:
- Orcamentos (Quotes)
- Ordens de Servico (Work Orders)
- Checklists
- Cobrancas (Payments)

Este modulo NAO duplica logica dos outros modulos, mas sim coordena a transicao entre estados e garante a integridade do fluxo de negocio.

## Fluxo do Servico

```
+-------------+     +---------------+     +------------+     +-----------+
|   QUOTE     | --> |  WORK ORDER   | --> | CHECKLIST  | --> |  PAYMENT  |
|  (APPROVED) |     |  (SCHEDULED)  |     | (COMPLETE) |     | (PENDING) |
+-------------+     +---------------+     +------------+     +-----------+
                           |                    |                  |
                           v                    v                  v
                    +---------------+     +------------+     +-----------+
                    |  WORK ORDER   | --> | WORK ORDER | --> |  PAYMENT  |
                    | (IN_PROGRESS) |     |   (DONE)   |     | (RECEIVED)|
                    +---------------+     +------------+     +-----------+
```

## Endpoints

### 1. Converter Orcamento em OS

```
POST /service-flow/quote/:quoteId/convert-to-work-order
```

**Requisitos:**
- Orcamento deve estar com status `APPROVED`
- Orcamento nao pode ter OS vinculada

**Request Body:**
```json
{
  "title": "Instalacao de Ar-Condicionado",
  "description": "Instalacao completa com teste",
  "scheduledDate": "2025-01-15",
  "scheduledStartTime": "2025-01-15T09:00:00Z",
  "scheduledEndTime": "2025-01-15T12:00:00Z",
  "address": "Rua Teste, 123",
  "notes": "Cliente preferiu pela manha",
  "equipmentIds": ["eq-uuid-1", "eq-uuid-2"]
}
```

**Response:**
```json
{
  "id": "wo-uuid",
  "userId": "user-uuid",
  "clientId": "client-uuid",
  "quoteId": "quote-uuid",
  "title": "Instalacao de Ar-Condicionado",
  "status": "SCHEDULED",
  "client": {
    "id": "client-uuid",
    "name": "Joao Silva",
    "email": "joao@email.com",
    "phone": "11999999999",
    "address": "Rua Teste, 123"
  },
  "quote": {
    "id": "quote-uuid",
    "totalValue": 1500.00,
    "status": "APPROVED"
  },
  "equipments": []
}
```

---

### 2. Concluir Ordem de Servico

```
POST /service-flow/work-order/:workOrderId/complete
```

**Requisitos:**
- OS nao pode estar `DONE` ou `CANCELED`
- Todos os checklists devem ter itens obrigatorios respondidos (a menos que `skipChecklistValidation: true`)

**Request Body:**
```json
{
  "skipChecklistValidation": false,
  "notes": "Servico concluido com sucesso. Cliente satisfeito."
}
```

**Response:**
```json
{
  "workOrder": {
    "id": "wo-uuid",
    "status": "DONE",
    "executionEnd": "2025-01-15T11:30:00Z",
    "client": {
      "id": "client-uuid",
      "name": "Joao Silva"
    },
    "quote": {
      "id": "quote-uuid",
      "totalValue": 1500.00
    }
  },
  "paymentSuggestion": {
    "canGeneratePayment": true,
    "suggestedValue": 1500.00,
    "hasQuote": true,
    "quoteId": "quote-uuid"
  }
}
```

---

### 3. Gerar Cobranca

```
POST /service-flow/work-order/:workOrderId/generate-payment
```

**Requisitos:**
- OS deve estar com status `DONE`
- Nao pode haver cobranca pendente para esta OS
- Se nao houver orcamento vinculado, `value` e obrigatorio

**Request Body:**
```json
{
  "billingType": "PIX",
  "value": 1500.00,
  "dueDate": "2025-01-20",
  "description": "Cobranca referente a OS #12345"
}
```

**Tipos de cobranca:**
- `PIX` - Pagamento via PIX (QR Code e codigo copia-cola)
- `BOLETO` - Boleto bancario
- `CREDIT_CARD` - Cartao de credito

**Response:**
```json
{
  "id": "payment-uuid",
  "asaasPaymentId": "pay_abc123",
  "clientId": "client-uuid",
  "clientName": "Joao Silva",
  "billingType": "PIX",
  "value": 1500.00,
  "dueDate": "2025-01-20T00:00:00Z",
  "status": "PENDING",
  "invoiceUrl": "https://sandbox.asaas.com/...",
  "qrCodeUrl": "data:image/png;base64,...",
  "pixCode": "00020126...",
  "createdAt": "2025-01-15T12:00:00Z"
}
```

---

### 4. Timeline do Cliente

```
GET /service-flow/client/:clientId/timeline
```

Retorna todos os eventos relacionados ao cliente em ordem cronologica decrescente.

**Response:**
```json
[
  {
    "type": "PAYMENT_CONFIRMED",
    "date": "2025-01-18T14:30:00Z",
    "data": {
      "id": "payment-uuid",
      "value": 1500.00,
      "billingType": "PIX"
    }
  },
  {
    "type": "PAYMENT_CREATED",
    "date": "2025-01-15T12:00:00Z",
    "data": {
      "id": "payment-uuid",
      "value": 1500.00,
      "billingType": "PIX",
      "status": "PENDING",
      "dueDate": "2025-01-20",
      "workOrderId": "wo-uuid",
      "quoteId": "quote-uuid"
    }
  },
  {
    "type": "WORK_ORDER_COMPLETED",
    "date": "2025-01-15T11:30:00Z",
    "data": {
      "id": "wo-uuid",
      "title": "Instalacao de Ar-Condicionado"
    }
  },
  {
    "type": "CHECKLIST_CREATED",
    "date": "2025-01-15T10:00:00Z",
    "data": {
      "id": "checklist-uuid",
      "title": "Checklist de Instalacao",
      "workOrderId": "wo-uuid",
      "workOrderTitle": "Instalacao de Ar-Condicionado"
    }
  },
  {
    "type": "WORK_ORDER_STARTED",
    "date": "2025-01-15T09:00:00Z",
    "data": {
      "id": "wo-uuid",
      "title": "Instalacao de Ar-Condicionado"
    }
  },
  {
    "type": "WORK_ORDER_CREATED",
    "date": "2025-01-10T15:00:00Z",
    "data": {
      "id": "wo-uuid",
      "title": "Instalacao de Ar-Condicionado",
      "status": "SCHEDULED",
      "quoteId": "quote-uuid",
      "equipmentsCount": 1
    }
  },
  {
    "type": "QUOTE_APPROVED",
    "date": "2025-01-08T14:00:00Z",
    "data": {
      "id": "quote-uuid",
      "totalValue": 1500.00
    }
  },
  {
    "type": "QUOTE_CREATED",
    "date": "2025-01-05T10:00:00Z",
    "data": {
      "id": "quote-uuid",
      "status": "APPROVED",
      "totalValue": 1500.00,
      "itemsCount": 3
    }
  }
]
```

**Tipos de eventos:**
- `QUOTE_CREATED` - Orcamento criado
- `QUOTE_APPROVED` - Orcamento aprovado
- `QUOTE_REJECTED` - Orcamento rejeitado
- `WORK_ORDER_CREATED` - OS criada
- `WORK_ORDER_STARTED` - OS iniciada (executionStart)
- `WORK_ORDER_COMPLETED` - OS concluida
- `CHECKLIST_CREATED` - Checklist adicionado a OS
- `PAYMENT_CREATED` - Cobranca gerada
- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_OVERDUE` - Pagamento em atraso

---

### 5. Extrato da Ordem de Servico

```
GET /service-flow/work-order/:workOrderId/extract
```

Retorna visao completa da OS com resumo financeiro.

**Response:**
```json
{
  "workOrder": {
    "id": "wo-uuid",
    "title": "Instalacao de Ar-Condicionado",
    "description": "Instalacao completa",
    "status": "DONE",
    "scheduledDate": "2025-01-15T00:00:00Z",
    "executionStart": "2025-01-15T09:00:00Z",
    "executionEnd": "2025-01-15T11:30:00Z",
    "createdAt": "2025-01-10T15:00:00Z"
  },
  "client": {
    "id": "client-uuid",
    "name": "Joao Silva",
    "email": "joao@email.com",
    "phone": "11999999999"
  },
  "quote": {
    "id": "quote-uuid",
    "totalValue": 1500.00,
    "discountValue": 100.00,
    "status": "APPROVED",
    "items": [
      {
        "name": "Instalacao de Split",
        "quantity": 1,
        "unitPrice": 1200.00,
        "totalPrice": 1200.00
      },
      {
        "name": "Materiais",
        "quantity": 1,
        "unitPrice": 400.00,
        "totalPrice": 400.00
      }
    ]
  },
  "payments": [
    {
      "id": "payment-uuid",
      "value": 1500.00,
      "billingType": "PIX",
      "status": "RECEIVED",
      "dueDate": "2025-01-20T00:00:00Z",
      "paidAt": "2025-01-18T14:30:00Z",
      "invoiceUrl": "https://..."
    }
  ],
  "checklists": [
    {
      "id": "checklist-uuid",
      "title": "Checklist de Instalacao",
      "answersCount": 10
    }
  ],
  "equipments": [
    {
      "id": "eq-uuid",
      "type": "Ar-condicionado Split",
      "brand": "LG",
      "model": "S4-W12JA3AA"
    }
  ],
  "financialSummary": {
    "totalQuoted": 1500.00,
    "totalPaid": 1500.00,
    "totalPending": 0,
    "balance": 0
  }
}
```

---

## Regras de Negocio

### Transicoes de Estado - Quote

```
DRAFT --> SENT --> APPROVED --> (pode converter em OS)
                \-> REJECTED --> (fim)
      \-> EXPIRED --> (fim)
```

### Transicoes de Estado - WorkOrder

```
SCHEDULED --> IN_PROGRESS --> DONE --> (pode gerar cobranca)
          \-> CANCELED --> (fim)
              (de qualquer estado exceto DONE)
```

### Validacoes Importantes

1. **Conversao Quote -> OS:**
   - Quote deve ser `APPROVED`
   - Quote nao pode ter OS existente
   - Equipments devem pertencer ao mesmo cliente

2. **Conclusao da OS:**
   - OS nao pode estar `DONE` ou `CANCELED`
   - Checklists obrigatorios devem estar completos
   - Flag `skipChecklistValidation` permite bypass

3. **Geracao de Cobranca:**
   - OS deve estar `DONE`
   - Nao pode haver cobranca `PENDING` ou `CONFIRMED` existente
   - Se nao houver Quote, `value` e obrigatorio

---

## Integracao com Webhook

O modulo de webhooks (`/webhooks/asaas`) atualiza automaticamente o status dos pagamentos quando:
- `PAYMENT_CONFIRMED` - Pagamento confirmado
- `PAYMENT_RECEIVED` - Pagamento recebido
- `PAYMENT_OVERDUE` - Pagamento em atraso

Esses eventos sao refletidos automaticamente na timeline do cliente.

---

## Seguranca

- Todos os endpoints requerem autenticacao JWT
- Todas as operacoes validam `userId` antes de executar
- Relacionamentos cruzados (Quote->Client, WO->Client, etc) sao validados

---

## Testes

```bash
# Rodar testes unitarios
npm test -- --testPathPattern=service-flow

# Rodar testes e2e
npm test -- --testPathPattern=service-flow.e2e
```
