import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { IsString, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';
import { PlanLimitsService } from './plan-limits.service';
import { AsaasBillingService } from './asaas-billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, SubscriptionStatus, BillingPeriod, PaymentMethod } from '@prisma/client';
import { LimitedResource } from './interfaces/billing.interfaces';

// ============================================
// DTOs
// ============================================

class CheckoutPixDto {
  @IsString()
  cpfCnpj: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class CheckoutCreditCardDto {
  // Dados do cliente
  @IsString()
  cpfCnpj: string;

  @IsString()
  phone: string;

  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  postalCode: string;

  @IsString()
  addressNumber: string;

  // Dados do cartão
  @IsString()
  cardHolderName: string;

  @IsString()
  cardNumber: string;

  @IsString()
  expiryMonth: string;

  @IsString()
  expiryYear: string;

  @IsString()
  ccv: string;
}

class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelImmediately?: boolean;
}

// ============================================
// CONTROLLER
// ============================================

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly asaasBillingService: AsaasBillingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /billing/plan
   * Get current plan, limits, and usage
   */
  @Get('plan')
  async getPlan(@CurrentUser('id') userId: string) {
    return this.subscriptionService.getBillingStatus(userId);
  }

  /**
   * GET /billing/subscription
   * Get subscription info (alias for plan with frontend-compatible format)
   */
  @Get('subscription')
  async getSubscription(@CurrentUser('id') userId: string) {
    const billing = await this.subscriptionService.getBillingStatus(userId);
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    // Return in format expected by frontend
    return {
      plan: {
        type: billing.planKey,
        name: billing.planKey === 'PRO' ? 'Profissional' : 'Gratuito',
        price: billing.planKey === 'PRO' ? 39.90 : 0,
        limits: billing.limits,
      },
      planKey: billing.planKey,
      planName: billing.planName,
      usage: billing.usage,
      status: billing.subscriptionStatus,
      subscriptionStatus: billing.subscriptionStatus,
      currentPeriodStart: subscription?.currentPeriodStart,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      // CRITICAL: Include trial info for frontend
      trialEndAt: billing.trialEndAt,
      trialDaysRemaining: billing.trialDaysRemaining,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      paymentMethod: subscription?.paymentMethod,
      creditCardLastFour: subscription?.creditCardLastFour,
      creditCardBrand: subscription?.creditCardBrand,
      overdueAt: subscription?.overdueAt,
      blockedAt: subscription?.blockedAt,
      blockReason: subscription?.blockReason,
    };
  }

  /**
   * GET /billing/plans
   * Get all available plans
   */
  @Get('plans')
  async getAvailablePlans() {
    // Retorna apenas FREE e PRO (sem TEAM)
    const plans = await this.prisma.plan.findMany({
      where: {
        isActive: true,
        type: { in: [PlanType.FREE, PlanType.PRO] },
      },
      orderBy: { price: 'asc' },
    });

    return plans.map((plan) => ({
      type: plan.type,
      name: plan.name,
      price: Number(plan.price),
      features: plan.features,
      limits: {
        maxClients: plan.maxClients,
        maxQuotes: plan.maxQuotes,
        maxWorkOrders: plan.maxWorkOrders,
        maxInvoices: plan.maxInvoices,
      },
    }));
  }

  /**
   * GET /billing/quota
   * Get remaining quota for a specific resource
   */
  @Get('quota')
  async getQuota(
    @CurrentUser('id') userId: string,
    @Query('resource') resource: LimitedResource,
  ) {
    if (!resource) {
      // Return all quotas
      const [clients, quotes, workOrders, payments, notifications] = await Promise.all([
        this.planLimitsService.getRemainingQuota(userId, 'CLIENT'),
        this.planLimitsService.getRemainingQuota(userId, 'QUOTE'),
        this.planLimitsService.getRemainingQuota(userId, 'WORK_ORDER'),
        this.planLimitsService.getRemainingQuota(userId, 'PAYMENT'),
        this.planLimitsService.getRemainingQuota(userId, 'NOTIFICATION'),
      ]);

      return {
        clients,
        quotes,
        workOrders,
        payments,
        notifications,
      };
    }

    return this.planLimitsService.getRemainingQuota(userId, resource);
  }

  // ============================================
  // CHECKOUT - PIX
  // ============================================

  /**
   * POST /billing/checkout/pix
   * Inicia checkout via PIX - retorna QR Code
   */
  @Post('checkout/pix')
  @HttpCode(HttpStatus.OK)
  async checkoutPix(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckoutPixDto,
  ) {
    // Validar CPF/CNPJ
    if (!dto.cpfCnpj || dto.cpfCnpj.replace(/\D/g, '').length < 11) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }

    // Buscar usuário e subscription
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Verificar se já está no PRO ativo
    if (user.subscription?.status === SubscriptionStatus.ACTIVE) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: user.subscription.planId },
      });
      if (plan?.type === PlanType.PRO) {
        return {
          success: false,
          message: 'Você já possui o plano PRO ativo',
        };
      }
    }

    // Criar/atualizar cliente no Asaas
    const customer = await this.asaasBillingService.createOrUpdateCustomer(userId, {
      name: dto.name || user.name || user.email,
      email: user.email,
      cpfCnpj: dto.cpfCnpj,
      phone: dto.phone,
    });

    // Atualizar subscription com asaasCustomerId
    await this.ensureSubscription(userId, customer.id);

    // Buscar preço do plano PRO
    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) {
      throw new BadRequestException('Plano PRO não encontrado');
    }

    // Criar cobrança PIX
    const result = await this.asaasBillingService.createPixPayment(
      userId,
      customer.id,
      Number(proPlan.price),
      `Assinatura ${proPlan.name}`,
    );

    return {
      success: result.success,
      paymentId: result.paymentId,
      pixQrCode: result.pixQrCode,
      pixCopyPaste: result.pixCopyPaste,
      pixExpiresAt: result.pixExpiresAt,
      amount: Number(proPlan.price),
      errorMessage: result.errorMessage,
    };
  }

  /**
   * GET /billing/checkout/pix/status
   * Verifica status do pagamento PIX
   */
  @Get('checkout/pix/status')
  async checkPixStatus(@CurrentUser('id') userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription?.asaasPaymentId) {
      return { status: 'NO_PAYMENT', paid: false };
    }

    const status = await this.asaasBillingService.checkPixPaymentStatus(
      subscription.asaasPaymentId,
    );

    const paid = status === 'CONFIRMED' || status === 'RECEIVED';

    return {
      status: status || 'UNKNOWN',
      paid,
      subscriptionStatus: subscription.status,
    };
  }

  // ============================================
  // CHECKOUT - CARTÃO DE CRÉDITO
  // ============================================

  /**
   * POST /billing/checkout/credit-card
   * Processa pagamento com cartão de crédito
   */
  @Post('checkout/credit-card')
  @HttpCode(HttpStatus.OK)
  async checkoutCreditCard(
    @CurrentUser('id') userId: string,
    @Body() dto: CheckoutCreditCardDto,
    @Req() req: Request,
  ) {
    // Validações
    if (!dto.cpfCnpj || dto.cpfCnpj.replace(/\D/g, '').length < 11) {
      throw new BadRequestException('CPF/CNPJ inválido');
    }
    if (!dto.cardNumber || dto.cardNumber.replace(/\s/g, '').length < 13) {
      throw new BadRequestException('Número do cartão inválido');
    }
    if (!dto.ccv || dto.ccv.length < 3) {
      throw new BadRequestException('CVV inválido');
    }

    // Buscar usuário
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado');
    }

    // Verificar se já está no PRO ativo
    if (user.subscription?.status === SubscriptionStatus.ACTIVE) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: user.subscription.planId },
      });
      if (plan?.type === PlanType.PRO) {
        return {
          success: false,
          message: 'Você já possui o plano PRO ativo',
        };
      }
    }

    // Criar/atualizar cliente no Asaas
    const customer = await this.asaasBillingService.createOrUpdateCustomer(userId, {
      name: dto.name,
      email: dto.email || user.email,
      cpfCnpj: dto.cpfCnpj,
      phone: dto.phone,
      postalCode: dto.postalCode,
      addressNumber: dto.addressNumber,
    });

    // Atualizar subscription com asaasCustomerId
    await this.ensureSubscription(userId, customer.id);

    // Buscar preço do plano PRO
    const proPlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.PRO },
    });

    if (!proPlan) {
      throw new BadRequestException('Plano PRO não encontrado');
    }

    // Obter IP do cliente
    const remoteIp = req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1';

    // Processar pagamento com cartão
    const result = await this.asaasBillingService.createCreditCardPayment(
      userId,
      customer.id,
      Number(proPlan.price),
      `Assinatura ${proPlan.name}`,
      {
        holderName: dto.cardHolderName,
        number: dto.cardNumber,
        expiryMonth: dto.expiryMonth,
        expiryYear: dto.expiryYear,
        ccv: dto.ccv,
      },
      {
        name: dto.name,
        email: dto.email || user.email,
        cpfCnpj: dto.cpfCnpj,
        postalCode: dto.postalCode,
        addressNumber: dto.addressNumber,
        phone: dto.phone,
      },
      remoteIp,
    );

    // Se pagamento confirmado, atualizar para plano PRO
    if (result.success) {
      await this.subscriptionService.createOrUpdateSubscription(
        userId,
        PlanType.PRO,
        {
          asaasCustomerId: customer.id,
          asaasPaymentId: result.paymentId,
          status: SubscriptionStatus.ACTIVE,
          billingPeriod: BillingPeriod.MONTHLY,
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.calculatePeriodEnd(BillingPeriod.MONTHLY),
          paymentMethod: PaymentMethod.CREDIT_CARD,
          creditCardLastFour: result.creditCardLastFour,
          creditCardBrand: result.creditCardBrand,
          lastPaymentDate: new Date(),
        },
      );
    }

    return {
      success: result.success,
      paymentId: result.paymentId,
      status: result.status,
      creditCardLastFour: result.creditCardLastFour,
      creditCardBrand: result.creditCardBrand,
      errorMessage: result.errorMessage,
    };
  }

  // ============================================
  // CANCELAMENTO
  // ============================================

  /**
   * POST /billing/cancel
   * Cancel subscription - volta para plano FREE
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @CurrentUser('id') userId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      return {
        success: false,
        message: 'Nenhuma assinatura encontrada',
      };
    }

    if (subscription.plan.type === PlanType.FREE) {
      return {
        success: false,
        message: 'Você já está no plano gratuito',
      };
    }

    // Cancelar assinatura
    await this.asaasBillingService.cancelSubscription(userId);

    return {
      success: true,
      message: 'Assinatura cancelada. Você foi movido para o plano gratuito.',
      newPlan: 'FREE',
    };
  }

  /**
   * POST /billing/reactivate
   * Reactivate a canceled subscription
   */
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateSubscription(@CurrentUser('id') userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return {
        success: false,
        message: 'Nenhuma assinatura encontrada',
      };
    }

    // Se cancelada, precisa fazer novo checkout
    if (subscription.status === SubscriptionStatus.CANCELED) {
      return {
        success: false,
        message: 'Assinatura cancelada. Faça um novo checkout para reativar.',
        requiresCheckout: true,
      };
    }

    // Se bloqueada, precisa pagar
    if (subscription.status === SubscriptionStatus.BLOCKED) {
      return {
        success: false,
        message: 'Conta bloqueada por inadimplência. Regularize o pagamento.',
        requiresPayment: true,
      };
    }

    // Se marcada para cancelamento, desmarcar
    if (subscription.cancelAtPeriodEnd) {
      await this.prisma.userSubscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: false },
      });

      return {
        success: true,
        message: 'Assinatura reativada com sucesso.',
        status: subscription.status,
      };
    }

    return {
      success: true,
      message: 'Assinatura já está ativa',
      status: subscription.status,
    };
  }

  /**
   * GET /billing/check-limit
   * Check if a specific resource can be created (for frontend validation)
   */
  @Get('check-limit')
  async checkLimit(
    @CurrentUser('id') userId: string,
    @Query('resource') resource: LimitedResource,
  ) {
    return this.planLimitsService.checkLimit({ userId, resource });
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Garante que existe uma subscription para o usuário
   */
  private async ensureSubscription(
    userId: string,
    asaasCustomerId: string,
  ): Promise<void> {
    const existing = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (existing) {
      await this.prisma.userSubscription.update({
        where: { userId },
        data: { asaasCustomerId },
      });
    } else {
      // Buscar plano FREE
      const freePlan = await this.prisma.plan.findUnique({
        where: { type: PlanType.FREE },
      });

      if (freePlan) {
        await this.prisma.userSubscription.create({
          data: {
            userId,
            planId: freePlan.id,
            asaasCustomerId,
            status: SubscriptionStatus.ACTIVE,
          },
        });
      }
    }
  }

  private calculatePeriodEnd(billingPeriod: BillingPeriod): Date {
    const end = new Date();
    if (billingPeriod === BillingPeriod.YEARLY) {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end;
  }
}
