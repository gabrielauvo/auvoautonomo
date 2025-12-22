/**
 * Expenses Types - Mobile
 *
 * Tipos alinhados com o backend para despesas/contas a pagar.
 * As despesas são criadas online e cacheadas localmente para visualização.
 */

// ============================================
// ENUMS
// ============================================

/**
 * Status da despesa
 */
export type ExpenseStatus = 'PENDING' | 'PAID' | 'CANCELED';

/**
 * Método de pagamento
 */
export type ExpensePaymentMethod =
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'BOLETO'
  | 'OTHER';

// ============================================
// INTERFACES
// ============================================

/**
 * Fornecedor resumido
 */
export interface ExpenseSupplier {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
}

/**
 * Categoria de despesa
 */
export interface ExpenseCategory {
  id: string;
  name: string;
  color?: string;
}

/**
 * Ordem de serviço vinculada (resumida)
 */
export interface ExpenseWorkOrder {
  id: string;
  title: string;
  status?: string;
  client?: {
    id: string;
    name: string;
  };
}

/**
 * Despesa completa
 */
export interface Expense {
  id: string;
  userId: string;
  supplierId?: string;
  categoryId?: string;
  workOrderId?: string;
  description: string;
  notes?: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  status: ExpenseStatus;
  paymentMethod?: ExpensePaymentMethod;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  // Relações
  supplier?: ExpenseSupplier;
  category?: ExpenseCategory;
  workOrder?: ExpenseWorkOrder;
  // Campo computado
  isOverdue?: boolean;
}

/**
 * Parâmetros de filtro para despesas
 */
export interface ExpenseFiltersDto {
  status?: ExpenseStatus;
  supplierId?: string;
  categoryId?: string;
  workOrderId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * DTO para criar despesa
 */
export interface CreateExpenseDto {
  description: string;
  amount: number;
  dueDate: string;
  supplierId?: string;
  categoryId?: string;
  workOrderId?: string;
  status?: ExpenseStatus;
  paymentMethod?: ExpensePaymentMethod;
  paidAt?: string;
  notes?: string;
}

/**
 * DTO para atualizar despesa
 */
export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {}

/**
 * DTO para marcar como paga
 */
export interface MarkAsPaidDto {
  paymentMethod: ExpensePaymentMethod;
  paidAt?: string;
}

/**
 * Resumo/estatísticas de despesas
 */
export interface ExpenseSummary {
  total: { count: number; amount: number };
  pending: { count: number; amount: number };
  paid: { count: number; amount: number };
  canceled: { count: number; amount: number };
  overdue: { count: number; amount: number };
}

/**
 * Fornecedor completo
 */
export interface Supplier {
  id: string;
  userId: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  _count?: {
    expenses: number;
  };
}

/**
 * DTO para criar fornecedor
 */
export interface CreateSupplierDto {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * DTO para atualizar fornecedor
 */
export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {}

/**
 * Categoria de despesa completa
 */
export interface ExpenseCategoryFull {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    expenses: number;
  };
}

/**
 * DTO para criar categoria
 */
export interface CreateExpenseCategoryDto {
  name: string;
  color?: string;
}

/**
 * DTO para atualizar categoria
 */
export interface UpdateExpenseCategoryDto extends Partial<CreateExpenseCategoryDto> {}

// ============================================
// HELPERS
// ============================================

/**
 * Labels de status
 */
export const expenseStatusLabels: Record<ExpenseStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  CANCELED: 'Cancelada',
};

/**
 * Labels de método de pagamento
 */
export const paymentMethodLabels: Record<ExpensePaymentMethod, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  BANK_TRANSFER: 'Transferência Bancária',
  CASH: 'Dinheiro',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
};

/**
 * Verificar se pode editar a despesa
 */
export function canEditExpense(expense: Expense): boolean {
  return expense.status !== 'CANCELED';
}

/**
 * Verificar se pode cancelar a despesa
 */
export function canCancelExpense(expense: Expense): boolean {
  return expense.status === 'PENDING';
}

/**
 * Verificar se pode marcar como paga
 */
export function canMarkAsPaid(expense: Expense): boolean {
  return expense.status === 'PENDING';
}

/**
 * Verificar se a despesa está paga
 */
export function isExpensePaid(expense: Expense): boolean {
  return expense.status === 'PAID';
}

/**
 * Verificar se a despesa está vencida
 */
export function isExpenseOverdue(expense: Expense): boolean {
  if (expense.status !== 'PENDING') return false;
  const dueDate = new Date(expense.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}
