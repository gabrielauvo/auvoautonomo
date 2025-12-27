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
  /** Tipo do plano: FREE (gratuito), PRO (pago/trial) */
  planKey: 'FREE' | 'PRO';
  planName: string;
  /** Status da assinatura: TRIALING = em período de teste, ACTIVE = assinante */
  subscriptionStatus: 'FREE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'EXPIRED';
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
  subscriptionId?: string;
  paymentId?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: string;
  nextDueDate?: string;
  amount?: number;
  billingPeriod?: BillingPeriod;
  errorMessage?: string;
  message?: string;
}

export interface CreditCardCheckoutResult {
  success: boolean;
  subscriptionId?: string;
  paymentId?: string;
  status?: string;
  creditCardLastFour?: string;
  creditCardBrand?: string;
  nextDueDate?: string;
  amount?: number;
  billingPeriod?: BillingPeriod;
  errorMessage?: string;
  message?: string;
}

export interface PixStatusResult {
  status: string;
  paid: boolean;
  subscriptionStatus?: string;
}

// ============================================
// STRIPE CHECKOUT TYPES (International)
// ============================================

export interface GatewayInfo {
  country: string;
  gateway: 'asaas' | 'stripe';
  currency: string;
  currencySymbol?: string;
  isPixAvailable?: boolean;
  paymentMethods: {
    card: boolean;
    pix?: boolean;
    boleto?: boolean;
    oxxo?: boolean;
    sepaDebit?: boolean;
    ideal?: boolean;
    bancontact?: boolean;
    sofort?: boolean;
  };
  methodsInfo?: Record<string, {
    name: string;
    description: string;
    icon: string;
    processingTime: string;
    expiresIn?: string;
  }>;
  pricing: {
    monthly: number;
    yearly: number;
    yearlyTotal?: number;
    yearlySavings?: number;
    monthlyFormatted?: string;
    yearlyFormatted?: string;
  };
}

export interface StripeCheckoutResult {
  success: boolean;
  subscriptionId?: string;
  checkoutUrl?: string;
  currency?: string;
  errorMessage?: string;
}

export interface StripeCheckoutDto {
  billingPeriod: BillingPeriod;
  country: string;
  name: string;
  email: string;
  successUrl?: string;
  cancelUrl?: string;
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

// ============================================
// STRIPE CHECKOUT FUNCTIONS (International)
// ============================================

/**
 * Obtém informações do gateway baseado no país
 */
export async function getGatewayInfo(country: string = 'BR'): Promise<GatewayInfo> {
  try {
    const response = await api.get<GatewayInfo>(`/billing/gateway-info?country=${country}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Cria sessão de checkout Stripe (para clientes internacionais)
 * Retorna URL para redirecionar o usuário
 */
export async function createStripeCheckout(data: StripeCheckoutDto): Promise<StripeCheckoutResult> {
  try {
    const response = await api.post<StripeCheckoutResult>('/billing/checkout/stripe', {
      billingPeriod: data.billingPeriod,
      country: data.country,
      name: data.name,
      email: data.email,
      successUrl: data.successUrl || `${window.location.origin}/settings/plan?success=true`,
      cancelUrl: data.cancelUrl || `${window.location.origin}/settings/plan?canceled=true`,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Verifica se o país usa Stripe (internacional) ou Asaas (Brasil)
 */
export function isInternationalCountry(country: string): boolean {
  return country.toUpperCase() !== 'BR';
}

/**
 * Lista de países suportados pelo Stripe
 */
export const STRIPE_SUPPORTED_COUNTRIES = [
  // América do Norte
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'MX', name: 'México', currency: 'MXN' },
  // Europa
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  // Ásia-Pacífico
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
];

export const billingService = {
  getBillingStatus,
  calculateTrialDaysRemaining,
  isTrialExpired,
  checkoutPix,
  checkPixStatus,
  checkoutCreditCard,
  cancelSubscription,
  reactivateSubscription,
  // Stripe (Internacional)
  getGatewayInfo,
  createStripeCheckout,
  isInternationalCountry,
  // Constantes
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
  STRIPE_SUPPORTED_COUNTRIES,
};

export default billingService;
