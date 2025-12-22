/**
 * Expense Categories Service - Serviço de Categorias de Despesas
 *
 * Gerencia:
 * - CRUD de categorias de despesas
 */

import api, { getErrorMessage } from './api';

/**
 * Tipos de dados da categoria de despesa
 */
export interface ExpenseCategory {
  id: string;
  userId: string;
  name: string;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  // Contagens (vêm do backend)
  _count?: {
    expenses: number;
  };
}

export interface CreateExpenseCategoryDto {
  name: string;
  color?: string;
}

export interface UpdateExpenseCategoryDto extends Partial<CreateExpenseCategoryDto> {}

/**
 * Listar todas as categorias de despesas
 */
export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const response = await api.get<ExpenseCategory[]>('/expense-categories');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter categoria por ID
 */
export async function getExpenseCategoryById(id: string): Promise<ExpenseCategory> {
  try {
    const response = await api.get<ExpenseCategory>(`/expense-categories/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar categoria
 */
export async function createExpenseCategory(data: CreateExpenseCategoryDto): Promise<ExpenseCategory> {
  try {
    const response = await api.post<ExpenseCategory>('/expense-categories', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar categoria
 */
export async function updateExpenseCategory(id: string, data: UpdateExpenseCategoryDto): Promise<ExpenseCategory> {
  try {
    const response = await api.patch<ExpenseCategory>(`/expense-categories/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar categoria
 */
export async function deleteExpenseCategory(id: string): Promise<void> {
  try {
    await api.delete(`/expense-categories/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const expenseCategoriesService = {
  listExpenseCategories,
  getExpenseCategoryById,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
};

export default expenseCategoriesService;
