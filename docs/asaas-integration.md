# Integração Asaas - Sistema de Cobranças

## Visão Geral

A integração com o Asaas permite que **autônomos (usuários do sistema) cobrem seus próprios clientes** usando sua conta Asaas pessoal. Esta NÃO é uma integração para cobrar o autônomo, mas sim para que ele utilize o sistema de pagamentos do Asaas para receber de seus clientes.

## Características Principais

- ✅ **Conexão via API Key** com validação automática
- ✅ **Ambientes Sandbox e Production** configuráveis
- ✅ **Criptografia de API Key** usando AES-256-CBC
- ✅ **Sincronização automática de clientes** com Asaas Customers
- ✅ **Criação de cobranças** (Boleto, Pix, Cartão de Crédito)
- ✅ **Webhook handler** para atualizações em tempo real
- ✅ **16 status de pagamento** mapeados da documentação oficial
- ✅ **22 tipos de eventos** processados via webhook

## Arquitetura

### Módulos Criados

1. **EncryptionModule** (`src/common/encryption/`)
   - Serviço global para criptografia de dados sensíveis
   - AES-256-CBC com chaves de 32 bytes (64 caracteres hex)
   - Usado para proteger API Keys do Asaas

2. **AsaasHttpClient** (`src/common/asaas/`)
   - Cliente HTTP seguindo documentação oficial do Asaas
   - Métodos para: getAccountInfo, createOrUpdateCustomer, createPayment, getPayment, deletePayment
   - Suporte a ambientes Sandbox e Production

3. **AsaasIntegrationModule** (`src/asaas-integration/`)
   - Gerencia conexão da conta Asaas do usuário
   - Endpoints: connect, status, disconnect

4. **ClientPaymentsModule** (`src/client-payments/`)
   - Criação e gerenciamento de cobranças
   - Sincronização automática de clientes
   - Endpoints para criar e listar pagamentos

5. **WebhooksModule** (`src/webhooks/`)
   - Processa webhooks do Asaas (endpoint público)
   - Atualiza status de pagamentos automaticamente

### Modelos Prisma

#### AsaasIntegration
```prisma
model AsaasIntegration {
  id              String            @id @default(uuid())
  userId          String            @unique
  apiKeyEncrypted String
  environment     AsaasEnvironment  @default(SANDBOX)
  isActive        Boolean           @default(true)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}
```

#### ClientPayment
```prisma
model ClientPayment {
  id                String          @id @default(uuid())
  userId            String
  clientId          String
  quoteId           String?
  workOrderId       String?
  asaasPaymentId    String          @unique
  billingType       PaymentBillingType
  value             Decimal         @db.Decimal(10, 2)
  description       String?
  dueDate           DateTime
  status            PaymentStatus   @default(PENDING)
  asaasInvoiceUrl   String?
  asaasQrCodeUrl    String?
  asaasPixCode      String?
  paidAt            DateTime?
  canceledAt        DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}
```

#### Client (modificado)
```prisma
model Client {
  // ... campos existentes
  asaasCustomerId String? // ID do customer no Asaas
}
```

### Enums

#### AsaasEnvironment
```prisma
enum AsaasEnvironment {
  SANDBOX
  PRODUCTION
}
```

#### PaymentBillingType
```prisma
enum PaymentBillingType {
  BOLETO
  PIX
  CREDIT_CARD
}
```

#### PaymentStatus (16 status conforme documentação Asaas)
```prisma
enum PaymentStatus {
  PENDING
  CONFIRMED
  RECEIVED
  OVERDUE
  REFUNDED
  DELETED
  RECEIVED_IN_CASH
  REFUND_REQUESTED
  REFUND_IN_PROGRESS
  PARTIALLY_REFUNDED
  CHARGEBACK_REQUESTED
  CHARGEBACK_DISPUTE
  AWAITING_CHARGEBACK_REVERSAL
  DUNNING_REQUESTED
  DUNNING_RECEIVED
  AWAITING_RISK_ANALYSIS
  AUTHORIZED
}
```

## Endpoints da API

### 1. Integração Asaas

#### POST /integrations/asaas/connect
Conecta conta Asaas do usuário

**Request:**
```json
{
  "apiKey": "$aak_test_...",
  "environment": "SANDBOX"
}
```

**Response:**
```json
{
  "id": "uuid",
  "environment": "SANDBOX",
  "isActive": true,
  "connectedAt": "2025-12-09T...",
  "accountInfo": {
    "name": "Nome da Conta",
    "email": "email@exemplo.com",
    "cpfCnpj": "123456789",
    "personType": "FISICA"
  }
}
```

**Erros:**
- `409 Conflict`: Integração já existe
- `400 Bad Request`: API Key inválida

---

#### GET /integrations/asaas/status
Verifica status da integração

**Response:**
```json
{
  "connected": true,
  "environment": "SANDBOX",
  "isActive": true,
  "connectedAt": "2025-12-09T...",
  "accountInfo": {
    "name": "Nome da Conta",
    "email": "email@exemplo.com",
    "cpfCnpj": "123456789",
    "personType": "FISICA"
  }
}
```

---

#### DELETE /integrations/asaas/disconnect
Desconecta integração Asaas

**Response:**
```json
{
  "message": "Asaas integration disconnected successfully"
}
```

---

### 2. Sincronização de Clientes

#### POST /clients/:clientId/sync-asaas
Sincroniza cliente com Asaas Customers

**Response:**
```json
{
  "message": "Client synced with Asaas successfully",
  "asaasCustomerId": "cus_000005161589"
}
```

---

### 3. Cobranças (Payments)

#### POST /clients/:clientId/payments
Cria cobrança para um cliente

**Request:**
```json
{
  "billingType": "PIX",
  "value": 150.00,
  "dueDate": "2025-12-20",
  "description": "Orçamento #123 - Instalação de Ar Condicionado",
  "quoteId": "uuid-opcional",
  "workOrderId": "uuid-opcional"
}
```

**Response:**
```json
{
  "id": "uuid",
  "asaasPaymentId": "pay_123456",
  "clientId": "uuid",
  "clientName": "João da Silva",
  "billingType": "PIX",
  "value": 150.00,
  "description": "Orçamento #123...",
  "dueDate": "2025-12-20T00:00:00Z",
  "status": "PENDING",
  "invoiceUrl": null,
  "qrCodeUrl": "data:image/png;base64,...",
  "pixCode": "00020126...",
  "createdAt": "2025-12-09T..."
}
```

**Tipos de Cobrança:**
- `BOLETO`: Retorna `invoiceUrl` (link do boleto)
- `PIX`: Retorna `pixCode` (código copia-e-cola) e `qrCodeUrl` (QR Code em base64)
- `CREDIT_CARD`: Retorna `invoiceUrl` (página de pagamento)

---

#### GET /clients/payments
Lista todas as cobranças do usuário

**Query Parameters:**
- `clientId` (opcional): Filtrar por cliente específico

**Response:**
```json
[
  {
    "id": "uuid",
    "asaasPaymentId": "pay_123456",
    "clientId": "uuid",
    "clientName": "João da Silva",
    "billingType": "PIX",
    "value": 150.00,
    "description": "Orçamento #123...",
    "dueDate": "2025-12-20T00:00:00Z",
    "status": "RECEIVED",
    "invoiceUrl": null,
    "paidAt": "2025-12-15T10:30:00Z",
    "canceledAt": null,
    "createdAt": "2025-12-09T..."
  }
]
```

---

#### GET /clients/payments/:paymentId
Busca cobrança específica

**Response:**
```json
{
  "id": "uuid",
  "asaasPaymentId": "pay_123456",
  "clientId": "uuid",
  "clientName": "João da Silva",
  "billingType": "PIX",
  "value": 150.00,
  "description": "Orçamento #123...",
  "dueDate": "2025-12-20T00:00:00Z",
  "status": "RECEIVED",
  "invoiceUrl": null,
  "qrCodeUrl": "data:image/png;base64,...",
  "pixCode": "00020126...",
  "paidAt": "2025-12-15T10:30:00Z",
  "canceledAt": null,
  "createdAt": "2025-12-09T...",
  "updatedAt": "2025-12-15T10:30:00Z",
  "quote": { /* ... */ },
  "workOrder": { /* ... */ }
}
```

---

### 4. Webhooks

#### POST /webhooks/asaas
**Endpoint público** para receber eventos do Asaas

**Não requer autenticação** (configurado no painel do Asaas)

**Eventos processados (22 tipos):**

| Evento | Descrição | Atualização |
|--------|-----------|-------------|
| `PAYMENT_CREATED` | Cobrança criada | Apenas log |
| `PAYMENT_UPDATED` | Cobrança atualizada | Atualiza status |
| `PAYMENT_CONFIRMED` | Cobrança confirmada | Status → CONFIRMED |
| `PAYMENT_RECEIVED` | Pagamento recebido | Status → RECEIVED + paidAt |
| `PAYMENT_OVERDUE` | Cobrança vencida | Status → OVERDUE |
| `PAYMENT_REFUNDED` | Pagamento estornado | Status → REFUNDED |
| `PAYMENT_REFUND_IN_PROGRESS` | Estorno em progresso | Status → REFUND_IN_PROGRESS |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback solicitado | Status → CHARGEBACK_REQUESTED |
| `PAYMENT_CHARGEBACK_DISPUTE` | Disputa de chargeback | Status → CHARGEBACK_DISPUTE |
| `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` | Aguardando reversão | Status → AWAITING_CHARGEBACK_REVERSAL |
| `PAYMENT_DUNNING_REQUESTED` | Negativação solicitada | Status → DUNNING_REQUESTED |
| `PAYMENT_DUNNING_RECEIVED` | Negativação confirmada | Status → DUNNING_RECEIVED |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | Análise de risco | Status → AWAITING_RISK_ANALYSIS |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | Aprovado pela análise | Apenas log |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Reprovado pela análise | Apenas log |
| `PAYMENT_DELETED` | Cobrança deletada | Status → DELETED |
| `PAYMENT_RESTORED` | Cobrança restaurada | Status → PENDING |
| `PAYMENT_PARTIALLY_REFUNDED` | Estorno parcial | Status → PARTIALLY_REFUNDED |
| `PAYMENT_AUTHORIZED` | Pagamento autorizado | Status → AUTHORIZED |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Captura recusada | Apenas log |
| `PAYMENT_ANTICIPATED` | Cobrança antecipada | Apenas log |
| `PAYMENT_RECEIVED_IN_CASH_UNDONE` | Confirmação desfeita | Apenas log |
| `PAYMENT_BANK_SLIP_VIEWED` | Boleto visualizado | Apenas log |
| `PAYMENT_CHECKOUT_VIEWED` | Checkout visualizado | Apenas log |

**Configuração no Asaas:**
1. Acesse o painel do Asaas
2. Vá em Configurações → Webhooks
3. Adicione a URL: `https://seu-dominio.com/webhooks/asaas`
4. Selecione os eventos de pagamento que deseja receber

---

## Segurança

### 1. Criptografia de API Keys

A API Key do Asaas é armazenada criptografada no banco de dados usando AES-256-CBC.

**Variável de Ambiente Obrigatória:**
```bash
ENCRYPTION_KEY=64-caracteres-hexadecimais
```

**Gerar chave de criptografia:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Autenticação

- Todos os endpoints de integração e pagamentos requerem **JWT token**
- Apenas o endpoint `/webhooks/asaas` é público (recebe eventos do Asaas)

### 3. Isolamento de Dados

- Cada usuário só acessa seus próprios dados
- Guards automáticos verificam `userId` em todas as queries
- Cliente sincronizado fica vinculado ao usuário que o criou

---

## Fluxo Completo de Uso

### 1. Conectar Conta Asaas

```bash
POST /integrations/asaas/connect
{
  "apiKey": "$aak_test_...",
  "environment": "SANDBOX"
}
```

### 2. Criar Cliente (se ainda não existir)

```bash
POST /clients
{
  "name": "João da Silva",
  "email": "joao@exemplo.com",
  "phone": "11999999999",
  "taxId": "12345678900",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567"
}
```

### 3. Sincronizar Cliente com Asaas

```bash
POST /clients/:clientId/sync-asaas
```

Este passo cria um Customer no Asaas e armazena o ID retornado.

### 4. Criar Cobrança

```bash
POST /clients/:clientId/payments
{
  "billingType": "PIX",
  "value": 250.00,
  "dueDate": "2025-12-25",
  "description": "Manutenção de Ar Condicionado"
}
```

**Resposta inclui:**
- Link do boleto (se BOLETO)
- QR Code e código Pix (se PIX)
- Link de pagamento (se CREDIT_CARD)

### 5. Cliente Paga

O cliente usa o link/QR Code para efetuar o pagamento.

### 6. Webhook Atualiza Status

Asaas envia webhook `PAYMENT_RECEIVED` automaticamente.

Sistema atualiza:
- `status` → `RECEIVED`
- `paidAt` → data/hora do pagamento

### 7. Consultar Pagamentos

```bash
GET /clients/payments
```

ou

```bash
GET /clients/payments?clientId=:clientId
```

---

## Ambientes: Sandbox vs Production

### Sandbox (Testes)
- **URL**: `https://api-sandbox.asaas.com/v3`
- **API Key**: Começa com `$aak_test_`
- Não processa pagamentos reais
- Use para desenvolvimento e testes
- Crie conta em: https://sandbox.asaas.com

### Production (Produção)
- **URL**: `https://api.asaas.com/v3`
- **API Key**: Começa com `$aak_`
- Processa pagamentos reais
- Use apenas em produção
- Requer conta Asaas validada

**Troca de ambiente:**
Basta desconectar e reconectar com a API Key do ambiente desejado.

---

## Tratamento de Erros

### Erros Comuns

| Código | Erro | Solução |
|--------|------|---------|
| 401 | Unauthorized | API Key inválida ou expirada |
| 403 | Forbidden | Permissões insuficientes |
| 404 | Not Found | Cliente ou pagamento não encontrado |
| 409 | Conflict | Integração já existe |
| 400 | Bad Request | Dados inválidos na requisição |

### Logs

O sistema registra automaticamente:
- Conexões e desconexões
- Criação de clientes no Asaas
- Criação de pagamentos
- Recebimento de webhooks
- Erros de comunicação com Asaas

Use `Logger` do NestJS para debug:
```typescript
this.logger.log('Payment created', { paymentId: payment.id });
this.logger.error('Failed to sync customer', error);
```

---

## Limitações e Considerações

### 1. Sincronização Manual

A sincronização de clientes com Asaas é **manual** (via endpoint).

**Opções:**
- Sincronizar no momento da criação da primeira cobrança (automático)
- Sincronizar manualmente antes de criar cobranças
- Implementar sincronização automática em background (futuro)

### 2. Webhooks Requerem URL Pública

Para receber webhooks do Asaas em desenvolvimento local:
- Use **ngrok**: `ngrok http 3001`
- Configure a URL do ngrok no painel do Asaas
- Ou teste em staging/produção

### 3. Dados do Cliente

O Asaas exige alguns dados para criar customers:
- **Nome** (obrigatório)
- Email, telefone, CPF/CNPJ (recomendados)
- Endereço completo (para Boleto com Correios)

### 4. Taxa do Asaas

O Asaas cobra taxas por transação:
- Boleto: R$ 3,49 por cobrança paga
- Pix: 0,99% do valor (mínimo R$ 0,50)
- Cartão de Crédito: 4,99% do valor

**Consulte a documentação oficial para valores atualizados.**

---

## Referências

- [Documentação Oficial Asaas](https://docs.asaas.com/)
- [API Reference](https://docs.asaas.com/reference/visao-geral)
- [Webhooks](https://docs.asaas.com/reference/webhooks)
- [Painel Sandbox](https://sandbox.asaas.com)
- [Painel Production](https://www.asaas.com)

---

## Próximos Passos (Melhorias Futuras)

- [ ] Implementar retry automático para webhooks falhados
- [ ] Adicionar logs de auditoria para todas as operações
- [ ] Implementar sincronização em background de clientes
- [ ] Adicionar suporte a assinaturas (recorrência)
- [ ] Implementar splits de pagamento (para equipes)
- [ ] Dashboard de analytics de cobranças
- [ ] Notificações push quando pagamento é recebido
- [ ] Exportação de relatórios financeiros
