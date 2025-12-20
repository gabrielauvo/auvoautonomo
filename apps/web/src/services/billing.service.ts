/**
 * Billing Service - Serviço de Planos e Limites
 *
 * Gerencia:
 * - Status do plano atual
 * - Quota e uso
 * - Informações de billing
 * - Checkout PIX e Cartão de Crédito
 */

import api, { getErrorMessage } from './api';

/**
 * Tipos de dados de billing
 */
export interface UsageLimits {
  maxClients: number;
  maxQuotes: number;
  maxWorkOrders: number;
  maxPayments: number;
  maxNotificationsPerMonth: number;
  enableAdvancedAutomations: boolean;
  enableAdvancedAnalytics: boolean;
  enableClientPortal: boolean;
  enablePdfExport: boolean;
  enableDigitalSignature: boolean;
  enableWhatsApp: boolean;
}

export interface CurrentUsage {
  clientsCount: number;
  quotesCount: number;
  workOrdersCount: number;
  paymentsCount: number;
  notificationsSentThisMonth: number;
}

export interface BillingStatus {
  planKey: 'FREE' | 'PRO' | 'TEAM';
  planName: string;
  subscriptionStatus?: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  status?: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  limits?: Partial<UsageLimits>;
  usage?: Partial<CurrentUsage>;
  features?: {
    advancedReports?: boolean;
    exportPdf?: boolean;
    whatsapp?: boolean;
  };
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndAt?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export interface QuotaInfo {
  remaining: number;
  max: number;
  current: number;
  unlimited: boolean;
}

export interface AllQuotas {
  clients: QuotaInfo;
  quotes: QuotaInfo;
  workOrders: QuotaInfo;
  payments: QuotaInfo;
  notifications: QuotaInfo;
}

/**
 * Obtém status completo do plano e billing
 */
export async function getBillingStatus(): Promise<BillingStatus> {
  try {
    const response = await api.get<BillingStatus>('/billing/plan');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obtém quota de um recurso específico
 */
export async function getQuota(resource?: string): Promise<QuotaInfo | AllQuotas> {
  try {
    const url = resource ? `/billing/quota?resource=${resource}` : '/billing/quota';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Verifica se um limite está disponível
 */
export async function checkLimit(resource: string): Promise<{
  allowed: boolean;
  resource: string;
  plan: string;
  max: number;
  current: number;
}> {
  try {
    const response = await api.get(`/billing/check-limit/${resource}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================
// CHECKOUT TYPES
// ============================================

export interface CheckoutPixDto {
  cpfCnpj: string;
  phone?: string;
  name?: string;
}

export interface CheckoutCreditCardDto {
  // Dados do cliente
  cpfCnpj: string;
  phone: string;
  name: string;
  email: string;
  postalCode: string;
  addressNumber: string;

  // Dados do cartão
  cardHolderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface PixCheckoutResult {
  success: boolean;
  paymentId?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: string;
  amount?: number;
  errorMessage?: string;
  message?: string;
}

export interface CreditCardCheckoutResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  creditCardLastFour?: string;
  creditCardBrand?: string;
  errorMessage?: string;
  message?: string;
}

export interface PixStatusResult {
  status: string;
  paid: boolean;
  subscriptionStatus?: string;
}

// ============================================
// CHECKOUT FUNCTIONS
// ============================================

/**
 * Inicia checkout via PIX - retorna QR Code
 */
export async function checkoutPix(data: CheckoutPixDto): Promise<PixCheckoutResult> {
  try {
    const response = await api.post<PixCheckoutResult>('/billing/checkout/pix', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Verifica status do pagamento PIX
 */
export async function checkPixStatus(): Promise<PixStatusResult> {
  try {
    const response = await api.get<PixStatusResult>('/billing/checkout/pix/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Processa pagamento com cartão de crédito
 */
export async function checkoutCreditCard(data: CheckoutCreditCardDto): Promise<CreditCardCheckoutResult> {
  try {
    const response = await api.post<CreditCardCheckoutResult>('/billing/checkout/credit-card', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Cancela assinatura
 */
export async function cancelSubscription(): Promise<{ success: boolean; message: string; newPlan?: string }> {
  try {
    const response = await api.post('/billing/cancel');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Reativa assinatura
 */
export async function reactivateSubscription(): Promise<{ success: boolean; message: string; status?: string; requiresCheckout?: boolean; requiresPayment?: boolean }> {
  try {
    const response = await api.post('/billing/reactivate');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const billingService = {
  getBillingStatus,
  getQuota,
  checkLimit,
  checkoutPix,
  checkPixStatus,
  checkoutCreditCard,
  cancelSubscription,
  reactivateSubscription,
};

export default billingService;
