/**
 * Clients Service - Serviço de Clientes
 *
 * Gerencia:
 * - CRUD de clientes
 * - Busca e listagem
 * - Timeline do cliente
 */

import api, { getErrorMessage } from './api';

/**
 * Tipos de dados do cliente
 */
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Contagens (vêm do backend)
  _count?: {
    quotes: number;
    workOrders: number;
    payments: number;
  };
}

export interface CreateClientDto {
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId: string;
  notes?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}

export interface ClientListResponse {
  data: Client[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientSearchParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Timeline types
 */
export type TimelineEventType =
  | 'QUOTE_CREATED'
  | 'QUOTE_APPROVED'
  | 'QUOTE_REJECTED'
  | 'WORK_ORDER_CREATED'
  | 'WORK_ORDER_STARTED'
  | 'WORK_ORDER_COMPLETED'
  | 'CHECKLIST_CREATED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE';

export interface TimelineEvent {
  type: TimelineEventType;
  date: string;
  data: {
    id: string;
    title?: string;
    status?: string;
    totalValue?: number;
    value?: number;
    itemsCount?: number;
    equipmentsCount?: number;
    quoteId?: string;
    workOrderId?: string;
    workOrderTitle?: string;
    billingType?: string;
    dueDate?: string;
  };
}

/**
 * Client Summary/KPIs
 */
export interface ClientSummary {
  totalQuotes: number;
  totalWorkOrders: number;
  totalBilled: number;
  totalReceived: number;
  totalPending: number;
  totalOverdue: number;
  completedWorkOrders: number;
  approvedQuotes: number;
}

/**
 * Sanitiza parâmetros de busca para prevenir XSS
 */
function sanitizeSearchParam(value: string): string {
  // Remove caracteres perigosos e limita tamanho
  return value
    .trim()
    .replace(/[<>]/g, '') // Remove tags HTML
    .slice(0, 100); // Limita tamanho
}

/**
 * Listar todos os clientes
 */
export async function listClients(params?: ClientSearchParams): Promise<Client[]> {
  try {
    // Se tem busca, usa endpoint de search
    if (params?.search) {
      const sanitizedSearch = sanitizeSearchParam(params.search);
      const response = await api.get<Client[]>('/clients/search', {
        params: { q: sanitizedSearch },
      });
      return response.data;
    }

    // Lista completa
    const response = await api.get<Client[]>('/clients');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Buscar clientes
 */
export async function searchClients(query: string): Promise<Client[]> {
  try {
    const sanitizedQuery = sanitizeSearchParam(query);
    const response = await api.get<Client[]>('/clients/search', {
      params: { q: sanitizedQuery },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter cliente por ID
 */
export async function getClientById(id: string): Promise<Client> {
  try {
    const response = await api.get<Client>(`/clients/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar cliente
 */
export async function createClient(data: CreateClientDto): Promise<Client> {
  try {
    const response = await api.post<Client>('/clients', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar cliente
 */
export async function updateClient(id: string, data: UpdateClientDto): Promise<Client> {
  try {
    const response = await api.patch<Client>(`/clients/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar cliente (soft delete)
 */
export async function deleteClient(id: string): Promise<void> {
  try {
    await api.delete(`/clients/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Deletar múltiplos clientes (soft delete em lote)
 */
export async function deleteClients(ids: string[]): Promise<{ count: number; deletedIds: string[] }> {
  try {
    const response = await api.delete<{ count: number; deletedIds: string[] }>('/clients/batch/delete', {
      data: { ids },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter timeline do cliente
 */
export async function getClientTimeline(clientId: string): Promise<TimelineEvent[]> {
  try {
    const response = await api.get<TimelineEvent[]>(
      `/service-flow/client/${clientId}/timeline`
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter resumo/KPIs do cliente
 * Calcula a partir da timeline ou dados do cliente
 */
export async function getClientSummary(clientId: string): Promise<ClientSummary> {
  try {
    // Busca dados do cliente com contagens
    const client = await getClientById(clientId);

    // Busca timeline para calcular valores
    const timeline = await getClientTimeline(clientId);

    // Calcula KPIs
    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    let completedWorkOrders = 0;
    let approvedQuotes = 0;

    for (const event of timeline) {
      switch (event.type) {
        case 'QUOTE_APPROVED':
          approvedQuotes++;
          break;
        case 'WORK_ORDER_COMPLETED':
          completedWorkOrders++;
          break;
        case 'PAYMENT_CREATED':
          if (event.data.value) {
            totalBilled += event.data.value;
            // Se não foi pago, é pendente
            totalPending += event.data.value;
          }
          break;
        case 'PAYMENT_CONFIRMED':
          if (event.data.value) {
            totalReceived += event.data.value;
            // Remove do pendente
            totalPending -= event.data.value;
          }
          break;
        case 'PAYMENT_OVERDUE':
          if (event.data.value) {
            totalOverdue += event.data.value;
          }
          break;
      }
    }

    return {
      totalQuotes: client._count?.quotes || 0,
      totalWorkOrders: client._count?.workOrders || 0,
      totalBilled,
      totalReceived,
      totalPending: Math.max(0, totalPending),
      totalOverdue,
      completedWorkOrders,
      approvedQuotes,
    };
  } catch (error) {
    // Retorna valores zerados em caso de erro
    return {
      totalQuotes: 0,
      totalWorkOrders: 0,
      totalBilled: 0,
      totalReceived: 0,
      totalPending: 0,
      totalOverdue: 0,
      completedWorkOrders: 0,
      approvedQuotes: 0,
    };
  }
}

export const clientsService = {
  listClients,
  searchClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  deleteClients,
  getClientTimeline,
  getClientSummary,
};

export default clientsService;
