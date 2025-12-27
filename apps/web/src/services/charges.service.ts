/**
 * Charges Service
 *
 * Serviço para comunicação com a API de Cobranças.
 * Integra com o backend que se comunica com o Asaas.
 *
 * Inclui:
 * - CRUD de cobranças
 * - Gerenciamento de status
 * - Pagamento manual
 * - Cancelamento
 * - URLs de pagamento (boleto, PIX, cartão)
 */

import api, { getErrorMessage } from './api';

// ============================================
// TYPES & ENUMS
// ============================================

/**
 * Status da cobrança
 */
export type ChargeStatus =
  | 'PENDING'
  | 'OVERDUE'
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'RECEIVED_IN_CASH'
  | 'REFUNDED'
  | 'CANCELED';

/**
 * Tipo de cobrança (forma de pagamento)
 */
export type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';

/**
 * Cliente resumido
 */
export interface ChargeSummaryClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
}

/**
 * URLs de pagamento
 */
export interface PaymentUrls {
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  transactionReceiptUrl?: string;
}

/**
 * Evento de histórico da cobrança
 */
export interface ChargeEvent {
  id: string;
  chargeId: string;
  type: string;
  description: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Cobrança completa
 */
export interface Charge {
  id: string;
  asaasId?: string;
  userId: string;
  clientId: string;
  workOrderId?: string;
  quoteId?: string;
  value: number;
  netValue?: number;
  billingType: BillingType;
  status: ChargeStatus;
  dueDate: string;
  paymentDate?: string;
  description?: string;
  externalReference?: string;
  discount?: {
    value: number;
    dueDateLimitDays?: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type: 'PERCENTAGE';
  };
  urls: PaymentUrls;
  client: ChargeSummaryClient;
  events?: ChargeEvent[];
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Gerar link publico de pagamento
 */
export function getPublicPaymentUrl(charge: Charge): string | null {
  if (!charge.publicToken) return null;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  return `${baseUrl}/pay/${charge.publicToken}`;
}

/**
 * Parâmetros de busca de cobranças
 */
export interface ChargeSearchParams {
  search?: string;
  status?: ChargeStatus;
  billingType?: BillingType;
  clientId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Resposta paginada
 */
export interface ChargeListResponse {
  data: Charge[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * DTO para criar cobrança
 */
export interface CreateChargeDto {
  clientId: string;
  workOrderId?: string;
  quoteId?: string;
  value: number;
  billingType: BillingType;
  dueDate: string;
  description?: string;
  externalReference?: string;
  discount?: {
    value: number;
    dueDateLimitDays?: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type: 'PERCENTAGE';
  };
}

/**
 * DTO para atualizar cobrança
 */
export interface UpdateChargeDto {
  dueDate?: string;
  description?: string;
  discount?: {
    value: number;
    dueDateLimitDays?: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
    type: 'PERCENTAGE';
  };
}

/**
 * DTO para registrar pagamento manual
 */
export interface ManualPaymentDto {
  paymentDate: string;
  value: number;
  paymentMethod?: string;
  notes?: string;
}

/**
 * DTO para cancelar cobrança
 */
export interface CancelChargeDto {
  reason?: string;
}

/**
 * Estatísticas de cobranças
 */
export interface ChargeStats {
  total: number;
  pending: number;
  overdue: number;
  confirmed: number;
  canceled: number;
  totalValue: number;
  receivedValue: number;
  pendingValue: number;
  overdueValue: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Labels de status
 */
export const chargeStatusLabels: Record<ChargeStatus, string> = {
  PENDING: 'Aguardando',
  OVERDUE: 'Vencida',
  CONFIRMED: 'Confirmada',
  RECEIVED: 'Recebida',
  RECEIVED_IN_CASH: 'Recebida em Dinheiro',
  REFUNDED: 'Estornada',
  CANCELED: 'Cancelada',
};

/**
 * Labels de tipo de cobrança
 */
export const billingTypeLabels: Record<BillingType, string> = {
  BOLETO: 'Boleto',
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  UNDEFINED: 'Não definido',
};

/**
 * Verificar se pode editar a cobrança
 */
export function canEditCharge(charge: Charge): boolean {
  return charge.status === 'PENDING';
}

/**
 * Verificar se pode cancelar a cobrança
 */
export function canCancelCharge(charge: Charge): boolean {
  return charge.status === 'PENDING' || charge.status === 'OVERDUE';
}

/**
 * Verificar se pode registrar pagamento manual
 */
export function canRegisterManualPayment(charge: Charge): boolean {
  return charge.status === 'PENDING' || charge.status === 'OVERDUE';
}

/**
 * Verificar se a cobrança está paga
 */
export function isChargePaid(charge: Charge): boolean {
  return (
    charge.status === 'CONFIRMED' ||
    charge.status === 'RECEIVED' ||
    charge.status === 'RECEIVED_IN_CASH'
  );
}

/**
 * Verificar se a cobrança está finalizada
 */
export function isChargeFinalized(charge: Charge): boolean {
  return (
    charge.status === 'CONFIRMED' ||
    charge.status === 'RECEIVED' ||
    charge.status === 'RECEIVED_IN_CASH' ||
    charge.status === 'REFUNDED' ||
    charge.status === 'CANCELED'
  );
}

// ============================================
// API FUNCTIONS - CHARGES
// ============================================

/**
 * Listar cobranças
 */
export async function listCharges(params?: ChargeSearchParams): Promise<ChargeListResponse> {
  try {
    const response = await api.get<ChargeListResponse>('/billing/charges', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter cobrança por ID
 */
export async function getChargeById(id: string): Promise<Charge> {
  try {
    const response = await api.get<Charge>(`/billing/charges/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Criar cobrança
 */
export async function createCharge(data: CreateChargeDto): Promise<Charge> {
  try {
    const response = await api.post<Charge>('/billing/charges', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Atualizar cobrança
 */
export async function updateCharge(id: string, data: UpdateChargeDto): Promise<Charge> {
  try {
    const response = await api.put<Charge>(`/billing/charges/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Cancelar cobrança
 */
export async function cancelCharge(id: string, data?: CancelChargeDto): Promise<Charge> {
  try {
    const response = await api.post<Charge>(`/billing/charges/${id}/cancel`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Registrar pagamento manual
 */
export async function registerManualPayment(
  id: string,
  data: ManualPaymentDto
): Promise<Charge> {
  try {
    const response = await api.post<Charge>(`/billing/charges/${id}/receive-in-cash`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obter estatísticas de cobranças
 */
export async function getChargeStats(): Promise<ChargeStats> {
  try {
    const response = await api.get<ChargeStats>('/billing/charges/stats');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Listar cobranças de um cliente
 */
export async function listClientCharges(
  clientId: string,
  params?: Omit<ChargeSearchParams, 'clientId'>
): Promise<ChargeListResponse> {
  try {
    const response = await api.get<ChargeListResponse>(`/clients/${clientId}/charges`, {
      params,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Enviar cobrança por email
 */
export async function sendChargeEmail(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post<{ success: boolean; message: string }>(`/clients/payments/${id}/send-email`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * @deprecated Use sendChargeEmail instead
 */
export const resendChargeEmail = sendChargeEmail;

/**
 * Obter histórico de eventos da cobrança
 */
export async function getChargeEvents(id: string): Promise<ChargeEvent[]> {
  try {
    const response = await api.get<ChargeEvent[]>(`/billing/charges/${id}/events`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// EXPORT SERVICE OBJECT
// ============================================

export const chargesService = {
  // Charges
  listCharges,
  getChargeById,
  createCharge,
  updateCharge,
  cancelCharge,
  registerManualPayment,
  getChargeStats,
  listClientCharges,
  sendChargeEmail,
  resendChargeEmail,
  getChargeEvents,
  // Helpers
  canEditCharge,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
  isChargeFinalized,
  getPublicPaymentUrl,
  // Labels
  chargeStatusLabels,
  billingTypeLabels,
};

export default chargesService;
