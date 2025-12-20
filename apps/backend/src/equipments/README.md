# Equipment Module

## Descrição

O módulo **Equipment** gerencia os equipamentos pertencentes aos clientes no sistema FieldFlow. Este módulo permite que técnicos de manutenção mantenham um registro detalhado de todos os equipamentos instalados nos clientes, incluindo informações de garantia, histórico de manutenções através de ordens de serviço, e dados técnicos relevantes.

## Características Principais

- ✅ CRUD completo de equipamentos
- ✅ Validação de propriedade em múltiplos níveis (userId → clientId → equipmentId)
- ✅ Relacionamento com clientes e ordens de serviço
- ✅ Controle de garantia com datas de instalação e vencimento
- ✅ Histórico de manutenções (últimas 10 ordens de serviço)
- ✅ Filtros por cliente
- ✅ Autenticação JWT obrigatória
- ✅ Documentação Swagger completa
- ✅ Testes unitários e E2E abrangentes

## Modelo de Dados

### Equipment

```prisma
model Equipment {
  id                String    @id @default(uuid())
  userId            String
  clientId          String
  type              String
  brand             String?
  model             String?
  serialNumber      String?
  installationDate  DateTime?
  warrantyEndDate   DateTime?
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  client            Client        @relation(fields: [clientId], references: [id], onDelete: Cascade)
  workOrders        WorkOrder[]

  @@index([userId])
  @@index([clientId])
  @@map("equipment")
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | Identificador único do equipamento |
| `userId` | UUID | Sim | ID do usuário proprietário (técnico/empresa) |
| `clientId` | UUID | Sim | ID do cliente proprietário do equipamento |
| `type` | String | Sim | Tipo/descrição do equipamento (ex: "Ar-condicionado Split 12000 BTUs") |
| `brand` | String | Não | Marca do equipamento (ex: "LG", "Samsung") |
| `model` | String | Não | Modelo específico do equipamento |
| `serialNumber` | String | Não | Número de série do equipamento |
| `installationDate` | DateTime | Não | Data de instalação do equipamento |
| `warrantyEndDate` | DateTime | Não | Data de vencimento da garantia |
| `notes` | String | Não | Observações gerais sobre o equipamento |
| `createdAt` | DateTime | Sim | Data de criação do registro |
| `updatedAt` | DateTime | Sim | Data da última atualização (auto-gerenciada) |

## Endpoints da API

Todos os endpoints requerem autenticação JWT via header `Authorization: Bearer <token>`.

### POST /equipment

Cria um novo equipamento para um cliente.

**Request Body:**
```json
{
  "clientId": "uuid-do-cliente",
  "type": "Ar-condicionado Split 12000 BTUs",
  "brand": "LG",
  "model": "S4-W12JA3AA",
  "serialNumber": "SN123456789",
  "installationDate": "2024-01-15",
  "warrantyEndDate": "2026-01-15",
  "notes": "Instalado na sala principal"
}
```

**Validações:**
- `clientId` deve ser um UUID válido
- `clientId` deve pertencer ao usuário autenticado
- `type` é obrigatório e não pode ser vazio
- `installationDate` e `warrantyEndDate` devem estar no formato ISO 8601

**Response (201):**
```json
{
  "id": "uuid-do-equipamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "type": "Ar-condicionado Split 12000 BTUs",
  "brand": "LG",
  "model": "S4-W12JA3AA",
  "serialNumber": "SN123456789",
  "installationDate": "2024-01-15T00:00:00.000Z",
  "warrantyEndDate": "2026-01-15T00:00:00.000Z",
  "notes": "Instalado na sala principal",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente"
  }
}
```

**Erros:**
- `400 Bad Request`: Dados inválidos
- `401 Unauthorized`: Token ausente ou inválido
- `403 Forbidden`: Cliente não encontrado ou não pertence ao usuário

---

### GET /equipment

Retorna todos os equipamentos do usuário autenticado, com opção de filtro por cliente.

**Query Parameters:**
- `clientId` (opcional): Filtra equipamentos de um cliente específico

**Exemplos:**
```
GET /equipment
GET /equipment?clientId=uuid-do-cliente
```

**Response (200):**
```json
[
  {
    "id": "uuid-do-equipamento",
    "userId": "uuid-do-usuario",
    "clientId": "uuid-do-cliente",
    "type": "Ar-condicionado Split 12000 BTUs",
    "brand": "LG",
    "model": "S4-W12JA3AA",
    "serialNumber": "SN123456789",
    "installationDate": "2024-01-15T00:00:00.000Z",
    "warrantyEndDate": "2026-01-15T00:00:00.000Z",
    "notes": "Instalado na sala principal",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "client": {
      "id": "uuid-do-cliente",
      "name": "Nome do Cliente"
    }
  }
]
```

**Erros:**
- `401 Unauthorized`: Token ausente ou inválido
- `403 Forbidden`: Cliente especificado não pertence ao usuário

---

### GET /equipment/by-client/:clientId

Retorna todos os equipamentos de um cliente específico.

**Path Parameters:**
- `clientId`: UUID do cliente

**Response (200):**
```json
[
  {
    "id": "uuid-do-equipamento",
    "userId": "uuid-do-usuario",
    "clientId": "uuid-do-cliente",
    "type": "Ar-condicionado Split 12000 BTUs",
    "brand": "LG",
    "model": "S4-W12JA3AA",
    "serialNumber": "SN123456789",
    "installationDate": "2024-01-15T00:00:00.000Z",
    "warrantyEndDate": "2026-01-15T00:00:00.000Z",
    "notes": "Instalado na sala principal",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

**Erros:**
- `401 Unauthorized`: Token ausente ou inválido
- `403 Forbidden`: Cliente não encontrado ou não pertence ao usuário

---

### GET /equipment/:id

Retorna um equipamento específico com informações detalhadas do cliente e histórico de ordens de serviço (últimas 10).

**Path Parameters:**
- `id`: UUID do equipamento

**Response (200):**
```json
{
  "id": "uuid-do-equipamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "type": "Ar-condicionado Split 12000 BTUs",
  "brand": "LG",
  "model": "S4-W12JA3AA",
  "serialNumber": "SN123456789",
  "installationDate": "2024-01-15T00:00:00.000Z",
  "warrantyEndDate": "2026-01-15T00:00:00.000Z",
  "notes": "Instalado na sala principal",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente",
    "email": "cliente@exemplo.com",
    "phone": "11999999999"
  },
  "workOrders": [
    {
      "id": "uuid-da-ordem",
      "title": "Manutenção preventiva",
      "status": "COMPLETED",
      "scheduledDate": "2024-02-15T14:00:00.000Z",
      "completedDate": "2024-02-15T16:30:00.000Z"
    }
  ]
}
```

**Erros:**
- `401 Unauthorized`: Token ausente ou inválido
- `404 Not Found`: Equipamento não encontrado ou não pertence ao usuário

---

### PATCH /equipment/:id

Atualiza um equipamento existente.

**Path Parameters:**
- `id`: UUID do equipamento

**Request Body (todos os campos opcionais):**
```json
{
  "clientId": "novo-uuid-do-cliente",
  "type": "Ar-condicionado Split 18000 BTUs",
  "brand": "Samsung",
  "model": "Novo Modelo",
  "serialNumber": "SN987654321",
  "installationDate": "2024-03-20",
  "warrantyEndDate": "2027-03-20",
  "notes": "Atualizações nas observações"
}
```

**Validações:**
- Se `clientId` for fornecido, deve pertencer ao usuário autenticado
- `installationDate` e `warrantyEndDate` devem estar no formato ISO 8601

**Response (200):**
```json
{
  "id": "uuid-do-equipamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "type": "Ar-condicionado Split 18000 BTUs",
  "brand": "Samsung",
  "model": "Novo Modelo",
  "serialNumber": "SN987654321",
  "installationDate": "2024-03-20T00:00:00.000Z",
  "warrantyEndDate": "2027-03-20T00:00:00.000Z",
  "notes": "Atualizações nas observações",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-03-20T11:45:00.000Z",
  "client": {
    "id": "uuid-do-cliente",
    "name": "Nome do Cliente"
  }
}
```

**Erros:**
- `400 Bad Request`: Dados inválidos
- `401 Unauthorized`: Token ausente ou inválido
- `403 Forbidden`: Novo clientId não pertence ao usuário
- `404 Not Found`: Equipamento não encontrado ou não pertence ao usuário

---

### DELETE /equipment/:id

Remove um equipamento do sistema.

**Path Parameters:**
- `id`: UUID do equipamento

**Response (200):**
```json
{
  "id": "uuid-do-equipamento",
  "userId": "uuid-do-usuario",
  "clientId": "uuid-do-cliente",
  "type": "Ar-condicionado Split 12000 BTUs",
  "brand": "LG",
  "model": "S4-W12JA3AA"
}
```

**Erros:**
- `401 Unauthorized`: Token ausente ou inválido
- `404 Not Found`: Equipamento não encontrado ou não pertence ao usuário

**Nota:** A exclusão de um equipamento não exclui as ordens de serviço relacionadas, elas terão o campo `equipmentId` definido como `null` (devido à configuração `onDelete: SetNull` no Prisma).

## Validação de Propriedade

O módulo implementa validação de propriedade em múltiplos níveis para garantir segurança:

1. **Nível 1 - Usuário:** Todas as operações verificam que o recurso pertence ao usuário autenticado (userId)
2. **Nível 2 - Cliente:** Ao criar ou atualizar equipamento, verifica-se que o cliente especificado pertence ao usuário
3. **Nível 3 - Equipamento:** Garante que apenas o proprietário pode visualizar, editar ou excluir seus equipamentos

### Exemplo de Fluxo de Validação

```typescript
// Criar equipamento
1. Usuário autentica → Obtém userId do token JWT
2. Fornece clientId no payload
3. Sistema verifica se clientId pertence ao userId
4. Se sim → Cria equipamento com userId + clientId
5. Se não → Retorna 403 Forbidden

// Buscar equipamento
1. Usuário autentica → Obtém userId do token JWT
2. Fornece equipmentId na URL
3. Sistema busca equipamento WHERE id = equipmentId AND userId = userId
4. Se encontrado → Retorna equipamento
5. Se não encontrado → Retorna 404 Not Found
```

## Casos de Uso

### 1. Registrar Novo Equipamento

Quando um técnico instala um novo equipamento no cliente:

```typescript
POST /equipment
{
  "clientId": "cliente-abc",
  "type": "Ar-condicionado Split 12000 BTUs",
  "brand": "LG",
  "model": "S4-W12JA3AA",
  "serialNumber": "SN123456789",
  "installationDate": "2024-01-15",
  "warrantyEndDate": "2026-01-15",
  "notes": "Instalado na sala principal. Garantia de 2 anos."
}
```

### 2. Listar Equipamentos de um Cliente

Para visualizar todos os equipamentos instalados em um cliente específico:

```typescript
GET /equipment/by-client/cliente-abc
```

### 3. Consultar Histórico de Manutenções

Para ver o histórico de manutenções de um equipamento:

```typescript
GET /equipment/equipamento-xyz
// Retorna o equipamento com as últimas 10 ordens de serviço
```

### 4. Atualizar Informações Técnicas

Quando há alteração nas informações do equipamento:

```typescript
PATCH /equipment/equipamento-xyz
{
  "model": "S4-W12JA3AA-V2",
  "notes": "Atualizado para nova versão do modelo"
}
```

### 5. Transferir Equipamento para Outro Cliente

Quando um equipamento é realocado:

```typescript
PATCH /equipment/equipamento-xyz
{
  "clientId": "novo-cliente-def",
  "notes": "Transferido do cliente ABC para cliente DEF em 2024-03-20"
}
```

## Integração com Outros Módulos

### Clients Module
- Equipamentos pertencem a clientes
- Cascade delete: se um cliente for excluído, todos seus equipamentos são removidos

### Work Orders Module
- Ordens de serviço podem referenciar equipamentos específicos
- Histórico de manutenções é acessível via equipamento

### Users Module
- Equipamentos pertencem a usuários (técnicos/empresas)
- Isolamento total de dados entre diferentes usuários

## Testes

### Testes Unitários

Localização: `src/equipment/equipment.service.spec.ts`

Cobertura:
- ✅ Criar equipamento com cliente válido
- ✅ Rejeitar criação com cliente inválido (ForbiddenException)
- ✅ Listar todos os equipamentos
- ✅ Filtrar equipamentos por cliente
- ✅ Buscar equipamento específico com detalhes
- ✅ Atualizar equipamento
- ✅ Atualizar clientId com validação
- ✅ Remover equipamento
- ✅ Contagem de equipamentos
- ✅ Buscar por cliente com validação

Para executar:
```bash
npm run test -- equipment.service.spec
```

### Testes E2E

Localização: `test/equipment.e2e-spec.ts`

Cobertura:
- ✅ Criar equipamento via API
- ✅ Validação de propriedade em todas as operações
- ✅ Filtros e buscas
- ✅ Autenticação JWT
- ✅ Isolamento entre usuários diferentes
- ✅ Validações de entrada (DTOs)

Para executar:
```bash
npm run test:e2e -- equipment.e2e-spec
```

## DTOs

### CreateEquipmentDto

```typescript
{
  clientId: string;          // UUID, obrigatório
  type: string;              // Obrigatório
  brand?: string;            // Opcional
  model?: string;            // Opcional
  serialNumber?: string;     // Opcional
  installationDate?: string; // ISO 8601, opcional
  warrantyEndDate?: string;  // ISO 8601, opcional
  notes?: string;            // Opcional
}
```

### UpdateEquipmentDto

Todos os campos são opcionais (usa `PartialType` do `CreateEquipmentDto`).

## Swagger/OpenAPI

A documentação interativa está disponível em `/api` quando o servidor está rodando.

Tags utilizadas:
- `equipment`: Todas as operações do módulo Equipment

Autenticação:
- Bearer Token JWT (JWT-auth)

## Boas Práticas Implementadas

1. **Segurança:**
   - Validação de propriedade em múltiplos níveis
   - Autenticação JWT obrigatória em todos os endpoints
   - Isolamento total de dados entre usuários

2. **Validação:**
   - DTOs com class-validator
   - Validação de UUIDs
   - Validação de datas ISO 8601
   - ValidationPipe global configurado

3. **Documentação:**
   - Swagger decorators completos em todos os endpoints
   - Exemplos de request/response
   - Descrição de erros possíveis

4. **Performance:**
   - Índices no banco de dados (userId, clientId)
   - Includes otimizados para evitar N+1 queries
   - Limitação de 10 ordens de serviço no histórico

5. **Manutenibilidade:**
   - Separação clara de responsabilidades (Controller/Service)
   - Testes abrangentes (unitários e E2E)
   - Código TypeScript com tipagem forte
   - Tratamento de erros consistente

## Próximos Passos

Este módulo está pronto para:
1. Integração com módulo de Work Orders (ordens de serviço)
2. Geração de relatórios de equipamentos
3. Alertas de vencimento de garantia
4. Histórico completo de manutenções
5. Exportação de dados de equipamentos

## Changelog

### v1.0.0 (Dia 5)
- ✅ Implementação inicial do módulo Equipment
- ✅ CRUD completo com validação de propriedade
- ✅ Testes unitários e E2E
- ✅ Documentação Swagger
- ✅ Integração com Clients e Users
