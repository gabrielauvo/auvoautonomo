/**
 * Hooks para o módulo de Fornecedores
 *
 * React Query hooks para:
 * - Listagem de fornecedores
 * - Detalhes do fornecedor
 * - Operações CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  suppliersService,
  Supplier,
  CreateSupplierDto,
  UpdateSupplierDto,
} from '@/services/suppliers.service';

/**
 * Hook para listar fornecedores
 */
export function useSuppliers(search?: string) {
  return useQuery<Supplier[]>({
    queryKey: ['suppliers', { search }],
    queryFn: () => suppliersService.listSuppliers({ search }),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter fornecedor por ID
 */
export function useSupplier(id: string | undefined) {
  return useQuery<Supplier>({
    queryKey: ['supplier', id],
    queryFn: () => suppliersService.getSupplierById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para criar fornecedor
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierDto) => suppliersService.createSupplier(data),
    onSuccess: () => {
      // Invalida cache da lista de fornecedores
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

/**
 * Hook para atualizar fornecedor
 */
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierDto }) =>
      suppliersService.updateSupplier(id, data),
    onSuccess: (_, variables) => {
      // Invalida cache do fornecedor específico e da lista
      queryClient.invalidateQueries({ queryKey: ['supplier', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

/**
 * Hook para deletar fornecedor
 */
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => suppliersService.deleteSupplier(id),
    onSuccess: () => {
      // Invalida cache da lista de fornecedores
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
