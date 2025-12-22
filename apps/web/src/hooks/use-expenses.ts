/**
 * Hooks para o módulo de Despesas
 *
 * React Query hooks para:
 * - Listagem de despesas
 * - Detalhes da despesa
 * - Operações CRUD
 * - Resumo de despesas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  expensesService,
  Expense,
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilters,
  ExpenseSummary,
  MarkAsPaidDto,
} from '@/services/expenses.service';

/**
 * Hook para listar despesas
 */
export function useExpenses(filters?: ExpenseFilters) {
  return useQuery<Expense[]>({
    queryKey: ['expenses', filters],
    queryFn: () => expensesService.listExpenses(filters),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter despesa por ID
 */
export function useExpense(id: string | undefined) {
  return useQuery<Expense>({
    queryKey: ['expense', id],
    queryFn: () => expensesService.getExpenseById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para obter resumo de despesas
 */
export function useExpenseSummary(filters?: ExpenseFilters) {
  return useQuery<ExpenseSummary>({
    queryKey: ['expenses', 'summary', filters],
    queryFn: () => expensesService.getExpenseSummary(filters),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para criar despesa
 */
export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseDto) => expensesService.createExpense(data),
    onSuccess: () => {
      // Invalida cache da lista de despesas e resumo
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/**
 * Hook para atualizar despesa
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseDto }) =>
      expensesService.updateExpense(id, data),
    onSuccess: (_, variables) => {
      // Invalida cache da despesa específica e da lista
      queryClient.invalidateQueries({ queryKey: ['expense', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/**
 * Hook para marcar despesa como paga
 */
export function useMarkExpenseAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MarkAsPaidDto }) =>
      expensesService.markExpenseAsPaid(id, data),
    onSuccess: (_, variables) => {
      // Invalida cache da despesa específica e da lista
      queryClient.invalidateQueries({ queryKey: ['expense', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

/**
 * Hook para deletar despesa
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesService.deleteExpense(id),
    onSuccess: () => {
      // Invalida cache da lista de despesas
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
