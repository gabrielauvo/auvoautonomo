/**
 * Hooks para o módulo de Clientes
 *
 * React Query hooks para:
 * - Listagem de clientes
 * - Detalhes do cliente
 * - Timeline do cliente
 * - Operações CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clientsService,
  Client,
  CreateClientDto,
  UpdateClientDto,
  TimelineEvent,
  ClientSummary,
} from '@/services/clients.service';

/**
 * Hook para listar clientes
 */
export function useClients(search?: string) {
  return useQuery<Client[]>({
    queryKey: ['clients', { search }],
    queryFn: () => clientsService.listClients({ search }),
    staleTime: 30000, // 30 segundos
  });
}

/**
 * Hook para buscar clientes (com debounce no componente)
 */
export function useSearchClients(query: string, enabled = true) {
  return useQuery<Client[]>({
    queryKey: ['clients', 'search', query],
    queryFn: () => clientsService.searchClients(query),
    enabled: enabled && query.length >= 2,
    staleTime: 30000,
  });
}

/**
 * Hook para obter cliente por ID
 */
export function useClient(id: string | undefined) {
  return useQuery<Client>({
    queryKey: ['client', id],
    queryFn: () => clientsService.getClientById(id!),
    enabled: !!id,
  });
}

/**
 * Hook para obter timeline do cliente
 */
export function useClientTimeline(clientId: string | undefined) {
  return useQuery<TimelineEvent[]>({
    queryKey: ['client', clientId, 'timeline'],
    queryFn: () => clientsService.getClientTimeline(clientId!),
    enabled: !!clientId,
  });
}

/**
 * Hook para obter resumo/KPIs do cliente
 */
export function useClientSummary(clientId: string | undefined) {
  return useQuery<ClientSummary>({
    queryKey: ['client', clientId, 'summary'],
    queryFn: () => clientsService.getClientSummary(clientId!),
    enabled: !!clientId,
  });
}

/**
 * Hook para criar cliente
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClientDto) => clientsService.createClient(data),
    onSuccess: () => {
      // Invalida cache da lista de clientes
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Hook para atualizar cliente
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
      clientsService.updateClient(id, data),
    onSuccess: (_, variables) => {
      // Invalida cache do cliente específico e da lista
      queryClient.invalidateQueries({ queryKey: ['client', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Hook para deletar cliente
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.deleteClient(id),
    onSuccess: () => {
      // Invalida cache da lista de clientes
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Hook para deletar múltiplos clientes
 */
export function useDeleteClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => clientsService.deleteClients(ids),
    onSuccess: () => {
      // Invalida cache da lista de clientes
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
