# Work Orders Module

## Descrição

O módulo **Work Orders (Ordens de Serviço)** é o coração operacional do sistema FieldFlow. Gerencia todo o ciclo de vida das ordens de serviço, desde o agendamento até a conclusão, incluindo vinculação com clientes, orçamentos aprovados e equipamentos.

## Características Principais

- ✅ CRUD completo de ordens de serviço
- ✅ Vinculação com clientes (obrigatório)
- ✅ Vinculação com orçamentos aprovados (opcional)
- ✅ Gestão de equipamentos vinculados à OS
- ✅ Controle de status com validação de transições
- ✅ Agendamento com datas e horários
- ✅ Rastreamento de execução (início e fim real)
- ✅ Endereço customizado por OS
- ✅ Notas e observações
- ✅ Validação de propriedade multi-nível
- ✅ Testes unitários e E2E completos
- ✅ Preparado para evolução (checklists, fotos, assinaturas, etc.)

## Modelos de Dados

### WorkOrder

```prisma
model WorkOrder {
  id                  String          @id @default(uuid())
  userId              String
  clientId            String
  quoteId             String?         @unique
  title               String
  description         String?
  status              WorkOrderStatus @default(SCHEDULED)
  scheduledDate       DateTime?
  scheduledStartTime  DateTime?
  scheduledEndTime    DateTime?
  executionStart      DateTime?
  executionEnd        DateTime?
  address             String?
  notes               String?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  user                User                  @relation(...)
  client              Client                @relation(...)
  quote               Quote?                @relation(...)
  equipments          WorkOrderEquipment[]
  invoice             Invoice?

  @@index([userId])
  @@index([clientId])
  @@index([status])
  @@map("work_orders")
}
```

### WorkOrderEquipment

```prisma
model WorkOrderEquipment {
  id          String    @id @default(uuid())
  workOrderId String
  equipmentId String
  createdAt   DateTime  @default(now())

  workOrder   WorkOrder @relation(...)
  equipment   Equipment @relation(...)

  @@index([workOrderId])
  @@index([equipmentId])
  @@map("work_order_equipments")
}
```

### WorkOrderStatus (Enum)

```typescript
enum WorkOrderStatus {
  SCHEDULED = 'SCHEDULED',    // Agendada
  IN_PROGRESS = 'IN_PROGRESS', // Em execução
  DONE = 'DONE',               // Concluída
  CANCELED = 'CANCELED',       // Cancelada
}
```

## Regras de Negócio

### 1. Criação de OS

- **Cliente obrigatório**: Toda OS deve estar vinculada a um cliente
- **Cliente deve pertencer ao usuário**: Validação de ownership
- **Orçamento opcional**: Pode ser criada a partir de orçamento aprovado
- **Validação de orçamento**:
  - Se `quoteId` fornecido, orçamento deve estar `APPROVED`
  - Orçamento não pode já ter outra OS vinculada (relação 1:1)
  - Orçamento deve pertencer ao mesmo cliente
- **Equipamentos opcionais**: Pode incluir lista de equipamentos
  - Equipamentos devem pertencer ao usuário e ao cliente da OS
- **Status inicial**: Sempre `SCHEDULED`

### 2. Transições de Status

```
SCHEDULED → IN_PROGRESS → DONE
     ↓                ↓
  CANCELED        CANCELED
```

**Regras:**
- `SCHEDULED` → `IN_PROGRESS`, `CANCELED`
- `IN_PROGRESS` → `DONE`, `CANCELED`
- `DONE` → (nenhuma transição)
- `CANCELED` → (nenhuma transição)

**Automações:**
- Ao transitar para `IN_PROGRESS`: Se `executionStart` não estiver setado, é automaticamente preenchido com timestamp atual
- Ao transitar para `DONE`: Se `executionEnd` não estiver setado, é automaticamente preenchido com timestamp atual

### 3. Atualização de OS

- **Não pode atualizar** se status é `DONE` ou `CANCELED`
- Pode atualizar: title, description, datas, horários, address, notes

### 4. Exclusão de OS

- **Não pode deletar** se status é `IN_PROGRESS` ou `DONE`
- Deve cancelar antes de deletar
- Equipamentos vinculados são deletados em cascade

### 5. Gestão de Equipamentos

- **Adicionar equipamento**:
  - Não pode adicionar se status é `DONE` ou `CANCELED`
  - Equipamento deve pertencer ao usuário e ao cliente da OS
  - Equipamento não pode já estar vinculado à mesma OS

- **Remover equipamento**:
  - Não pode remover se status é `DONE` ou `CANCELED`
  - Equipamento deve estar vinculado à OS

### 6. Validação de Propriedade (Ownership)

**Multi-nível:**
- `userId` → WorkOrder (WHERE userId em todas queries)
- `userId` → Client (validação ao criar)
- `userId` → Quote (validação ao criar, se fornecido)
- `userId` → Equipments (validação ao criar/adicionar)

## Endpoints da API

### POST /work-orders

Cria nova ordem de serviço.

**Request:**
```json
{
  "clientId": "uuid-client-id",
  "quoteId": "uuid-quote-id",  // opcional
  "title": "Manutenção ar-condicionado sala 3",
  "description": "Limpeza completa e troca de filtros",
  "scheduledDate": "2025-12-15",
  "scheduledStartTime": "2025-12-15T08:00:00Z",
  "scheduledEndTime": "2025-12-15T12:00:00Z",
  "address": "Rua Exemplo, 123 - Sala 301",
  "notes": "Cliente solicitou visita pela manhã",
  "equipmentIds": ["uuid-equipment-1", "uuid-equipment-2"]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid-workorder-id",
  "userId": "uuid-user-id",
  "clientId": "uuid-client-id",
  "quoteId": "uuid-quote-id",
  "title": "Manutenção ar-condicionado sala 3",
  "description": "Limpeza completa e troca de filtros",
  "status": "SCHEDULED",
  "scheduledDate": "2025-12-15T00:00:00Z",
  "scheduledStartTime": "2025-12-15T08:00:00Z",
  "scheduledEndTime": "2025-12-15T12:00:00Z",
  "executionStart": null,
  "executionEnd": null,
  "address": "Rua Exemplo, 123 - Sala 301",
  "notes": "Cliente solicitou visita pela manhã",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z",
  "client": {
    "id": "uuid-client-id",
    "name": "Cliente Teste",
    "email": "cliente@test.com",
    "phone": "11999999999"
  },
  "quote": {
    "id": "uuid-quote-id",
    "totalValue": "500.00",
    "status": "APPROVED"
  },
  "equipments": [
    {
      "id": "uuid-link-1",
      "equipment": {
        "id": "uuid-equipment-1",
        "name": "Ar-condicionado Split",
        "type": "Ar-condicionado",
        "brand": "LG",
        "model": "DUAL123"
      }
    }
  ]
}
```

**Códigos de status:**
- `201`: OS criada com sucesso
- `400`: Orçamento não aprovado ou já possui OS
- `401`: Não autenticado
- `403`: Cliente, orçamento ou equipamentos não encontrados ou não pertencem ao usuário

### GET /work-orders

Lista todas as ordens de serviço do usuário autenticado.

**Query Parameters:**
- `clientId` (opcional): Filtrar por cliente
- `status` (opcional): Filtrar por status (SCHEDULED, IN_PROGRESS, DONE, CANCELED)
- `startDate` (opcional): Filtrar por data agendada (início do intervalo) - formato ISO 8601
- `endDate` (opcional): Filtrar por data agendada (fim do intervalo) - formato ISO 8601

**Response:** `200 OK`
```json
[
  {
    "id": "uuid-workorder-id",
    "userId": "uuid-user-id",
    "clientId": "uuid-client-id",
    "title": "Manutenção ar-condicionado sala 3",
    "status": "SCHEDULED",
    "scheduledDate": "2025-12-15T00:00:00Z",
    "createdAt": "2025-12-09T10:00:00Z",
    "updatedAt": "2025-12-09T10:00:00Z",
    "client": {
      "id": "uuid-client-id",
      "name": "Cliente Teste"
    },
    "_count": {
      "equipments": 2
    }
  }
]
```

**Códigos de status:**
- `200`: Sucesso
- `401`: Não autenticado
- `403`: clientId fornecido não pertence ao usuário

### GET /work-orders/:id

Retorna uma ordem de serviço específica com todos os detalhes.

**Response:** `200 OK`
```json
{
  "id": "uuid-workorder-id",
  "userId": "uuid-user-id",
  "clientId": "uuid-client-id",
  "quoteId": "uuid-quote-id",
  "title": "Manutenção ar-condicionado sala 3",
  "description": "Limpeza completa e troca de filtros",
  "status": "IN_PROGRESS",
  "scheduledDate": "2025-12-15T00:00:00Z",
  "scheduledStartTime": "2025-12-15T08:00:00Z",
  "scheduledEndTime": "2025-12-15T12:00:00Z",
  "executionStart": "2025-12-15T08:15:00Z",
  "executionEnd": null,
  "address": "Rua Exemplo, 123 - Sala 301",
  "notes": "Cliente solicitou visita pela manhã",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-15T08:15:00Z",
  "client": {
    "id": "uuid-client-id",
    "name": "Cliente Teste",
    "email": "cliente@test.com",
    "phone": "11999999999",
    "address": "Rua Cliente, 456",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567"
  },
  "quote": {
    "id": "uuid-quote-id",
    "totalValue": "500.00",
    "discountValue": "50.00",
    "status": "APPROVED"
  },
  "equipments": [
    {
      "id": "uuid-link-1",
      "equipment": {
        "id": "uuid-equipment-1",
        "name": "Ar-condicionado Split",
        "type": "Ar-condicionado",
        "brand": "LG",
        "model": "DUAL123",
        "serialNumber": "SN123456"
      }
    }
  ]
}
```

**Códigos de status:**
- `200`: Sucesso
- `401`: Não autenticado
- `404`: OS não encontrada ou não pertence ao usuário

### PUT /work-orders/:id

Atualiza detalhes da ordem de serviço.

**Request:**
```json
{
  "title": "Manutenção URGENTE - Ar-condicionado sala 3",
  "description": "Limpeza, troca de filtros e verificação de vazamentos",
  "scheduledDate": "2025-12-16",
  "scheduledStartTime": "2025-12-16T07:00:00Z",
  "scheduledEndTime": "2025-12-16T11:00:00Z",
  "executionStart": "2025-12-16T07:10:00Z",
  "executionEnd": "2025-12-16T10:50:00Z",
  "address": "Rua Exemplo, 123 - Sala 302",
  "notes": "Atualizado para urgente. Cliente agradeceu"
}
```

**Response:** `200 OK`

**Códigos de status:**
- `200`: OS atualizada com sucesso
- `400`: Não pode atualizar OS com status DONE ou CANCELED
- `401`: Não autenticado
- `404`: OS não encontrada

### DELETE /work-orders/:id

Deleta uma ordem de serviço.

**Response:** `200 OK`

**Códigos de status:**
- `200`: OS deletada com sucesso
- `400`: Não pode deletar OS com status IN_PROGRESS ou DONE
- `401`: Não autenticado
- `404`: OS não encontrada

### PATCH /work-orders/:id/status

Atualiza o status da ordem de serviço.

**Request:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid-workorder-id",
  "status": "IN_PROGRESS",
  "executionStart": "2025-12-15T08:15:23Z",
  ...
}
```

**Códigos de status:**
- `200`: Status atualizado com sucesso
- `400`: Transição de status inválida
- `401`: Não autenticado
- `404`: OS não encontrada

### POST /work-orders/:id/equipments

Adiciona equipamento à ordem de serviço.

**Request:**
```json
{
  "equipmentId": "uuid-equipment-id"
}
```

**Response:** `201 Created`

**Códigos de status:**
- `201`: Equipamento adicionado com sucesso
- `400`: Equipamento já vinculado ou OS com status DONE/CANCELED
- `401`: Não autenticado
- `404`: OS não encontrada

### DELETE /work-orders/:id/equipments/:equipmentId

Remove equipamento da ordem de serviço.

**Response:** `200 OK`

**Códigos de status:**
- `200`: Equipamento removido com sucesso
- `400`: OS com status DONE ou CANCELED
- `401`: Não autenticado
- `404`: OS ou vinculação não encontrada

## Fluxo Típico de Uso

### 1. Criar OS a partir de orçamento aprovado
```bash
POST /work-orders
{
  "clientId": "...",
  "quoteId": "...",  # orçamento aprovado
  "title": "Serviço conforme orçamento",
  "scheduledDate": "2025-12-20",
  "equipmentIds": ["eq-1", "eq-2"]
}
```

### 2. Agendar execução
```bash
PUT /work-orders/:id
{
  "scheduledStartTime": "2025-12-20T08:00:00Z",
  "scheduledEndTime": "2025-12-20T12:00:00Z"
}
```

### 3. Iniciar execução (em campo)
```bash
PATCH /work-orders/:id/status
{
  "status": "IN_PROGRESS"
}
# executionStart é automaticamente setado
```

### 4. Concluir serviço
```bash
PATCH /work-orders/:id/status
{
  "status": "DONE"
}
# executionEnd é automaticamente setado
```

### 5. Adicionar notas finais
```bash
PUT /work-orders/:id
{
  "notes": "Serviço concluído com sucesso. Cliente satisfeito. Próxima manutenção em 6 meses."
}
```

## Casos de Uso

### Caso 1: OS Simples (sem orçamento)

**Cenário**: Técnico recebe chamado direto do cliente para manutenção preventiva.

```bash
# 1. Criar OS
POST /work-orders
{
  "clientId": "client-abc",
  "title": "Manutenção preventiva ar-condicionado",
  "scheduledDate": "2025-12-18",
  "equipmentIds": ["eq-123"]
}

# 2. No dia do serviço, iniciar
PATCH /work-orders/wo-xyz/status { "status": "IN_PROGRESS" }

# 3. Concluir
PATCH /work-orders/wo-xyz/status { "status": "DONE" }
```

### Caso 2: OS a partir de Orçamento

**Cenário**: Cliente aprovou orçamento, criar OS automaticamente.

```bash
# 1. Criar OS vinculada ao orçamento
POST /work-orders
{
  "clientId": "client-abc",
  "quoteId": "quote-approved",  # já APPROVED
  "title": "Instalação conforme orçamento #123",
  "scheduledDate": "2025-12-22"
}
# Sistema valida: quote APPROVED, não tem outra OS, pertence ao cliente
```

### Caso 3: Reagendamento

**Cenário**: Cliente pediu para reagendar serviço.

```bash
# 1. Atualizar data
PUT /work-orders/wo-xyz
{
  "scheduledDate": "2025-12-25",
  "scheduledStartTime": "2025-12-25T14:00:00Z",
  "notes": "Cliente solicitou reagendamento para tarde de natal"
}
```

### Caso 4: Cancelamento

**Cenário**: Cliente cancelou serviço.

```bash
# 1. Cancelar OS
PATCH /work-orders/wo-xyz/status
{
  "status": "CANCELED"
}

# 2. Adicionar nota
PUT /work-orders/wo-xyz
{
  "notes": "Cliente cancelou. Motivo: viagem inesperada"
}
# Não pode mais atualizar depois de cancelar
```

## Integração com Outros Módulos

### Clients
- **Obrigatório**: WorkOrder sempre vinculada a Client
- **Cascade**: Se Client deletado, WorkOrders também são deletadas

### Quotes
- **Opcional**: WorkOrder pode vir de Quote aprovado
- **Relação 1:1**: Quote pode ter no máximo 1 WorkOrder
- **Validação**: Quote deve estar APPROVED

### Equipments
- **Opcional**: WorkOrder pode ter múltiplos Equipments
- **Many-to-Many**: via WorkOrderEquipment
- **Validação**: Equipments devem pertencer ao mesmo Client

### Invoices (Futuro - Dia 8)
- **Relação 1:1**: WorkOrder pode gerar 1 Invoice
- **Futuro**: Ao concluir OS, pode criar Nota Fiscal automaticamente

## Testes

### Testes Unitários

**Executar:**
```bash
npm test work-orders.service.spec.ts
```

**Cobertura:**
- create(): criação normal, com quote, com equipments, validações (6 testes)
- findAll(): listar, filtrar por client, filtrar por status (3 testes)
- findOne(): buscar, não encontrado (2 testes)
- update(): atualizar, não permitir se DONE (2 testes)
- updateStatus(): transições válidas, inválidas (3 testes)
- addEquipment(): adicionar, já vinculado (2 testes)
- removeEquipment(): remover, não vinculado (2 testes)

**Total**: 20 testes unitários

### Testes E2E

**Executar:**
```bash
npm run test:e2e work-orders.e2e-spec.ts
```

**Cobertura:**
- POST /work-orders (4 testes)
- GET /work-orders (3 testes)
- GET /work-orders/:id (2 testes)
- PUT /work-orders/:id (1 teste)
- PATCH /work-orders/:id/status (3 testes)
- Ownership validation (1 teste)

**Total**: 14 testes E2E

## DTOs

### CreateWorkOrderDto
- clientId (obrigatório, UUID)
- quoteId (opcional, UUID)
- title (obrigatório, string)
- description (opcional, string)
- scheduledDate (opcional, ISO8601)
- scheduledStartTime (opcional, ISO8601)
- scheduledEndTime (opcional, ISO8601)
- address (opcional, string)
- notes (opcional, string)
- equipmentIds (opcional, array de UUIDs)

### UpdateWorkOrderDto
- title (opcional, string)
- description (opcional, string)
- scheduledDate (opcional, ISO8601)
- scheduledStartTime (opcional, ISO8601)
- scheduledEndTime (opcional, ISO8601)
- executionStart (opcional, ISO8601)
- executionEnd (opcional, ISO8601)
- address (opcional, string)
- notes (opcional, string)

### UpdateWorkOrderStatusDto
- status (obrigatório, enum: SCHEDULED | IN_PROGRESS | DONE | CANCELED)

### AddEquipmentDto
- equipmentId (obrigatório, UUID)

## Swagger/OpenAPI

Todos os endpoints estão documentados no Swagger:
- http://localhost:3001/api
- Tag: **Work Orders**
- Todos endpoints requerem autenticação JWT

## Boas Práticas Implementadas

1. **Validação de entrada**: class-validator em todos os DTOs
2. **Validação de negócio**: regras de transição de status, validações de quote
3. **Ownership**: validação multi-nível (user→client→quote→equipments)
4. **Timestamps automáticos**: executionStart e executionEnd
5. **Includes otimizados**: select específico para performance
6. **Cascade delete**: WorkOrderEquipment deletado automaticamente
7. **Status machine**: transições controladas e validadas
8. **Testes abrangentes**: unitários e E2E
9. **Documentação completa**: Swagger e README

## Preparação para Evolução

O módulo está preparado para futuras funcionalidades:

### Checklists (Dia futuro)
- Adicionar tabela `WorkOrderChecklist`
- Template de checklist por tipo de serviço
- Marcar items como OK/NOK durante execução

### Fotos (Dia futuro)
- Adicionar tabela `WorkOrderPhoto`
- Upload de fotos antes/depois
- Armazenamento S3/local

### Assinaturas (Dia futuro)
- Campo `clientSignature` em WorkOrder
- Captura de assinatura digital
- Confirmação de conclusão pelo cliente

### Time Tracking (Dia futuro)
- Pausas durante execução
- Múltiplas sessões de trabalho
- Relatório de horas trabalhadas

### Cobrança Automática (Dia 8)
- Gerar Invoice ao concluir OS
- Vincular items do Quote
- Adicionar items extras se houver

## Limitações e Considerações

1. **Offline-first**: Módulo preparado mas ainda não implementado sync offline
2. **Geolocalização**: Campos preparados mas tracking GPS não implementado
3. **Notificações**: Não envia notificações push ainda
4. **Relatórios**: Não gera relatórios automáticos de produtividade

## Próximos Passos

1. ✅ Implementar módulo Invoice (Dia 8)
2. ⏳ Adicionar geolocalização (capturar GPS ao iniciar/concluir)
3. ⏳ Implementar checklists dinâmicos
4. ⏳ Upload de fotos
5. ⏳ Assinatura digital do cliente

## Changelog

### v1.0.0 (Dia 7)
- ✅ CRUD completo de Work Orders
- ✅ Vinculação com Clients
- ✅ Vinculação opcional com Quotes aprovados
- ✅ Gestão de equipamentos (add/remove)
- ✅ Status machine (SCHEDULED→IN_PROGRESS→DONE/CANCELED)
- ✅ Timestamps automáticos (executionStart/executionEnd)
- ✅ 20 testes unitários
- ✅ 14 testes E2E
- ✅ Documentação completa
- ✅ Swagger completo
