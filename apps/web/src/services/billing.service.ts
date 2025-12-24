/**
 * Billing Service - Serviço de Planos e Assinaturas
 *
 * Gerencia:
 * - Status do plano atual (Trial ou PRO)
 * - Período de teste de 14 dias
 * - Checkout PIX e Cartão de Crédito
 * - Preços: R$ 99,90/mês ou R$ 89,90/mês (anual)
 */

import api, { getErrorMessage } from './api';

/** Duração do trial em dias */
export const TRIAL_DURATION_DAYS = 14;

/** Preços do plano PRO */
export const PRO_PLAN_PRICING = {
  MONTHLY: 99.90,
  YEARLY: 89.90, // por mês
  YEARLY_TOTAL: 1078.80, // total anual
  YEARLY_SAVINGS: 119.00, // economia vs mensal
};

/**
 * Tipos de dados de billing
 */
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

export interface BillingStatus {
  /** Tipo do plano: TRIAL (14 dias grátis) ou PRO (pago) */
  planKey: 'TRIAL' | 'PRO';
  planName: string;
  /** Status da assinatura */
  subscriptionStatus: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'EXPIRED';
  /** Período de cobrança (mensal ou anual) */
  billingPeriod?: BillingPeriod;
  /** Data de início do período atual */
  currentPeriodStart?: string | null;
  /** Data de fim do período atual */
  currentPeriodEnd?: string | null;
  /** Data de fim do trial (apenas para TRIALING) */
  trialEndAt?: string | null;
  /** Dias restantes do trial */
  trialDaysRemaining?: number;
  /** Se vai cancelar no fim do período */
  cancelAtPeriodEnd?: boolean;
  /** Data de criação da conta */
  createdAt?: string;
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
 * Calcula dias restantes do trial
 */
export function calculateTrialDaysRemaining(trialEndAt: string | null | undefined): number {
  if (!trialEndAt) return 0;
  const now = new Date();
  const endDate = new Date(trialEndAt);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Verifica se o trial expirou
 */
export function isTrialExpired(trialEndAt: string | null | undefined): boolean {
  if (!trialEndAt) return false;
  return new Date(trialEndAt) < new Date();
}

// ============================================
// CHECKOUT TYPES
// ============================================

export interface CheckoutPixDto {
  cpfCnpj: string;
  phone?: string;
  name?: string;
  /** Período de cobrança */
  billingPeriod: BillingPeriod;
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

  /** Período de cobrança */
  billingPeriod: BillingPeriod;
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
  calculateTrialDaysRemaining,
  isTrialExpired,
  checkoutPix,
  checkPixStatus,
  checkoutCreditCard,
  cancelSubscription,
  reactivateSubscription,
  // Constantes
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
};

export default billingService;
