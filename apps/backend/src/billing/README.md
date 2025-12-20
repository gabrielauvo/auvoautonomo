# Billing Module - Planos, Assinaturas e Limites de Uso (PLG)

## Visão Geral

O módulo Billing gerencia todo o sistema de planos, assinaturas e limites de uso da plataforma, implementando um modelo Product-Led Growth (PLG) com:

- Gestão de planos (FREE, PRO, TEAM)
- Limites de uso por plano
- Bloqueios automáticos quando limites são atingidos
- Integração com Asaas para cobranças recorrentes
- Webhook para eventos de assinatura

## Planos Disponíveis

### FREE (Gratuito)
| Recurso | Limite |
|---------|--------|
| Clientes | 10 |
| Orçamentos | 20 |
| Ordens de Serviço | 20 |
| Cobranças | 20 |
| Notificações/mês | 50 |
| Automações Avançadas | ❌ |
| Relatórios Avançados | ❌ |
| Portal do Cliente | ❌ |
| Assinatura Digital | ❌ |
| WhatsApp | ❌ |

### PRO (R$ 49,90/mês ou R$ 499,00/ano)
| Recurso | Limite |
|---------|--------|
| Clientes | Ilimitado |
| Orçamentos | Ilimitado |
| Ordens de Serviço | Ilimitado |
| Cobranças | Ilimitado |
| Notificações/mês | Ilimitado |
| Automações Avançadas | ✅ |
| Relatórios Avançados | ✅ |
| Portal do Cliente | ✅ |
| Assinatura Digital | ✅ |
| WhatsApp | ✅ |

### TEAM (R$ 99,90/mês ou R$ 999,00/ano)
Todos os recursos do PRO + múltiplos usuários e gestão de equipe.

---

## Endpoints

### 1. Status do Plano

```
GET /billing/plan
```

**Resposta:**
```json
{
  "planKey": "FREE",
  "planName": "Plano Gratuito",
  "subscriptionStatus": "FREE",
  "limits": {
    "maxClients": 10,
    "maxQuotes": 20,
    "maxWorkOrders": 20,
    "maxPayments": 20,
    "maxNotificationsPerMonth": 50,
    "enableAdvancedAutomations": false,
    "enableAdvancedAnalytics": false,
    "enableClientPortal": false,
    "enablePdfExport": true,
    "enableDigitalSignature": false,
    "enableWhatsApp": false
  },
  "usage": {
    "clientsCount": 8,
    "quotesCount": 12,
    "workOrdersCount": 5,
    "paymentsCount": 7,
    "notificationsSentThisMonth": 15
  },
  "currentPeriodStart": null,
  "currentPeriodEnd": null,
  "cancelAtPeriodEnd": false
}
```

---

### 2. Planos Disponíveis

```
GET /billing/plans
```

Retorna lista de todos os planos ativos com seus limites.

---

### 3. Quota Restante

```
GET /billing/quota?resource=CLIENT
```

**Recursos disponíveis:** `CLIENT`, `QUOTE`, `WORK_ORDER`, `PAYMENT`, `NOTIFICATION`

**Resposta:**
```json
{
  "remaining": 2,
  "max": 10,
  "current": 8,
  "unlimited": false
}
```

Sem parâmetro `resource`, retorna todas as quotas:

```json
{
  "clients": { "remaining": 2, "max": 10, "current": 8, "unlimited": false },
  "quotes": { "remaining": 8, "max": 20, "current": 12, "unlimited": false },
  "workOrders": { "remaining": 15, "max": 20, "current": 5, "unlimited": false },
  "payments": { "remaining": 13, "max": 20, "current": 7, "unlimited": false },
  "notifications": { "remaining": 35, "max": 50, "current": 15, "unlimited": false }
}
```

---

### 4. Upgrade para PRO

```
POST /billing/upgrade-to-pro
```

**Body:**
```json
{
  "billingType": "PIX",
  "billingPeriod": "MONTHLY",
  "cpfCnpj": "12345678901",
  "phone": "11999999999"
}
```

**billingType:** `BOLETO`, `CREDIT_CARD`, `PIX`
**billingPeriod:** `MONTHLY`, `YEARLY`

**Resposta:**
```json
{
  "subscriptionId": "uuid",
  "status": "ACTIVE",
  "asaasSubscriptionId": "sub_xxx",
  "paymentUrl": "https://www.asaas.com/c/xxx",
  "nextDueDate": "2025-02-01",
  "message": "Upgrade iniciado com sucesso. Complete o pagamento para ativar o PRO."
}
```

---

### 5. Cancelar Assinatura

```
POST /billing/cancel
```

**Body:**
```json
{
  "reason": "Motivo opcional",
  "cancelImmediately": false
}
```

Se `cancelImmediately: false` (default), a assinatura permanece ativa até o fim do período atual.

**Resposta:**
```json
{
  "message": "Assinatura será cancelada ao fim do período atual (2025-02-01).",
  "status": "ACTIVE",
  "cancelAtPeriodEnd": true,
  "currentPeriodEnd": "2025-02-01T00:00:00.000Z"
}
```

---

### 6. Reativar Assinatura

```
POST /billing/reactivate
```

Reativa uma assinatura marcada para cancelamento.

---

### 7. Verificar Limite

```
GET /billing/check-limit?resource=CLIENT
```

**Resposta:**
```json
{
  "allowed": true,
  "resource": "CLIENT",
  "plan": "FREE",
  "max": 10,
  "current": 8
}
```

---

## Erro de Limite Atingido

Quando o limite é atingido, a API retorna erro 403:

```json
{
  "statusCode": 403,
  "error": "LIMIT_REACHED",
  "resource": "CLIENT",
  "plan": "FREE",
  "max": 10,
  "current": 10,
  "message": "Você atingiu o limite de 10 clientes no plano FREE. Faça upgrade para o PRO para continuar cadastrando."
}
```

---

## Erro de Recurso Não Disponível

Quando um recurso avançado não está disponível no plano:

```json
{
  "statusCode": 403,
  "error": "FEATURE_NOT_AVAILABLE",
  "feature": "WHATSAPP",
  "plan": "FREE",
  "message": "O recurso \"Notificações WhatsApp\" não está disponível no plano Plano Gratuito. Faça upgrade para o PRO para acessar este recurso."
}
```

---

## Webhooks (Assinatura)

```
POST /webhooks/billing/asaas
```

Eventos tratados:
- `PAYMENT_CONFIRMED` - Ativa/renova assinatura
- `PAYMENT_RECEIVED` - Ativa/renova assinatura
- `PAYMENT_OVERDUE` - Marca como PAST_DUE
- `SUBSCRIPTION_DELETED` - Cancela e rebaixa para FREE
- `SUBSCRIPTION_EXPIRED` - Cancela e rebaixa para FREE

---

## Fluxos de Negócio

### Usuário sem assinatura
1. É tratado como plano FREE
2. Limites do FREE são aplicados automaticamente
3. Pode fazer upgrade a qualquer momento

### Upgrade FREE → PRO
1. Usuário chama `POST /billing/upgrade-to-pro`
2. Customer é criado no Asaas (se não existir)
3. Subscription recorrente é criada no Asaas
4. UserSubscription local é criada com status ACTIVE
5. Frontend exibe link de pagamento/boleto/PIX

### Pagamento confirmado (Webhook)
1. Asaas envia evento `PAYMENT_CONFIRMED`
2. Sistema atualiza `currentPeriodStart` e `currentPeriodEnd`
3. Status permanece/volta para `ACTIVE`

### Pagamento em atraso (Webhook)
1. Asaas envia evento `PAYMENT_OVERDUE`
2. Sistema marca status como `PAST_DUE`
3. Limites podem ser mantidos ou reduzidos (configurável)

### Cancelamento
1. Usuário chama `POST /billing/cancel`
2. Se `cancelImmediately: true`:
   - Cancela no Asaas
   - Rebaixa para FREE imediatamente
3. Se `cancelImmediately: false`:
   - Marca `cancelAtPeriodEnd: true`
   - PRO continua até `currentPeriodEnd`
   - Scheduler rebaixa para FREE após o período

---

## Integração nos Módulos

O `PlanLimitsService` é automaticamente injetado em:

- **ClientsService** - Verifica limite antes de criar cliente
- **QuotesService** - Verifica limite antes de criar orçamento
- **WorkOrdersService** - Verifica limite antes de criar OS
- **ClientPaymentsService** - Verifica limite antes de criar cobrança
- **NotificationsService** - Verifica limite antes de enviar notificação

---

## Variáveis de Ambiente

```env
# Asaas para cobrar assinaturas da plataforma
ASAAS_PLATFORM_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_PLATFORM_API_KEY=your_platform_api_key
ASAAS_PLATFORM_WEBHOOK_TOKEN=your_webhook_token
```

---

## Testes

```bash
npm test -- --testPathPattern=billing
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
│                  BillingController                      │
│  GET /plan, /plans, /quota, /check-limit               │
│  POST /upgrade-to-pro, /cancel, /reactivate            │
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐
│SubscriptionService│ │PlanLimitsService│ │AsaasBillingService│
│- getUserEffectivePlan│ │- checkLimitOrThrow│ │- createCustomer │
│- getCurrentUsage    │ │- checkFeatureOrThrow│ │- createSubscription│
│- getBillingStatus   │ │- getRemainingQuota │ │- processWebhook │
└─────────┬──────────┘ └─────────┬──────┘ └────────┬────────┘
          │                      │                  │
          └──────────────────────┼──────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────┐
│                    PrismaService                        │
│  Plan, UserSubscription, UsageLimitsConfig              │
└─────────────────────────────────────────────────────────┘
```

---

## Tabelas do Banco

| Model | Descrição |
|-------|-----------|
| Plan | Planos disponíveis (FREE, PRO, TEAM) |
| UserSubscription | Assinatura do usuário autônomo |
| UsageLimitsConfig | Limites detalhados por plano |
