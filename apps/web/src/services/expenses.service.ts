/**
 * Expenses Service - Serviço de Despesas (Contas a Pagar)
 *
 * Gerencia:
 * - CRUD de despesas
 * - Marcação de pagamento
 * - Sumários e estatísticas
 */

import api, { getErrorMessage } from './api';
import { Supplier } from './suppliers.service';
import { ExpenseCategory } from './expense-categories.service';

/**
 * Status de despesa
 */
export type ExpenseStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELED';

/**
 * Método de pagamento da despesa
 */
export type ExpensePaymentMethod =
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'BOLETO'
  | 'OTHER';

/**
 * Tipos de dados da despesa
 */
export interface Expense {
  id: string;
  userId: string;
  supplierId?: string | null;
  categoryId?: string | null;
  workOrderId?: string | null;
  description: string;
  notes?: string | null;
  amount: number;
  dueDate: string;
  paymentDate?: string | null;
  paidAt?: string | null;
  status: ExpenseStatus;
  paymentMethod?: ExpensePaymentMethod | null;
  invoiceNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  // Campo calculado pelo backend
  isOverdue?: boolean;
  // Relações
  supplier?: Pick<Supplier, 'id' | 'name' | 'document'> | null;
  category?: Pick<ExpenseCategory, 'id' | 'name' | 'color'> | null;
  workOrder?: {
    id: string;
    title: string;
  } | null;
}

export interface CreateExpenseDto {
  supplierId?: string;
  categoryId?: string;
  workOrderId?: string;
  description: string;
  notes?: string;
  amount: number;
  dueDate: string;
  status?: ExpenseStatus;
  paymentMethod?: ExpensePaymentMethod;
  paidAt?: string; // Campo correto esperado pelo backend
  invoiceNumber?: string;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {}

export interface ExpenseFilters {
  status?: ExpenseStatus;
  supplierId?: string;
  categoryId?: string;
  workOrderId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ExpenseListResponse {
  data: Expense[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExpenseSummaryItem {
  count: number;
  amount: number;
}

export interface ExpenseSummary {
  total: ExpenseSummaryItem;
  pending: ExpenseSummaryItem;
  paid: ExpenseSummaryItem;
  canceled: ExpenseSummaryItem;
  overdue: ExpenseSummaryItem;
}

export interface MarkAsPaidDto {
  paymentMethod: ExpensePaymentMethod;
  paidAt?: string;
}

/**
 * Obter label do status em português
 */
export function getStatusLabel(status: ExpenseStatus): string {
  const labels: Record<ExpenseStatus, string> = {
    DRAFT: 'Rascunho',
    PENDING: 'Pendente',
    PAID: 'Pago',
    CANCELED: 'Cancelado',
  };
  return labels[status] || status;
}

/**
 * Obter cor do status (retorna nome da cor para Badge variant)
 */
export function getStatusColor(status: ExpenseStatus): 'gray' | 'yellow' | 'green' | 'red' {
  const colors: Record<ExpenseStatus, 'gray' | 'yellow' | 'green' | 'red'> = {
    DRAFT: 'gray',
    PENDING: 'yellow',
    PAID: 'green',
    CANCELED: 'red',
  };
  return colors[status] || 'gray';
}

/**
 * Obter label do método de pagamento em português
 */
export function getPaymentMethodLabel(method: ExpensePaymentMethod): string {
  const labels: Record<ExpensePaymentMethod, string> = {
    PIX: 'PIX',
    CREDIT_CARD: 'Cartão de Crédito',
    DEBIT_CARD: 'Cartão de Débito',
    CASH: 'Dinheiro',
    BANK_TRANSFER: 'Transferência Bancária',
    BOLETO: 'Boleto',
    OTHER: 'Outro',
  };
  return labels[method] || method;
}

/**
 * Listar despesas com filtros
 */
export async function listExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
  try {
    const queryParams: Record<string, string | number> = {};

    if (filters?.status) queryParams.status = filters.status;
    if (filters?.supplierId) queryParams.supplierId = filters.supplierId;
    if (filters?.categoryId) queryParams.categoryId = filters.categoryId;
    if (filters?.workOrderId) queryParams.workOrderId = filters.workOrderId;
    if (filters?.startDate) queryParams.startDate = filters.startDate;
    if (filters?.endDate) queryParams.endDate = filters.endDate;
    if (filters?.page) queryParams.page = filters.page;
    if (filters?.pageSize) queryParams.pageSize = filters.pageSize;

    const response = await api.get<Expense[]>('/expenses', { params: queryParams });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter sumário de despesas
 */
export async function getExpenseSummary(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseSummary> {
  try {
    const queryParams: Record<string, string> = {};
    if (filters?.startDate) queryParams.startDate = filters.startDate;
    if (filters?.endDate) queryParams.endDate = filters.endDate;

    const response = await api.get<ExpenseSummary>('/expenses/summary', { params: queryParams });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter despesa por ID
 */
export async function getExpenseById(id: string): Promise<Expense> {
  try {
    const response = await api.get<Expense>(`/expenses/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar despesa
 */
export async function createExpense(data: CreateExpenseDto): Promise<Expense> {
  try {
    const response = await api.post<Expense>('/expenses', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar despesa
 */
export async function updateExpense(id: string, data: UpdateExpenseDto): Promise<Expense> {
  try {
    const response = await api.patch<Expense>(`/expenses/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Marcar despesa como paga
 */
export async function markExpenseAsPaid(id: string, data: MarkAsPaidDto): Promise<Expense> {
  try {
    const response = await api.patch<Expense>(`/expenses/${id}/pay`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar despesa (soft delete)
 */
export async function deleteExpense(id: string): Promise<void> {
  try {
    await api.delete(`/expenses/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const expensesService = {
  listExpenses,
  getExpenseSummary,
  getExpenseById,
  createExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
  getStatusLabel,
  getStatusColor,
  getPaymentMethodLabel,
};

export default expensesService;
