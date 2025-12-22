import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  workOrderTypesService,
  WorkOrderType,
  CreateWorkOrderTypeDto,
  UpdateWorkOrderTypeDto,
  WorkOrderTypesFilters,
} from '@/services/work-order-types.service';
import { toast } from 'sonner';

const QUERY_KEY = 'work-order-types';

/**
 * Hook to fetch work order types list
 */
export function useWorkOrderTypes(filters: WorkOrderTypesFilters = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => workOrderTypesService.list(filters),
    staleTime: 30000,
  });
}

/**
 * Hook to fetch active work order types for selection
 */
export function useActiveWorkOrderTypes() {
  return useQuery({
    queryKey: [QUERY_KEY, 'active'],
    queryFn: () => workOrderTypesService.getActiveTypes(),
    staleTime: 60000,
  });
}

/**
 * Hook to fetch a single work order type
 */
export function useWorkOrderType(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => workOrderTypesService.getById(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

/**
 * Hook to create a work order type
 */
export function useCreateWorkOrderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkOrderTypeDto) => workOrderTypesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tipo de OS criado com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar tipo de OS';
      toast.error(message);
    },
  });
}

/**
 * Hook to update a work order type
 */
export function useUpdateWorkOrderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkOrderTypeDto }) =>
      workOrderTypesService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tipo de OS atualizado com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar tipo de OS';
      toast.error(message);
    },
  });
}

/**
 * Hook to deactivate a work order type
 */
export function useDeactivateWorkOrderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workOrderTypesService.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tipo de OS desativado');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao desativar tipo de OS';
      toast.error(message);
    },
  });
}

/**
 * Hook to reactivate a work order type
 */
export function useReactivateWorkOrderType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workOrderTypesService.reactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Tipo de OS reativado');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao reativar tipo de OS';
      toast.error(message);
    },
  });
}
