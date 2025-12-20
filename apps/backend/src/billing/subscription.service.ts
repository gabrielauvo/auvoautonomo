import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, SubscriptionStatus, BillingPeriod, PaymentMethod } from '@prisma/client';
import {
  EffectivePlan,
  UsageLimits,
  CurrentUsage,
  BillingStatusResponse,
} from './interfaces/billing.interfaces';

/**
 * Default limits for FREE plan (fallback)
 */
const DEFAULT_FREE_LIMITS: UsageLimits = {
  maxClients: 10,
  maxQuotes: 10,
  maxWorkOrders: 10,
  maxPayments: 5,
  maxNotificationsPerMonth: 50,
  enableAdvancedAutomations: false,
  enableAdvancedAnalytics: false,
  enableClientPortal: false,
  enablePdfExport: true,
  enableDigitalSignature: false,
  enableWhatsApp: false,
};

/**
 * Default limits for PRO plan (fallback)
 */
const DEFAULT_PRO_LIMITS: UsageLimits = {
  maxClients: -1, // unlimited
  maxQuotes: -1,
  maxWorkOrders: -1,
  maxPayments: -1,
  maxNotificationsPerMonth: -1,
  enableAdvancedAutomations: true,
  enableAdvancedAnalytics: true,
  enableClientPortal: true,
  enablePdfExport: true,
  enableDigitalSignature: true,
  enableWhatsApp: true,
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get the effective plan for a user
   * If no subscription exists, returns FREE plan
   */
  async getUserEffectivePlan(userId: string): Promise<EffectivePlan> {
    // Try to find active subscription
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: {
        plan: {
          include: {
            usageLimits: true,
          },
        },
      },
    });

    // If no subscription, return FREE plan
    if (!subscription) {
      const freePlan = await this.getOrCreateFreePlan();
      return {
        planKey: PlanType.FREE,
        planName: freePlan.name,
        planId: freePlan.id,
        limits: this.getLimitsFromPlan(freePlan),
        subscriptionStatus: 'FREE',
        currentPeriodEnd: null,
        trialEndAt: null,
      };
    }

    // Return subscription plan
    return {
      planKey: subscription.plan.type,
      planName: subscription.plan.name,
      planId: subscription.planId,
      limits: this.getLimitsFromPlan(subscription.plan),
      subscriptionStatus: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndAt: subscription.trialEndAt,
    };
  }

  /**
   * Get current usage counts for a user
   */
  async getCurrentUsage(userId: string): Promise<CurrentUsage> {
    const [
      clientsCount,
      quotesCount,
      workOrdersCount,
      paymentsCount,
      notificationsSentThisMonth,
    ] = await Promise.all([
      this.prisma.client.count({ where: { userId } }),
      this.prisma.quote.count({ where: { userId } }),
      this.prisma.workOrder.count({ where: { userId } }),
      this.prisma.clientPayment.count({ where: { userId } }),
      this.getNotificationsSentThisMonth(userId),
    ]);

    return {
      clientsCount,
      quotesCount,
      workOrdersCount,
      paymentsCount,
      notificationsSentThisMonth,
    };
  }

  /**
   * Get full billing status including plan, limits, and usage
   */
  async getBillingStatus(userId: string): Promise<BillingStatusResponse> {
    const [effectivePlan, usage] = await Promise.all([
      this.getUserEffectivePlan(userId),
      this.getCurrentUsage(userId),
    ]);

    // Get subscription details for dates
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    return {
      planKey: effectivePlan.planKey,
      planName: effectivePlan.planName,
      subscriptionStatus: effectivePlan.subscriptionStatus,
      limits: effectivePlan.limits,
      usage,
      currentPeriodStart: subscription?.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() || null,
      trialEndAt: subscription?.trialEndAt?.toISOString() || null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    };
  }

  /**
   * Create or update user subscription
   */
  async createOrUpdateSubscription(
    userId: string,
    planType: PlanType,
    data: {
      asaasCustomerId?: string;
      asaasSubscriptionId?: string;
      asaasPaymentId?: string;
      status?: SubscriptionStatus;
      billingPeriod?: BillingPeriod;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      trialEndAt?: Date;
      paymentMethod?: PaymentMethod;
      creditCardToken?: string;
      creditCardLastFour?: string;
      creditCardBrand?: string;
      lastPaymentDate?: Date;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({
      where: { type: planType },
    });

    if (!plan) {
      throw new NotFoundException(`Plan ${planType} not found`);
    }

    return this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        ...data,
      },
      update: {
        planId: plan.id,
        ...data,
      },
    });
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(
    userId: string,
    status: SubscriptionStatus,
    additionalData?: {
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      canceledAt?: Date;
      cancelAtPeriodEnd?: boolean;
    },
  ) {
    return this.prisma.userSubscription.update({
      where: { userId },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    userId: string,
    cancelImmediately: boolean = false,
  ) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    if (cancelImmediately) {
      // Downgrade to FREE immediately
      const freePlan = await this.getOrCreateFreePlan();
      return this.prisma.userSubscription.update({
        where: { userId },
        data: {
          planId: freePlan.id,
          status: SubscriptionStatus.CANCELED,
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      // Mark to cancel at end of period
      return this.prisma.userSubscription.update({
        where: { userId },
        data: {
          cancelAtPeriodEnd: true,
        },
      });
    }
  }

  /**
   * Check and process subscriptions that should be downgraded
   * (Called by scheduler/cron)
   */
  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();

    // Find subscriptions marked to cancel at period end where period has ended
    const expiredSubscriptions = await this.prisma.userSubscription.findMany({
      where: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: { lte: now },
        status: { not: SubscriptionStatus.CANCELED },
      },
    });

    const freePlan = await this.getOrCreateFreePlan();

    for (const sub of expiredSubscriptions) {
      await this.prisma.userSubscription.update({
        where: { id: sub.id },
        data: {
          planId: freePlan.id,
          status: SubscriptionStatus.CANCELED,
          canceledAt: now,
          cancelAtPeriodEnd: false,
        },
      });

      this.logger.log(`Downgraded subscription ${sub.id} to FREE after period end`);
    }

    return expiredSubscriptions.length;
  }

  /**
   * Get plan by type
   */
  async getPlanByType(type: PlanType) {
    return this.prisma.plan.findUnique({
      where: { type },
      include: { usageLimits: true },
    });
  }

  /**
   * Get all active plans
   */
  async getActivePlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      include: { usageLimits: true },
      orderBy: { price: 'asc' },
    });
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Get or create the FREE plan (fallback)
   */
  private async getOrCreateFreePlan() {
    let freePlan = await this.prisma.plan.findUnique({
      where: { type: PlanType.FREE },
      include: { usageLimits: true },
    });

    if (!freePlan) {
      // Create FREE plan if it doesn't exist
      freePlan = await this.prisma.plan.create({
        data: {
          type: PlanType.FREE,
          name: 'Plano Gratuito',
          description: 'Plano básico gratuito com recursos limitados',
          price: 0,
          maxClients: DEFAULT_FREE_LIMITS.maxClients,
          maxQuotes: DEFAULT_FREE_LIMITS.maxQuotes,
          maxWorkOrders: DEFAULT_FREE_LIMITS.maxWorkOrders,
          maxInvoices: DEFAULT_FREE_LIMITS.maxPayments,
          features: ['Até 10 clientes', 'Até 10 orçamentos', 'Até 10 OS', 'Até 5 cobranças'],
          isActive: true,
          usageLimits: {
            create: {
              ...DEFAULT_FREE_LIMITS,
            },
          },
        },
        include: { usageLimits: true },
      });

      this.logger.log('Created default FREE plan');
    }

    return freePlan;
  }

  /**
   * Extract limits from plan with fallback
   */
  private getLimitsFromPlan(plan: {
    type: PlanType;
    usageLimits?: {
      maxClients: number;
      maxQuotes: number;
      maxWorkOrders: number;
      maxPayments: number;
      maxNotificationsPerMonth: number;
      enableAdvancedAutomations: boolean;
      enableAdvancedAnalytics: boolean;
      enableClientPortal: boolean;
      enablePdfExport: boolean;
      enableDigitalSignature: boolean;
      enableWhatsApp: boolean;
    } | null;
  }): UsageLimits {
    if (plan.usageLimits) {
      return {
        maxClients: plan.usageLimits.maxClients,
        maxQuotes: plan.usageLimits.maxQuotes,
        maxWorkOrders: plan.usageLimits.maxWorkOrders,
        maxPayments: plan.usageLimits.maxPayments,
        maxNotificationsPerMonth: plan.usageLimits.maxNotificationsPerMonth,
        enableAdvancedAutomations: plan.usageLimits.enableAdvancedAutomations,
        enableAdvancedAnalytics: plan.usageLimits.enableAdvancedAnalytics,
        enableClientPortal: plan.usageLimits.enableClientPortal,
        enablePdfExport: plan.usageLimits.enablePdfExport,
        enableDigitalSignature: plan.usageLimits.enableDigitalSignature,
        enableWhatsApp: plan.usageLimits.enableWhatsApp,
      };
    }

    // Fallback based on plan type
    return plan.type === PlanType.PRO ? DEFAULT_PRO_LIMITS : DEFAULT_FREE_LIMITS;
  }

  /**
   * Count notifications sent this month
   */
  private async getNotificationsSentThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.notificationLog.count({
      where: {
        userId,
        createdAt: { gte: firstDayOfMonth },
        status: 'SENT',
      },
    });
  }
}
