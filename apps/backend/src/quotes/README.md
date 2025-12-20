# Quotes Module

## Descrição

O módulo **Quotes** gerencia orçamentos no sistema FieldFlow. Permite criar, editar e controlar orçamentos com múltiplos itens, cálculo automático de totais, aplicação de descontos e controle de status do orçamento (rascunho, enviado, aprovado, rejeitado, expirado).

## Características Principais

- ✅ CRUD completo de orçamentos
- ✅ Gestão de itens do orçamento (QuoteItems)
- ✅ Cálculo automático de totais (backend)
- ✅ Aplicação de descontos
- ✅ Controle de status com validação de transições
- ✅ Cópia do preço unitário no momento da criação (snapshot)
- ✅ Relacionamento com clientes e itens do catálogo
- ✅ Validação de propriedade multi-nível
- ✅ Recálculo automático ao adicionar/remover/editar itens
- ✅ Testes unitários e E2E completos

## Modelos de Dados

### Quote

```prisma
model Quote {
  id              String      @id @default(uuid())
  userId          String
  clientId        String
  status          QuoteStatus @default(DRAFT)
  discountValue   Decimal     @db.Decimal(10, 2) @default(0)
  totalValue      Decimal     @db.Decimal(10, 2)
  notes           String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  client          Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  items           QuoteItem[]
  workOrder       WorkOrder?

  @@index([userId])
  @@index([clientId])
  @@map("quotes")
}
```

### QuoteItem

```prisma
model QuoteItem {
  id              String   @id @default(uuid())
  quoteId         String
  itemId          String?
  quantity        Decimal  @db.Decimal(10, 3)
  unitPrice       Decimal  @db.Decimal(10, 2)
  totalPrice      Decimal  @db.Decimal(10, 2)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  quote           Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  item            Item?   @relation(fields: [itemId], references: [id], onDelete: SetNull)

  @@index([quoteId])
  @@map("quote_items")
}
```

### QuoteStatus (Enum)

```typescript
enum QuoteStatus {
  DRAFT = 'DRAFT',       // Rascunho
  SENT = 'SENT',         // Enviado ao cliente
  APPROVED = 'APPROVED', // Aprovado pelo cliente
  REJECTED = 'REJECTED', // Rejeitado pelo cliente
  EXPIRED = 'EXPIRED',   // Expirado
}
```

## Regras de Negócio

### 1. Cálculo de Totais

O total do orçamento é calculado automaticamente no backend:

```
itemsTotal = Σ (QuoteItem.totalPrice)
totalValue = itemsTotal - discountValue
```

Onde:
```
QuoteItem.totalPrice = quantity * unitPrice
```

**Importante:**
- O `totalValue` nunca pode ser negativo
- Se `discountValue` > `itemsTotal`, retorna erro `400 Bad Request`

### 2. Snapshot de Preços

Quando um item é adicionado ao orçamento, o `unitPrice` atual do Item é **copiado** para o QuoteItem. Isso garante que:

- Alterações futuras no preço do Item não afetam orçamentos já criados
- O orçamento mantém um histórico preciso dos preços no momento da criação
- Não há necessidade de buscar preços dinamicamente

### 3. Transições de Status

Apenas as seguintes transições são permitidas:

| Status Atual | Status Permitido |
|--------------|------------------|
| DRAFT | SENT, EXPIRED |
| SENT | APPROVED, REJECTED, EXPIRED |
| APPROVED | EXPIRED |
| REJECTED | EXPIRED |
| EXPIRED | (nenhum) |

**Validação:** Tentar fazer uma transição inválida retorna `400 Bad Request`.

### 4. Validação de Propriedade

- Um Quote só pode pertencer ao usuário que o criou
- O clientId deve pertencer ao usuário autenticado
- Todos os itemIds devem pertencer ao usuário autenticado
- Impossível acessar/modificar orçamentos de outros usuários

## Endpoints da API

Todos os endpoints requerem autenticação JWT via header `Authorization: Bearer <token>`.

### POST /quotes

Cria um novo orçamento com itens.

**Request Body:**
```json
{
  "clientId": "uuid-do-cliente",
  "items": [
    {
      "itemId": "uuid-item-1",
      "quantity": 2
    },
    {
      "itemId": "uuid-item-2",
      "quantity": 1.5
    }
  ],
  "discountValue": 25,
  "notes": "Orçamento para manutenção preventiva"
}
```

**Response (201):**
```json
{
  "id": "uuid-do-orcamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "status": "DRAFT",
  "discountValue": "25.00",
  "totalValue": "250.00",
  "notes": "Orçamento para manutenção preventiva",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente",
    "email": "cliente@exemplo.com",
    "phone": "11999999999"
  },
  "items": [
    {
      "id": "uuid-quote-item-1",
      "quoteId": "uuid-do-orcamento",
      "itemId": "uuid-item-1",
      "quantity": "2.000",
      "unitPrice": "100.00",
      "totalPrice": "200.00",
      "item": {
        "id": "uuid-item-1",
        "name": "Serviço de Manutenção",
        "type": "SERVICE"
      }
    },
    {
      "id": "uuid-quote-item-2",
      "quoteId": "uuid-do-orcamento",
      "itemId": "uuid-item-2",
      "quantity": "1.500",
      "unitPrice": "50.00",
      "totalPrice": "75.00",
      "item": {
        "id": "uuid-item-2",
        "name": "Peça de Reposição",
        "type": "PRODUCT"
      }
    }
  ]
}
```

**Erros:**
- `400`: Desconto maior que total, itens inválidos
- `401`: Não autenticado
- `403`: Cliente ou itens não pertencem ao usuário

---

### GET /quotes

Lista todos os orçamentos do usuário autenticado.

**Query Parameters:**
- `clientId` (opcional): Filtra por cliente específico
- `status` (opcional): Filtra por status (DRAFT, SENT, APPROVED, REJECTED, EXPIRED)

**Exemplos:**
```
GET /quotes
GET /quotes?clientId=uuid-do-cliente
GET /quotes?status=DRAFT
GET /quotes?clientId=uuid&status=SENT
```

**Response (200):**
```json
[
  {
    "id": "uuid-do-orcamento",
    "userId": "uuid-do-usuario",
    "clientId": "uuid-do-cliente",
    "status": "DRAFT",
    "discountValue": "25.00",
    "totalValue": "250.00",
    "notes": "Orçamento para manutenção",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "client": {
      "id": "uuid-do-cliente",
      "name": "Nome do Cliente"
    },
    "_count": {
      "items": 2
    }
  }
]
```

---

### GET /quotes/:id

Retorna um orçamento específico com todos os itens.

**Response (200):**
```json
{
  "id": "uuid-do-orcamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "status": "DRAFT",
  "discountValue": "25.00",
  "totalValue": "250.00",
  "notes": "Orçamento para manutenção",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente",
    "email": "cliente@exemplo.com",
    "phone": "11999999999",
    "address": "Rua Exemplo, 123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567"
  },
  "items": [
    {
      "id": "uuid-quote-item-1",
      "quantity": "2.000",
      "unitPrice": "100.00",
      "totalPrice": "200.00",
      "item": {
        "id": "uuid-item-1",
        "name": "Serviço de Manutenção",
        "description": "Manutenção preventiva completa",
        "type": "SERVICE",
        "unit": "hora"
      }
    }
  ]
}
```

**Erros:**
- `401`: Não autenticado
- `404`: Orçamento não encontrado ou não pertence ao usuário

---

### PUT /quotes/:id

Atualiza o orçamento (apenas desconto e notas, não os itens).

**Request Body:**
```json
{
  "discountValue": 50,
  "notes": "Desconto aprovado pela gerência"
}
```

**Response (200):**
```json
{
  "id": "uuid-do-orcamento",
  "discountValue": "50.00",
  "totalValue": "225.00",
  "notes": "Desconto aprovado pela gerência",
  ...
}
```

**Erros:**
- `400`: Desconto maior que total de itens
- `401`: Não autenticado
- `404`: Orçamento não encontrado

---

### DELETE /quotes/:id

Remove um orçamento (e todos seus itens).

**Response (200):**
```json
{
  "id": "uuid-do-orcamento",
  ...
}
```

---

### POST /quotes/:id/items

Adiciona um item ao orçamento.

**Request Body:**
```json
{
  "itemId": "uuid-item-3",
  "quantity": 2
}
```

**Response (201):**
Retorna o orçamento completo atualizado com o novo item e total recalculado.

**Erros:**
- `400`: Item não encontrado ou não pertence ao usuário
- `404`: Orçamento não encontrado

---

### PUT /quotes/:id/items/:itemId

Atualiza a quantidade de um item no orçamento.

**Request Body:**
```json
{
  "quantity": 5
}
```

**Response (200):**
Retorna o orçamento completo com totalPrice do item e totalValue recalculados.

**Erros:**
- `404`: Orçamento ou item não encontrado

---

### DELETE /quotes/:id/items/:itemId

Remove um item do orçamento.

**Response (200):**
Retorna o orçamento completo com totalValue recalculado.

**Erros:**
- `400`: Remoção tornaria total negativo (ajustar desconto primeiro)
- `404`: Orçamento ou item não encontrado

---

### PATCH /quotes/:id/status

Atualiza o status do orçamento com validação de transição.

**Request Body:**
```json
{
  "status": "SENT"
}
```

**Response (200):**
```json
{
  "id": "uuid-do-orcamento",
  "status": "SENT",
  ...
}
```

**Erros:**
- `400`: Transição de status inválida
- `404`: Orçamento não encontrado

## Fluxo Típico de Uso

### 1. Criar Orçamento

```typescript
POST /quotes
{
  "clientId": "cliente-123",
  "items": [
    { "itemId": "item-1", "quantity": 2 },
    { "itemId": "item-2", "quantity": 1 }
  ],
  "discountValue": 0,
  "notes": "Orçamento inicial"
}
// Status: DRAFT
// Total calculado automaticamente
```

### 2. Ajustar Itens

```typescript
// Adicionar mais um item
POST /quotes/quote-123/items
{ "itemId": "item-3", "quantity": 1 }

// Ajustar quantidade
PUT /quotes/quote-123/items/quote-item-1
{ "quantity": 3 }

// Remover item
DELETE /quotes/quote-123/items/quote-item-2
```

### 3. Aplicar Desconto

```typescript
PUT /quotes/quote-123
{
  "discountValue": 100,
  "notes": "Desconto de fidelidade aplicado"
}
// Total recalculado: itemsTotal - 100
```

### 4. Enviar ao Cliente

```typescript
PATCH /quotes/quote-123/status
{ "status": "SENT" }
// Status: DRAFT → SENT
```

### 5. Cliente Aprova

```typescript
PATCH /quotes/quote-123/status
{ "status": "APPROVED" }
// Status: SENT → APPROVED
// (ou REJECTED se rejeitado)
```

### 6. Gerar Ordem de Serviço

*Nota: A conversão de Quote → WorkOrder será implementada no módulo de OS.*

## Casos de Uso

### Caso 1: Orçamento Simples

Cliente solicita manutenção de ar-condicionado:

```json
POST /quotes
{
  "clientId": "cliente-abc",
  "items": [
    { "itemId": "manutencao-ac", "quantity": 1 }
  ],
  "notes": "Manutenção preventiva AC Split 12000 BTUs"
}
```

### Caso 2: Orçamento com Múltiplos Itens e Desconto

Cliente solicita instalação completa:

```json
POST /quotes
{
  "clientId": "cliente-xyz",
  "items": [
    { "itemId": "instalacao-ac", "quantity": 1 },
    { "itemId": "ac-12000-btus", "quantity": 1 },
    { "itemId": "suporte-parede", "quantity": 2 },
    { "itemId": "tubo-cobre-3m", "quantity": 5 }
  ],
  "discountValue": 150,
  "notes": "Cliente antigo - desconto de 150 reais"
}
```

### Caso 3: Ajustar Orçamento Durante Negociação

```typescript
// Cliente pediu para remover um item
DELETE /quotes/quote-123/items/item-abc

// Cliente negociou mais desconto
PUT /quotes/quote-123
{ "discountValue": 200 }

// Enviar versão final
PATCH /quotes/quote-123/status
{ "status": "SENT" }
```

## Integração com Outros Módulos

### Clients

- Quote.clientId → Client.id
- Validação de propriedade: Client.userId === Quote.userId

### Items

- QuoteItem.itemId → Item.id (opcional, pode ser null se item deletado)
- Snapshot: unitPrice copiado no momento da criação
- Validação: Item.userId === Quote.userId

### Work Orders (Futuro)

- Quote pode gerar uma WorkOrder quando aprovado
- WorkOrder.quoteId → Quote.id (one-to-one)
- O orçamento aprovado serve como base para a ordem de serviço

## Testes

### Testes Unitários

**Localização:** `src/quotes/quotes.service.spec.ts`

**Cobertura:**
- ✅ Criação com cálculo correto (24 testes)
- ✅ Validações de cliente e itens
- ✅ Desconto não pode exceder total
- ✅ Filtros (clientId, status)
- ✅ Adição de itens com recálculo
- ✅ Atualização de quantidade
- ✅ Remoção de itens
- ✅ Atualização de desconto
- ✅ Transições de status válidas e inválidas

**Executar:**
```bash
npm test -- quotes.service.spec
```

### Testes E2E

**Localização:** `test/quotes.e2e-spec.ts`

**Cobertura:**
- ✅ CRUD completo via API
- ✅ Cálculos de totais corretos
- ✅ Validações de propriedade
- ✅ Filtros funcionando
- ✅ Gestão de itens (adicionar/editar/remover)
- ✅ Transições de status
- ✅ Isolamento entre usuários

**Executar:**
```bash
npm run test:e2e -- quotes.e2e-spec
```

## DTOs

### CreateQuoteDto

```typescript
{
  clientId: string;           // UUID, obrigatório
  items: CreateQuoteItemDto[]; // Array, obrigatório, min 1 item
  discountValue?: number;      // Opcional, padrão 0, min 0
  notes?: string;              // Opcional
}

CreateQuoteItemDto {
  itemId: string;    // UUID, obrigatório
  quantity: number;  // Obrigatório, min 0.001
}
```

### UpdateQuoteDto

```typescript
{
  discountValue?: number;  // Opcional, min 0
  notes?: string;          // Opcional
}
```

### AddQuoteItemDto

```typescript
{
  itemId: string;    // UUID, obrigatório
  quantity: number;  // Obrigatório, min 0.001
}
```

### UpdateQuoteItemDto

```typescript
{
  quantity: number;  // Obrigatório, min 0.001
}
```

### UpdateQuoteStatusDto

```typescript
{
  status: QuoteStatus;  // Enum, obrigatório
}
```

## Swagger/OpenAPI

A documentação interativa está disponível em `/api` quando o servidor está rodando.

**Tag:** `Quotes`

**Autenticação:** Bearer Token JWT

## Boas Práticas Implementadas

1. **Cálculos no Backend:** Todos os valores são calculados no servidor, nunca confiando no cliente
2. **Snapshot de Preços:** Preços copiados no momento da criação garantem histórico preciso
3. **Validação de Transições:** Máquina de estados garante fluxo correto
4. **Validação de Propriedade:** Multi-nível (user → client/items → quote)
5. **Recálculo Automático:** Totais sempre corretos após operações
6. **Testes Abrangentes:** 24 testes unitários + testes E2E completos
7. **Tratamento de Erros:** Mensagens claras e status codes adequados
8. **Documentação Completa:** Swagger + README detalhado

## Limitações e Considerações

- **Desconto:** Aplicado ao total, não por item individual
- **Tax/Impostos:** Não implementado nesta versão (pode ser adicionado depois)
- **Validade:** Campo validUntil removido (pode ser re-adicionado se necessário)
- **Aprovação Automática:** APPROVED só via ação explícita, não automático
- **Histórico:** Alterações não são versionadas (considerar audit log futuro)

## Próximos Passos

Este módulo está pronto para:
1. ✅ Criação e gestão completa de orçamentos
2. ✅ Controle de status e fluxo de aprovação
3. ⏳ Conversão para Work Order (próximo módulo)
4. ⏳ Geração de PDF do orçamento
5. ⏳ Envio por email ao cliente
6. ⏳ Notificações de expiração (job agendado)

## Changelog

### v1.0.0 (Dia 6)
- ✅ Implementação inicial do módulo Quotes
- ✅ CRUD completo com validações
- ✅ Gestão de QuoteItems
- ✅ Cálculo automático de totais
- ✅ Controle de status com validações
- ✅ Testes unitários e E2E
- ✅ Documentação completa
