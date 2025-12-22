/**
 * Charge Service - Mobile
 *
 * Serviço para comunicação com a API de Cobranças.
 * As cobranças são criadas online (integração com Asaas),
 * diferente de quotes/workOrders que funcionam offline.
 *
 * Features:
 * - Listagem de cobranças
 * - Criação de cobranças
 * - Cancelamento
 * - Pagamento manual
 * - Estatísticas
 */

import { fetchWithTimeout } from '../../utils/fetch-with-timeout';
import { AuthService } from '../../services/AuthService';
import { getApiBaseUrl } from '../../config/api';
import type {
  Charge,
  ChargeListResponse,
  ChargeSearchParams,
  ChargeStats,
  CreateChargeDto,
  ManualPaymentDto,
  CancelChargeDto,
} from './types';

// ============================================
// HELPERS
// ============================================

/**
 * Get headers with authentication
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Build URL with query params
 */
function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const baseUrl = getApiBaseUrl();
  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Handle API response
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Listar cobranças
 */
export async function listCharges(params?: ChargeSearchParams): Promise<ChargeListResponse> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/billing/charges', params as Record<string, string | number | undefined>);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<ChargeListResponse>(response);
}

/**
 * Obter cobrança por ID
 */
export async function getChargeById(id: string): Promise<Charge> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/billing/charges/${id}`);

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<Charge>(response);
}

/**
 * Criar cobrança
 */
export async function createCharge(data: CreateChargeDto): Promise<Charge> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/billing/charges');

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 60000, // Longer timeout for creation (Asaas integration)
  });

  return handleResponse<Charge>(response);
}

/**
 * Cancelar cobrança
 */
export async function cancelCharge(id: string, data?: CancelChargeDto): Promise<Charge> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/billing/charges/${id}/cancel`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data || {}),
    timeout: 30000,
  });

  return handleResponse<Charge>(response);
}

/**
 * Registrar pagamento manual
 */
export async function registerManualPayment(id: string, data: ManualPaymentDto): Promise<Charge> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/billing/charges/${id}/receive-in-cash`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
    timeout: 30000,
  });

  return handleResponse<Charge>(response);
}

/**
 * Obter estatísticas de cobranças
 */
export async function getChargeStats(): Promise<ChargeStats> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/billing/charges/stats');

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 30000,
  });

  return handleResponse<ChargeStats>(response);
}

/**
 * Reenviar cobrança por email
 */
export async function resendChargeEmail(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = buildUrl(`/billing/charges/${id}/resend-email`);

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    timeout: 30000,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }
}

/**
 * Listar cobranças de um cliente
 */
export async function listClientCharges(
  clientId: string,
  params?: Omit<ChargeSearchParams, 'clientId'>
): Promise<ChargeListResponse> {
  return listCharges({ ...params, clientId });
}

/**
 * Buscar clientes via API (para seleção ao criar cobrança)
 */
export interface ClientSearchResult {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

export async function searchClients(query: string, limit: number = 20): Promise<ClientSearchResult[]> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/clients/search', { q: query, limit });

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 15000,
  });

  return handleResponse<ClientSearchResult[]>(response);
}

/**
 * Listar todos os clientes (para seleção inicial)
 */
export async function listClients(limit: number = 50): Promise<ClientSearchResult[]> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/clients', { limit });

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers,
    timeout: 15000,
  });

  // API retorna array diretamente
  const data = await handleResponse<ClientSearchResult[]>(response);
  return Array.isArray(data) ? data : [];
}

/**
 * Criar cliente rápido (para uso na tela de cobranças)
 */
export interface CreateQuickClientDto {
  name: string;
  phone: string;
  taxId?: string;
  email?: string;
}

export async function createQuickClient(data: CreateQuickClientDto): Promise<ClientSearchResult> {
  const headers = await getAuthHeaders();
  const url = buildUrl('/clients');

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      taxId: data.taxId || '00000000000', // CPF genérico se não informado
      email: data.email,
    }),
    timeout: 15000,
  });

  return handleResponse<ClientSearchResult>(response);
}

// ============================================
// EXPORT SERVICE OBJECT
// ============================================

export const ChargeService = {
  listCharges,
  getChargeById,
  createCharge,
  cancelCharge,
  registerManualPayment,
  getChargeStats,
  resendChargeEmail,
  listClientCharges,
  searchClients,
  listClients,
  createQuickClient,
};

export default ChargeService;
