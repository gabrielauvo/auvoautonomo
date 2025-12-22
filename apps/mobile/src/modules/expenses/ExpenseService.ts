/**
 * Expense Service - Mobile
 *
 * Serviço para comunicação com a API de Despesas.
 * Gerencia despesas, fornecedores e categorias.
 *
 * Features:
 * - CRUD de despesas
 * - Marcar como paga
 * - Filtros por status, fornecedor, categoria, data
 * - Estatísticas/resumo
 * - CRUD de fornecedores
 * - CRUD de categorias
 */

import { fetchWithTimeout } from '../../utils/fetch-with-timeout';
import { AuthService } from '../../services/AuthService';
import { getApiBaseUrl } from '../../config/api';
import type {
  Expense,
  ExpenseFiltersDto,
  ExpenseSummary,
  CreateExpenseDto,
  UpdateExpenseDto,
  MarkAsPaidDto,
  Supplier,
  CreateSupplierDto,
  UpdateSupplierDto,
  ExpenseCategoryFull,
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './types';

// ============================================
// HELPERS
// ============================================

/**
 * Get headers with authentication
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Build URL with query params
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ============================================
// EXPENSES API
// ============================================

/**
 * Listar despesas
 */
export async function listExpenses(filters?: ExpenseFiltersDto): Promise<Expense[]> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/expenses', filters as Record<string, string | number | undefined>);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<Expense[]>(response);
}

/**
 * Obter despesa por ID
 */
export async function getExpenseById(id: string): Promise<Expense> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expenses/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<Expense>(response);
}

/**
 * Criar despesa
 */
export async function createExpense(data: CreateExpenseDto): Promise<Expense> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/expenses');

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Expense>(response);
}

/**
 * Atualizar despesa
 */
export async function updateExpense(id: string, data: UpdateExpenseDto): Promise<Expense> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expenses/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Expense>(response);
}

/**
 * Excluir despesa (soft delete)
 */
export async function deleteExpense(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expenses/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers,
    timeout: 30000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Marcar despesa como paga
 */
export async function markExpenseAsPaid(id: string, data: MarkAsPaidDto): Promise<Expense> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expenses/${id}/mark-paid`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Expense>(response);
}

/**
 * Obter resumo/estatísticas de despesas
 */
export async function getExpenseSummary(filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseSummary> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/expenses/summary', filters);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<ExpenseSummary>(response);
}

// ============================================
// SUPPLIERS API
// ============================================

/**
 * Listar fornecedores
 */
export async function listSuppliers(search?: string): Promise<Supplier[]> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/suppliers', search ? { search } : undefined);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<Supplier[]>(response);
}

/**
 * Obter fornecedor por ID
 */
export async function getSupplierById(id: string): Promise<Supplier> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/suppliers/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<Supplier>(response);
}

/**
 * Criar fornecedor
 */
export async function createSupplier(data: CreateSupplierDto): Promise<Supplier> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/suppliers');

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Supplier>(response);
}

/**
 * Atualizar fornecedor
 */
export async function updateSupplier(id: string, data: UpdateSupplierDto): Promise<Supplier> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/suppliers/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Supplier>(response);
}

/**
 * Excluir fornecedor (soft delete)
 */
export async function deleteSupplier(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/suppliers/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers,
    timeout: 30000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
}

// ============================================
// EXPENSE CATEGORIES API
// ============================================

/**
 * Listar categorias de despesa
 */
export async function listExpenseCategories(): Promise<ExpenseCategoryFull[]> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/expense-categories');

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<ExpenseCategoryFull[]>(response);
}

/**
 * Obter categoria por ID
 */
export async function getExpenseCategoryById(id: string): Promise<ExpenseCategoryFull> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expense-categories/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<ExpenseCategoryFull>(response);
}

/**
 * Criar categoria
 */
export async function createExpenseCategory(
  data: CreateExpenseCategoryDto
): Promise<ExpenseCategoryFull> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/expense-categories');

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<ExpenseCategoryFull>(response);
}

/**
 * Atualizar categoria
 */
export async function updateExpenseCategory(
  id: string,
  data: UpdateExpenseCategoryDto
): Promise<ExpenseCategoryFull> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expense-categories/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<ExpenseCategoryFull>(response);
}

/**
 * Excluir categoria
 */
export async function deleteExpenseCategory(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/expense-categories/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'DELETE',
    headers,
    timeout: 30000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
}

// ============================================
// EXPORT SERVICE OBJECT
// ============================================

export const ExpenseService = {
  // Expenses
  listExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  markExpenseAsPaid,
  getExpenseSummary,
  // Suppliers
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Categories
  listExpenseCategories,
  getExpenseCategoryById,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
};

export default ExpenseService;
