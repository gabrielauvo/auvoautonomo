/**
 * Mercado Pago Billing Service
 *
 * Gateway de pagamento para clientes da America Latina.
 * Usa Mercado Pago para processar pagamentos em ARS, CLP, COP, PEN, UYU.
 *
 * Paises suportados:
 * - Argentina (AR) - ARS
 * - Chile (CL) - CLP
 * - Colombia (CO) - COP
 * - Peru (PE) - PEN
 * - Uruguay (UY) - UYU
 */

import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  SubscriptionStatus,
  BillingPeriod,
  PlanType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { ReferralRewardsService } from '../referral/services/referral-rewards.service';
import {
  IPaymentGateway,
  CustomerData,
  CreditCardData,
  CreditCardHolderData,
  CreateCustomerResult,
  SubscriptionResult,
  PaymentStatusResult,
  PaymentCycle,
} from './interfaces/payment-gateway.interface';

// ============================================
// MERCADO PAGO TYPES
// ============================================

/** Paises suportados pelo Mercado Pago nesta integracao */
export type MercadoPagoCountry = 'AR' | 'CL' | 'CO' | 'PE' | 'UY';

/** Moedas suportadas por pais */
export type MercadoPagoCurrency = 'ARS' | 'CLP' | 'COP' | 'PEN' | 'UYU';

/** Metodos de pagamento por pais */
export interface MercadoPagoPaymentMethods {
  card: boolean;
  mercadoPago: boolean;
  cash: string[]; // IDs dos metodos de pagamento em dinheiro
}

/** Mapeamento de metodos de pagamento por pais */
export const MERCADOPAGO_PAYMENT_METHODS: Record<MercadoPagoCountry, MercadoPagoPaymentMethods> = {
  // Argentina: Cartao, Mercado Pago, Rapipago, Pago Facil
  AR: {
    card: true,
    mercadoPago: true,
    cash: ['rapipago', 'pagofacil'],
  },
  // Chile: Cartao, Mercado Pago, Servipag, Webpay
  CL: {
    card: true,
    mercadoPago: true,
    cash: ['servipag', 'webpay'],
  },
  // Colombia: Cartao, Mercado Pago, PSE, Efecty
  CO: {
    card: true,
    mercadoPago: true,
    cash: ['pse', 'efecty'],
  },
  // Peru: Cartao, Mercado Pago, PagoEfectivo
  PE: {
    card: true,
    mercadoPago: true,
    cash: ['pagoefectivo_atm'],
  },
  // Uruguay: Cartao, Mercado Pago, Abitab, Redpagos
  UY: {
    card: true,
    mercadoPago: true,
    cash: ['abitab', 'redpagos'],
  },
};

/** Mapeamento de moedas por pais */
export const MERCADOPAGO_CURRENCIES: Record<MercadoPagoCountry, MercadoPagoCurrency> = {
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  UY: 'UYU',
};

/** Lista de paises suportados */
export const MERCADOPAGO_SUPPORTED_COUNTRIES: MercadoPagoCountry[] = ['AR', 'CL', 'CO', 'PE', 'UY'];

/** Resposta de cliente do Mercado Pago */
export interface MercadoPagoCustomer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: {
    area_code?: string;
    number?: string;
  };
  identification?: {
    type?: string;
    number?: string;
  };
  address?: {
    zip_code?: string;
    street_name?: string;
    street_number?: number;
  };
  date_registered?: string;
  metadata?: Record<string, any>;
}

/** Resposta de preferencia (Checkout Pro) do Mercado Pago */
export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: string;
  }>;
  payer?: MercadoPagoCustomer;
  back_urls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  auto_return?: 'approved' | 'all';
  external_reference?: string;
  notification_url?: string;
}

/** Resposta de pagamento do Mercado Pago */
export interface MercadoPagoPayment {
  id: number;
  status: MercadoPagoPaymentStatus;
  status_detail: string;
  payment_type_id: string;
  payment_method_id: string;
  transaction_amount: number;
  currency_id: string;
  description?: string;
  external_reference?: string;
  payer?: {
    id?: string;
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  metadata?: Record<string, any>;
  date_created?: string;
  date_approved?: string;
  card?: {
    first_six_digits?: string;
    last_four_digits?: string;
    cardholder?: {
      name?: string;
    };
  };
}

/** Status de pagamento do Mercado Pago */
export type MercadoPagoPaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

/** Resposta de subscricao do Mercado Pago */
export interface MercadoPagoSubscription {
  id: string;
  payer_id: number;
  status: string;
  reason: string;
  external_reference?: string;
  preapproval_plan_id?: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'months' | 'days';
    transaction_amount: number;
    currency_id: string;
  };
  summarized?: {
    charged_quantity?: number;
    pending_charge_quantity?: number;
    charged_amount?: number;
    pending_charge_amount?: number;
  };
  next_payment_date?: string;
  payment_method_id?: string;
  card_id?: string;
  first_invoice_offset?: number;
}

/** Webhook/IPN payload do Mercado Pago */
export interface MercadoPagoWebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

// ============================================
// MERCADO PAGO SDK INTERFACE
// ============================================

interface MercadoPagoSDK {
  configure: (config: { access_token: string }) => void;
  customers: {
    create: (data: any) => Promise<{ body: MercadoPagoCustomer }>;
    update: (data: any) => Promise<{ body: MercadoPagoCustomer }>;
    findById: (id: string) => Promise<{ body: MercadoPagoCustomer }>;
    search: (filters: any) => Promise<{ body: { results: MercadoPagoCustomer[] } }>;
  };
  preferences: {
    create: (data: any) => Promise<{ body: MercadoPagoPreference }>;
    update: (data: any) => Promise<{ body: MercadoPagoPreference }>;
    findById: (id: string) => Promise<{ body: MercadoPagoPreference }>;
  };
  payment: {
    create: (data: any) => Promise<{ body: MercadoPagoPayment }>;
    findById: (id: number) => Promise<{ body: MercadoPagoPayment }>;
    update: (data: any) => Promise<{ body: MercadoPagoPayment }>;
  };
  preapproval: {
    create: (data: any) => Promise<{ body: MercadoPagoSubscription }>;
    update: (data: any) => Promise<{ body: MercadoPagoSubscription }>;
    findById: (id: string) => Promise<{ body: MercadoPagoSubscription }>;
  };
}

// ============================================
// SERVICE
// ============================================

@Injectable()
export class MercadoPagoBillingService implements IPaymentGateway {
  private readonly logger = new Logger(MercadoPagoBillingService.name);
  private mercadopago: MercadoPagoSDK | null = null;
  private readonly webhookSecret: string;
  private readonly publicKey: string;

  readonly name = 'mercadopago';
  readonly supportedCurrencies = ['ARS', 'CLP', 'COP', 'PEN', 'UYU'];
  readonly supportedCountries = MERCADOPAGO_SUPPORTED_COUNTRIES;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Optional() private referralRewardsService?: ReferralRewardsService,
  ) {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    this.publicKey = this.configService.get<string>('MERCADOPAGO_PUBLIC_KEY') || '';
    this.webhookSecret = this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') || '';

    if (accessToken) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mercadopagoSDK = require('mercadopago');
        mercadopagoSDK.configure({ access_token: accessToken });
        this.mercadopago = mercadopagoSDK;
        this.logger.log('Mercado Pago SDK initialized');
      } catch (error) {
        this.logger.warn('Mercado Pago SDK not installed. Run: npm install mercadopago');
      }
    }
  }

  /**
   * Verifica se o gateway esta configurado
   */
  isConfigured(): boolean {
    return this.mercadopago !== null;
  }

  /**
   * Retorna a moeda para um pais
   */
  getCurrencyForCountry(country: string): MercadoPagoCurrency {
    const upperCountry = country.toUpperCase() as MercadoPagoCountry;
    return MERCADOPAGO_CURRENCIES[upperCountry] || 'ARS';
  }

  /**
   * Retorna os metodos de pagamento disponiveis para um pais
   */
  getPaymentMethodsForCountry(country: string): MercadoPagoPaymentMethods {
    const upperCountry = country.toUpperCase() as MercadoPagoCountry;
    return MERCADOPAGO_PAYMENT_METHODS[upperCountry] || MERCADOPAGO_PAYMENT_METHODS.AR;
  }

  /**
   * Verifica se o pais e suportado
   */
  isCountrySupported(country: string): boolean {
    return MERCADOPAGO_SUPPORTED_COUNTRIES.includes(country.toUpperCase() as MercadoPagoCountry);
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  /**
   * Cria ou atualiza cliente no Mercado Pago
   */
  async createOrUpdateCustomer(data: CustomerData): Promise<CreateCustomerResult> {
    this.logger.log(`Creating/updating Mercado Pago customer for user ${data.userId}`);

    if (!this.isConfigured()) {
      // Mock para desenvolvimento
      return {
        success: true,
        customerId: `mp_cus_mock_${data.userId.substring(0, 8)}`,
      };
    }

    try {
      // Verificar se ja existe cliente no Mercado Pago
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId: data.userId },
      }) as any;

      // Separar nome em first_name e last_name
      const nameParts = data.name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;

      // Separar telefone em area_code e number
      const phoneNumber = data.phone?.replace(/\D/g, '') || '';
      const areaCode = phoneNumber.substring(0, 2);
      const number = phoneNumber.substring(2);

      const customerData = {
        email: data.email,
        first_name: firstName,
        last_name: lastName,
        phone: {
          area_code: areaCode,
          number: number,
        },
        identification: {
          type: this.getIdentificationTypeForCountry(data.country),
          number: data.taxId?.replace(/\D/g, '') || '',
        },
        address: {
          zip_code: data.postalCode?.replace(/\D/g, '') || '',
          street_number: parseInt(data.addressNumber || '0', 10),
        },
        metadata: {
          userId: data.userId,
          country: data.country,
        },
      };

      if (subscription?.mercadoPagoCustomerId) {
        // Atualizar cliente existente
        const customer = await this.mercadopago!.customers.update({
          id: subscription.mercadoPagoCustomerId,
          ...customerData,
        });
        return { success: true, customerId: customer.body.id };
      }

      // Buscar por email primeiro
      const searchResult = await this.mercadopago!.customers.search({
        email: data.email,
      });

      if (searchResult.body.results.length > 0) {
        const existingCustomer = searchResult.body.results[0];
        // Atualizar cliente existente
        const customer = await this.mercadopago!.customers.update({
          id: existingCustomer.id,
          ...customerData,
        });
        return { success: true, customerId: customer.body.id };
      }

      // Criar novo cliente
      const customer = await this.mercadopago!.customers.create(customerData);
      this.logger.log(`Created Mercado Pago customer ${customer.body.id}`);
      return { success: true, customerId: customer.body.id };
    } catch (error) {
      this.logger.error('Error creating Mercado Pago customer', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar cliente',
      };
    }
  }

  /**
   * Retorna o tipo de identificacao para o pais
   */
  private getIdentificationTypeForCountry(country: string): string {
    const types: Record<string, string> = {
      AR: 'DNI',   // Documento Nacional de Identidad
      CL: 'RUT',   // Rol Unico Tributario
      CO: 'CC',    // Cedula de Ciudadania
      PE: 'DNI',   // Documento Nacional de Identidad
      UY: 'CI',    // Cedula de Identidad
    };
    return types[country.toUpperCase()] || 'OTHER';
  }

  // ============================================
  // SUBSCRIPTIONS
  // ============================================

  /**
   * Cria assinatura recorrente via Cartao de Credito
   * Nota: Para Mercado Pago, e recomendado usar createCheckoutSession
   */
  async createCreditCardSubscription(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
    creditCard: CreditCardData,
    holderInfo: CreditCardHolderData,
    remoteIp: string,
    cycle: PaymentCycle,
  ): Promise<SubscriptionResult> {
    this.logger.log(`Creating credit card subscription for user ${userId} (cycle: ${cycle})`);

    // Para Mercado Pago, e melhor usar Checkout Pro
    // Mas podemos criar uma subscricao direta se tivermos o card token

    if (!this.isConfigured()) {
      const nextDueDate = new Date();
      if (cycle === 'YEARLY') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }
      return {
        success: true,
        subscriptionId: `mp_sub_mock_${Date.now()}`,
        status: 'authorized',
        creditCardLastFour: creditCard.number.slice(-4),
        creditCardBrand: 'visa',
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        currency: 'ARS',
      };
    }

    // Redirecionar para Checkout Pro
    return {
      success: false,
      errorMessage: 'Para pagamentos com Mercado Pago, use o Checkout Pro. Chame createCheckoutSession().',
    };
  }

  /**
   * Cria sessao de Checkout Pro do Mercado Pago
   * Redireciona usuario para pagina de pagamento hospedada pelo Mercado Pago
   * Suporta cartao, saldo Mercado Pago e metodos de pagamento locais
   */
  async createCheckoutSession(
    userId: string,
    customerId: string,
    priceId: string, // No MP, usamos como external_reference ou plan_id
    successUrl: string,
    cancelUrl: string,
    country?: string,
  ): Promise<SubscriptionResult> {
    this.logger.log(`Creating Mercado Pago Checkout session for user ${userId}, country: ${country}`);

    const countryCode = (country?.toUpperCase() || 'AR') as MercadoPagoCountry;
    const currency = this.getCurrencyForCountry(countryCode);

    if (!this.isConfigured()) {
      return {
        success: true,
        subscriptionId: `mp_sub_mock_${Date.now()}`,
        checkoutUrl: 'https://www.mercadopago.com/checkout/mock-session',
        currency,
      };
    }

    try {
      // Buscar informacoes do plano/preco
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      if (!subscription?.plan) {
        return {
          success: false,
          errorMessage: 'Plano nao encontrado',
        };
      }

      const amount = Number(subscription.plan.price);
      const planName = subscription.plan.name;

      // Determinar metodos de pagamento excluidos baseado no pais
      const paymentMethods = this.getPaymentMethodsForCountry(countryCode);
      const excludedPaymentTypes: Array<{ id: string }> = [];

      // Excluir metodos nao suportados
      if (!paymentMethods.card) {
        excludedPaymentTypes.push({ id: 'credit_card' });
        excludedPaymentTypes.push({ id: 'debit_card' });
      }

      // URL base para notificacoes
      const baseUrl = this.configService.get<string>('APP_BASE_URL') || 'https://api.example.com';
      const notificationUrl = `${baseUrl}/api/billing/webhook/mercadopago`;

      // Criar preferencia de pagamento (Checkout Pro)
      const preference = await this.mercadopago!.preferences.create({
        items: [
          {
            id: priceId || subscription.plan.id,
            title: `Assinatura ${planName}`,
            description: `Assinatura mensal do plano ${planName}`,
            quantity: 1,
            unit_price: amount,
            currency_id: currency,
          },
        ],
        payer: {
          id: customerId,
        },
        back_urls: {
          success: successUrl,
          failure: cancelUrl,
          pending: `${successUrl}?status=pending`,
        },
        auto_return: 'approved',
        external_reference: userId,
        notification_url: notificationUrl,
        payment_methods: {
          excluded_payment_types: excludedPaymentTypes,
          installments: 1, // Apenas pagamento a vista para assinaturas
        },
        metadata: {
          userId,
          country: countryCode,
          planId: subscription.plan.id,
        },
      });

      this.logger.log(`Created Mercado Pago preference ${preference.body.id}`);

      // Atualizar subscription local
      await (this.prisma.userSubscription.update as any)({
        where: { userId },
        data: {
          mercadoPagoCustomerId: customerId,
          mercadoPagoPreferenceId: preference.body.id,
          country: countryCode,
          currency,
        },
      });

      return {
        success: true,
        subscriptionId: preference.body.id,
        checkoutUrl: preference.body.init_point, // URL de producao
        currency,
      };
    } catch (error) {
      this.logger.error('Error creating Mercado Pago Checkout session', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar checkout',
      };
    }
  }

  /**
   * Cria subscricao recorrente no Mercado Pago (Preapproval)
   */
  async createRecurringSubscription(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
    cycle: PaymentCycle,
    country: string,
  ): Promise<SubscriptionResult> {
    this.logger.log(`Creating recurring subscription for user ${userId}`);

    const currency = this.getCurrencyForCountry(country);

    if (!this.isConfigured()) {
      return {
        success: true,
        subscriptionId: `mp_preapproval_mock_${Date.now()}`,
        currency,
      };
    }

    try {
      const baseUrl = this.configService.get<string>('APP_BASE_URL') || 'https://api.example.com';

      const preapproval = await this.mercadopago!.preapproval.create({
        payer_email: '', // Sera preenchido pelo usuario no checkout
        back_url: `${baseUrl}/billing/success`,
        reason: description,
        external_reference: userId,
        auto_recurring: {
          frequency: 1,
          frequency_type: cycle === 'YEARLY' ? 'months' : 'months',
          transaction_amount: amount,
          currency_id: currency,
          repetitions: cycle === 'YEARLY' ? 12 : undefined,
        },
      });

      this.logger.log(`Created Mercado Pago preapproval ${preapproval.body.id}`);

      return {
        success: true,
        subscriptionId: preapproval.body.id,
        currency,
      };
    } catch (error) {
      this.logger.error('Error creating recurring subscription', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar assinatura recorrente',
      };
    }
  }

  // ============================================
  // CANCEL SUBSCRIPTION
  // ============================================

  /**
   * Cancela assinatura no Mercado Pago
   */
  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Canceling Mercado Pago subscription ${subscriptionId}`);

    if (!this.isConfigured()) {
      return { success: true, message: 'Assinatura cancelada (mock)' };
    }

    try {
      // No Mercado Pago, cancelamos atualizando o status do preapproval
      await this.mercadopago!.preapproval.update({
        id: subscriptionId,
        status: 'cancelled',
      });

      this.logger.log(`Mercado Pago subscription ${subscriptionId} cancelled`);
      return { success: true, message: 'Assinatura cancelada com sucesso' };
    } catch (error) {
      this.logger.error('Error canceling Mercado Pago subscription', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao cancelar assinatura',
      };
    }
  }

  // ============================================
  // PAYMENT STATUS
  // ============================================

  /**
   * Verifica status de um pagamento
   */
  async checkPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!this.isConfigured()) {
      return { status: 'approved', paid: true };
    }

    try {
      const payment = await this.mercadopago!.payment.findById(parseInt(paymentId, 10));
      const status = payment.body.status;
      const paid = status === 'approved';

      return {
        status,
        paid,
      };
    } catch (error) {
      this.logger.error('Error checking Mercado Pago payment status', error);
      return { status: 'unknown', paid: false };
    }
  }

  /**
   * Mapeia status do Mercado Pago para status interno
   */
  private mapPaymentStatus(mpStatus: MercadoPagoPaymentStatus): PaymentStatus {
    const statusMap: Record<MercadoPagoPaymentStatus, PaymentStatus> = {
      pending: PaymentStatus.PENDING,
      approved: PaymentStatus.CONFIRMED,
      authorized: PaymentStatus.AUTHORIZED,
      in_process: PaymentStatus.PENDING,
      in_mediation: PaymentStatus.PENDING,
      rejected: PaymentStatus.FAILED,
      cancelled: PaymentStatus.CANCELED,
      refunded: PaymentStatus.REFUNDED,
      charged_back: PaymentStatus.CHARGEBACK_REQUESTED,
    };
    return statusMap[mpStatus] || PaymentStatus.PENDING;
  }

  /**
   * Mapeia status do Mercado Pago para status de subscricao
   */
  private mapSubscriptionStatus(mpStatus: MercadoPagoPaymentStatus): SubscriptionStatus {
    switch (mpStatus) {
      case 'approved':
      case 'authorized':
        return SubscriptionStatus.ACTIVE;
      case 'pending':
      case 'in_process':
      case 'in_mediation':
        return SubscriptionStatus.PAST_DUE;
      case 'rejected':
      case 'cancelled':
      case 'refunded':
      case 'charged_back':
        return SubscriptionStatus.CANCELED;
      default:
        return SubscriptionStatus.PAST_DUE;
    }
  }

  // ============================================
  // WEBHOOKS (IPN)
  // ============================================

  /**
   * Processa webhook/IPN do Mercado Pago
   */
  async processWebhook(event: string, payload: any): Promise<void> {
    this.logger.log(`Processing Mercado Pago webhook: ${event}`);

    // O Mercado Pago envia diferentes tipos de notificacoes
    // type: 'payment' | 'plan' | 'subscription' | 'point_integration_wh' | etc.
    // action: 'payment.created' | 'payment.updated' | etc.

    const type = payload.type || event;
    const dataId = payload.data?.id || payload.id;

    if (!dataId) {
      this.logger.warn('Webhook without data ID');
      return;
    }

    switch (type) {
      case 'payment':
        await this.handlePaymentWebhook(dataId, payload.action);
        break;

      case 'subscription_preapproval':
      case 'preapproval':
        await this.handleSubscriptionWebhook(dataId, payload.action);
        break;

      case 'subscription_authorized_payment':
        await this.handleAuthorizedPaymentWebhook(dataId, payload.action);
        break;

      default:
        this.logger.log(`Unhandled Mercado Pago webhook type: ${type}`);
    }
  }

  /**
   * Processa webhook de pagamento
   */
  private async handlePaymentWebhook(paymentId: string, action?: string): Promise<void> {
    this.logger.log(`Handling payment webhook: ${paymentId}, action: ${action}`);

    if (!this.isConfigured()) {
      return;
    }

    try {
      const payment = await this.mercadopago!.payment.findById(parseInt(paymentId, 10));
      const paymentData = payment.body;
      const userId = paymentData.external_reference || paymentData.metadata?.userId;

      if (!userId) {
        this.logger.warn('Payment webhook without userId');
        return;
      }

      const internalStatus = this.mapPaymentStatus(paymentData.status);
      const subscriptionStatus = this.mapSubscriptionStatus(paymentData.status);

      switch (paymentData.status) {
        case 'approved':
          await this.handlePaymentApproved(userId, paymentData);
          break;

        case 'rejected':
        case 'cancelled':
          await this.handlePaymentFailed(userId, paymentData);
          break;

        case 'refunded':
        case 'charged_back':
          await this.handlePaymentRefunded(userId, paymentData);
          break;

        case 'pending':
        case 'in_process':
          await this.handlePaymentPending(userId, paymentData);
          break;

        default:
          this.logger.log(`Unhandled payment status: ${paymentData.status}`);
      }
    } catch (error) {
      this.logger.error('Error handling payment webhook', error);
    }
  }

  /**
   * Handle payment approved
   */
  private async handlePaymentApproved(userId: string, payment: MercadoPagoPayment): Promise<void> {
    this.logger.log(`Payment approved for user ${userId}`);

    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) {
      this.logger.error('PRO plan not found');
      return;
    }

    // Verificar se é o primeiro pagamento confirmado
    const previousPayments = await this.prisma.subscriptionPaymentHistory.count({
      where: {
        userId,
        status: PaymentStatus.CONFIRMED,
      },
    });
    const isFirstPayment = previousPayments === 0;

    // Calcular periodo
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        planId: proPlan.id,
        status: SubscriptionStatus.ACTIVE,
        lastPaymentDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        overdueAt: null,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        creditCardLastFour: payment.card?.last_four_digits,
      },
    });

    // Salvar historico
    await this.savePaymentHistory(userId, {
      mercadoPagoPaymentId: payment.id.toString(),
      amount: payment.transaction_amount,
      status: PaymentStatus.CONFIRMED,
      paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
    });

    this.logger.log(`Subscription activated for user ${userId} via Mercado Pago`);

    // Processar recompensa de indicação (apenas no primeiro pagamento)
    if (isFirstPayment && this.referralRewardsService) {
      try {
        const result = await this.referralRewardsService.processSubscriptionPaid({
          refereeUserId: userId,
          paymentId: payment.id.toString(),
        });

        if (result.rewarded) {
          this.logger.log(
            `Referral reward credited: ${result.monthsCredited} month(s) for referrer of user ${userId}` +
            (result.milestoneReached ? ' (milestone reached!)' : ''),
          );
        }
      } catch (error) {
        // Log error but don't fail the payment confirmation
        this.logger.error(`Error processing referral reward for user ${userId}:`, error);
      }
    }
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(userId: string, payment: MercadoPagoPayment): Promise<void> {
    this.logger.log(`Payment failed for user ${userId}`);

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        overdueAt: new Date(),
      },
    });

    // Salvar historico
    await this.savePaymentHistory(userId, {
      mercadoPagoPaymentId: payment.id.toString(),
      amount: payment.transaction_amount,
      status: PaymentStatus.FAILED,
      errorMessage: payment.status_detail,
    });
  }

  /**
   * Handle payment refunded
   */
  private async handlePaymentRefunded(userId: string, payment: MercadoPagoPayment): Promise<void> {
    this.logger.log(`Payment refunded for user ${userId}`);

    const freePlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.FREE },
    });

    if (!freePlan) return;

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        planId: freePlan.id,
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    // Atualizar historico
    await this.updatePaymentHistoryStatus(payment.id.toString(), PaymentStatus.REFUNDED);
  }

  /**
   * Handle payment pending
   */
  private async handlePaymentPending(userId: string, payment: MercadoPagoPayment): Promise<void> {
    this.logger.log(`Payment pending for user ${userId}`);

    // Salvar historico se ainda nao existe
    await this.savePaymentHistory(userId, {
      mercadoPagoPaymentId: payment.id.toString(),
      amount: payment.transaction_amount,
      status: PaymentStatus.PENDING,
    });
  }

  /**
   * Processa webhook de subscricao (preapproval)
   */
  private async handleSubscriptionWebhook(subscriptionId: string, action?: string): Promise<void> {
    this.logger.log(`Handling subscription webhook: ${subscriptionId}, action: ${action}`);

    if (!this.isConfigured()) {
      return;
    }

    try {
      const subscription = await this.mercadopago!.preapproval.findById(subscriptionId);
      const subData = subscription.body;
      const userId = subData.external_reference;

      if (!userId) {
        this.logger.warn('Subscription webhook without userId');
        return;
      }

      switch (subData.status) {
        case 'authorized':
          await this.handleSubscriptionAuthorized(userId, subData);
          break;

        case 'paused':
          await this.handleSubscriptionPaused(userId);
          break;

        case 'cancelled':
          await this.handleSubscriptionCancelled(userId);
          break;

        default:
          this.logger.log(`Unhandled subscription status: ${subData.status}`);
      }
    } catch (error) {
      this.logger.error('Error handling subscription webhook', error);
    }
  }

  /**
   * Handle subscription authorized
   */
  private async handleSubscriptionAuthorized(userId: string, subscription: MercadoPagoSubscription): Promise<void> {
    this.logger.log(`Subscription authorized for user ${userId}`);

    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) return;

    const periodEnd = subscription.next_payment_date
      ? new Date(subscription.next_payment_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await (this.prisma.userSubscription.update as any)({
      where: { userId },
      data: {
        planId: proPlan.id,
        status: SubscriptionStatus.ACTIVE,
        mercadoPagoSubscriptionId: subscription.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });
  }

  /**
   * Handle subscription paused
   */
  private async handleSubscriptionPaused(userId: string): Promise<void> {
    this.logger.log(`Subscription paused for user ${userId}`);

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
      },
    });
  }

  /**
   * Handle subscription cancelled
   */
  private async handleSubscriptionCancelled(userId: string): Promise<void> {
    this.logger.log(`Subscription cancelled for user ${userId}`);

    const freePlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.FREE },
    });

    if (!freePlan) return;

    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        planId: freePlan.id,
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    });
  }

  /**
   * Processa webhook de pagamento autorizado de subscricao
   */
  private async handleAuthorizedPaymentWebhook(paymentId: string, action?: string): Promise<void> {
    // Delegar para o handler de pagamento normal
    await this.handlePaymentWebhook(paymentId, action);
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Salva historico de pagamento
   */
  private async savePaymentHistory(
    userId: string,
    data: {
      mercadoPagoPaymentId?: string;
      amount: number;
      status: PaymentStatus;
      paidAt?: Date;
      errorMessage?: string;
    },
  ): Promise<void> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) return;

    // Verificar se ja existe para evitar duplicacao
    if (data.mercadoPagoPaymentId) {
      const existing = await this.prisma.subscriptionPaymentHistory.findFirst({
        where: {
          subscriptionId: subscription.id,
          asaasPaymentId: data.mercadoPagoPaymentId, // Reutilizando campo
        },
      });

      if (existing) {
        this.logger.log(`Payment history for ${data.mercadoPagoPaymentId} already exists`);
        return;
      }
    }

    await this.prisma.subscriptionPaymentHistory.create({
      data: {
        subscriptionId: subscription.id,
        asaasPaymentId: data.mercadoPagoPaymentId, // Reutilizando campo para MP
        amount: data.amount,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: data.status,
        dueDate: new Date(),
        paidAt: data.paidAt,
        errorMessage: data.errorMessage,
      },
    });
  }

  /**
   * Atualiza status do historico de pagamento
   */
  private async updatePaymentHistoryStatus(
    mercadoPagoPaymentId: string,
    status: PaymentStatus,
  ): Promise<void> {
    await this.prisma.subscriptionPaymentHistory.updateMany({
      where: { asaasPaymentId: mercadoPagoPaymentId },
      data: { status },
    });
  }

  /**
   * Valida assinatura do webhook usando o secret
   */
  validateWebhookSignature(signature: string, payload: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping validation');
      return true;
    }

    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      this.logger.error('Error validating webhook signature', error);
      return false;
    }
  }
}
