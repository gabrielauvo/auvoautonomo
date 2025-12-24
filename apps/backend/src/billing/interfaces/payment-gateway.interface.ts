/**
 * Payment Gateway Interface
 *
 * Interface abstrata para diferentes gateways de pagamento.
 * Permite usar Asaas (Brasil) ou Stripe (Internacional) de forma transparente.
 */

import { BillingPeriod, PaymentMethod } from '@prisma/client';

// ============================================
// COMMON TYPES
// ============================================

export type PaymentCycle = 'MONTHLY' | 'YEARLY';

export interface CustomerData {
  userId: string;
  name: string;
  email: string;
  /** CPF/CNPJ para Brasil, Tax ID para internacional */
  taxId?: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
  /** País do cliente (ISO 3166-1 alpha-2) */
  country: string;
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface CreditCardHolderData {
  name: string;
  email: string;
  taxId: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

// ============================================
// RESULT TYPES
// ============================================

export interface CreateCustomerResult {
  success: boolean;
  customerId?: string;
  errorMessage?: string;
}

export interface SubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  paymentId?: string;
  status?: string;
  /** Para PIX - QR Code em base64 */
  pixQrCode?: string;
  /** Para PIX - código copia e cola */
  pixCopyPaste?: string;
  /** Para PIX - data de expiração */
  pixExpiresAt?: string;
  /** Para Cartão - últimos 4 dígitos */
  creditCardLastFour?: string;
  /** Para Cartão - bandeira */
  creditCardBrand?: string;
  /** Próxima data de cobrança */
  nextDueDate?: string;
  /** URL de checkout (Stripe) */
  checkoutUrl?: string;
  /** Moeda da cobrança */
  currency?: string;
  errorMessage?: string;
}

export interface PaymentStatusResult {
  status: string;
  paid: boolean;
  subscriptionStatus?: string;
}

// ============================================
// GATEWAY INTERFACE
// ============================================

/**
 * Interface que todo gateway de pagamento deve implementar
 */
export interface IPaymentGateway {
  /** Nome do gateway (asaas, stripe) */
  readonly name: string;

  /** Moedas suportadas */
  readonly supportedCurrencies: string[];

  /** Países suportados */
  readonly supportedCountries: string[];

  /**
   * Verifica se o gateway está configurado
   */
  isConfigured(): boolean;

  /**
   * Cria ou atualiza cliente no gateway
   */
  createOrUpdateCustomer(data: CustomerData): Promise<CreateCustomerResult>;

  /**
   * Cria assinatura recorrente via PIX (apenas Brasil)
   */
  createPixSubscription?(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
    cycle: PaymentCycle,
  ): Promise<SubscriptionResult>;

  /**
   * Cria assinatura recorrente via Cartão de Crédito
   */
  createCreditCardSubscription(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
    creditCard: CreditCardData,
    holderInfo: CreditCardHolderData,
    remoteIp: string,
    cycle: PaymentCycle,
  ): Promise<SubscriptionResult>;

  /**
   * Cria sessão de checkout hospedado (Stripe Checkout)
   * Para gateways que suportam checkout hospedado
   */
  createCheckoutSession?(
    userId: string,
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<SubscriptionResult>;

  /**
   * Verifica status de um pagamento
   */
  checkPaymentStatus(paymentId: string): Promise<PaymentStatusResult>;

  /**
   * Cancela assinatura
   */
  cancelSubscription(subscriptionId: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Processa webhook do gateway
   */
  processWebhook(event: string, payload: any): Promise<void>;
}

// ============================================
// GATEWAY TYPE
// ============================================

export type GatewayType = 'asaas' | 'stripe';

/**
 * Determina qual gateway usar baseado no país
 */
export function getGatewayTypeForCountry(country: string): GatewayType {
  // Brasil usa Asaas
  if (country.toUpperCase() === 'BR') {
    return 'asaas';
  }
  // Outros países usam Stripe
  return 'stripe';
}

/**
 * Determina a moeda baseada no país
 */
export function getCurrencyForCountry(country: string): string {
  const currencyMap: Record<string, string> = {
    BR: 'BRL',
    US: 'USD',
    GB: 'GBP',
    EU: 'EUR',
    // Adicione mais conforme necessário
  };
  return currencyMap[country.toUpperCase()] || 'USD';
}
