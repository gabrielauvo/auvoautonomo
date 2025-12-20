# Clients Module

## Overview

The Clients module manages customer information in the system. It provides full CRUD operations with multi-tenancy support, search functionality, and plan-based usage limits.

## Features

- **CRUD Operations**: Create, Read, Update, Delete clients
- **Search**: Search clients by name, email, phone, or tax ID
- **Multi-tenancy**: All clients are scoped to the authenticated user
- **Usage Limits**: Enforces plan-based limits (Free: 5, Pro: 50, Team: unlimited)
- **Equipment Tracking**: Clients can have associated equipment
- **Relationship Counts**: Returns counts of quotes, work orders, and invoices for each client

## Endpoints

### Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### POST /clients

Creates a new client for the authenticated user.

**Usage Limit**: Checks plan limit before creation.

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(11) 99999-9999",
  "taxId": "123.456.789-00",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "notes": "VIP customer"
}
```

**Required Fields**:
- `name`: String (not empty)
- `phone`: String matching pattern `^[\d\s()+-]+$`
- `taxId`: String matching pattern `^[\d.-]+$` (CPF or CNPJ)

**Optional Fields**:
- `email`: Valid email address
- `address`: String
- `city`: String
- `state`: String
- `zipCode`: String
- `notes`: String

**Response** (201):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(11) 99999-9999",
  "taxId": "123.456.789-00",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "notes": "VIP customer",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z",
  "equipment": []
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data (validation failed)
- `401 Unauthorized`: Missing or invalid JWT token
- `403 Forbidden`: Client limit reached for current plan

---

### GET /clients

Returns all clients for the authenticated user.

**Query Parameters**: None

**Response** (200):
```json
[
  {
    "id": "uuid",
    "userId": "user-uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "(11) 99999-9999",
    "taxId": "123.456.789-00",
    "address": "Rua Exemplo, 123",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01234-567",
    "notes": "VIP customer",
    "createdAt": "2025-12-09T10:00:00Z",
    "updatedAt": "2025-12-09T10:00:00Z",
    "equipment": [],
    "_count": {
      "quotes": 5,
      "workOrders": 3,
      "invoices": 8
    }
  }
]
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token

---

### GET /clients/search?q={query}

Searches clients by name, email, phone, or tax ID (case-insensitive for name and email).

**Query Parameters**:
- `q`: Search query string (required)

**Response** (200):
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "(11) 99999-9999",
    "taxId": "123.456.789-00",
    "equipment": [],
    "_count": {
      "quotes": 5,
      "workOrders": 3,
      "invoices": 8
    }
  }
]
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token

---

### GET /clients/:id

Returns a single client by ID with full details including related entities.

**Path Parameters**:
- `id`: Client UUID

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(11) 99999-9999",
  "taxId": "123.456.789-00",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "notes": "VIP customer",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z",
  "equipment": [],
  "quotes": [],
  "workOrders": [],
  "invoices": [],
  "_count": {
    "quotes": 0,
    "workOrders": 0,
    "invoices": 0
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Client with specified ID not found

---

### PATCH /clients/:id

Updates a client's information.

**Path Parameters**:
- `id`: Client UUID

**Request Body** (all fields optional):
```json
{
  "name": "Jane Doe",
  "phone": "(11) 88888-8888",
  "notes": "Updated notes"
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Jane Doe",
  "email": "john@example.com",
  "phone": "(11) 88888-8888",
  "taxId": "123.456.789-00",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "notes": "Updated notes",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T11:00:00Z",
  "equipment": []
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Client with specified ID not found

---

### DELETE /clients/:id

Deletes a client.

**Path Parameters**:
- `id`: Client UUID

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "(11) 99999-9999",
  "taxId": "123.456.789-00",
  "address": "Rua Exemplo, 123",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01234-567",
  "notes": "VIP customer",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Client with specified ID not found

---

### GET /clients/count

Returns the count of clients for the authenticated user.

**Response** (200):
```json
{
  "count": 42
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token

---

## Usage Limits

The Clients module enforces plan-based limits on the number of clients a user can create:

| Plan | Client Limit |
|------|--------------|
| Free | 5            |
| Pro  | 50           |
| Team | Unlimited    |

When a user attempts to create a client beyond their plan limit, the API returns:

**Response** (403):
```json
{
  "statusCode": 403,
  "message": "Client limit reached. Your FREE plan allows up to 5 clients. Please upgrade your plan."
}
```

To check current usage:

```bash
GET /plans/usage
```

**Response**:
```json
{
  "plan": "FREE",
  "clients": {
    "current": 5,
    "limit": 5
  },
  "quotes": {
    "current": 3,
    "limit": 10
  },
  // ... other resources
}
```

---

## DTOs

### CreateClientDto

```typescript
{
  name: string;          // Required, not empty
  email?: string;        // Optional, must be valid email
  phone: string;         // Required, pattern: ^[\d\s()+-]+$
  taxId: string;         // Required, pattern: ^[\d.-]+$
  address?: string;      // Optional
  city?: string;         // Optional
  state?: string;        // Optional
  zipCode?: string;      // Optional
  notes?: string;        // Optional
}
```

### UpdateClientDto

All fields are optional (partial of CreateClientDto):

```typescript
{
  name?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
}
```

---

## Service Methods

### `create(userId: string, createClientDto: CreateClientDto)`

Creates a new client for the specified user.

### `findAll(userId: string)`

Returns all clients for the user with equipment and relationship counts, ordered by `createdAt` descending.

### `findOne(userId: string, id: string)`

Returns a single client with full details including related entities. Throws `NotFoundException` if not found.

### `search(userId: string, query: string)`

Searches clients by name (case-insensitive), email (case-insensitive), phone, or taxId. Returns results ordered by name ascending.

### `update(userId: string, id: string, updateClientDto: UpdateClientDto)`

Updates a client. Throws `NotFoundException` if not found.

### `remove(userId: string, id: string)`

Deletes a client. Throws `NotFoundException` if not found.

### `count(userId: string)`

Returns the count of clients for the user.

---

## Testing

### Unit Tests

Run unit tests for the ClientsService:

```bash
pnpm test clients.service.spec.ts
```

**Test Coverage**:
- ✅ create: successful creation
- ✅ findAll: returns all clients with counts
- ✅ findOne: returns single client, throws NotFoundException
- ✅ search: searches across multiple fields
- ✅ update: updates client, throws NotFoundException
- ✅ remove: deletes client, throws NotFoundException
- ✅ count: returns client count

### E2E Integration Tests

Run E2E tests:

```bash
pnpm test:e2e clients.e2e-spec.ts
```

**Test Coverage**:
- ✅ Authentication setup (register + login)
- ✅ POST /clients (create client)
- ✅ GET /clients (list all clients)
- ✅ GET /clients/search (search functionality)
- ✅ GET /clients/:id (get single client)
- ✅ PATCH /clients/:id (update client)
- ✅ DELETE /clients/:id (delete client)
- ✅ GET /clients/count (count clients)
- ✅ Plan limits enforcement (FREE plan limit of 5)

---

## Multi-tenancy

All client operations are automatically scoped to the authenticated user via the `@CurrentUser()` decorator. Users can only access their own clients.

**Security**:
- JWT authentication required for all endpoints
- Client queries always filter by `userId`
- Update and delete operations verify ownership before execution

---

## Database Schema

```prisma
model Client {
  id          String   @id @default(uuid())
  userId      String
  name        String
  email       String?
  phone       String
  address     String?
  city        String?
  state       String?
  zipCode     String?
  taxId       String
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  equipment   Equipment[]
  quotes      Quote[]
  workOrders  WorkOrder[]
  invoices    Invoice[]

  @@index([userId])
  @@map("clients")
}
```

---

## Related Modules

- **AuthModule**: Provides JWT authentication
- **PlansModule**: Provides usage limit enforcement
- **PrismaModule**: Database access

---

## Examples

### Create a client

```bash
curl -X POST http://localhost:3001/clients \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "phone": "(11) 98765-4321",
    "taxId": "987.654.321-00",
    "address": "Av. Paulista, 1000",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01310-100",
    "notes": "Prefers morning appointments"
  }'
```

### List all clients

```bash
curl http://localhost:3001/clients \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Search clients

```bash
curl "http://localhost:3001/clients/search?q=Maria" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Update a client

```bash
curl -X PATCH http://localhost:3001/clients/<client-id> \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "(11) 91234-5678",
    "notes": "Updated contact number"
  }'
```

### Delete a client

```bash
curl -X DELETE http://localhost:3001/clients/<client-id> \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## Next Steps

- Add equipment management endpoints under `/clients/:clientId/equipment`
- Implement client export to CSV/PDF
- Add client activity timeline
- Implement bulk operations (bulk delete, bulk update)
