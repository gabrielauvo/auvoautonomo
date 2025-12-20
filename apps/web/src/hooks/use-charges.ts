/**
 * Hooks para o módulo de Cobranças
 *
 * React Query hooks para:
 * - Listagem de cobranças
 * - Detalhes da cobrança
 * - Operações CRUD
 * - Pagamento manual
 * - Cancelamento
 * - Estatísticas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  chargesService,
  Charge,
  ChargeSearchParams,
  ChargeListResponse,
  CreateChargeDto,
  UpdateChargeDto,
  ManualPaymentDto,
  CancelChargeDto,
  ChargeStats,
  ChargeEvent,
} from '@/services/charges.service';

// ============================================
// CHARGES QUERIES
// ============================================

/**
 * Hook para listar cobranças
 */
export function useCharges(params?: ChargeSearchParams) {
  return useQuery<ChargeListResponse>({
    queryKey: ['charges', params],
    queryFn: () => chargesService.listCharges(params),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para obter cobrança por ID
 */
export function useCharge(id: string | undefined) {
  return useQuery<Charge>({
    queryKey: ['charge', id],
    queryFn: () => chargesService.getChargeById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para obter estatísticas de cobranças
 */
export function useChargeStats() {
  return useQuery<ChargeStats>({
    queryKey: ['charges', 'stats'],
    queryFn: () => chargesService.getChargeStats(),
    staleTime: 60000, // 1 minuto
  });
}

/**
 * Hook para listar cobranças de um cliente
 */
export function useClientCharges(
  clientId: string | undefined,
  params?: Omit<ChargeSearchParams, 'clientId'>
) {
  return useQuery<ChargeListResponse>({
    queryKey: ['client', clientId, 'charges', params],
    queryFn: () => chargesService.listClientCharges(clientId!, params),
    enabled: !!clientId,
    staleTime: 30000,
  });
}

/**
 * Hook para obter eventos da cobrança
 */
export function useChargeEvents(chargeId: string | undefined) {
  return useQuery<ChargeEvent[]>({
    queryKey: ['charge', chargeId, 'events'],
    queryFn: () => chargesService.getChargeEvents(chargeId!),
    enabled: !!chargeId,
  });
}

// ============================================
// CHARGES MUTATIONS
// ============================================

/**
 * Hook para criar cobrança
 */
export function useCreateCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateChargeDto) => chargesService.createCharge(data),
    onSuccess: (newCharge) => {
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      queryClient.invalidateQueries({ queryKey: ['charges', 'stats'] });
      // Invalida cobranças do cliente
      if (newCharge.clientId) {
        queryClient.invalidateQueries({
          queryKey: ['client', newCharge.clientId, 'charges'],
        });
      }
    },
  });
}

/**
 * Hook para atualizar cobrança
 */
export function useUpdateCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChargeDto }) =>
      chargesService.updateCharge(id, data),
    onSuccess: (updatedCharge, variables) => {
      queryClient.invalidateQueries({ queryKey: ['charge', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      if (updatedCharge.clientId) {
        queryClient.invalidateQueries({
          queryKey: ['client', updatedCharge.clientId, 'charges'],
        });
      }
    },
  });
}

/**
 * Hook para cancelar cobrança
 */
export function useCancelCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CancelChargeDto }) =>
      chargesService.cancelCharge(id, data),
    onSuccess: (canceledCharge, variables) => {
      queryClient.invalidateQueries({ queryKey: ['charge', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      queryClient.invalidateQueries({ queryKey: ['charges', 'stats'] });
      if (canceledCharge.clientId) {
        queryClient.invalidateQueries({
          queryKey: ['client', canceledCharge.clientId, 'charges'],
        });
      }
    },
  });
}

/**
 * Hook para registrar pagamento manual
 */
export function useRegisterManualPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ManualPaymentDto }) =>
      chargesService.registerManualPayment(id, data),
    onSuccess: (updatedCharge, variables) => {
      queryClient.invalidateQueries({ queryKey: ['charge', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['charge', variables.id, 'events'] });
      queryClient.invalidateQueries({ queryKey: ['charges'] });
      queryClient.invalidateQueries({ queryKey: ['charges', 'stats'] });
      if (updatedCharge.clientId) {
        queryClient.invalidateQueries({
          queryKey: ['client', updatedCharge.clientId, 'charges'],
        });
      }
    },
  });
}

/**
 * Hook para reenviar email da cobrança
 */
export function useResendChargeEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => chargesService.resendChargeEmail(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['charge', id, 'events'] });
    },
  });
}
