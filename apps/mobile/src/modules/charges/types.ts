/**
 * Charges Types - Mobile
 *
 * Tipos alinhados com o backend e web para cobranças.
 * As cobranças são criadas online (integração com Asaas),
 * mas os dados são cacheados localmente para visualização offline.
 */

// ============================================
// ENUMS
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

// ============================================
// INTERFACES
// ============================================

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
 * Desconto
 */
export interface ChargeDiscount {
  value: number;
  dueDateLimitDays?: number;
  type: 'FIXED' | 'PERCENTAGE';
}

/**
 * Multa
 */
export interface ChargeFine {
  value: number;
  type: 'FIXED' | 'PERCENTAGE';
}

/**
 * Juros
 */
export interface ChargeInterest {
  value: number;
  type: 'PERCENTAGE';
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
  discount?: ChargeDiscount;
  fine?: ChargeFine;
  interest?: ChargeInterest;
  urls: PaymentUrls;
  client: ChargeSummaryClient;
  publicToken?: string;
  createdAt: string;
  updatedAt: string;
  // Campos locais para cache
  syncedAt?: string;
  technicianId: string;
  // Dados desnormalizados
  clientName?: string;
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
  discount?: ChargeDiscount;
  fine?: ChargeFine;
  interest?: ChargeInterest;
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
// HELPERS
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
