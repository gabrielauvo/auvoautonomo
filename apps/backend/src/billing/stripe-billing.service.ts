/**
 * Stripe Billing Service
 *
 * Gateway de pagamento para clientes internacionais.
 * Usa Stripe para processar pagamentos em USD, EUR, GBP, etc.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  SubscriptionStatus,
  BillingPeriod,
  PlanType,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import {
  IPaymentGateway,
  CustomerData,
  CreditCardData,
  CreditCardHolderData,
  CreateCustomerResult,
  SubscriptionResult,
  PaymentStatusResult,
  PaymentCycle,
  STRIPE_SUPPORTED_COUNTRIES,
  getPaymentMethodsForCountry,
  getCurrencyForCountry,
} from './interfaces/payment-gateway.interface';

// Stripe SDK types (instalar: npm install stripe)
interface Stripe {
  customers: {
    create: (params: any) => Promise<any>;
    update: (id: string, params: any) => Promise<any>;
  };
  subscriptions: {
    create: (params: any) => Promise<any>;
    cancel: (id: string) => Promise<any>;
    retrieve: (id: string) => Promise<any>;
  };
  checkout: {
    sessions: {
      create: (params: any) => Promise<any>;
    };
  };
  paymentIntents: {
    retrieve: (id: string) => Promise<any>;
  };
  prices: {
    create: (params: any) => Promise<any>;
    list: (params: any) => Promise<any>;
  };
}

@Injectable()
export class StripeBillingService implements IPaymentGateway {
  private readonly logger = new Logger(StripeBillingService.name);
  private stripe: Stripe | null = null;
  private readonly webhookSecret: string;

  readonly name = 'stripe';
  readonly supportedCurrencies = [
    'USD', 'CAD', 'MXN',           // América do Norte
    'EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', // Europa
    'AUD', 'NZD', 'JPY', 'SGD', 'HKD', // Ásia-Pacífico
  ];
  readonly supportedCountries = STRIPE_SUPPORTED_COUNTRIES;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    if (apiKey) {
      // Inicializa Stripe SDK dinamicamente
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const StripeSDK = require('stripe');
        this.stripe = new StripeSDK(apiKey, { apiVersion: '2023-10-16' });
        this.logger.log('Stripe SDK initialized');
      } catch (error) {
        this.logger.warn('Stripe SDK not installed. Run: npm install stripe');
      }
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async createOrUpdateCustomer(data: CustomerData): Promise<CreateCustomerResult> {
    this.logger.log(`Creating/updating Stripe customer for user ${data.userId}`);

    if (!this.isConfigured()) {
      // Mock para desenvolvimento
      return {
        success: true,
        customerId: `cus_mock_${data.userId.substring(0, 8)}`,
      };
    }

    try {
      // Verificar se já existe
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId: data.userId },
      }) as any;

      if (subscription?.stripeCustomerId) {
        // Atualizar cliente existente
        const customer = await this.stripe!.customers.update(subscription.stripeCustomerId, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          metadata: { userId: data.userId },
        });
        return { success: true, customerId: customer.id };
      }

      // Criar novo cliente
      const customer = await this.stripe!.customers.create({
        name: data.name,
        email: data.email,
        phone: data.phone,
        metadata: { userId: data.userId, country: data.country },
      });

      this.logger.log(`Created Stripe customer ${customer.id}`);
      return { success: true, customerId: customer.id };
    } catch (error) {
      this.logger.error('Error creating Stripe customer', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar cliente',
      };
    }
  }

  // ============================================
  // SUBSCRIPTIONS
  // ============================================

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
    this.logger.log(`Creating Stripe subscription for user ${userId} (cycle: ${cycle})`);

    if (!this.isConfigured()) {
      // Mock para desenvolvimento
      const nextDueDate = new Date();
      if (cycle === 'YEARLY') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }
      return {
        success: true,
        subscriptionId: `sub_mock_${Date.now()}`,
        status: 'active',
        creditCardLastFour: creditCard.number.slice(-4),
        creditCardBrand: 'visa',
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        currency: 'USD',
      };
    }

    try {
      // No Stripe, é melhor usar Checkout Sessions para coleta de cartão
      // Mas podemos criar subscription com PaymentMethod se já tivermos o cartão tokenizado

      // Por enquanto, retornar erro indicando que deve usar Checkout Session
      return {
        success: false,
        errorMessage: 'Para pagamentos internacionais, use o Stripe Checkout. Chame createCheckoutSession().',
      };
    } catch (error) {
      this.logger.error('Error creating Stripe subscription', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar assinatura',
      };
    }
  }

  /**
   * Cria sessão de checkout do Stripe
   * Redireciona usuário para página de pagamento hospedada pelo Stripe
   * Suporta métodos de pagamento locais por país (OXXO, SEPA, iDEAL, etc.)
   */
  async createCheckoutSession(
    userId: string,
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    country?: string,
  ): Promise<SubscriptionResult> {
    this.logger.log(`Creating Stripe Checkout session for user ${userId}, country: ${country}`);

    const currency = country ? getCurrencyForCountry(country) : 'USD';

    if (!this.isConfigured()) {
      return {
        success: true,
        subscriptionId: `sub_mock_${Date.now()}`,
        checkoutUrl: 'https://checkout.stripe.com/mock-session',
        currency,
      };
    }

    try {
      // Determinar métodos de pagamento baseado no país
      const paymentMethodTypes = this.getPaymentMethodTypesForCountry(country || 'US');

      const session = await this.stripe!.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: paymentMethodTypes,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, country: country || 'US' },
        subscription_data: {
          metadata: { userId, country: country || 'US' },
        },
        // Configurações específicas para México (OXXO)
        ...(country === 'MX' && {
          payment_method_options: {
            oxxo: {
              expires_after_days: 3, // OXXO voucher expira em 3 dias
            },
          },
        }),
        // Configurações para Europa (SEPA)
        ...(this.isSepaCountry(country) && {
          payment_method_options: {
            sepa_debit: {
              mandate_options: {
                transaction_type: 'personal',
              },
            },
          },
        }),
      });

      this.logger.log(`Created Stripe Checkout session ${session.id}`);

      return {
        success: true,
        subscriptionId: session.subscription as string,
        checkoutUrl: session.url || undefined,
        currency,
      };
    } catch (error) {
      this.logger.error('Error creating Stripe Checkout session', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro ao criar checkout',
      };
    }
  }

  /**
   * Retorna os tipos de método de pagamento para o país
   */
  private getPaymentMethodTypesForCountry(country: string): string[] {
    const methods = getPaymentMethodsForCountry(country);
    const types: string[] = [];

    // Cartão sempre disponível
    if (methods.card) types.push('card');

    // México - OXXO
    if (methods.oxxo) types.push('oxxo');

    // Europa - SEPA
    if (methods.sepaDebit) types.push('sepa_debit');

    // Holanda - iDEAL
    if (methods.ideal) types.push('ideal');

    // Bélgica - Bancontact
    if (methods.bancontact) types.push('bancontact');

    // Alemanha - Giropay (descontinuado, usar SEPA)
    // if (methods.giropay) types.push('giropay');

    // Europa - Sofort
    if (methods.sofort) types.push('sofort');

    return types.length > 0 ? types : ['card'];
  }

  /**
   * Verifica se o país está na zona SEPA
   */
  private isSepaCountry(country?: string): boolean {
    if (!country) return false;
    const sepaCountries = ['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'IE', 'FI', 'LU', 'SK', 'SI', 'LV', 'LT', 'EE', 'CY', 'MT', 'GR'];
    return sepaCountries.includes(country.toUpperCase());
  }

  /**
   * Cria ou obtém Price ID do Stripe para o plano
   */
  async getOrCreatePriceId(
    productName: string,
    amount: number,
    currency: string,
    cycle: PaymentCycle,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return `price_mock_${cycle.toLowerCase()}`;
    }

    try {
      // Buscar price existente
      const prices = await this.stripe!.prices.list({
        lookup_keys: [`${productName.toLowerCase()}_${cycle.toLowerCase()}_${currency.toLowerCase()}`],
        active: true,
      });

      if (prices.data.length > 0) {
        return prices.data[0].id;
      }

      // Criar novo price
      const price = await this.stripe!.prices.create({
        unit_amount: Math.round(amount * 100), // Stripe usa centavos
        currency: currency.toLowerCase(),
        recurring: {
          interval: cycle === 'YEARLY' ? 'year' : 'month',
        },
        product_data: {
          name: productName,
        },
        lookup_key: `${productName.toLowerCase()}_${cycle.toLowerCase()}_${currency.toLowerCase()}`,
      });

      return price.id;
    } catch (error) {
      this.logger.error('Error getting/creating Stripe price', error);
      return null;
    }
  }

  // ============================================
  // PAYMENT STATUS
  // ============================================

  async checkPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!this.isConfigured()) {
      return { status: 'succeeded', paid: true };
    }

    try {
      const paymentIntent = await this.stripe!.paymentIntents.retrieve(paymentId);
      const paid = paymentIntent.status === 'succeeded';

      return {
        status: paymentIntent.status,
        paid,
      };
    } catch (error) {
      this.logger.error('Error checking Stripe payment status', error);
      return { status: 'unknown', paid: false };
    }
  }

  // ============================================
  // CANCEL
  // ============================================

  async cancelSubscription(subscriptionId: string): Promise<{ success: boolean; message?: string }> {
    this.logger.log(`Canceling Stripe subscription ${subscriptionId}`);

    if (!this.isConfigured()) {
      return { success: true, message: 'Subscription canceled (mock)' };
    }

    try {
      await this.stripe!.subscriptions.cancel(subscriptionId);
      return { success: true, message: 'Assinatura cancelada com sucesso' };
    } catch (error) {
      this.logger.error('Error canceling Stripe subscription', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao cancelar',
      };
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  async processWebhook(event: string, payload: any): Promise<void> {
    this.logger.log(`Processing Stripe webhook: ${event}`);

    const dataObject = payload.data?.object;
    const userId = dataObject?.metadata?.userId;

    // Alguns eventos podem não ter userId nos metadata (ex: checkout.session)
    // Nesse caso, tentamos buscar da subscription associada
    if (!userId && event !== 'checkout.session.completed' && event !== 'checkout.session.expired') {
      this.logger.warn('Stripe webhook without userId in metadata');
      return;
    }

    switch (event) {
      // Checkout Session events
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(dataObject);
        break;

      case 'checkout.session.expired':
        await this.handleCheckoutSessionExpired(dataObject);
        break;

      case 'checkout.session.async_payment_succeeded':
        await this.handleAsyncPaymentSucceeded(dataObject);
        break;

      case 'checkout.session.async_payment_failed':
        await this.handleAsyncPaymentFailed(dataObject);
        break;

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        if (userId) {
          await this.handleSubscriptionUpdated(userId, dataObject);
        }
        break;

      case 'customer.subscription.deleted':
        if (userId) {
          await this.handleSubscriptionDeleted(userId);
        }
        break;

      // Invoice events
      case 'invoice.paid':
        if (userId) {
          await this.handleInvoicePaid(userId, dataObject);
        }
        break;

      case 'invoice.payment_failed':
        if (userId) {
          await this.handlePaymentFailed(userId);
        }
        break;

      default:
        this.logger.log(`Unhandled Stripe event: ${event}`);
    }
  }

  /**
   * Handle checkout.session.completed
   * Ocorre quando o cliente finaliza o checkout com sucesso
   */
  private async handleCheckoutSessionCompleted(session: any): Promise<void> {
    const userId = session.metadata?.userId;
    const subscriptionId = session.subscription;
    const customerId = session.customer;
    const country = session.metadata?.country || 'US';

    this.logger.log(`Checkout completed for user ${userId}, subscription: ${subscriptionId}`);

    if (!userId) {
      this.logger.warn('Checkout session without userId in metadata');
      return;
    }

    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) {
      this.logger.error('PRO plan not found');
      return;
    }

    // Atualizar ou criar subscription do usuário
    const existingSubscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    const subscriptionData = {
      planId: proPlan.id,
      status: SubscriptionStatus.ACTIVE,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      country: country.toUpperCase(),
      currency: getCurrencyForCountry(country),
      paymentMethod: PaymentMethod.CREDIT_CARD,
      lastPaymentDate: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    };

    if (existingSubscription) {
      await (this.prisma.userSubscription.update as any)({
        where: { userId },
        data: subscriptionData,
      });
    } else {
      await (this.prisma.userSubscription.create as any)({
        data: { userId, ...subscriptionData },
      });
    }

    this.logger.log(`Subscription activated for user ${userId} via Stripe Checkout`);
  }

  /**
   * Handle checkout.session.expired
   * Ocorre quando a sessão de checkout expira sem conclusão
   */
  private async handleCheckoutSessionExpired(session: any): Promise<void> {
    const userId = session.metadata?.userId;
    this.logger.log(`Checkout session expired for user ${userId}`);
    // Não é necessário ação - o usuário pode iniciar um novo checkout
  }

  /**
   * Handle checkout.session.async_payment_succeeded
   * Para métodos como OXXO que são assíncronos
   */
  private async handleAsyncPaymentSucceeded(session: any): Promise<void> {
    const userId = session.metadata?.userId;
    this.logger.log(`Async payment succeeded for user ${userId}`);

    if (!userId) return;

    // O pagamento assíncrono foi confirmado - atualizar status
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        lastPaymentDate: new Date(),
      },
    });
  }

  /**
   * Handle checkout.session.async_payment_failed
   * Para métodos como OXXO que falham
   */
  private async handleAsyncPaymentFailed(session: any): Promise<void> {
    const userId = session.metadata?.userId;
    this.logger.log(`Async payment failed for user ${userId}`);

    if (!userId) return;

    // O pagamento assíncrono falhou - manter em pending ou marcar como failed
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        overdueAt: new Date(),
      },
    });
  }

  private async handleSubscriptionUpdated(userId: string, subscription: any): Promise<void> {
    const status = subscription.status;
    const isActive = status === 'active' || status === 'trialing';

    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) return;

    // Usar cast para any até migração do Prisma ser aplicada
    await (this.prisma.userSubscription.update as any)({
      where: { userId },
      data: {
        stripeSubscriptionId: subscription.id,
        planId: isActive ? proPlan.id : undefined,
        status: isActive ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAST_DUE,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    this.logger.log(`Updated subscription for user ${userId}: ${status}`);
  }

  private async handleSubscriptionDeleted(userId: string): Promise<void> {
    const freePlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.FREE },
    });

    if (!freePlan) return;

    // Usar cast para any até migração do Prisma ser aplicada
    await (this.prisma.userSubscription.update as any)({
      where: { userId },
      data: {
        planId: freePlan.id,
        status: SubscriptionStatus.CANCELED,
        stripeSubscriptionId: null,
        canceledAt: new Date(),
      },
    });

    this.logger.log(`Subscription deleted for user ${userId}`);
  }

  private async handleInvoicePaid(userId: string, invoice: any): Promise<void> {
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        lastPaymentDate: new Date(),
        overdueAt: null,
      },
    });

    this.logger.log(`Invoice paid for user ${userId}`);
  }

  private async handlePaymentFailed(userId: string): Promise<void> {
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        overdueAt: new Date(),
      },
    });

    this.logger.log(`Payment failed for user ${userId}`);
  }
}
