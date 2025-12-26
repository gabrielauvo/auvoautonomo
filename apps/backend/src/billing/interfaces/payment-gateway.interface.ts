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

export type GatewayType = 'asaas' | 'stripe' | 'mercadopago';

/**
 * Determina qual gateway usar baseado no país
 */
export function getGatewayTypeForCountry(country: string): GatewayType {
  const countryUpper = country.toUpperCase();

  // Brasil usa Asaas
  if (countryUpper === 'BR') {
    return 'asaas';
  }

  // LATAM (exceto Brasil e México) usa Mercado Pago
  if (['AR', 'CL', 'CO', 'PE', 'UY'].includes(countryUpper)) {
    return 'mercadopago';
  }

  // Outros países usam Stripe (incluindo México com OXXO)
  return 'stripe';
}

/**
 * Determina a moeda baseada no país
 */
export function getCurrencyForCountry(country: string): string {
  const currencyMap: Record<string, string> = {
    // América do Norte
    US: 'USD',
    CA: 'CAD',
    MX: 'MXN',
    // América do Sul - Asaas
    BR: 'BRL',
    // América do Sul - Mercado Pago
    AR: 'ARS', // Argentina - Peso Argentino
    CL: 'CLP', // Chile - Peso Chileno
    CO: 'COP', // Colômbia - Peso Colombiano
    PE: 'PEN', // Peru - Sol Peruano
    UY: 'UYU', // Uruguai - Peso Uruguaio
    // Europa - Zona Euro
    DE: 'EUR', // Alemanha
    FR: 'EUR', // França
    ES: 'EUR', // Espanha
    IT: 'EUR', // Itália
    PT: 'EUR', // Portugal
    NL: 'EUR', // Holanda
    BE: 'EUR', // Bélgica
    AT: 'EUR', // Áustria
    IE: 'EUR', // Irlanda
    FI: 'EUR', // Finlândia
    // Europa - Outras moedas
    GB: 'GBP', // Reino Unido
    CH: 'CHF', // Suíça
    SE: 'SEK', // Suécia
    NO: 'NOK', // Noruega
    DK: 'DKK', // Dinamarca
    PL: 'PLN', // Polônia
    // Ásia-Pacífico
    AU: 'AUD', // Austrália
    NZ: 'NZD', // Nova Zelândia
    JP: 'JPY', // Japão
    SG: 'SGD', // Singapura
    HK: 'HKD', // Hong Kong
  };
  return currencyMap[country.toUpperCase()] || 'USD';
}

/**
 * Lista de países suportados pelo Stripe
 */
export const STRIPE_SUPPORTED_COUNTRIES = [
  // América do Norte
  'US', 'CA', 'MX',
  // Europa
  'GB', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI',
  'CH', 'SE', 'NO', 'DK', 'PL',
  // Ásia-Pacífico
  'AU', 'NZ', 'JP', 'SG', 'HK',
];

/**
 * Lista de países suportados pelo Mercado Pago
 */
export const MERCADOPAGO_SUPPORTED_COUNTRIES = [
  'AR', // Argentina
  'CL', // Chile
  'CO', // Colômbia
  'PE', // Peru
  'UY', // Uruguai
];

/**
 * Todos os países da América Latina suportados
 */
export const LATAM_COUNTRIES = [
  'AR', 'CL', 'CO', 'PE', 'UY', // Mercado Pago
  'MX', // Stripe (OXXO)
  'BR', // Asaas
];

/**
 * Métodos de pagamento disponíveis por país
 */
export interface CountryPaymentMethods {
  card: boolean;
  oxxo?: boolean;       // México
  sepaDebit?: boolean;  // Europa SEPA
  ideal?: boolean;      // Holanda
  bancontact?: boolean; // Bélgica
  giropay?: boolean;    // Alemanha
  sofort?: boolean;     // Europa
}

/**
 * Métodos de pagamento Mercado Pago por país
 */
export interface MercadoPagoPaymentMethods {
  card: boolean;
  mercadoPago?: boolean;      // Wallet Mercado Pago
  rapipago?: boolean;         // Argentina
  pagoFacil?: boolean;        // Argentina
  servipag?: boolean;         // Chile
  webpay?: boolean;           // Chile
  pse?: boolean;              // Colômbia - PSE (transferência bancária)
  efecty?: boolean;           // Colômbia
  pagoEfectivo?: boolean;     // Peru
  abitab?: boolean;           // Uruguai
  redpagos?: boolean;         // Uruguai
}

export function getPaymentMethodsForCountry(country: string): CountryPaymentMethods {
  const methods: Record<string, CountryPaymentMethods> = {
    // México - OXXO é muito popular
    MX: { card: true, oxxo: true },
    // Europa SEPA
    DE: { card: true, sepaDebit: true, giropay: true, sofort: true },
    FR: { card: true, sepaDebit: true, sofort: true },
    ES: { card: true, sepaDebit: true },
    IT: { card: true, sepaDebit: true },
    PT: { card: true, sepaDebit: true },
    NL: { card: true, sepaDebit: true, ideal: true },
    BE: { card: true, sepaDebit: true, bancontact: true },
    AT: { card: true, sepaDebit: true, sofort: true },
    // Outros
    US: { card: true },
    CA: { card: true },
    GB: { card: true },
    AU: { card: true },
  };
  return methods[country.toUpperCase()] || { card: true };
}

export function getMercadoPagoMethodsForCountry(country: string): MercadoPagoPaymentMethods {
  const methods: Record<string, MercadoPagoPaymentMethods> = {
    // Argentina
    AR: { card: true, mercadoPago: true, rapipago: true, pagoFacil: true },
    // Chile
    CL: { card: true, mercadoPago: true, servipag: true, webpay: true },
    // Colômbia
    CO: { card: true, mercadoPago: true, pse: true, efecty: true },
    // Peru
    PE: { card: true, mercadoPago: true, pagoEfectivo: true },
    // Uruguai
    UY: { card: true, mercadoPago: true, abitab: true, redpagos: true },
  };
  return methods[country.toUpperCase()] || { card: true };
}
