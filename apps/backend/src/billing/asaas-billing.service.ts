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

// ============================================
// INTERFACES
// ============================================

export interface CreateAsaasCustomerDto {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  status: string;
  nextDueDate: string;
  cycle: string;
}

export interface CreditCardInfo {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  status: string;
  billingType: string;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  creditCard?: {
    creditCardNumber: string;
    creditCardBrand: string;
    creditCardToken: string;
  };
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface CheckoutResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  pixExpiresAt?: string;
  creditCardLastFour?: string;
  creditCardBrand?: string;
  errorMessage?: string;
}

// ============================================
// SERVICE
// ============================================

/**
 * AsaasBillingService - Gerencia cobranças da plataforma via Asaas
 *
 * Funcionalidades:
 * - Criar clientes no Asaas
 * - Processar pagamentos com PIX (inline com QR Code)
 * - Processar pagamentos com Cartão de Crédito (tokenizado)
 * - Retry automático de cartão por 15 dias
 * - Bloqueio de conta após 15 dias de inadimplência
 * - Webhooks para atualização de status
 */
@Injectable()
export class AsaasBillingService {
  private readonly logger = new Logger(AsaasBillingService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly GRACE_PERIOD_DAYS = 15; // Dias de tolerância antes de bloquear

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // URL da API (sandbox ou produção)
    this.apiUrl =
      this.configService.get<string>('ASAAS_API_URL') ||
      'https://sandbox.asaas.com/api/v3';
    this.apiKey = this.configService.get<string>('ASAAS_API_KEY') || '';
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  /**
   * Cria ou atualiza cliente no Asaas
   */
  async createOrUpdateCustomer(
    userId: string,
    data: CreateAsaasCustomerDto,
  ): Promise<AsaasCustomerResponse> {
    this.logger.log(`Creating/updating Asaas customer for user ${userId}`);

    // Verificar se já existe cliente
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (subscription?.asaasCustomerId) {
      // Atualizar cliente existente
      return this.updateCustomer(subscription.asaasCustomerId, data);
    }

    // Criar novo cliente
    return this.createCustomer(userId, data);
  }

  /**
   * Cria cliente no Asaas
   */
  async createCustomer(
    userId: string,
    data: CreateAsaasCustomerDto,
  ): Promise<AsaasCustomerResponse> {
    if (!this.isConfigured()) {
      this.logger.warn('Asaas API not configured, returning mock customer');
      return {
        id: `cus_mock_${userId.substring(0, 8)}`,
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
          phone: data.phone,
          mobilePhone: data.mobilePhone,
          postalCode: data.postalCode?.replace(/\D/g, ''),
          address: data.address,
          addressNumber: data.addressNumber,
          province: data.province,
          externalReference: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('Failed to create Asaas customer', error);
        throw new BadRequestException(
          error.errors?.[0]?.description || 'Erro ao criar cliente no Asaas',
        );
      }

      const customer: AsaasCustomerResponse = await response.json();
      this.logger.log(`Created Asaas customer ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error('Error creating Asaas customer', error);
      throw error;
    }
  }

  /**
   * Atualiza cliente no Asaas
   */
  async updateCustomer(
    customerId: string,
    data: Partial<CreateAsaasCustomerDto>,
  ): Promise<AsaasCustomerResponse> {
    if (!this.isConfigured()) {
      return { id: customerId, ...data } as AsaasCustomerResponse;
    }

    try {
      const response = await fetch(`${this.apiUrl}/customers/${customerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          cpfCnpj: data.cpfCnpj?.replace(/\D/g, ''),
          phone: data.phone,
          mobilePhone: data.mobilePhone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BadRequestException(
          error.errors?.[0]?.description || 'Erro ao atualizar cliente',
        );
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error updating Asaas customer', error);
      throw error;
    }
  }

  // ============================================
  // PAYMENTS - PIX
  // ============================================

  /**
   * Cria cobrança PIX e retorna QR Code
   */
  async createPixPayment(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
  ): Promise<CheckoutResult> {
    this.logger.log(`Creating PIX payment for user ${userId}`);

    if (!this.isConfigured()) {
      // Mock para desenvolvimento
      return {
        success: true,
        paymentId: `pay_mock_${Date.now()}`,
        status: 'PENDING',
        pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        pixCopyPaste: '00020126580014br.gov.bcb.pix0136mock-pix-code-' + Date.now(),
        pixExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }

    try {
      // 1. Criar cobrança
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1); // Vence amanhã

      const paymentResponse = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: amount,
          dueDate: dueDate.toISOString().split('T')[0],
          description,
          externalReference: userId,
        }),
      });

      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        throw new BadRequestException(
          error.errors?.[0]?.description || 'Erro ao criar cobrança PIX',
        );
      }

      const payment: AsaasPaymentResponse = await paymentResponse.json();

      // 2. Obter QR Code PIX
      const qrCodeResponse = await fetch(
        `${this.apiUrl}/payments/${payment.id}/pixQrCode`,
        {
          headers: { access_token: this.apiKey },
        },
      );

      if (!qrCodeResponse.ok) {
        throw new BadRequestException('Erro ao gerar QR Code PIX');
      }

      const qrCode: AsaasPixQrCodeResponse = await qrCodeResponse.json();

      // 3. Salvar no histórico
      await this.savePaymentHistory(userId, {
        asaasPaymentId: payment.id,
        amount,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        dueDate,
        pixQrCode: qrCode.encodedImage,
        pixCopyPaste: qrCode.payload,
        pixExpiresAt: new Date(qrCode.expirationDate),
      });

      // 4. Atualizar subscription
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          asaasPaymentId: payment.id,
          paymentMethod: PaymentMethod.PIX,
        },
      });

      return {
        success: true,
        paymentId: payment.id,
        status: payment.status,
        pixQrCode: `data:image/png;base64,${qrCode.encodedImage}`,
        pixCopyPaste: qrCode.payload,
        pixExpiresAt: qrCode.expirationDate,
      };
    } catch (error) {
      this.logger.error('Error creating PIX payment', error);
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Erro ao criar PIX',
      };
    }
  }

  // ============================================
  // PAYMENTS - CREDIT CARD
  // ============================================

  /**
   * Processa pagamento com cartão de crédito
   */
  async createCreditCardPayment(
    userId: string,
    customerId: string,
    amount: number,
    description: string,
    creditCard: CreditCardInfo,
    holderInfo: CreditCardHolderInfo,
    remoteIp: string,
  ): Promise<CheckoutResult> {
    this.logger.log(`Creating credit card payment for user ${userId}`);

    if (!this.isConfigured()) {
      // Mock para desenvolvimento
      return {
        success: true,
        paymentId: `pay_mock_${Date.now()}`,
        status: 'CONFIRMED',
        creditCardLastFour: creditCard.number.slice(-4),
        creditCardBrand: 'VISA',
      };
    }

    try {
      const dueDate = new Date();

      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'CREDIT_CARD',
          value: amount,
          dueDate: dueDate.toISOString().split('T')[0],
          description,
          externalReference: userId,
          creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number.replace(/\s/g, ''),
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv,
          },
          creditCardHolderInfo: {
            name: holderInfo.name,
            email: holderInfo.email,
            cpfCnpj: holderInfo.cpfCnpj.replace(/\D/g, ''),
            postalCode: holderInfo.postalCode.replace(/\D/g, ''),
            addressNumber: holderInfo.addressNumber,
            phone: holderInfo.phone.replace(/\D/g, ''),
          },
          remoteIp,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMsg =
          error.errors?.[0]?.description || 'Erro ao processar cartão';
        this.logger.error('Credit card payment failed', error);

        // Salvar tentativa falha
        await this.savePaymentHistory(userId, {
          amount,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          status: PaymentStatus.FAILED,
          dueDate,
          errorMessage: errorMsg,
        });

        return {
          success: false,
          errorMessage: errorMsg,
        };
      }

      const payment: AsaasPaymentResponse = await response.json();

      // Verificar se foi aprovado
      const isConfirmed = ['CONFIRMED', 'RECEIVED'].includes(payment.status);

      // Salvar no histórico
      await this.savePaymentHistory(userId, {
        asaasPaymentId: payment.id,
        amount,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: isConfirmed ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING,
        dueDate,
        paidAt: isConfirmed ? new Date() : undefined,
      });

      // Atualizar subscription com token do cartão (para retry)
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          asaasPaymentId: payment.id,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          creditCardToken: payment.creditCard?.creditCardToken,
          creditCardLastFour: payment.creditCard?.creditCardNumber?.slice(-4),
          creditCardBrand: payment.creditCard?.creditCardBrand,
          ...(isConfirmed && {
            lastPaymentDate: new Date(),
            overdueAt: null,
            retryCount: 0,
          }),
        },
      });

      // Se confirmado, ativar assinatura
      if (isConfirmed) {
        await this.activateSubscription(userId);
      }

      return {
        success: isConfirmed,
        paymentId: payment.id,
        status: payment.status,
        creditCardLastFour: payment.creditCard?.creditCardNumber?.slice(-4),
        creditCardBrand: payment.creditCard?.creditCardBrand,
        errorMessage: isConfirmed ? undefined : 'Pagamento pendente de confirmação',
      };
    } catch (error) {
      this.logger.error('Error creating credit card payment', error);
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Erro ao processar cartão',
      };
    }
  }

  /**
   * Retry de cobrança com cartão tokenizado
   */
  async retryCardPayment(userId: string): Promise<CheckoutResult> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription?.creditCardToken) {
      return {
        success: false,
        errorMessage: 'Cartão não cadastrado para cobrança automática',
      };
    }

    this.logger.log(`Retrying card payment for user ${userId}`);

    if (!this.isConfigured()) {
      return { success: true, status: 'CONFIRMED' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: this.apiKey,
        },
        body: JSON.stringify({
          customer: subscription.asaasCustomerId,
          billingType: 'CREDIT_CARD',
          value: Number(subscription.plan.price),
          dueDate: new Date().toISOString().split('T')[0],
          description: `Assinatura ${subscription.plan.name} - Retry`,
          externalReference: userId,
          creditCardToken: subscription.creditCardToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();

        // Incrementar contador de retry
        await this.prisma.userSubscription.update({
          where: { userId },
          data: {
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
          },
        });

        return {
          success: false,
          errorMessage: error.errors?.[0]?.description || 'Retry falhou',
        };
      }

      const payment: AsaasPaymentResponse = await response.json();
      const isConfirmed = ['CONFIRMED', 'RECEIVED'].includes(payment.status);

      if (isConfirmed) {
        await this.activateSubscription(userId);
      }

      return {
        success: isConfirmed,
        paymentId: payment.id,
        status: payment.status,
      };
    } catch (error) {
      this.logger.error('Error retrying card payment', error);
      return {
        success: false,
        errorMessage: 'Erro ao processar retry',
      };
    }
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  /**
   * Ativa assinatura após pagamento confirmado
   * Usa lock otimista através de WHERE condition para evitar race conditions
   */
  async activateSubscription(userId: string): Promise<void> {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Atualizar apenas se não estiver já ACTIVE com período válido
    // Isso evita sobrescrever ativações concorrentes
    const result = await this.prisma.userSubscription.updateMany({
      where: {
        userId,
        OR: [
          { status: { not: SubscriptionStatus.ACTIVE } },
          { currentPeriodEnd: { lt: new Date() } },
          { currentPeriodEnd: null }
        ]
      },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        lastPaymentDate: new Date(),
        overdueAt: null,
        retryCount: 0,
        blockedAt: null,
        blockReason: null,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Subscription activated for user ${userId}`);
    } else {
      this.logger.log(`Subscription for user ${userId} already active with valid period`);
    }
  }

  /**
   * Marca assinatura como inadimplente
   */
  async markAsOverdue(userId: string): Promise<void> {
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        overdueAt: new Date(),
      },
    });

    this.logger.log(`Subscription marked as overdue for user ${userId}`);
  }

  /**
   * Bloqueia conta por inadimplência
   */
  async blockAccount(userId: string, reason: string): Promise<void> {
    // 1. Atualizar subscription
    await this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status: SubscriptionStatus.BLOCKED,
        blockedAt: new Date(),
        blockReason: reason,
      },
    });

    // 2. Cancelar assinatura no Asaas
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (subscription?.asaasSubscriptionId && this.isConfigured()) {
      try {
        await fetch(
          `${this.apiUrl}/subscriptions/${subscription.asaasSubscriptionId}`,
          {
            method: 'DELETE',
            headers: { access_token: this.apiKey },
          },
        );
      } catch (error) {
        this.logger.error('Error canceling Asaas subscription', error);
      }
    }

    this.logger.log(`Account blocked for user ${userId}: ${reason}`);
  }

  /**
   * Desbloqueia conta após pagamento
   */
  async unblockAccount(userId: string): Promise<void> {
    await this.activateSubscription(userId);
    this.logger.log(`Account unblocked for user ${userId}`);
  }

  /**
   * Cancela assinatura e volta para plano FREE
   */
  async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    // Cancelar no Asaas
    if (subscription?.asaasSubscriptionId && this.isConfigured()) {
      try {
        await fetch(
          `${this.apiUrl}/subscriptions/${subscription.asaasSubscriptionId}`,
          {
            method: 'DELETE',
            headers: { access_token: this.apiKey },
          },
        );
      } catch (error) {
        this.logger.error('Error canceling Asaas subscription', error);
      }
    }

    // Voltar para plano FREE
    const freePlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.FREE },
    });

    if (freePlan) {
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          planId: freePlan.id,
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          asaasSubscriptionId: null,
          asaasPaymentId: null,
          creditCardToken: null,
          creditCardLastFour: null,
          creditCardBrand: null,
        },
      });
    }

    this.logger.log(`Subscription canceled for user ${userId}`);
  }

  // ============================================
  // WEBHOOK PROCESSING
  // ============================================

  /**
   * Processa webhook do Asaas
   */
  async processWebhook(event: string, payload: any): Promise<void> {
    this.logger.log(`Processing webhook: ${event}`);

    const externalReference = payload.payment?.externalReference || payload.externalReference;

    if (!externalReference) {
      // Tentar encontrar por asaasPaymentId
      const paymentId = payload.payment?.id || payload.id;
      if (paymentId) {
        const subscription = await this.prisma.userSubscription.findFirst({
          where: { asaasPaymentId: paymentId },
        });
        if (subscription) {
          await this.handleWebhookEvent(event, subscription.userId, payload);
          return;
        }
      }
      this.logger.warn('Webhook without externalReference or known paymentId');
      return;
    }

    await this.handleWebhookEvent(event, externalReference, payload);
  }

  private async handleWebhookEvent(
    event: string,
    userId: string,
    payload: any,
  ): Promise<void> {
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await this.handlePaymentConfirmed(userId, payload);
        break;

      case 'PAYMENT_OVERDUE':
        await this.handlePaymentOverdue(userId);
        break;

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_DELETED':
        await this.handlePaymentCanceled(userId);
        break;

      default:
        this.logger.log(`Unhandled event: ${event}`);
    }
  }

  private async handlePaymentConfirmed(
    userId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Payment confirmed for user ${userId}`);

    // Usar transação para evitar race conditions
    await this.prisma.$transaction(async (tx) => {
      // Atualizar histórico (idempotente - só atualiza se ainda não foi confirmado)
      if (payload.payment?.id) {
        const updated = await tx.subscriptionPaymentHistory.updateMany({
          where: {
            asaasPaymentId: payload.payment.id,
            status: { not: PaymentStatus.CONFIRMED } // Só atualiza se ainda não confirmado
          },
          data: {
            status: PaymentStatus.CONFIRMED,
            paidAt: new Date(),
          },
        });

        // Se nenhum registro foi atualizado, já foi processado antes
        if (updated.count === 0) {
          this.logger.log(`Payment ${payload.payment.id} already confirmed, skipping duplicate processing`);
          return;
        }
      }

      // Ativar/reativar assinatura dentro da mesma transação
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await tx.userSubscription.update({
        where: { userId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          lastPaymentDate: new Date(),
          overdueAt: null,
          retryCount: 0,
          blockedAt: null,
          blockReason: null,
        },
      });

      this.logger.log(`Subscription activated for user ${userId}`);
    });
  }

  private async handlePaymentOverdue(userId: string): Promise<void> {
    this.logger.log(`Payment overdue for user ${userId}`);
    await this.markAsOverdue(userId);
  }

  private async handlePaymentCanceled(userId: string): Promise<void> {
    this.logger.log(`Payment canceled for user ${userId}`);
    // Não faz nada imediatamente - aguarda retry ou bloqueio
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Salva histórico de pagamento (com proteção contra duplicação)
   */
  private async savePaymentHistory(
    userId: string,
    data: {
      asaasPaymentId?: string;
      amount: number;
      paymentMethod: PaymentMethod;
      status: PaymentStatus;
      dueDate: Date;
      paidAt?: Date;
      pixQrCode?: string;
      pixCopyPaste?: string;
      pixExpiresAt?: Date;
      errorMessage?: string;
    },
  ): Promise<void> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) return;

    // Se tiver asaasPaymentId, verificar se já existe para evitar duplicação
    if (data.asaasPaymentId) {
      const existing = await this.prisma.subscriptionPaymentHistory.findFirst({
        where: {
          subscriptionId: subscription.id,
          asaasPaymentId: data.asaasPaymentId,
        },
      });

      if (existing) {
        this.logger.log(`Payment history for ${data.asaasPaymentId} already exists, skipping creation`);
        return;
      }
    }

    await this.prisma.subscriptionPaymentHistory.create({
      data: {
        subscriptionId: subscription.id,
        asaasPaymentId: data.asaasPaymentId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        status: data.status,
        dueDate: data.dueDate,
        paidAt: data.paidAt,
        pixQrCode: data.pixQrCode,
        pixCopyPaste: data.pixCopyPaste,
        pixExpiresAt: data.pixExpiresAt,
        errorMessage: data.errorMessage,
      },
    });
  }

  /**
   * Verifica inadimplentes e processa retry/bloqueio
   * (Chamado por job agendado)
   */
  async processOverdueAccounts(): Promise<{ processed: number; blocked: number; retried: number }> {
    this.logger.log('Processing overdue accounts...');

    let processed = 0;
    let blocked = 0;
    let retried = 0;

    // Buscar contas inadimplentes
    const overdueSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        overdueAt: { not: null },
      },
      include: { plan: true },
    });

    for (const sub of overdueSubscriptions) {
      processed++;
      const daysOverdue = Math.floor(
        (Date.now() - sub.overdueAt!.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysOverdue >= this.GRACE_PERIOD_DAYS) {
        // Bloquear conta após 15 dias
        await this.blockAccount(
          sub.userId,
          `Inadimplência por ${daysOverdue} dias`,
        );
        blocked++;
      } else if (sub.creditCardToken && sub.retryCount < 3) {
        // Tentar retry (máximo 3 tentativas)
        const lastRetry = sub.lastRetryAt?.getTime() || 0;
        const hoursSinceLastRetry =
          (Date.now() - lastRetry) / (1000 * 60 * 60);

        // Retry a cada 3 dias
        if (hoursSinceLastRetry >= 72) {
          await this.retryCardPayment(sub.userId);
          retried++;
        }
      }
    }

    this.logger.log(`Finished processing overdue accounts: ${processed} processed, ${blocked} blocked, ${retried} retried`);
    return { processed, blocked, retried };
  }

  /**
   * Verifica status de um pagamento PIX pendente
   */
  async checkPixPaymentStatus(paymentId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
        headers: { access_token: this.apiKey },
      });

      if (response.ok) {
        const payment = await response.json();
        return payment.status;
      }
    } catch (error) {
      this.logger.error('Error checking PIX status', error);
    }

    return null;
  }
}
