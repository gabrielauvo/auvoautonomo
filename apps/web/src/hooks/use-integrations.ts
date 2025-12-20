import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsService, ConnectAsaasDto } from '@/services/integrations.service';

export const INTEGRATIONS_QUERY_KEY = 'integrations';
export const ASAAS_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'asaas', 'status'];

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
