# Items Module

## Overview

The Items module manages products and services catalog for field service professionals. It provides CRUD operations for managing items that will be used in quotes and work orders.

## Features

- **CRUD Operations**: Create, Read, Update, Delete items
- **Item Types**: Support for both PRODUCT and SERVICE types
- **Search & Filter**: Search by name/code/description, filter by type and active status
- **Statistics**: Get summary statistics of items by type and status
- **Multi-tenancy**: All items are scoped to the authenticated user
- **Cost Tracking**: Track both selling price (unitPrice) and cost price (costPrice)
- **Inventory Control**: Mark items as active/inactive

## Entity Fields

### Item

```typescript
{
  id: string;              // UUID
  userId: string;          // Owner of the item
  name: string;            // Item name (required)
  description?: string;    // Detailed description
  type: ItemType;          // PRODUCT or SERVICE (default: PRODUCT)
  code?: string;           // Internal code/SKU
  unitPrice: number;       // Selling price (required, >= 0)
  costPrice?: number;      // Cost price (optional, >= 0)
  unit: string;            // Unit of measurement (default: "UN")
  category?: string;       // Item category
  isActive: boolean;       // Active status (default: true)
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last update timestamp
}
```

### ItemType Enum

```typescript
enum ItemType {
  PRODUCT = 'PRODUCT',  // Physical products
  SERVICE = 'SERVICE',  // Services and labor
}
```

## Endpoints

### Authentication

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### POST /items

Creates a new item for the authenticated user.

**Request Body**:
```json
{
  "name": "Serviço de Manutenção",
  "description": "Manutenção preventiva de equipamentos",
  "type": "SERVICE",
  "code": "SRV-001",
  "unitPrice": 150.00,
  "costPrice": 80.00,
  "unit": "hora",
  "category": "Serviços",
  "isActive": true
}
```

**Required Fields**:
- `name`: String (not empty)
- `unitPrice`: Number (>= 0)

**Optional Fields**:
- `description`: String
- `type`: ItemType enum (default: PRODUCT)
- `code`: String
- `costPrice`: Number (>= 0)
- `unit`: String (default: "UN")
- `category`: String
- `isActive`: Boolean (default: true)

**Response** (201):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Serviço de Manutenção",
  "description": "Manutenção preventiva de equipamentos",
  "type": "SERVICE",
  "code": "SRV-001",
  "unitPrice": "150.00",
  "costPrice": "80.00",
  "unit": "hora",
  "category": "Serviços",
  "isActive": true,
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data (validation failed)
- `401 Unauthorized`: Missing or invalid JWT token

---

### GET /items

Returns all items for the authenticated user with optional filters.

**Query Parameters**:
- `type` (optional): Filter by item type (PRODUCT or SERVICE)
- `search` (optional): Search in name, code, or description (case-insensitive)
- `isActive` (optional): Filter by active status (true or false)

**Examples**:
```
GET /items
GET /items?type=SERVICE
GET /items?search=Manut
GET /items?isActive=true
GET /items?type=PRODUCT&search=eletr&isActive=true
```

**Response** (200):
```json
[
  {
    "id": "uuid",
    "userId": "user-uuid",
    "name": "Serviço de Manutenção",
    "description": "Manutenção preventiva",
    "type": "SERVICE",
    "code": "SRV-001",
    "unitPrice": "150.00",
    "costPrice": "80.00",
    "unit": "hora",
    "category": "Serviços",
    "isActive": true,
    "createdAt": "2025-12-09T10:00:00Z",
    "updatedAt": "2025-12-09T10:00:00Z"
  }
]
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token

---

### GET /items/stats

Returns statistics about items for the authenticated user.

**Response** (200):
```json
{
  "total": 25,
  "products": 15,
  "services": 10,
  "active": 23,
  "inactive": 2
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token

---

### GET /items/:id

Returns a single item by ID with usage count.

**Path Parameters**:
- `id`: Item UUID

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Serviço de Manutenção",
  "description": "Manutenção preventiva",
  "type": "SERVICE",
  "code": "SRV-001",
  "unitPrice": "150.00",
  "costPrice": "80.00",
  "unit": "hora",
  "category": "Serviços",
  "isActive": true,
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z",
  "_count": {
    "quoteItems": 5
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Item with specified ID not found

---

### PATCH /items/:id

Updates an item's information.

**Path Parameters**:
- `id`: Item UUID

**Request Body** (all fields optional):
```json
{
  "name": "Serviço de Manutenção Premium",
  "unitPrice": 180.00,
  "isActive": false
}
```

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Serviço de Manutenção Premium",
  "description": "Manutenção preventiva",
  "type": "SERVICE",
  "code": "SRV-001",
  "unitPrice": "180.00",
  "costPrice": "80.00",
  "unit": "hora",
  "category": "Serviços",
  "isActive": false,
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T11:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Item with specified ID not found

---

### DELETE /items/:id

Deletes an item.

**Path Parameters**:
- `id`: Item UUID

**Response** (200):
```json
{
  "id": "uuid",
  "userId": "user-uuid",
  "name": "Serviço de Manutenção",
  "type": "SERVICE",
  "unitPrice": "150.00",
  "createdAt": "2025-12-09T10:00:00Z",
  "updatedAt": "2025-12-09T10:00:00Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Item with specified ID not found

---

## Business Rules

### Item Types

#### PRODUCT
- Physical items sold or installed
- Examples: Air filter, capacitor, circuit board
- Typical units: UN (unit), metro, kg, litro

#### SERVICE
- Labor or service time
- Examples: Installation, maintenance, repair, consulting
- Typical units: hora (hour), diária (day), serviço (service)

### Multi-tenancy

- Items are always scoped to the authenticated user
- A user can only see, edit, or delete their own items
- Items cannot be shared between users

### Pricing

- `unitPrice`: The price charged to the client
  - Must be >= 0
  - Required field
- `costPrice`: The cost to the service provider
  - Must be >= 0 if provided
  - Optional field
  - Used for profit margin calculations

### Active Status

- `isActive: true`: Item is available for use in quotes and work orders
- `isActive: false`: Item is archived but not deleted
- Inactive items can still be queried but are typically hidden in selection lists

### Units of Measurement

Common units for Brazilian field service:
- **Products**: UN (unit), metro, kg, litro, caixa, pacote
- **Services**: hora, diária, serviço, visita, km

---

## Service Methods

### `create(userId: string, createItemDto: CreateItemDto)`

Creates a new item for the specified user.

### `findAll(userId: string, type?: ItemType, search?: string, isActive?: boolean)`

Returns all items for the user with optional filters:
- `type`: Filter by PRODUCT or SERVICE
- `search`: Search in name, code, or description
- `isActive`: Filter by active status

### `findOne(userId: string, id: string)`

Returns a single item with usage count. Throws `NotFoundException` if not found.

### `update(userId: string, id: string, updateItemDto: UpdateItemDto)`

Updates an item. Throws `NotFoundException` if not found.

### `remove(userId: string, id: string)`

Deletes an item. Throws `NotFoundException` if not found.

### `count(userId: string)`

Returns the count of items for the user.

### `getStats(userId: string)`

Returns statistics:
- `total`: Total items
- `products`: Count of PRODUCT type
- `services`: Count of SERVICE type
- `active`: Count of active items
- `inactive`: Count of inactive items

---

## Testing

### Unit Tests

Run unit tests for the ItemsService:

```bash
pnpm test items.service.spec.ts
```

**Test Coverage** (15 tests):
- ✅ create: successful creation
- ✅ findAll: returns all items
- ✅ findAll: filter by type
- ✅ findAll: filter by search query
- ✅ findAll: filter by active status
- ✅ findOne: returns single item with usage count
- ✅ findOne: throws NotFoundException
- ✅ update: updates item
- ✅ update: throws NotFoundException
- ✅ remove: deletes item
- ✅ remove: throws NotFoundException
- ✅ count: returns item count
- ✅ getStats: returns statistics

### E2E Integration Tests

Run E2E tests:

```bash
pnpm test:e2e items.e2e-spec.ts
```

**Test Coverage** (28 tests):
- ✅ Authentication setup (4 tests)
- ✅ POST /items (5 tests)
- ✅ GET /items (7 tests including multi-tenancy)
- ✅ GET /items/stats (2 tests)
- ✅ GET /items/:id (4 tests)
- ✅ PATCH /items/:id (4 tests)
- ✅ DELETE /items/:id (4 tests)

---

## Database Schema

```prisma
enum ItemType {
  PRODUCT
  SERVICE
}

model Item {
  id              String   @id @default(uuid())
  userId          String
  name            String
  description     String?
  type            ItemType @default(PRODUCT)
  code            String?
  unitPrice       Decimal  @db.Decimal(10, 2)
  costPrice       Decimal? @db.Decimal(10, 2)
  unit            String   @default("UN")
  category        String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  quoteItems      QuoteItem[]

  @@index([userId])
  @@index([type])
  @@map("items")
}
```

---

## Related Modules

- **AuthModule**: Provides JWT authentication
- **PrismaModule**: Database access
- **QuotesModule** (future): Will use items in quotes
- **WorkOrdersModule** (future): Will use items in work orders

---

## Usage in Future Modules

This Items module is designed to be used by:

### Quotes Module
When creating a quote, users will:
1. Select client
2. Add items from their catalog
3. Specify quantity for each item
4. Calculate total based on unitPrice × quantity

### Work Orders Module
When creating a work order, users will:
1. Select client and equipment
2. Add items (parts and labor) used
3. Track actual costs vs quoted prices

---

## Examples

### Create a Product

```bash
curl -X POST http://localhost:3001/items \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Capacitor 10uF",
    "description": "Capacitor de partida",
    "type": "PRODUCT",
    "code": "CAP-10UF",
    "unitPrice": 25.00,
    "costPrice": 15.00,
    "unit": "UN",
    "category": "Componentes Eletrônicos"
  }'
```

### Create a Service

```bash
curl -X POST http://localhost:3001/items \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manutenção Preventiva",
    "description": "Serviço de manutenção preventiva completa",
    "type": "SERVICE",
    "code": "SRV-PREV",
    "unitPrice": 180.00,
    "unit": "serviço",
    "category": "Serviços"
  }'
```

### List All Items

```bash
curl http://localhost:3001/items \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Search for Items

```bash
curl "http://localhost:3001/items?search=Capacitor" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Filter by Type

```bash
curl "http://localhost:3001/items?type=SERVICE" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Get Statistics

```bash
curl http://localhost:3001/items/stats \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Update an Item

```bash
curl -X PATCH http://localhost:3001/items/<item-id> \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "unitPrice": 28.00,
    "costPrice": 16.50
  }'
```

### Deactivate an Item

```bash
curl -X PATCH http://localhost:3001/items/<item-id> \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

### Delete an Item

```bash
curl -X DELETE http://localhost:3001/items/<item-id> \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## Security

**Multi-tenancy enforcement**:
- All queries automatically filter by `userId`
- Users cannot access other users' items
- Update and delete operations verify ownership

**Input validation**:
- All DTOs use class-validator decorators
- unitPrice and costPrice must be >= 0
- type must be PRODUCT or SERVICE
- name is required

---

## Migration

After creating or modifying the Item model, run:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

---

## Next Steps

1. Implement QuotesModule to use items in quotes
2. Implement WorkOrdersModule to track items usage
3. Add reporting for profit margins (unitPrice - costPrice)
4. Add item images/attachments
5. Add bulk import/export functionality
