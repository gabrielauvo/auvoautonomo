import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  RawBodyRequest,
  Req,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AsaasBillingService } from './asaas-billing.service';
import { StripeBillingService } from './stripe-billing.service';
import { MercadoPagoBillingService } from './mercadopago-billing.service';

/**
 * Webhook events from Asaas for platform subscriptions
 */
interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    subscription?: string;
    customer: string;
    value: number;
    status: string;
    dueDate: string;
    paymentDate?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    status: string;
    nextDueDate: string;
    value: number;
  };
}

/**
 * Payload do webhook IPN do Mercado Pago
 */
interface MercadoPagoWebhookPayload {
  id?: number;
  live_mode?: boolean;
  type?: string;
  date_created?: string;
  user_id?: number;
  api_version?: string;
  action?: string;
  data?: {
    id: string;
  };
  // Query params IPN (formato antigo)
  topic?: string;
}

@Controller('webhooks/billing')
@Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests por minuto para webhooks
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);
  private readonly webhookToken: string;
  private readonly stripeWebhookSecret: string;
  private readonly mercadoPagoWebhookSecret: string;
  private readonly isProduction: boolean;
  private stripe: any = null;

  constructor(
    private readonly asaasBillingService: AsaasBillingService,
    private readonly stripeBillingService: StripeBillingService,
    private readonly mercadoPagoBillingService: MercadoPagoBillingService,
    private readonly configService: ConfigService,
  ) {
    this.webhookToken =
      this.configService.get<string>('ASAAS_PLATFORM_WEBHOOK_TOKEN') || '';
    this.stripeWebhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.mercadoPagoWebhookSecret =
      this.configService.get<string>('MERCADOPAGO_WEBHOOK_SECRET') || '';
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Inicializar Stripe SDK para verificacao de assinatura
    const stripeApiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeApiKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const StripeSDK = require('stripe');
        this.stripe = new StripeSDK(stripeApiKey, { apiVersion: '2023-10-16' });
      } catch (error) {
        this.logger.warn('Stripe SDK not available for webhook verification');
      }
    }

    // Alerta em producao se webhook token nao estiver configurado
    if (this.isProduction && !this.webhookToken) {
      this.logger.error(
        'CRITICAL: ASAAS_PLATFORM_WEBHOOK_TOKEN not configured in production!',
      );
    }
  }

  /**
   * Valida o token do webhook
   * Em produção, token é obrigatório
   */
  private validateWebhookToken(accessToken?: string): void {
    // Em produção, sempre exigir token
    if (this.isProduction) {
      if (!this.webhookToken) {
        throw new UnauthorizedException(
          'Webhook authentication not configured',
        );
      }
      if (!accessToken || accessToken !== this.webhookToken) {
        this.logger.warn('Invalid or missing webhook token in production');
        throw new UnauthorizedException('Invalid webhook token');
      }
    } else {
      // Em desenvolvimento, validar apenas se token estiver configurado
      if (this.webhookToken && accessToken !== this.webhookToken) {
        this.logger.warn('Invalid webhook token received');
        throw new BadRequestException('Invalid webhook token');
      }
    }
  }

  /**
   * POST /webhooks/billing/asaas
   * Receive subscription webhooks from Asaas
   *
   * This endpoint handles billing events for the PLATFORM's own subscriptions
   * (not the autonomous user's client payments - those are handled by WebhooksController)
   */
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async handleAsaasWebhook(
    @Body() payload: AsaasWebhookPayload,
    @Headers('asaas-access-token') accessToken?: string,
  ) {
    this.logger.log(`Received billing webhook: ${payload.event}`);

    // Validar token (obrigatório em produção)
    this.validateWebhookToken(accessToken);

    const { event } = payload;

    if (!event) {
      throw new BadRequestException('Missing event type');
    }

    try {
      await this.asaasBillingService.processWebhook(event, payload);
      return { received: true, event };
    } catch (error) {
      this.logger.error(`Error processing webhook ${event}`, error);
      // Return success to avoid retries for non-critical errors
      return { received: true, event, error: 'Processing error logged' };
    }
  }

  /**
   * POST /webhooks/billing/asaas/payment
   * Handle payment-specific webhooks
   */
  @Post('asaas/payment')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Body() payload: AsaasWebhookPayload,
    @Headers('asaas-access-token') accessToken?: string,
  ) {
    this.logger.log(`Received payment webhook: ${payload.event}`);

    // Validar token (obrigatório em produção)
    this.validateWebhookToken(accessToken);

    const { event, payment } = payload;

    if (!event || !payment) {
      throw new BadRequestException('Missing event or payment data');
    }

    // Map payment events to subscription events
    const subscriptionEvents = [
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_DELETED',
      'PAYMENT_REFUNDED',
    ];

    if (subscriptionEvents.includes(event) && payment.subscription) {
      // This is a subscription payment
      await this.asaasBillingService.processWebhook(event, {
        ...payload,
        subscription: { id: payment.subscription },
      });
    }

    return { received: true, event };
  }

  /**
   * POST /webhooks/billing/asaas/subscription
   * Handle subscription-specific webhooks
   */
  @Post('asaas/subscription')
  @HttpCode(HttpStatus.OK)
  async handleSubscriptionWebhook(
    @Body() payload: AsaasWebhookPayload,
    @Headers('asaas-access-token') accessToken?: string,
  ) {
    this.logger.log(`Received subscription webhook: ${payload.event}`);

    // Validar token (obrigatório em produção)
    this.validateWebhookToken(accessToken);

    const { event, subscription } = payload;

    if (!event) {
      throw new BadRequestException('Missing event type');
    }

    await this.asaasBillingService.processWebhook(event, payload);

    return { received: true, event };
  }

  // ============================================
  // STRIPE WEBHOOKS
  // ============================================

  /**
   * POST /webhooks/billing/stripe
   * Receive webhooks from Stripe for international customers
   *
   * Eventos importantes:
   * - checkout.session.completed: Checkout finalizado com sucesso
   * - customer.subscription.created: Assinatura criada
   * - customer.subscription.updated: Assinatura atualizada
   * - customer.subscription.deleted: Assinatura cancelada
   * - invoice.paid: Fatura paga
   * - invoice.payment_failed: Falha no pagamento
   * - payment_intent.succeeded: Pagamento confirmado
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    this.logger.log('Received Stripe webhook');

    // Verificar assinatura do webhook em produção
    let event: any;

    if (this.stripe && this.stripeWebhookSecret && signature) {
      try {
        // Stripe requer o raw body para verificar a assinatura
        const rawBody = req.rawBody;
        if (!rawBody) {
          this.logger.warn('Raw body not available for Stripe webhook verification');
          throw new BadRequestException('Raw body required for webhook verification');
        }

        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          this.stripeWebhookSecret,
        );
      } catch (err) {
        this.logger.error('Invalid Stripe webhook signature', err);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (this.isProduction) {
      // Em produção, exigir verificação de assinatura
      this.logger.error('Stripe webhook verification not configured in production');
      throw new UnauthorizedException('Webhook verification required');
    } else {
      // Em desenvolvimento, aceitar o body diretamente
      event = req.body;
    }

    const eventType = event.type || event.event;
    this.logger.log(`Processing Stripe event: ${eventType}`);

    if (!eventType) {
      throw new BadRequestException('Missing event type');
    }

    try {
      await this.stripeBillingService.processWebhook(eventType, event);
      return { received: true, type: eventType };
    } catch (error) {
      this.logger.error(`Error processing Stripe webhook ${eventType}`, error);
      // Return success to avoid retries for non-critical errors
      return { received: true, type: eventType, error: 'Processing error logged' };
    }
  }

  /**
   * POST /webhooks/billing/stripe/checkout
   * Handle Stripe Checkout session webhooks specifically
   * Use este endpoint se preferir separar os webhooks de checkout
   */
  @Post('stripe/checkout')
  @HttpCode(HttpStatus.OK)
  async handleStripeCheckoutWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    this.logger.log('Received Stripe Checkout webhook');

    let event: any;

    if (this.stripe && this.stripeWebhookSecret && signature) {
      try {
        const rawBody = req.rawBody;
        if (!rawBody) {
          throw new BadRequestException('Raw body required');
        }
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          signature,
          this.stripeWebhookSecret,
        );
      } catch (err) {
        this.logger.error('Invalid Stripe webhook signature', err);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    } else if (this.isProduction) {
      throw new UnauthorizedException('Webhook verification required');
    } else {
      event = req.body;
    }

    const eventType = event.type || event.event;
    this.logger.log(`Processing Stripe Checkout event: ${eventType}`);

    // Processar apenas eventos de checkout
    const checkoutEvents = [
      'checkout.session.completed',
      'checkout.session.expired',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
    ];

    if (!checkoutEvents.includes(eventType)) {
      this.logger.log(`Ignoring non-checkout event: ${eventType}`);
      return { received: true, type: eventType, ignored: true };
    }

    try {
      await this.stripeBillingService.processWebhook(eventType, event);
      return { received: true, type: eventType };
    } catch (error) {
      this.logger.error(`Error processing Stripe checkout ${eventType}`, error);
      return { received: true, type: eventType, error: 'Processing error logged' };
    }
  }

  // ============================================
  // MERCADO PAGO WEBHOOKS (IPN)
  // ============================================

  /**
   * POST /webhooks/billing/mercadopago
   * Receive IPN notifications from Mercado Pago for LATAM customers
   *
   * Mercado Pago envia dois tipos de notificacao:
   * 1. Webhooks (novo): POST com JSON no body
   * 2. IPN (antigo): POST com topic e id nos query params
   *
   * Tipos de notificacao:
   * - payment: Pagamento criado/atualizado
   * - subscription_preapproval: Assinatura criada/atualizada
   * - subscription_authorized_payment: Pagamento de assinatura autorizado
   *
   * Paises suportados: Argentina (AR), Chile (CL), Colombia (CO), Peru (PE), Uruguay (UY)
   */
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: MercadoPagoWebhookPayload,
    @Query('topic') topic?: string,
    @Query('id') queryId?: string,
    @Headers('x-signature') signature?: string,
  ) {
    this.logger.log('Received Mercado Pago webhook/IPN');

    // Determinar tipo de notificacao (novo webhook ou IPN antigo)
    let eventType = payload.type || topic;
    let dataId = payload.data?.id || queryId;

    // Verificar assinatura em producao
    if (this.isProduction && this.mercadoPagoWebhookSecret) {
      const rawBody = req.rawBody?.toString() || JSON.stringify(payload);
      const isValid = this.mercadoPagoBillingService.validateWebhookSignature(
        signature || '',
        rawBody,
      );

      if (!isValid) {
        this.logger.warn('Invalid Mercado Pago webhook signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Log detalhado para debug
    this.logger.log(`Mercado Pago notification - type: ${eventType}, id: ${dataId}, action: ${payload.action}`);

    if (!eventType) {
      // Mercado Pago requer resposta 200 mesmo para notificacoes invalidas
      this.logger.warn('Mercado Pago notification without event type');
      return { received: true };
    }

    try {
      await this.mercadoPagoBillingService.processWebhook(eventType, {
        ...payload,
        type: eventType,
        data: { id: dataId || '' },
      });
      return { received: true, type: eventType };
    } catch (error) {
      this.logger.error(`Error processing Mercado Pago webhook ${eventType}`, error);
      // Return success to avoid retries - Mercado Pago espera 200 OK
      return { received: true, type: eventType, error: 'Processing error logged' };
    }
  }

  /**
   * POST /webhooks/billing/mercadopago/payment
   * Handle payment-specific IPN notifications from Mercado Pago
   */
  @Post('mercadopago/payment')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoPaymentWebhook(
    @Body() payload: MercadoPagoWebhookPayload,
    @Query('id') paymentId?: string,
    @Headers('x-signature') signature?: string,
  ) {
    this.logger.log(`Received Mercado Pago payment notification: ${paymentId || payload.data?.id}`);

    const dataId = payload.data?.id || paymentId;

    if (!dataId) {
      this.logger.warn('Mercado Pago payment notification without ID');
      return { received: true };
    }

    try {
      await this.mercadoPagoBillingService.processWebhook('payment', {
        ...payload,
        type: 'payment',
        data: { id: dataId },
      });
      return { received: true, type: 'payment', paymentId: dataId };
    } catch (error) {
      this.logger.error(`Error processing Mercado Pago payment ${dataId}`, error);
      return { received: true, type: 'payment', error: 'Processing error logged' };
    }
  }

  /**
   * POST /webhooks/billing/mercadopago/subscription
   * Handle subscription-specific IPN notifications (preapproval)
   */
  @Post('mercadopago/subscription')
  @HttpCode(HttpStatus.OK)
  async handleMercadoPagoSubscriptionWebhook(
    @Body() payload: MercadoPagoWebhookPayload,
    @Query('id') subscriptionId?: string,
    @Headers('x-signature') signature?: string,
  ) {
    this.logger.log(`Received Mercado Pago subscription notification: ${subscriptionId || payload.data?.id}`);

    const dataId = payload.data?.id || subscriptionId;

    if (!dataId) {
      this.logger.warn('Mercado Pago subscription notification without ID');
      return { received: true };
    }

    try {
      await this.mercadoPagoBillingService.processWebhook('subscription_preapproval', {
        ...payload,
        type: 'subscription_preapproval',
        data: { id: dataId },
      });
      return { received: true, type: 'subscription_preapproval', subscriptionId: dataId };
    } catch (error) {
      this.logger.error(`Error processing Mercado Pago subscription ${dataId}`, error);
      return { received: true, type: 'subscription_preapproval', error: 'Processing error logged' };
    }
  }
}
