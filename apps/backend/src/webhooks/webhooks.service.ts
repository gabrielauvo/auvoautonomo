import { Injectable, Logger } from '@nestjs/common';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { AsaasWebhookEvent } from '../common/asaas/asaas-http.client';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly clientPaymentsService: ClientPaymentsService) {}

  /**
   * Handle Asaas webhook events
   * Docs: https://docs.asaas.com/reference/webhooks
   */
  async handleAsaasEvent(event: AsaasWebhookEvent): Promise<void> {
    this.logger.log(`Processing Asaas event: ${event.event}`);

    if (!event.payment) {
      this.logger.warn('Webhook event does not contain payment data');
      return;
    }

    // Capture payment to avoid TypeScript narrowing issues in closures
    const payment = event.payment;

    const eventHandlers: Record<string, () => Promise<void>> = {
      PAYMENT_CREATED: async () => {
        this.logger.log(`Payment created: ${payment.id}`);
      },
      PAYMENT_AWAITING_RISK_ANALYSIS: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'AWAITING_RISK_ANALYSIS',
        );
      },
      PAYMENT_APPROVED_BY_RISK_ANALYSIS: async () => {
        this.logger.log(`Payment approved by risk analysis: ${payment.id}`);
      },
      PAYMENT_REPROVED_BY_RISK_ANALYSIS: async () => {
        this.logger.log(`Payment reproved by risk analysis: ${payment.id}`);
      },
      PAYMENT_UPDATED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          payment.status,
        );
      },
      PAYMENT_CONFIRMED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'CONFIRMED',
          payment.confirmedDate ? new Date(payment.confirmedDate) : undefined,
        );
      },
      PAYMENT_RECEIVED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'RECEIVED',
          payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
        );
      },
      PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: async () => {
        this.logger.warn(`Payment credit card capture refused: ${payment.id}`);
      },
      PAYMENT_ANTICIPATED: async () => {
        this.logger.log(`Payment anticipated: ${payment.id}`);
      },
      PAYMENT_OVERDUE: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'OVERDUE',
        );
      },
      PAYMENT_DELETED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'DELETED',
        );
      },
      PAYMENT_RESTORED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'PENDING',
        );
      },
      PAYMENT_REFUNDED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'REFUNDED',
        );
      },
      PAYMENT_PARTIALLY_REFUNDED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'PARTIALLY_REFUNDED',
        );
      },
      PAYMENT_REFUND_IN_PROGRESS: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'REFUND_IN_PROGRESS',
        );
      },
      PAYMENT_AUTHORIZED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'AUTHORIZED',
        );
      },
      PAYMENT_RECEIVED_IN_CASH_UNDONE: async () => {
        this.logger.log(`Payment received in cash undone: ${payment.id}`);
      },
      PAYMENT_CHARGEBACK_REQUESTED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'CHARGEBACK_REQUESTED',
        );
      },
      PAYMENT_CHARGEBACK_DISPUTE: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'CHARGEBACK_DISPUTE',
        );
      },
      PAYMENT_AWAITING_CHARGEBACK_REVERSAL: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'AWAITING_CHARGEBACK_REVERSAL',
        );
      },
      PAYMENT_DUNNING_RECEIVED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'DUNNING_RECEIVED',
        );
      },
      PAYMENT_DUNNING_REQUESTED: async () => {
        await this.clientPaymentsService.updatePaymentStatus(
          payment.id,
          'DUNNING_REQUESTED',
        );
      },
      PAYMENT_BANK_SLIP_VIEWED: async () => {
        this.logger.log(`Payment bank slip viewed: ${payment.id}`);
      },
      PAYMENT_CHECKOUT_VIEWED: async () => {
        this.logger.log(`Payment checkout viewed: ${payment.id}`);
      },
    };

    const handler = eventHandlers[event.event];

    if (handler) {
      try {
        await handler();
        this.logger.log(`Successfully processed event: ${event.event}`);
      } catch (error) {
        this.logger.error(`Failed to process event ${event.event}`, error);
        throw error;
      }
    } else {
      this.logger.warn(`Unhandled event type: ${event.event}`);
    }
  }
}
