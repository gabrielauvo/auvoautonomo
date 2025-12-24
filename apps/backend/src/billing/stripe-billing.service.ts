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
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  readonly supportedCountries = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'ES', 'IT', 'PT'];

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
   */
  async createCheckoutSession(
    userId: string,
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<SubscriptionResult> {
    this.logger.log(`Creating Stripe Checkout session for user ${userId}`);

    if (!this.isConfigured()) {
      return {
        success: true,
        subscriptionId: `sub_mock_${Date.now()}`,
        checkoutUrl: 'https://checkout.stripe.com/mock-session',
        currency: 'USD',
      };
    }

    try {
      const session = await this.stripe!.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId },
        subscription_data: {
          metadata: { userId },
        },
      });

      this.logger.log(`Created Stripe Checkout session ${session.id}`);

      return {
        success: true,
        subscriptionId: session.subscription as string,
        checkoutUrl: session.url || undefined,
        currency: 'USD',
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

    const userId = payload.data?.object?.metadata?.userId;
    if (!userId) {
      this.logger.warn('Stripe webhook without userId in metadata');
      return;
    }

    switch (event) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(userId, payload.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(userId);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(userId, payload.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(userId);
        break;

      default:
        this.logger.log(`Unhandled Stripe event: ${event}`);
    }
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
