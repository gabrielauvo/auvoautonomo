import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { RegionalService } from '../regional/regional.service';
import { AsaasHttpClient, AsaasCustomer, AsaasPayment } from '../common/asaas/asaas-http.client';
import { AsaasIntegrationService } from '../asaas-integration/asaas-integration.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationType,
  PaymentCreatedContext,
  PaymentConfirmedContext,
  PaymentOverdueContext,
} from '../notifications/notifications.types';
import { DomainEventsService } from '../domain-events/domain-events.service';

@Injectable()
export class ClientPaymentsService {
  private readonly logger = new Logger(ClientPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasClient: AsaasHttpClient,
    private readonly asaasIntegration: AsaasIntegrationService,
    private readonly notificationsService: NotificationsService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly domainEventsService: DomainEventsService,
    private readonly regionalService: RegionalService,
  ) {}

  /**
   * Synchronize client with Asaas customers
   * Creates or updates customer in Asaas and stores the customerId
   */
  async syncCustomer(userId: string, clientId: string): Promise<string> {
    this.logger.log(`Syncing client ${clientId} with Asaas for user ${userId}`);

    const client = await this.prisma.client.findUnique({
      where: { id: clientId, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const { apiKey, environment } = await this.asaasIntegration.getApiKey(userId);

    const asaasCustomer: AsaasCustomer = {
      id: client.asaasCustomerId || undefined,
      name: client.name,
      email: client.email || undefined,
      phone: client.phone || undefined,
      cpfCnpj: client.taxId || undefined,
      postalCode: client.zipCode || undefined,
      address: client.address || undefined,
      province: client.state || undefined,
      externalReference: client.id,
    };

    const createdCustomer = await this.asaasClient.createOrUpdateCustomer(apiKey, environment, asaasCustomer);

    await this.prisma.client.update({
      where: { id: clientId },
      data: { asaasCustomerId: createdCustomer.id },
    });

    this.logger.log(`Client ${clientId} synced with Asaas customer ${createdCustomer.id}`);

    return createdCustomer.id!;
  }

  /**
   * Create a payment charge for a client
   * POST /clients/:clientId/payments
   *
   * If Asaas integration is not active, creates a local payment record
   */
  async createPayment(userId: string, dto: CreatePaymentDto) {
    // Check plan limit before creating
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'PAYMENT',
    });

    this.logger.log(`Creating payment for client ${dto.clientId}`);

    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (dto.quoteId) {
      const quote = await this.prisma.quote.findUnique({
        where: { id: dto.quoteId, userId },
      });
      if (!quote) {
        throw new NotFoundException('Quote not found');
      }
    }

    if (dto.workOrderId) {
      const workOrder = await this.prisma.workOrder.findUnique({
        where: { id: dto.workOrderId, userId },
      });
      if (!workOrder) {
        throw new NotFoundException('Work order not found');
      }
    }

    // Get the company's configured currency
    const currency = await this.regionalService.getCompanyCurrency(userId);

    // Try to get Asaas integration, but allow local payments if not available
    let asaasIntegrationData: { apiKey: string; environment: any } | null = null;

    try {
      asaasIntegrationData = await this.asaasIntegration.getApiKey(userId);
    } catch (error) {
      this.logger.log(`Asaas integration not available for user ${userId}, creating local payment`);
    }

    let asaasPaymentId: string | undefined = undefined;
    let asaasInvoiceUrl: string | undefined = undefined;
    let asaasQrCodeUrl: string | undefined = undefined;
    let asaasPixCode: string | undefined = undefined;
    let paymentStatus: PaymentStatus = PaymentStatus.PENDING;

    // If Asaas integration is active, create payment in Asaas
    if (asaasIntegrationData) {
      try {
        let asaasCustomerId = client.asaasCustomerId;

        if (!asaasCustomerId) {
          asaasCustomerId = await this.syncCustomer(userId, dto.clientId);
        }

        const billingTypeMap = {
          BOLETO: 'BOLETO' as const,
          PIX: 'PIX' as const,
          CREDIT_CARD: 'CREDIT_CARD' as const,
        };

        const asaasPayment: AsaasPayment = {
          customer: asaasCustomerId,
          billingType: billingTypeMap[dto.billingType],
          value: dto.value,
          dueDate: dto.dueDate,
          description: dto.description,
          externalReference: dto.quoteId || dto.workOrderId,
        };

        const paymentResponse = await this.asaasClient.createPayment(
          asaasIntegrationData.apiKey,
          asaasIntegrationData.environment,
          asaasPayment,
        );

        asaasPaymentId = paymentResponse.id;
        asaasInvoiceUrl = paymentResponse.invoiceUrl || paymentResponse.bankSlipUrl || undefined;
        asaasQrCodeUrl = paymentResponse.pixTransaction?.qrCode?.encodedImage || undefined;
        asaasPixCode = paymentResponse.pixTransaction?.qrCode?.payload || undefined;
        paymentStatus = this.mapAsaasStatusToPaymentStatus(paymentResponse.status);

        this.logger.log(`Payment created in Asaas: ${asaasPaymentId}`);
      } catch (asaasError) {
        this.logger.warn(`Failed to create payment in Asaas, creating local payment: ${asaasError}`);
        // Continue with local payment creation
      }
    }

    // Create payment record in database (with or without Asaas)
    const payment = await this.prisma.clientPayment.create({
      data: {
        userId,
        clientId: dto.clientId,
        quoteId: dto.quoteId,
        workOrderId: dto.workOrderId,
        asaasPaymentId: asaasPaymentId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        billingType: dto.billingType,
        value: dto.value,
        description: dto.description,
        dueDate: new Date(dto.dueDate),
        status: paymentStatus,
        asaasInvoiceUrl,
        asaasQrCodeUrl,
        asaasPixCode,
        currency,
      },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    this.logger.log(`Payment created: ${payment.id}${asaasPaymentId ? ` (Asaas: ${asaasPaymentId})` : ' (local only)'}`);

    // Send payment created notification
    await this.sendPaymentCreatedNotification(userId, payment);

    // Create domain event for push notification
    await this.domainEventsService.createEvent({
      type: 'payment.created',
      entity: 'payment',
      entityId: payment.id,
      targetUserId: userId,
      payload: {
        value: payment.value.toNumber(),
        clientName: payment.client.name,
        status: payment.status,
      },
    });

    return {
      id: payment.id,
      asaasPaymentId: payment.asaasPaymentId,
      clientId: payment.clientId,
      clientName: payment.client.name,
      billingType: payment.billingType,
      value: payment.value.toNumber(),
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      invoiceUrl: payment.asaasInvoiceUrl,
      qrCodeUrl: payment.asaasQrCodeUrl,
      pixCode: payment.asaasPixCode,
      publicToken: payment.publicToken,
      createdAt: payment.createdAt,
      isLocalOnly: !asaasPaymentId, // Indicates if payment is local only (no Asaas)
    };
  }

  /**
   * List payments for user
   */
  async listPayments(userId: string, clientId?: string) {
    const where: any = { userId };

    if (clientId) {
      where.clientId = clientId;
    }

    const payments = await this.prisma.clientPayment.findMany({
      where,
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((payment) => ({
      id: payment.id,
      asaasPaymentId: payment.asaasPaymentId,
      clientId: payment.clientId,
      clientName: payment.client.name,
      billingType: payment.billingType,
      value: payment.value.toNumber(),
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      invoiceUrl: payment.asaasInvoiceUrl,
      paidAt: payment.paidAt,
      canceledAt: payment.canceledAt,
      publicToken: payment.publicToken,
      createdAt: payment.createdAt,
    }));
  }

  /**
   * Get payment by ID
   */
  async getPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.clientPayment.findUnique({
      where: { id: paymentId, userId },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      id: payment.id,
      asaasPaymentId: payment.asaasPaymentId,
      clientId: payment.clientId,
      clientName: payment.client.name,
      billingType: payment.billingType,
      value: payment.value.toNumber(),
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      invoiceUrl: payment.asaasInvoiceUrl,
      qrCodeUrl: payment.asaasQrCodeUrl,
      pixCode: payment.asaasPixCode,
      paidAt: payment.paidAt,
      canceledAt: payment.canceledAt,
      sentAt: payment.sentAt,
      publicToken: payment.publicToken,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      quote: payment.quote,
      workOrder: payment.workOrder,
    };
  }

  /**
   * Update payment status from webhook
   * @internal
   */
  async updatePaymentStatus(asaasPaymentId: string, status: string, paidAt?: Date) {
    this.logger.log(`Updating payment ${asaasPaymentId} status to ${status}`);

    const payment = await this.prisma.clientPayment.findUnique({
      where: { asaasPaymentId },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for Asaas payment ID: ${asaasPaymentId}`);
      return;
    }

    const previousStatus = payment.status;
    const mappedStatus = this.mapAsaasStatusToPaymentStatus(status);

    const updatedPayment = await this.prisma.clientPayment.update({
      where: { asaasPaymentId },
      data: {
        status: mappedStatus,
        paidAt: paidAt || (mappedStatus === PaymentStatus.RECEIVED ? new Date() : undefined),
      },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    this.logger.log(`Payment ${payment.id} status updated to ${mappedStatus}`);

    // Send notifications based on status change
    if (previousStatus !== mappedStatus) {
      if (
        mappedStatus === PaymentStatus.CONFIRMED ||
        mappedStatus === PaymentStatus.RECEIVED ||
        mappedStatus === PaymentStatus.RECEIVED_IN_CASH
      ) {
        await this.sendPaymentConfirmedNotification(payment.userId, updatedPayment);

        // Create domain event for push notification
        await this.domainEventsService.createEvent({
          type: 'payment.confirmed',
          entity: 'payment',
          entityId: payment.id,
          targetUserId: payment.userId,
          payload: {
            value: updatedPayment.value.toNumber(),
            clientName: updatedPayment.client.name,
            status: mappedStatus,
          },
        });
      } else if (mappedStatus === PaymentStatus.OVERDUE) {
        await this.sendPaymentOverdueNotification(payment.userId, updatedPayment);

        // Create domain event for push notification
        await this.domainEventsService.createEvent({
          type: 'payment.overdue',
          entity: 'payment',
          entityId: payment.id,
          targetUserId: payment.userId,
          payload: {
            value: updatedPayment.value.toNumber(),
            clientName: updatedPayment.client.name,
            status: mappedStatus,
          },
        });
      }
    }
  }

  /**
   * Map Asaas payment status to internal PaymentStatus enum
   * Reference: https://docs.asaas.com/docs/webhook-para-cobrancas
   */
  private mapAsaasStatusToPaymentStatus(asaasStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      CONFIRMED: PaymentStatus.CONFIRMED,
      RECEIVED: PaymentStatus.RECEIVED,
      OVERDUE: PaymentStatus.OVERDUE,
      REFUNDED: PaymentStatus.REFUNDED,
      DELETED: PaymentStatus.DELETED,
      RECEIVED_IN_CASH: PaymentStatus.RECEIVED_IN_CASH,
      REFUND_REQUESTED: PaymentStatus.REFUND_REQUESTED,
      REFUND_IN_PROGRESS: PaymentStatus.REFUND_IN_PROGRESS,
      PARTIALLY_REFUNDED: PaymentStatus.PARTIALLY_REFUNDED,
      CHARGEBACK_REQUESTED: PaymentStatus.CHARGEBACK_REQUESTED,
      CHARGEBACK_DISPUTE: PaymentStatus.CHARGEBACK_DISPUTE,
      AWAITING_CHARGEBACK_REVERSAL: PaymentStatus.AWAITING_CHARGEBACK_REVERSAL,
      DUNNING_REQUESTED: PaymentStatus.DUNNING_REQUESTED,
      DUNNING_RECEIVED: PaymentStatus.DUNNING_RECEIVED,
      AWAITING_RISK_ANALYSIS: PaymentStatus.AWAITING_RISK_ANALYSIS,
      AUTHORIZED: PaymentStatus.AUTHORIZED,
    };

    return statusMap[asaasStatus] || PaymentStatus.PENDING;
  }

  /**
   * Send notification when payment is created
   */
  private async sendPaymentCreatedNotification(userId: string, payment: any): Promise<void> {
    try {
      const billingTypeMap: Record<string, string> = {
        BOLETO: 'Boleto',
        PIX: 'PIX',
        CREDIT_CARD: 'Cartão de Crédito',
      };

      // Fetch user to get company Pix key info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          pixKey: true,
          pixKeyType: true,
          pixKeyOwnerName: true,
          pixKeyEnabled: true,
        },
      });

      const context: PaymentCreatedContext = {
        clientName: payment.client.name,
        clientEmail: payment.client.email,
        clientPhone: payment.client.phone,
        paymentId: payment.id,
        value: payment.value.toNumber(),
        billingType: billingTypeMap[payment.billingType] || payment.billingType,
        dueDate: new Date(payment.dueDate).toLocaleDateString('pt-BR'),
        paymentLink: payment.asaasInvoiceUrl || undefined,
        pixCode: payment.asaasPixCode || undefined,
        workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
        quoteNumber: payment.quote?.id?.substring(0, 8).toUpperCase(),
        // Include company Pix key if enabled
        companyPixKey: user?.pixKeyEnabled && user?.pixKey ? user.pixKey : undefined,
        companyPixKeyType: user?.pixKeyEnabled && user?.pixKeyType ? user.pixKeyType : undefined,
        companyPixKeyOwnerName: user?.pixKeyEnabled && user?.pixKeyOwnerName ? user.pixKeyOwnerName : undefined,
      };

      await this.notificationsService.sendNotification({
        userId,
        clientId: payment.clientId,
        clientPaymentId: payment.id,
        quoteId: payment.quoteId,
        workOrderId: payment.workOrderId,
        type: NotificationType.PAYMENT_CREATED,
        contextData: context,
      });

      this.logger.log(`Payment created notification triggered for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment created notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send notification when payment is confirmed
   */
  private async sendPaymentConfirmedNotification(userId: string, payment: any): Promise<void> {
    try {
      const context: PaymentConfirmedContext = {
        clientName: payment.client.name,
        clientEmail: payment.client.email,
        clientPhone: payment.client.phone,
        paymentId: payment.id,
        value: payment.value.toNumber(),
        paidAt: payment.paidAt
          ? new Date(payment.paidAt).toLocaleString('pt-BR')
          : new Date().toLocaleString('pt-BR'),
        workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
      };

      await this.notificationsService.sendNotification({
        userId,
        clientId: payment.clientId,
        clientPaymentId: payment.id,
        quoteId: payment.quoteId,
        workOrderId: payment.workOrderId,
        type: NotificationType.PAYMENT_CONFIRMED,
        contextData: context,
      });

      this.logger.log(`Payment confirmed notification triggered for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment confirmed notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send notification when payment is overdue
   */
  private async sendPaymentOverdueNotification(userId: string, payment: any): Promise<void> {
    try {
      const dueDate = new Date(payment.dueDate);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch user to get company Pix key info
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          pixKey: true,
          pixKeyType: true,
          pixKeyOwnerName: true,
          pixKeyEnabled: true,
        },
      });

      const context: PaymentOverdueContext = {
        clientName: payment.client.name,
        clientEmail: payment.client.email,
        clientPhone: payment.client.phone,
        paymentId: payment.id,
        value: payment.value.toNumber(),
        dueDate: dueDate.toLocaleDateString('pt-BR'),
        daysOverdue: Math.max(0, daysOverdue),
        paymentLink: payment.asaasInvoiceUrl || undefined,
        workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
        // Include company Pix key if enabled
        companyPixKey: user?.pixKeyEnabled && user?.pixKey ? user.pixKey : undefined,
        companyPixKeyType: user?.pixKeyEnabled && user?.pixKeyType ? user.pixKeyType : undefined,
        companyPixKeyOwnerName: user?.pixKeyEnabled && user?.pixKeyOwnerName ? user.pixKeyOwnerName : undefined,
      };

      await this.notificationsService.sendNotification({
        userId,
        clientId: payment.clientId,
        clientPaymentId: payment.id,
        quoteId: payment.quoteId,
        workOrderId: payment.workOrderId,
        type: NotificationType.PAYMENT_OVERDUE,
        contextData: context,
      });

      this.logger.log(`Payment overdue notification triggered for payment ${payment.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send payment overdue notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Register manual payment (receive in cash)
   * Used when payment is received outside Asaas (cash, transfer, etc.)
   */
  async receivePaymentInCash(
    userId: string,
    paymentId: string,
    data: {
      paymentDate: string;
      value: number;
      paymentMethod?: string;
      notes?: string;
    },
  ) {
    this.logger.log(`Registering manual payment for payment ${paymentId}`);

    const payment = await this.prisma.clientPayment.findUnique({
      where: { id: paymentId, userId },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if payment can receive manual payment (only PENDING or OVERDUE)
    if (payment.status !== PaymentStatus.PENDING && payment.status !== PaymentStatus.OVERDUE) {
      throw new BadRequestException(
        `Não é possível registrar pagamento manual para cobrança com status ${payment.status}`,
      );
    }

    const paidAt = new Date(data.paymentDate);

    // Update payment in database
    const updatedPayment = await this.prisma.clientPayment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.RECEIVED_IN_CASH,
        paidAt,
      },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    this.logger.log(`Payment ${paymentId} marked as received in cash`);

    // Send payment confirmed notification
    await this.sendPaymentConfirmedNotification(userId, updatedPayment);

    // Create domain event for push notification
    await this.domainEventsService.createEvent({
      type: 'payment.confirmed',
      entity: 'payment',
      entityId: payment.id,
      targetUserId: userId,
      payload: {
        value: updatedPayment.value.toNumber(),
        clientName: updatedPayment.client.name,
        status: PaymentStatus.RECEIVED_IN_CASH,
      },
    });

    return {
      id: updatedPayment.id,
      asaasPaymentId: updatedPayment.asaasPaymentId,
      clientId: updatedPayment.clientId,
      clientName: updatedPayment.client.name,
      billingType: updatedPayment.billingType,
      value: updatedPayment.value.toNumber(),
      description: updatedPayment.description,
      dueDate: updatedPayment.dueDate,
      status: updatedPayment.status,
      invoiceUrl: updatedPayment.asaasInvoiceUrl,
      qrCodeUrl: updatedPayment.asaasQrCodeUrl,
      pixCode: updatedPayment.asaasPixCode,
      paidAt: updatedPayment.paidAt,
      publicToken: updatedPayment.publicToken,
      createdAt: updatedPayment.createdAt,
      updatedAt: updatedPayment.updatedAt,
    };
  }

  /**
   * Send payment email to client manually
   */
  async sendPaymentEmail(userId: string, paymentId: string) {
    const payment = await this.prisma.clientPayment.findUnique({
      where: { id: paymentId, userId },
      include: {
        client: true,
        quote: true,
        workOrder: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.client.email) {
      throw new BadRequestException('Client does not have an email address');
    }

    const billingTypeMap: Record<string, string> = {
      BOLETO: 'Boleto',
      PIX: 'PIX',
      CREDIT_CARD: 'Cartão de Crédito',
    };

    // Fetch user to get company Pix key info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        pixKey: true,
        pixKeyType: true,
        pixKeyOwnerName: true,
        pixKeyEnabled: true,
      },
    });

    const context: PaymentCreatedContext = {
      clientName: payment.client.name,
      clientEmail: payment.client.email || undefined,
      clientPhone: payment.client.phone || undefined,
      paymentId: payment.id,
      value: payment.value.toNumber(),
      billingType: billingTypeMap[payment.billingType] || payment.billingType,
      dueDate: new Date(payment.dueDate).toLocaleDateString('pt-BR'),
      paymentLink: payment.asaasInvoiceUrl || undefined,
      pixCode: payment.asaasPixCode || undefined,
      workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
      quoteNumber: payment.quote?.id?.substring(0, 8).toUpperCase(),
      // Include company Pix key if enabled
      companyPixKey: user?.pixKeyEnabled && user?.pixKey ? user.pixKey : undefined,
      companyPixKeyType: user?.pixKeyEnabled && user?.pixKeyType ? user.pixKeyType : undefined,
      companyPixKeyOwnerName: user?.pixKeyEnabled && user?.pixKeyOwnerName ? user.pixKeyOwnerName : undefined,
    };

    // Send notification
    await this.notificationsService.sendNotification({
      userId,
      clientId: payment.clientId,
      clientPaymentId: payment.id,
      quoteId: payment.quoteId || undefined,
      workOrderId: payment.workOrderId || undefined,
      type: NotificationType.PAYMENT_CREATED,
      contextData: context,
    });

    // Update sentAt timestamp
    await this.prisma.clientPayment.update({
      where: { id: paymentId },
      data: { sentAt: new Date() },
    });

    this.logger.log(`Payment email sent manually for payment ${paymentId}`);

    return { success: true, message: 'Email sent successfully' };
  }
}
