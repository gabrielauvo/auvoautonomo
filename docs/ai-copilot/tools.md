# AI Copilot - Tool Contracts

Este documento define os contratos de todas as ferramentas disponíveis para o AI Copilot.

## Sumário

- [Convenções](#convenções)
- [Autenticação e Autorização](#autenticação-e-autorização)
- [Tools de Leitura (READ)](#tools-de-leitura-read)
- [Tools de Escrita (WRITE)](#tools-de-escrita-write)
- [Códigos de Erro](#códigos-de-erro)

---

## Convenções

### Nomenclatura
- Tools seguem o padrão `{domain}.{action}` (ex: `customers.search`, `billing.createCharge`)
- Parâmetros em camelCase
- IDs são sempre UUIDs v4

### Resposta Padrão
Todas as tools retornam o seguinte formato:

```typescript
interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  affectedEntities?: AffectedEntity[];
}

interface AffectedEntity {
  type: 'customer' | 'workOrder' | 'quote' | 'charge' | 'payment';
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'read';
}
```

### Idempotência
- Todas as tools de escrita (WRITE) **REQUEREM** um `idempotencyKey`
- O sistema garante que a mesma operação não será executada duas vezes
- Keys expiram após 24 horas

---

## Autenticação e Autorização

### Permissões por Tool

| Tool | Permissão Requerida | Plano Mínimo |
|------|---------------------|--------------|
| `customers.*` | `customers:read` / `customers:write` | FREE |
| `workOrders.*` | `workOrders:read` / `workOrders:write` | STARTER |
| `quotes.*` | `quotes:read` / `quotes:write` | STARTER |
| `billing.*` | `billing:read` / `billing:write` | PROFESSIONAL |
| `kb.search` | `kb:read` | FREE |

### Multi-Tenancy
- Todas as operações são automaticamente filtradas pelo `userId` do contexto
- Não é possível acessar dados de outros usuários

---

## Tools de Leitura (READ)

### customers.search

Busca clientes por nome, email ou telefone.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `customers.search` |
| **Description** | Busca clientes por termo de pesquisa |
| **Permission** | `customers:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 2,
      "maxLength": 100,
      "description": "Termo de busca (nome, email ou telefone)"
    },
    "hasOverduePayments": {
      "type": "boolean",
      "description": "Filtrar apenas clientes inadimplentes"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    }
  },
  "required": ["query"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "name": { "type": "string" },
          "email": { "type": ["string", "null"] },
          "phone": { "type": ["string", "null"] },
          "city": { "type": ["string", "null"] },
          "isDelinquent": { "type": "boolean" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      }
    },
    "total": { "type": "integer" },
    "hasMore": { "type": "boolean" }
  }
}
```

---

### customers.get

Obtém detalhes completos de um cliente.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `customers.get` |
| **Description** | Obtém detalhes de um cliente específico |
| **Permission** | `customers:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "ID do cliente"
    },
    "includePayments": {
      "type": "boolean",
      "default": false,
      "description": "Incluir histórico de pagamentos"
    },
    "includeWorkOrders": {
      "type": "boolean",
      "default": false,
      "description": "Incluir ordens de serviço"
    },
    "includeQuotes": {
      "type": "boolean",
      "default": false,
      "description": "Incluir orçamentos"
    }
  },
  "required": ["id"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "phone": { "type": ["string", "null"] },
    "taxId": { "type": ["string", "null"] },
    "address": { "type": ["string", "null"] },
    "city": { "type": ["string", "null"] },
    "state": { "type": ["string", "null"] },
    "zipCode": { "type": ["string", "null"] },
    "notes": { "type": ["string", "null"] },
    "isDelinquent": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
    "payments": {
      "type": "array",
      "description": "Presente apenas se includePayments=true"
    },
    "workOrders": {
      "type": "array",
      "description": "Presente apenas se includeWorkOrders=true"
    },
    "quotes": {
      "type": "array",
      "description": "Presente apenas se includeQuotes=true"
    }
  }
}
```

---

### workOrders.get

Obtém detalhes de uma ordem de serviço.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `workOrders.get` |
| **Description** | Obtém detalhes de uma ordem de serviço |
| **Permission** | `workOrders:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "ID da ordem de serviço"
    }
  },
  "required": ["id"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "description": { "type": ["string", "null"] },
    "status": {
      "type": "string",
      "enum": ["PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
    },
    "scheduledDate": { "type": ["string", "null"], "format": "date-time" },
    "completedAt": { "type": ["string", "null"], "format": "date-time" },
    "totalValue": { "type": "number" },
    "customer": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "quantity": { "type": "number" },
          "unitPrice": { "type": "number" },
          "total": { "type": "number" }
        }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### workOrders.search

Busca ordens de serviço com filtros.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `workOrders.search` |
| **Description** | Busca ordens de serviço com filtros |
| **Permission** | `workOrders:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "format": "uuid",
      "description": "Filtrar por cliente"
    },
    "status": {
      "type": "string",
      "enum": ["PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
    },
    "scheduledDateFrom": {
      "type": "string",
      "format": "date",
      "description": "Data de agendamento inicial"
    },
    "scheduledDateTo": {
      "type": "string",
      "format": "date",
      "description": "Data de agendamento final"
    },
    "query": {
      "type": "string",
      "description": "Busca por título ou descrição"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    }
  }
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "workOrders": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "title": { "type": "string" },
          "status": { "type": "string" },
          "scheduledDate": { "type": ["string", "null"] },
          "totalValue": { "type": "number" },
          "customerName": { "type": "string" }
        }
      }
    },
    "total": { "type": "integer" },
    "hasMore": { "type": "boolean" }
  }
}
```

---

### quotes.get

Obtém detalhes de um orçamento.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `quotes.get` |
| **Description** | Obtém detalhes de um orçamento |
| **Permission** | `quotes:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "ID do orçamento"
    }
  },
  "required": ["id"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "description": { "type": ["string", "null"] },
    "status": {
      "type": "string",
      "enum": ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"]
    },
    "totalValue": { "type": "number" },
    "validUntil": { "type": ["string", "null"], "format": "date" },
    "customer": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "description": { "type": ["string", "null"] },
          "quantity": { "type": "number" },
          "unitPrice": { "type": "number" },
          "total": { "type": "number" }
        }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### quotes.search

Busca orçamentos com filtros.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `quotes.search` |
| **Description** | Busca orçamentos com filtros |
| **Permission** | `quotes:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "format": "uuid"
    },
    "status": {
      "type": "string",
      "enum": ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"]
    },
    "query": {
      "type": "string",
      "description": "Busca por título"
    },
    "createdFrom": {
      "type": "string",
      "format": "date"
    },
    "createdTo": {
      "type": "string",
      "format": "date"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    }
  }
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "quotes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "title": { "type": "string" },
          "status": { "type": "string" },
          "totalValue": { "type": "number" },
          "customerName": { "type": "string" },
          "createdAt": { "type": "string", "format": "date-time" }
        }
      }
    },
    "total": { "type": "integer" },
    "hasMore": { "type": "boolean" }
  }
}
```

---

### billing.getCharge

Obtém detalhes de uma cobrança.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `billing.getCharge` |
| **Description** | Obtém detalhes de uma cobrança específica |
| **Permission** | `billing:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "ID da cobrança"
    }
  },
  "required": ["id"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "externalId": { "type": ["string", "null"], "description": "ID no gateway (Asaas)" },
    "status": {
      "type": "string",
      "enum": ["PENDING", "CONFIRMED", "RECEIVED", "OVERDUE", "REFUNDED", "CANCELLED"]
    },
    "billingType": {
      "type": "string",
      "enum": ["PIX", "BOLETO", "CREDIT_CARD"]
    },
    "value": { "type": "number" },
    "netValue": { "type": ["number", "null"] },
    "dueDate": { "type": "string", "format": "date" },
    "paymentDate": { "type": ["string", "null"], "format": "date" },
    "description": { "type": ["string", "null"] },
    "invoiceUrl": { "type": ["string", "null"] },
    "pixQrCode": { "type": ["string", "null"] },
    "boletoBarCode": { "type": ["string", "null"] },
    "customer": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### billing.searchCharges

Busca cobranças com filtros.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `billing.searchCharges` |
| **Description** | Busca cobranças com filtros |
| **Permission** | `billing:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "format": "uuid"
    },
    "status": {
      "type": "string",
      "enum": ["PENDING", "CONFIRMED", "RECEIVED", "OVERDUE", "REFUNDED", "CANCELLED"]
    },
    "billingType": {
      "type": "string",
      "enum": ["PIX", "BOLETO", "CREDIT_CARD"]
    },
    "dueDateFrom": {
      "type": "string",
      "format": "date"
    },
    "dueDateTo": {
      "type": "string",
      "format": "date"
    },
    "overdueOnly": {
      "type": "boolean",
      "default": false
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100,
      "default": 20
    },
    "offset": {
      "type": "integer",
      "minimum": 0,
      "default": 0
    }
  }
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "charges": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "status": { "type": "string" },
          "billingType": { "type": "string" },
          "value": { "type": "number" },
          "dueDate": { "type": "string", "format": "date" },
          "customerName": { "type": "string" },
          "isOverdue": { "type": "boolean" }
        }
      }
    },
    "total": { "type": "integer" },
    "totalValue": { "type": "number" },
    "hasMore": { "type": "boolean" }
  }
}
```

---

### kb.search

Busca na base de conhecimento (RAG).

| Propriedade | Valor |
|-------------|-------|
| **Name** | `kb.search` |
| **Description** | Busca semântica na base de conhecimento |
| **Permission** | `kb:read` |
| **Side Effects** | none |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "minLength": 3,
      "maxLength": 500,
      "description": "Pergunta ou termo de busca"
    },
    "category": {
      "type": "string",
      "enum": ["general", "billing", "workOrders", "quotes", "customers"],
      "description": "Categoria para filtrar resultados"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 5
    }
  },
  "required": ["query"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "content": { "type": "string" },
          "source": { "type": "string" },
          "relevanceScore": { "type": "number", "minimum": 0, "maximum": 1 },
          "category": { "type": "string" }
        }
      }
    },
    "totalResults": { "type": "integer" }
  }
}
```

---

## Tools de Escrita (WRITE)

> **IMPORTANTE**: Todas as tools de escrita requerem `idempotencyKey` e passam pelo fluxo PLAN → CONFIRM → EXECUTE.

### customers.create

Cria um novo cliente.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `customers.create` |
| **Description** | Cria um novo cliente |
| **Permission** | `customers:write` |
| **Side Effects** | write |
| **Idempotent** | true (com idempotencyKey) |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 10,
      "maxLength": 64,
      "description": "Chave de idempotência para evitar duplicatas"
    },
    "name": {
      "type": "string",
      "minLength": 2,
      "maxLength": 200
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "phone": {
      "type": "string",
      "pattern": "^[0-9]{10,11}$",
      "description": "Telefone (apenas números, DDD + número)"
    },
    "taxId": {
      "type": "string",
      "description": "CPF ou CNPJ (apenas números)"
    },
    "address": {
      "type": "string",
      "maxLength": 500
    },
    "city": {
      "type": "string",
      "maxLength": 100
    },
    "state": {
      "type": "string",
      "maxLength": 2,
      "description": "UF (2 letras)"
    },
    "zipCode": {
      "type": "string",
      "pattern": "^[0-9]{8}$"
    },
    "notes": {
      "type": "string",
      "maxLength": 2000
    }
  },
  "required": ["idempotencyKey", "name"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "email": { "type": ["string", "null"] },
    "phone": { "type": ["string", "null"] },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### workOrders.create

Cria uma nova ordem de serviço.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `workOrders.create` |
| **Description** | Cria uma nova ordem de serviço |
| **Permission** | `workOrders:write` |
| **Side Effects** | write |
| **Idempotent** | true (com idempotencyKey) |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 10,
      "maxLength": 64
    },
    "customerId": {
      "type": "string",
      "format": "uuid"
    },
    "title": {
      "type": "string",
      "minLength": 3,
      "maxLength": 200
    },
    "description": {
      "type": "string",
      "maxLength": 5000
    },
    "scheduledDate": {
      "type": "string",
      "format": "date-time"
    },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "quantity": { "type": "number", "minimum": 0.01 },
          "unitPrice": { "type": "number", "minimum": 0 },
          "type": { "type": "string", "enum": ["PRODUCT", "SERVICE"] }
        },
        "required": ["name", "quantity", "unitPrice"]
      }
    }
  },
  "required": ["idempotencyKey", "customerId", "title", "items"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "status": { "type": "string" },
    "totalValue": { "type": "number" },
    "customerName": { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### quotes.create

Cria um novo orçamento.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `quotes.create` |
| **Description** | Cria um novo orçamento |
| **Permission** | `quotes:write` |
| **Side Effects** | write |
| **Idempotent** | true (com idempotencyKey) |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 10,
      "maxLength": 64
    },
    "customerId": {
      "type": "string",
      "format": "uuid"
    },
    "title": {
      "type": "string",
      "minLength": 3,
      "maxLength": 200
    },
    "description": {
      "type": "string",
      "maxLength": 5000
    },
    "validUntil": {
      "type": "string",
      "format": "date",
      "description": "Data de validade do orçamento"
    },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "description": { "type": "string" },
          "quantity": { "type": "number", "minimum": 0.01 },
          "unitPrice": { "type": "number", "minimum": 0 },
          "type": { "type": "string", "enum": ["PRODUCT", "SERVICE"] }
        },
        "required": ["name", "quantity", "unitPrice"]
      }
    }
  },
  "required": ["idempotencyKey", "customerId", "title", "items"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "status": { "type": "string" },
    "totalValue": { "type": "number" },
    "customerName": { "type": "string" },
    "validUntil": { "type": ["string", "null"] },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

### billing.previewCharge

Cria uma prévia de cobrança (dry-run). **OBRIGATÓRIO** antes de `billing.createCharge`.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `billing.previewCharge` |
| **Description** | Cria prévia de cobrança sem executar no gateway |
| **Permission** | `billing:read` |
| **Side Effects** | none (apenas validação) |
| **Idempotent** | true |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "customerId": {
      "type": "string",
      "format": "uuid"
    },
    "value": {
      "type": "number",
      "minimum": 5,
      "maximum": 100000,
      "description": "Valor em reais (mínimo R$ 5,00)"
    },
    "billingType": {
      "type": "string",
      "enum": ["PIX", "BOLETO", "CREDIT_CARD"]
    },
    "dueDate": {
      "type": "string",
      "format": "date",
      "description": "Data de vencimento"
    },
    "description": {
      "type": "string",
      "maxLength": 500
    }
  },
  "required": ["customerId", "value", "billingType", "dueDate"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "previewId": {
      "type": "string",
      "format": "uuid",
      "description": "ID da prévia para usar em createCharge"
    },
    "valid": { "type": "boolean" },
    "preview": {
      "type": "object",
      "properties": {
        "customerId": { "type": "string" },
        "customerName": { "type": "string" },
        "billingType": { "type": "string" },
        "value": { "type": "number" },
        "dueDate": { "type": "string" },
        "description": { "type": ["string", "null"] }
      }
    },
    "warnings": {
      "type": "array",
      "items": { "type": "string" }
    },
    "errors": {
      "type": "array",
      "items": { "type": "string" }
    },
    "customerHasPaymentProfile": { "type": "boolean" },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "description": "Prévia expira em 5 minutos"
    }
  }
}
```

---

### billing.createCharge

Cria uma cobrança real no gateway de pagamentos. **REQUER** `previewId` de `billing.previewCharge`.

| Propriedade | Valor |
|-------------|-------|
| **Name** | `billing.createCharge` |
| **Description** | Cria cobrança no gateway de pagamentos |
| **Permission** | `billing:write` |
| **Side Effects** | write (cria cobrança no Asaas) |
| **Idempotent** | true (com idempotencyKey) |

#### Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "idempotencyKey": {
      "type": "string",
      "minLength": 10,
      "maxLength": 64
    },
    "previewId": {
      "type": "string",
      "format": "uuid",
      "description": "ID retornado por billing.previewCharge"
    }
  },
  "required": ["idempotencyKey", "previewId"]
}
```

#### Output Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "externalId": { "type": "string", "description": "ID no Asaas" },
    "status": { "type": "string" },
    "billingType": { "type": "string" },
    "value": { "type": "number" },
    "dueDate": { "type": "string", "format": "date" },
    "invoiceUrl": { "type": "string" },
    "pixQrCode": { "type": ["string", "null"] },
    "boletoBarCode": { "type": ["string", "null"] },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `TOOL_NOT_FOUND` | Tool não existe |
| `PERMISSION_DENIED` | Usuário não tem permissão para esta tool |
| `VALIDATION_ERROR` | Parâmetros inválidos |
| `ENTITY_NOT_FOUND` | Entidade não encontrada |
| `ENTITY_NOT_OWNED` | Entidade pertence a outro usuário |
| `PLAN_LIMIT_EXCEEDED` | Limite do plano excedido |
| `IDEMPOTENCY_CONFLICT` | Operação já executada com esta chave |
| `PREVIEW_EXPIRED` | Prévia de pagamento expirou |
| `PREVIEW_REQUIRED` | Prévia obrigatória não fornecida |
| `GATEWAY_ERROR` | Erro no gateway de pagamentos |
| `RATE_LIMIT_EXCEEDED` | Muitas requisições |
| `INTERNAL_ERROR` | Erro interno do servidor |

---

## Changelog

| Data | Versão | Alterações |
|------|--------|------------|
| 2024-12-26 | 1.0.0 | Versão inicial com tools READ e WRITE |
