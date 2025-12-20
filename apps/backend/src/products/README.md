# Products Module - Catálogo de Produtos e Serviços

## Visão Geral

O módulo Products implementa um catálogo completo de produtos, serviços e pacotes (bundles) para prestadores de serviço autônomos.

## Estrutura de Dados

### ProductCategory
Categorias para organizar itens do catálogo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| userId | UUID | Proprietário da categoria |
| name | String | Nome da categoria |
| description | String? | Descrição opcional |
| color | String? | Cor para UI (hex) |
| isActive | Boolean | Status ativo/inativo |

### Item (ProductServiceItem)
Produtos, serviços ou pacotes no catálogo.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| userId | UUID | Proprietário do item |
| categoryId | UUID? | Categoria (opcional) |
| name | String | Nome do item |
| description | String? | Descrição |
| type | ItemType | PRODUCT, SERVICE, BUNDLE |
| sku | String? | Código SKU |
| unit | String | Unidade (UN, hora, m², etc) |
| basePrice | Decimal | Preço base de venda |
| costPrice | Decimal? | Preço de custo |
| defaultDurationMinutes | Int? | Duração padrão (serviços) |
| isActive | Boolean | Status ativo/inativo |

### BundleItem
Itens que compõem um bundle/pacote.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| userId | UUID | Proprietário |
| bundleId | UUID | Bundle pai |
| itemId | UUID | Item filho |
| quantity | Decimal | Quantidade no pacote |

## Endpoints da API

### Categorias

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /products/categories | Criar categoria |
| GET | /products/categories | Listar categorias |
| GET | /products/categories/:id | Buscar categoria |
| PUT | /products/categories/:id | Atualizar categoria |
| DELETE | /products/categories/:id | Remover categoria |

### Itens (Produtos/Serviços/Bundles)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /products/items | Criar item |
| GET | /products/items | Listar itens |
| GET | /products/items/:id | Buscar item |
| PUT | /products/items/:id | Atualizar item |
| DELETE | /products/items/:id | Remover item |

**Query Parameters para listagem:**
- `type`: PRODUCT, SERVICE, BUNDLE
- `categoryId`: Filtrar por categoria
- `search`: Busca por nome, SKU ou descrição
- `isActive`: true/false

### Bundle Items

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | /products/items/:id/bundle-items | Adicionar item ao bundle |
| GET | /products/items/:id/bundle-items | Listar itens do bundle |
| DELETE | /products/bundle-items/:bundleItemId | Remover item do bundle |

### Estatísticas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | /products/stats | Estatísticas do catálogo |

## Integração com Orçamentos (Quotes)

O módulo de orçamentos foi atualizado para suportar dois modos de adição de itens:

### Modo 1: Do Catálogo (Snapshot)
```json
POST /quotes/:id/items
{
  "itemId": "uuid-do-item",
  "quantity": 2,
  "unitPrice": 150.00  // Opcional: override do preço
}
```

Quando um item do catálogo é adicionado:
- Os dados são **copiados** (snapshot) para o orçamento
- Alterações futuras no catálogo **não afetam** orçamentos existentes
- O campo `itemId` mantém a referência ao item original

### Modo 2: Item Manual
```json
POST /quotes/:id/items
{
  "name": "Serviço Especial",
  "type": "SERVICE",
  "unit": "hora",
  "quantity": 4,
  "unitPrice": 200.00,
  "discountValue": 50.00
}
```

Para itens que não estão no catálogo, os dados são fornecidos diretamente.

## Integração com Ordens de Serviço (Work Orders)

### Criação a partir de Orçamento
Quando uma OS é criada a partir de um orçamento aprovado:
1. Todos os itens do orçamento são copiados automaticamente
2. O campo `quoteItemId` mantém a referência ao item do orçamento
3. O `totalValue` da OS é calculado automaticamente

### Gerenciamento de Itens
```
POST   /work-orders/:id/items     - Adicionar item
PUT    /work-orders/:id/items/:id - Atualizar quantidade
DELETE /work-orders/:id/items/:id - Remover item
```

## Padrão Snapshot

O sistema implementa o padrão de snapshot para garantir integridade histórica:

1. **QuoteItem**: Copia `name`, `type`, `unit`, `unitPrice` do catálogo
2. **WorkOrderItem**: Copia os mesmos campos, seja do catálogo ou do orçamento

Isso garante que:
- Alterações de preço no catálogo não afetam documentos existentes
- O histórico de orçamentos e OS permanece preciso
- Relatórios refletem os valores exatos no momento da criação

## Regras de Negócio

### Deleção de Itens
- Itens sem uso: **hard delete** (remoção completa)
- Itens com orçamentos ou OS: **soft delete** (isActive = false)

### Bundles
- Bundles não podem conter outros bundles (evita recursão)
- Um bundle não pode conter a si mesmo
- Preço do bundle é calculado automaticamente pela soma dos itens

### Categorias
- Categorias com itens não podem ser deletadas
- Devem ser desativadas ou ter os itens movidos primeiro

## Exemplos de Uso

### Criar Categoria
```bash
curl -X POST /products/categories \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "Manutenção", "color": "#3498db"}'
```

### Criar Produto
```bash
curl -X POST /products/items \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Filtro de Ar-Condicionado",
    "type": "PRODUCT",
    "unit": "UN",
    "basePrice": 45.90,
    "costPrice": 22.00,
    "categoryId": "uuid-categoria",
    "sku": "FLT-001"
  }'
```

### Criar Serviço
```bash
curl -X POST /products/items \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Limpeza de Ar-Condicionado",
    "type": "SERVICE",
    "unit": "hora",
    "basePrice": 120.00,
    "defaultDurationMinutes": 60,
    "categoryId": "uuid-categoria"
  }'
```

### Criar Bundle
```bash
# 1. Criar o bundle
curl -X POST /products/items \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Pacote Manutenção Completa",
    "type": "BUNDLE",
    "unit": "UN",
    "basePrice": 250.00
  }'

# 2. Adicionar itens ao bundle
curl -X POST /products/items/BUNDLE_ID/bundle-items \
  -H "Authorization: Bearer TOKEN" \
  -d '{"itemId": "uuid-filtro", "quantity": 2}'

curl -X POST /products/items/BUNDLE_ID/bundle-items \
  -H "Authorization: Bearer TOKEN" \
  -d '{"itemId": "uuid-servico", "quantity": 1}'
```

## Testes

```bash
# Executar testes do módulo
npm test -- --testPathPattern=products

# Executar com cobertura
npm test -- --testPathPattern=products --coverage
```

## Migrations

O módulo requer as seguintes tabelas:
- `product_categories`
- `items` (estendido com novos campos)
- `bundle_items`
- `quote_items` (atualizado com snapshot fields)
- `work_order_items` (nova tabela)

Execute as migrations:
```bash
npx prisma migrate dev
```
