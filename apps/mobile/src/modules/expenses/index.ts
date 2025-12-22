/**
 * Expenses Module
 *
 * Módulo de despesas/contas a pagar para o app mobile.
 * Inclui listagem, criação, edição e gerenciamento de fornecedores e categorias.
 */

// Service
export { ExpenseService } from './ExpenseService';

// Screens
export { ExpensesListScreen } from './ExpensesListScreen';
export { ExpenseDetailScreen } from './ExpenseDetailScreen';
export { ExpenseFormScreen } from './ExpenseFormScreen';

// Types
export type {
  Expense,
  ExpenseStatus,
  ExpensePaymentMethod,
  ExpenseFiltersDto,
  ExpenseSummary,
  CreateExpenseDto,
  UpdateExpenseDto,
  MarkAsPaidDto,
  ExpenseSupplier,
  ExpenseCategory,
  ExpenseWorkOrder,
  Supplier,
  CreateSupplierDto,
  UpdateSupplierDto,
  ExpenseCategoryFull,
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './types';

// Helpers
export {
  expenseStatusLabels,
  paymentMethodLabels,
  canEditExpense,
  canCancelExpense,
  canMarkAsPaid,
  isExpensePaid,
  isExpenseOverdue,
} from './types';
