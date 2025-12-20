# Notifications Module

Sistema de notificações automáticas multi-canal para o Auvo SaaS.

## Visão Geral

O módulo de notificações permite enviar notificações automáticas para clientes via Email e WhatsApp. As notificações são disparadas automaticamente quando eventos específicos ocorrem no sistema.

## Estrutura do Módulo

```
notifications/
├── channels/
│   ├── notification-channel.interface.ts  # Interface base para canais
│   ├── email-channel.service.ts           # Canal de Email
│   └── whatsapp-channel.service.ts        # Canal de WhatsApp
├── dto/
│   ├── update-notification-preferences.dto.ts
│   └── notification-logs-query.dto.ts
├── templates/
│   └── notification-templates.ts          # Templates de mensagens
├── notifications.service.ts               # Serviço principal
├── notifications.module.ts                # Módulo NestJS
├── notifications.types.ts                 # Tipos e interfaces
├── notification-preferences.controller.ts # Controller REST
└── index.ts                               # Exports
```

## Tipos de Notificação

| Tipo | Evento | Integração |
|------|--------|------------|
| `QUOTE_SENT` | Orçamento enviado ao cliente | quotes.service |
| `QUOTE_APPROVED` | Orçamento aprovado | quotes.service |
| `WORK_ORDER_CREATED` | Ordem de serviço criada/agendada | work-orders.service |
| `WORK_ORDER_COMPLETED` | Ordem de serviço concluída | work-orders.service |
| `PAYMENT_CREATED` | Cobrança gerada | client-payments.service |
| `PAYMENT_CONFIRMED` | Pagamento confirmado | client-payments.service (webhook) |
| `PAYMENT_OVERDUE` | Pagamento em atraso | client-payments.service (webhook) |

## Canais de Notificação

### Email Channel
- Valida formato de email
- Suporta HTML e texto plano
- Mock implementation (pronto para integrar com Nodemailer, SendGrid, etc.)

### WhatsApp Channel
- Valida e normaliza números de telefone
- Formato E.164 (+5511999999999)
- Mock implementation (pronto para integrar com Twilio, Gupshup, etc.)

## Endpoints REST

### GET /notifications/preferences
Retorna as preferências de notificação do usuário autenticado.

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "notifyOnQuoteSent": true,
  "notifyOnQuoteApproved": true,
  "notifyOnWorkOrderCreated": true,
  "notifyOnWorkOrderCompleted": true,
  "notifyOnPaymentCreated": true,
  "notifyOnPaymentConfirmed": true,
  "notifyOnPaymentOverdue": true,
  "defaultChannelEmail": true,
  "defaultChannelWhatsApp": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### PUT /notifications/preferences
Atualiza as preferências de notificação.

**Request Body:**
```json
{
  "notifyOnQuoteSent": false,
  "defaultChannelWhatsApp": false
}
```

### GET /notifications/logs
Retorna logs de notificações com paginação e filtros.

**Query Parameters:**
- `clientId` - Filtrar por cliente
- `type` - Filtrar por tipo (QUOTE_SENT, PAYMENT_CREATED, etc.)
- `channel` - Filtrar por canal (EMAIL, WHATSAPP)
- `status` - Filtrar por status (SENT, FAILED)
- `startDate` - Data inicial
- `endDate` - Data final
- `page` - Página (default: 1)
- `limit` - Itens por página (default: 20, max: 100)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "channel": "EMAIL",
      "type": "QUOTE_SENT",
      "recipient": "cliente@email.com",
      "subject": "Orçamento #ABCD1234",
      "body": "...",
      "status": "SENT",
      "createdAt": "2024-01-01T00:00:00Z",
      "client": {
        "id": "uuid",
        "name": "Cliente Exemplo"
      }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### GET /notifications/stats
Retorna estatísticas de notificações.

**Response:**
```json
{
  "totalSent": 150,
  "totalFailed": 5,
  "successRate": 97,
  "byChannel": {
    "EMAIL": 100,
    "WHATSAPP": 55
  },
  "byType": {
    "QUOTE_SENT": 30,
    "PAYMENT_CREATED": 50,
    "WORK_ORDER_CREATED": 25
  },
  "last7Days": 45
}
```

## Uso Programático

### Enviar Notificação Manualmente

```typescript
import { NotificationsService } from './notifications';
import { NotificationType } from '@prisma/client';

// Injetar no construtor
constructor(private notificationsService: NotificationsService) {}

// Enviar notificação
await this.notificationsService.sendNotification({
  userId: 'user-uuid',
  clientId: 'client-uuid',
  quoteId: 'quote-uuid',
  type: NotificationType.QUOTE_SENT,
  contextData: {
    clientName: 'João Silva',
    clientEmail: 'joao@email.com',
    clientPhone: '11999999999',
    quoteId: 'quote-uuid',
    quoteNumber: 'ABCD1234',
    totalValue: 1500.00,
  },
});
```

## Modelos Prisma

### NotificationPreference
Armazena as preferências de notificação por usuário.

### NotificationLog
Registro de auditoria de todas as notificações enviadas.

## Integração com Provedores Reais

### Email (Nodemailer/SendGrid)

```typescript
// email-channel.service.ts
import * as nodemailer from 'nodemailer';

private transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async send(message: NotificationMessage): Promise<NotificationResult> {
  const result = await this.transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.body,
    html: message.htmlBody,
  });

  return { success: true, messageId: result.messageId };
}
```

### WhatsApp (Twilio)

```typescript
// whatsapp-channel.service.ts
import { Twilio } from 'twilio';

private client = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

async send(message: NotificationMessage): Promise<NotificationResult> {
  const result = await this.client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${this.normalizePhoneNumber(message.to)}`,
    body: message.body,
  });

  return { success: true, messageId: result.sid };
}
```

## Templates de Mensagem

Os templates são renderizados em português brasileiro com:
- Formatação de moeda (R$ 1.000,00)
- Formatação de data (dd/mm/yyyy)
- HTML estilizado para emails
- Texto plano para WhatsApp

### Cores utilizadas nos emails
- **Primário (Auvo):** #7C3AED
- **Sucesso:** #10B981
- **Erro:** #EF4444
- **Info:** #3B82F6

## Testes

```bash
# Rodar testes do módulo
npm test -- --testPathPattern=notifications

# Com coverage
npm test -- --testPathPattern=notifications --coverage
```

## Variáveis de Ambiente

```env
# Email (para integração real)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=password
EMAIL_FROM=noreply@auvo.com

# WhatsApp/Twilio (para integração real)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=+14155238886
```
