# Accounts Payable (Contas a Pagar / Despesas)

Este documento descreve o módulo de Contas a Pagar (Despesas) implementado no Auvo Autônomos.

## Visão Geral

O módulo de Contas a Pagar permite que prestadores de serviço autônomos gerenciem suas despesas operacionais, fornecedores e categorias de gastos. Também oferece relatórios de lucro/prejuízo baseados nas receitas das ordens de serviço e cobranças.

## Estrutura do Módulo

### Backend (NestJS)

```
apps/backend/src/
├── expenses/
│   ├── dto/
│   │   ├── create-expense.dto.ts
│   │   ├── update-expense.dto.ts
│   │   ├── expense-filters.dto.ts
│   │   └── mark-as-paid.dto.ts
│   ├── expenses.controller.ts
│   ├── expenses.service.ts
│   ├── expenses.service.spec.ts
│   └── expenses.module.ts
├── expense-categories/
│   ├── dto/
│   │   ├── create-expense-category.dto.ts
│   │   └── update-expense-category.dto.ts
│   ├── expense-categories.controller.ts
│   ├── expense-categories.service.ts
│   ├── expense-categories.service.spec.ts
│   └── expense-categories.module.ts
├── suppliers/
│   ├── dto/
│   │   ├── create-supplier.dto.ts
│   │   └── update-supplier.dto.ts
│   ├── suppliers.controller.ts
│   ├── suppliers.service.ts
│   ├── suppliers.service.spec.ts
│   └── suppliers.module.ts
└── reports/
    └── reports.service.ts  # Relatório Lucro/Prejuízo
```

### Web (Next.js)

```
apps/web/src/
├── app/(dashboard)/
│   ├── expenses/
│   │   ├── page.tsx           # Lista de despesas
│   │   ├── new/page.tsx       # Nova despesa
│   │   └── [id]/page.tsx      # Detalhes da despesa
│   ├── suppliers/
│   │   ├── page.tsx           # Lista de fornecedores
│   │   ├── new/page.tsx       # Novo fornecedor
│   │   └── [id]/page.tsx      # Detalhes do fornecedor
│   └── reports/
│       └── profit-loss/page.tsx  # Relatório Lucro/Prejuízo
├── components/
│   └── expenses/
│       └── expense-form.tsx
├── hooks/
│   └── use-expenses.ts
│   └── use-suppliers.ts
│   └── use-expense-categories.ts
└── services/
    └── expenses.service.ts
```

### Mobile (React Native / Expo)

```
apps/mobile/
├── src/modules/expenses/
│   ├── types.ts              # Tipos e interfaces
│   ├── ExpenseService.ts     # Serviço de API
│   ├── ExpensesListScreen.tsx
│   ├── ExpenseDetailScreen.tsx
│   ├── ExpenseFormScreen.tsx
│   └── index.ts
└── app/despesas/
    ├── _layout.tsx
    ├── index.tsx
    ├── nova.tsx
    ├── [id].tsx
    └── editar/[id].tsx
```

## Schema do Banco de Dados

### Supplier (Fornecedor)

```prisma
model Supplier {
  id        String    @id @default(uuid())
  userId    String
  name      String
  document  String?   // CPF/CNPJ
  email     String?
  phone     String?
  address   String?
  notes     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // Soft delete

  user     User      @relation(...)
  expenses Expense[]

  @@map("suppliers")
}
```

### ExpenseCategory (Categoria de Despesa)

```prisma
model ExpenseCategory {
  id        String   @id @default(uuid())
  userId    String
  name      String
  color     String?  // Cor hex para UI
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(...)
  expenses Expense[]

  @@unique([userId, name])
  @@map("expense_categories")
}
```

### Expense (Despesa)

```prisma
model Expense {
  id            String                @id @default(uuid())
  userId        String
  supplierId    String?
  categoryId    String?
  workOrderId   String?               // Vínculo com OS para cálculo de lucro
  description   String
  notes         String?
  amount        Decimal               @db.Decimal(15, 2)
  dueDate       DateTime
  paidAt        DateTime?
  status        ExpenseStatus         @default(PENDING)
  paymentMethod ExpensePaymentMethod?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt
  deletedAt     DateTime?             // Soft delete

  user      User             @relation(...)
  supplier  Supplier?        @relation(...)
  category  ExpenseCategory? @relation(...)
  workOrder WorkOrder?       @relation(...)

  @@map("expenses")
}

enum ExpenseStatus {
  PENDING
  PAID
  CANCELED
}

enum ExpensePaymentMethod {
  PIX
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  CASH
  BOLETO
  OTHER
}
```

## API Endpoints

### Expenses

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/expenses` | Lista todas as despesas (com filtros) |
| GET | `/expenses/:id` | Busca despesa por ID |
| POST | `/expenses` | Cria nova despesa |
| PATCH | `/expenses/:id` | Atualiza despesa |
| DELETE | `/expenses/:id` | Exclui despesa (soft delete) |
| POST | `/expenses/:id/mark-paid` | Marca como paga |
| GET | `/expenses/summary` | Retorna estatísticas |

### Suppliers

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/suppliers` | Lista todos os fornecedores |
| GET | `/suppliers/:id` | Busca fornecedor por ID |
| POST | `/suppliers` | Cria novo fornecedor |
| PATCH | `/suppliers/:id` | Atualiza fornecedor |
| DELETE | `/suppliers/:id` | Exclui fornecedor (soft delete) |

### Expense Categories

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/expense-categories` | Lista todas as categorias |
| GET | `/expense-categories/:id` | Busca categoria por ID |
| POST | `/expense-categories` | Cria nova categoria |
| PATCH | `/expense-categories/:id` | Atualiza categoria |
| DELETE | `/expense-categories/:id` | Exclui categoria |

### Reports

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/reports/profit-loss` | Relatório de lucro/prejuízo |

## Filtros de Despesas

Os seguintes filtros estão disponíveis no endpoint `GET /expenses`:

- `status`: PENDING, PAID, CANCELED
- `supplierId`: ID do fornecedor
- `categoryId`: ID da categoria
- `workOrderId`: ID da ordem de serviço
- `startDate`: Data inicial (vencimento)
- `endDate`: Data final (vencimento)

## Relatório Lucro/Prejuízo

O relatório de lucro/prejuízo calcula:

### Receitas
- **Ordens de Serviço Concluídas**: Soma do `totalValue` das OS com status DONE
- **Cobranças Recebidas**: Soma das cobranças com status RECEIVED ou CONFIRMED

### Despesas
- **Despesas Pagas**: Soma das despesas com status PAID no período

### Métricas
- **Lucro/Prejuízo Bruto**: Receitas - Despesas
- **Margem de Lucro**: (Lucro / Receitas) × 100

## Feature Flag

O módulo está controlado pela feature flag `EXPENSE_MANAGEMENT`:

```typescript
// Em plan-limits.service.ts
if (featureFlags.includes('EXPENSE_MANAGEMENT')) {
  // Habilita funcionalidades de despesas
}
```

Para habilitar o módulo, adicione `EXPENSE_MANAGEMENT` à lista de features do plano.

## Limites por Plano

Os limites de recursos são controlados por plano:

```typescript
// Recursos limitados
maxSuppliers: number;  // Máximo de fornecedores
maxExpenses: number;   // Máximo de despesas
```

## Testes

Os testes unitários estão localizados em:
- `apps/backend/src/expenses/expenses.service.spec.ts` (18 testes)
- `apps/backend/src/expense-categories/expense-categories.service.spec.ts` (12 testes)
- `apps/backend/src/suppliers/suppliers.service.spec.ts` (13 testes)

Para executar os testes:

```bash
cd apps/backend
npm test -- --testPathPattern="expenses|suppliers|expense-categories"
```

## Uso no Mobile

### Acessando o módulo

O módulo pode ser acessado através do menu lateral (Drawer) na seção "Financeiro" > "Despesas".

### Funcionalidades disponíveis

1. **Listagem de Despesas**
   - Filtros por status (Todas, Pendentes, Vencidas, Pagas, Canceladas)
   - Busca por descrição, fornecedor, categoria
   - Ordenação por vencimento, data de criação, valor
   - Pull to refresh
   - Resumo financeiro (pendente, vencido, pago)

2. **Detalhes da Despesa**
   - Visualização completa
   - Marcar como paga (com seleção de método de pagamento)
   - Cancelar despesa
   - Editar despesa
   - Excluir despesa

3. **Criação/Edição**
   - Campos: descrição, valor, vencimento, fornecedor, categoria, status, forma de pagamento, observações
   - Validação de campos obrigatórios
   - Seleção de fornecedor e categoria via picker

## Considerações de Segurança

1. **Isolamento de Dados**: Todas as operações filtram por `userId` do usuário autenticado
2. **Soft Delete**: Despesas e fornecedores usam soft delete para manter histórico
3. **Validação de Relações**: Verifica se fornecedor/categoria/OS pertencem ao usuário antes de vincular
4. **Rate Limiting**: Limites por plano são verificados na criação de novos registros

## Próximos Passos

1. Adicionar gráficos no relatório de lucro/prejuízo
2. Implementar recorrência de despesas
3. Adicionar anexos às despesas (notas fiscais, comprovantes)
4. Notificações de despesas próximas ao vencimento
5. Integração com bancos para conciliação automática
