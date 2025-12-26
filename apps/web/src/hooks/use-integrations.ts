import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  integrationsService,
  ConnectAsaasDto,
  ConnectStripeDto,
  ConnectMercadoPagoDto,
} from '@/services/integrations.service';

export const INTEGRATIONS_QUERY_KEY = 'integrations';
export const ASAAS_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'asaas', 'status'];
export const STRIPE_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'stripe', 'status'];
export const MERCADOPAGO_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'mercadopago', 'status'];

// ============================================
// ASAAS
// ============================================

export function useAsaasStatus() {
  return useQuery({
    queryKey: ASAAS_STATUS_QUERY_KEY,
    queryFn: () => integrationsService.getAsaasStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useConnectAsaas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConnectAsaasDto) => integrationsService.connectAsaas(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASAAS_STATUS_QUERY_KEY });
    },
  });
}

export function useDisconnectAsaas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectAsaas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASAAS_STATUS_QUERY_KEY });
    },
  });
}

// ============================================
// STRIPE
// ============================================

export function useStripeStatus() {
  return useQuery({
    queryKey: STRIPE_STATUS_QUERY_KEY,
    queryFn: () => integrationsService.getStripeStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useConnectStripe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConnectStripeDto) => integrationsService.connectStripe(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STRIPE_STATUS_QUERY_KEY });
    },
  });
}

export function useDisconnectStripe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectStripe(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STRIPE_STATUS_QUERY_KEY });
    },
  });
}

// ============================================
// MERCADO PAGO
// ============================================

export function useMercadoPagoStatus() {
  return useQuery({
    queryKey: MERCADOPAGO_STATUS_QUERY_KEY,
    queryFn: () => integrationsService.getMercadoPagoStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useConnectMercadoPago() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConnectMercadoPagoDto) => integrationsService.connectMercadoPago(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MERCADOPAGO_STATUS_QUERY_KEY });
    },
  });
}

export function useDisconnectMercadoPago() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectMercadoPago(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MERCADOPAGO_STATUS_QUERY_KEY });
    },
  });
}
