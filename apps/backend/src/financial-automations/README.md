# Financial Automations Module

Sistema de automações financeiras inteligentes para cobrança automática, lembretes de pagamento, follow-up de orçamentos e gerenciamento de inadimplência.

## Visão Geral

O módulo de Automações Financeiras permite que autônomos e pequenas empresas automatizem suas rotinas de cobrança, eliminando a necessidade de lembrar manualmente de:

- Enviar lembretes antes do vencimento
- Cobrar pagamentos atrasados
- Fazer follow-up de orçamentos não respondidos
- Marcar clientes inadimplentes
- Cancelar cobranças muito antigas

## Rotinas Disponíveis

### 1. Lembretes Antes do Vencimento (D-X)

Envia notificações automáticas para clientes com pagamentos próximos do vencimento.

- **Configuração**: `paymentReminderDaysBefore` (ex: `[3, 1]` = D-3 e D-1)
- **Tipo de Notificação**: `PAYMENT_REMINDER_BEFORE_DUE`
- **Destinatário**: Cliente (email + WhatsApp)
- **Não duplica**: Verifica NotificationLog antes de enviar

### 2. Lembretes Após Vencimento (D+X)

Envia notificações para pagamentos em atraso.

- **Configuração**: `paymentReminderDaysAfter` (ex: `[3, 7]` = D+3 e D+7)
- **Tipo de Notificação**: `PAYMENT_REMINDER_AFTER_DUE`
- **Destinatário**: Cliente
- **Não duplica**: Usa payload com `daysAfterDue` para evitar repetição

### 3. Marcação de Inadimplentes

Marca automaticamente clientes como inadimplentes após X dias de atraso.

- **Configuração**: `autoMarkOverdueAsDelinquentAfterDays` (ex: `30`)
- **Ação**: Atualiza `Client.isDelinquent = true` e `Client.delinquentAt`
- **Critério**: Cliente com pagamento OVERDUE há mais de X dias

### 4. Follow-up de Orçamentos

Envia lembretes para orçamentos enviados mas não respondidos.

- **Configuração**: `enableQuoteFollowUp` + `quoteFollowUpDays` (ex: `[3, 7]`)
- **Tipo de Notificação**: `QUOTE_FOLLOW_UP`
- **Critério**: Quote com status SENT, sentAt há X dias

### 5. Cancelamento Automático de Cobranças

Cancela cobranças muito antigas no Asaas e localmente.

- **Configuração**: `autoCancelPaymentAfterDays` (ex: `90`)
- **Ação**:
  1. Chama `AsaasHttpClient.deletePayment()`
  2. Atualiza `ClientPayment.status = DELETED`
- **Segurança**: Continua mesmo se Asaas falhar (ex: integração inativa)

## Execução

### Método Principal

```typescript
// Executa todas as automações para todos os usuários ativos
const result = await financialAutomationsService.runDailyAutomations();
```

### Agendamento Recomendado

Execute uma vez por dia, preferencialmente em horário de baixo tráfego:

#### Opção 1: NestJS Schedule

```typescript
import { Cron } from '@nestjs/schedule';

@Cron('0 3 * * *') // 03:00 todo dia
async handleCron() {
  await this.financialAutomationsScheduler.runDaily();
}
```

#### Opção 2: CRON externo

```bash
# crontab -e
0 3 * * * curl -X POST http://localhost:3000/financial/automations/run -H "Authorization: Bearer $TOKEN"
```

#### Opção 3: Cloud Scheduler

Configure AWS EventBridge, GCP Cloud Scheduler ou similar para chamar o endpoint.

## API Endpoints

### GET /financial/automations/settings

Retorna configurações do usuário (cria defaults se não existir).

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "isEnabled": true,
  "paymentReminderDaysBefore": [3, 1],
  "paymentReminderDaysAfter": [3, 7],
  "autoMarkOverdueAsDelinquentAfterDays": 30,
  "enableQuoteFollowUp": true,
  "quoteFollowUpDays": [3, 7],
  "autoCancelPaymentAfterDays": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### PUT /financial/automations/settings

Atualiza configurações do usuário.

**Body:**
```json
{
  "isEnabled": true,
  "paymentReminderDaysBefore": [5, 2, 1],
  "paymentReminderDaysAfter": [3, 7, 14],
  "autoMarkOverdueAsDelinquentAfterDays": 45,
  "enableQuoteFollowUp": false,
  "autoCancelPaymentAfterDays": 60
}
```

**Validações:**
- `paymentReminderDaysBefore`: 1-30 dias, máximo 5 valores
- `paymentReminderDaysAfter`: 1-90 dias, máximo 10 valores
- `autoMarkOverdueAsDelinquentAfterDays`: 7-365 dias
- `quoteFollowUpDays`: 1-30 dias, máximo 5 valores
- `autoCancelPaymentAfterDays`: 30-365 dias

### POST /financial/automations/run

Executa manualmente as automações (para testes/debug).

**Response:**
```json
{
  "runAt": "2024-01-01T03:00:00.000Z",
  "usersProcessed": 5,
  "results": {
    "paymentRemindersBeforeDue": { "processed": 10, "successful": 8, "failed": 2 },
    "paymentRemindersAfterDue": { "processed": 5, "successful": 5, "failed": 0 },
    "delinquentClients": { "processed": 2, "successful": 2, "failed": 0 },
    "quoteFollowUps": { "processed": 3, "successful": 3, "failed": 0 },
    "autoCancelPayments": { "processed": 1, "successful": 1, "failed": 0 }
  },
  "errors": []
}
```

## Configuração Padrão

Novos usuários recebem automaticamente:

```typescript
{
  isEnabled: true,
  paymentReminderDaysBefore: [3, 1],    // Lembrar 3 e 1 dia antes
  paymentReminderDaysAfter: [3, 7],     // Cobrar 3 e 7 dias depois
  autoMarkOverdueAsDelinquentAfterDays: 30,
  enableQuoteFollowUp: true,
  quoteFollowUpDays: [3, 7],            // Follow-up 3 e 7 dias após envio
  autoCancelPaymentAfterDays: null,     // Desativado por padrão
}
```

## Exemplo de Fluxo Real

### Cenário: Cobrança de R$ 500,00 vence em 10/01/2024

| Data | Ação Automática |
|------|-----------------|
| 07/01 (D-3) | Lembrete: "Pagamento vence em 3 dias" |
| 09/01 (D-1) | Lembrete: "Pagamento vence amanhã" |
| 10/01 (D0) | - (vencimento) |
| 13/01 (D+3) | Cobrança: "Pagamento em atraso há 3 dias" |
| 17/01 (D+7) | Cobrança: "Pagamento em atraso há 7 dias" |
| 09/02 (D+30) | Cliente marcado como INADIMPLENTE |

### Cenário: Orçamento enviado em 01/01/2024

| Data | Ação Automática |
|------|-----------------|
| 04/01 (D+3) | Follow-up: "Orçamento aguarda aprovação há 3 dias" |
| 08/01 (D+7) | Follow-up: "Orçamento aguarda aprovação há 7 dias" |

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     CRON / Scheduler                         │
│                     (03:00 diário)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              FinancialAutomationsScheduler                   │
│                    runDaily()                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               FinancialAutomationsService                    │
│                 runDailyAutomations()                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ processPaymentRemindersBeforeDue()                      ││
│  │ processPaymentRemindersAfterDue()                       ││
│  │ processDelinquentClients()                              ││
│  │ processQuoteFollowUps()                                 ││
│  │ processAutoCancelPayments()                             ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Notifications│ │   Prisma   │ │   Asaas     │
│   Service   │ │   (DB)     │ │   Client    │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Integrações

- **NotificationsModule**: Para envio de emails e WhatsApp
- **ClientPayment**: Para buscar pagamentos pendentes/vencidos
- **Quote**: Para buscar orçamentos não respondidos
- **Client**: Para marcar inadimplentes
- **AsaasHttpClient**: Para cancelar cobranças

## Modelo de Dados

### FinancialAutomationSettings

```prisma
model FinancialAutomationSettings {
  id                                   String   @id @default(uuid())
  userId                               String   @unique
  isEnabled                            Boolean  @default(true)
  paymentReminderDaysBefore            Int[]    @default([3, 1])
  paymentReminderDaysAfter             Int[]    @default([3, 7])
  autoMarkOverdueAsDelinquentAfterDays Int?     @default(30)
  enableQuoteFollowUp                  Boolean  @default(true)
  quoteFollowUpDays                    Int[]    @default([3, 7])
  autoCancelPaymentAfterDays           Int?
  createdAt                            DateTime @default(now())
  updatedAt                            DateTime @updatedAt

  user                                 User     @relation(...)
}
```

## Segurança e Performance

- **Deduplicação**: Todas as notificações verificam NotificationLog antes de enviar
- **Por usuário**: Cada automação respeita as configurações individuais
- **Tolerância a falhas**: Erros são logados mas não interrompem o processamento
- **Asaas opcional**: Cancelamento continua mesmo sem integração Asaas ativa
