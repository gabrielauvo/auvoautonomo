/**
 * Hooks para o módulo de Categorias de Despesas
 *
 * React Query hooks para:
 * - Listagem de categorias
 * - Operações CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  expenseCategoriesService,
  ExpenseCategory,
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from '@/services/expense-categories.service';

/**
 * Hook para listar categorias de despesas
 */
export function useExpenseCategories() {
  return useQuery<ExpenseCategory[]>({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoriesService.listExpenseCategories(),
    staleTime: 60000, // 1 minuto (categorias mudam pouco)
  });
}

/**
 * Hook para obter categoria por ID
 */
export function useExpenseCategory(id: string | undefined) {
  return useQuery<ExpenseCategory>({
    queryKey: ['expense-category', id],
    queryFn: () => expenseCategoriesService.getExpenseCategoryById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para criar categoria de despesa
 */
export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseCategoryDto) =>
      expenseCategoriesService.createExpenseCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

/**
 * Hook para atualizar categoria de despesa
 */
export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseCategoryDto }) =>
      expenseCategoriesService.updateExpenseCategory(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-category', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}

/**
 * Hook para deletar categoria de despesa
 */
export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expenseCategoriesService.deleteExpenseCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
    },
  });
}
