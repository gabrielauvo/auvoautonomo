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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AsaasBillingService } from './asaas-billing.service';

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

@Controller('webhooks/billing')
@Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests por minuto para webhooks
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);
  private readonly webhookToken: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly asaasBillingService: AsaasBillingService,
    private readonly configService: ConfigService,
  ) {
    this.webhookToken =
      this.configService.get<string>('ASAAS_PLATFORM_WEBHOOK_TOKEN') || '';
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Alerta em produção se webhook token não estiver configurado
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
}
