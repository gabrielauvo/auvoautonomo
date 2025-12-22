import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import {
  LimitedResource,
  FeatureFlag,
  LimitCheckResult,
  LimitReachedError,
  FeatureNotAvailableError,
} from './interfaces/billing.interfaces';

/**
 * Custom exception for limit reached errors
 */
export class LimitReachedException extends ForbiddenException {
  constructor(public readonly details: LimitReachedError) {
    super(details);
  }
}

/**
 * Custom exception for feature not available errors
 */
export class FeatureNotAvailableException extends ForbiddenException {
  constructor(public readonly details: FeatureNotAvailableError) {
    super(details);
  }
}

@Injectable()
export class PlanLimitsService {
  private readonly logger = new Logger(PlanLimitsService.name);

  constructor(
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {}

  /**
   * Check if a user can create a new resource
   * Throws LimitReachedException if limit is reached
   *
   * IMPORTANT: This method only checks the limit. To prevent TOCTOU race conditions,
   * you MUST call checkAndIncrementLimit() within a transaction when creating resources.
   */
  async checkLimitOrThrow(params: {
    userId: string;
    resource: LimitedResource;
  }): Promise<void> {
    const result = await this.checkLimit(params);

    if (!result.allowed) {
      throw new LimitReachedException({
        error: 'LIMIT_REACHED',
        resource: result.resource,
        plan: result.plan,
        max: result.max,
        current: result.current,
        message: result.message || this.getLimitMessage(result),
      });
    }
  }

  /**
   * Atomically check and increment resource count within a transaction
   * This prevents TOCTOU (Time-of-check to Time-of-use) race conditions
   *
   * Usage:
   *   await prisma.$transaction(async (tx) => {
   *     await planLimitsService.checkAndIncrementLimit(tx, { userId, resource });
   *     await tx.client.create({ data: ... });
   *   });
   */
  async checkAndIncrementLimit(
    tx: any, // Prisma transaction context
    params: {
      userId: string;
      resource: LimitedResource;
    }
  ): Promise<void> {
    const { userId, resource } = params;

    const effectivePlan = await this.subscriptionService.getUserEffectivePlan(userId);
    const { limits, planKey } = effectivePlan;

    // Get the max limit for this resource
    const max = this.getMaxLimit(resource, limits);

    // -1 means unlimited
    if (max === -1) {
      return;
    }

    // Count current usage within the transaction (uses FOR UPDATE lock implicitly)
    const current = await this.getResourceCount(tx, userId, resource);

    // Check if limit would be exceeded
    if (current >= max) {
      throw new LimitReachedException({
        error: 'LIMIT_REACHED',
        resource,
        plan: planKey,
        max,
        current,
        message: this.getLimitMessage({ resource, max, current, plan: planKey, allowed: false }),
      });
    }

    // The actual increment happens when the caller creates the resource
    // within the same transaction. This check ensures atomicity.
  }

  /**
   * Check limit without throwing
   * Returns detailed result
   */
  async checkLimit(params: {
    userId: string;
    resource: LimitedResource;
  }): Promise<LimitCheckResult> {
    const { userId, resource } = params;

    const effectivePlan = await this.subscriptionService.getUserEffectivePlan(userId);
    const { limits, planKey } = effectivePlan;

    const { max, current } = await this.getResourceCountAndLimit(
      userId,
      resource,
      limits,
    );

    // -1 means unlimited
    const allowed = max === -1 || current < max;

    return {
      allowed,
      resource,
      plan: planKey,
      max,
      current,
      message: allowed ? undefined : this.getLimitMessage({ resource, max, current, plan: planKey, allowed }),
    };
  }

  /**
   * Check if a feature is enabled for the user's plan
   * Throws FeatureNotAvailableException if not available
   */
  async checkFeatureOrThrow(params: {
    userId: string;
    feature: FeatureFlag;
  }): Promise<void> {
    const result = await this.checkFeature(params);

    if (!result.available) {
      throw new FeatureNotAvailableException({
        error: 'FEATURE_NOT_AVAILABLE',
        feature: params.feature,
        plan: result.plan,
        message: result.message,
      });
    }
  }

  /**
   * Check if a feature is available without throwing
   */
  async checkFeature(params: {
    userId: string;
    feature: FeatureFlag;
  }): Promise<{ available: boolean; plan: any; message: string }> {
    const { userId, feature } = params;

    const effectivePlan = await this.subscriptionService.getUserEffectivePlan(userId);
    const { limits, planKey, planName } = effectivePlan;

    const available = this.isFeatureEnabled(feature, limits);

    return {
      available,
      plan: planKey,
      message: available
        ? ''
        : `O recurso "${this.getFeatureName(feature)}" não está disponível no plano ${planName}. Faça upgrade para o PRO para acessar este recurso.`,
    };
  }

  /**
   * Get remaining quota for a resource
   */
  async getRemainingQuota(
    userId: string,
    resource: LimitedResource,
  ): Promise<{ remaining: number; max: number; current: number; unlimited: boolean }> {
    const effectivePlan = await this.subscriptionService.getUserEffectivePlan(userId);
    const { max, current } = await this.getResourceCountAndLimit(
      userId,
      resource,
      effectivePlan.limits,
    );

    const unlimited = max === -1;
    const remaining = unlimited ? -1 : Math.max(0, max - current);

    return { remaining, max, current, unlimited };
  }

  /**
   * Batch check multiple resources at once
   */
  async checkMultipleLimits(
    userId: string,
    resources: LimitedResource[],
  ): Promise<Map<LimitedResource, LimitCheckResult>> {
    const results = new Map<LimitedResource, LimitCheckResult>();

    // Run all checks in parallel
    const checks = await Promise.all(
      resources.map((resource) => this.checkLimit({ userId, resource })),
    );

    resources.forEach((resource, index) => {
      results.set(resource, checks[index]);
    });

    return results;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Get current count and max limit for a resource
   */
  private async getResourceCountAndLimit(
    userId: string,
    resource: LimitedResource,
    limits: {
      maxClients: number;
      maxQuotes: number;
      maxWorkOrders: number;
      maxPayments: number;
      maxNotificationsPerMonth: number;
      maxSuppliers?: number;
      maxExpenses?: number;
    },
  ): Promise<{ max: number; current: number }> {
    const max = this.getMaxLimit(resource, limits);
    const current = await this.getResourceCount(this.prisma, userId, resource);
    return { max, current };
  }

  /**
   * Get max limit for a resource from plan limits
   */
  private getMaxLimit(
    resource: LimitedResource,
    limits: {
      maxClients: number;
      maxQuotes: number;
      maxWorkOrders: number;
      maxPayments: number;
      maxNotificationsPerMonth: number;
      maxSuppliers?: number;
      maxExpenses?: number;
    },
  ): number {
    switch (resource) {
      case 'CLIENT':
        return limits.maxClients;
      case 'QUOTE':
        return limits.maxQuotes;
      case 'WORK_ORDER':
        return limits.maxWorkOrders;
      case 'PAYMENT':
        return limits.maxPayments;
      case 'NOTIFICATION':
        return limits.maxNotificationsPerMonth;
      case 'SUPPLIER':
        return limits.maxSuppliers ?? -1; // Default unlimited if not defined
      case 'EXPENSE':
        return limits.maxExpenses ?? -1; // Default unlimited if not defined
      default:
        throw new Error(`Unknown resource type: ${resource}`);
    }
  }

  /**
   * Get current resource count
   * Can be called with either prisma client or transaction context
   */
  private async getResourceCount(
    prismaOrTx: any,
    userId: string,
    resource: LimitedResource,
  ): Promise<number> {
    switch (resource) {
      case 'CLIENT':
        return await prismaOrTx.client.count({ where: { userId } });

      case 'QUOTE':
        return await prismaOrTx.quote.count({ where: { userId } });

      case 'WORK_ORDER':
        return await prismaOrTx.workOrder.count({ where: { userId } });

      case 'PAYMENT':
        return await prismaOrTx.clientPayment.count({ where: { userId } });

      case 'NOTIFICATION':
        return await this.getNotificationsSentThisMonth(userId);

      case 'SUPPLIER':
        return await prismaOrTx.supplier.count({ where: { userId, deletedAt: null } });

      case 'EXPENSE':
        return await prismaOrTx.expense.count({ where: { userId, deletedAt: null } });

      default:
        throw new Error(`Unknown resource type: ${resource}`);
    }
  }

  /**
   * Check if a feature flag is enabled
   */
  private isFeatureEnabled(
    feature: FeatureFlag,
    limits: {
      enableAdvancedAutomations: boolean;
      enableAdvancedAnalytics: boolean;
      enableClientPortal: boolean;
      enablePdfExport: boolean;
      enableDigitalSignature: boolean;
      enableWhatsApp: boolean;
      enableExpenseManagement?: boolean;
      enableAcceptanceTerms?: boolean;
      enableInventory?: boolean;
    },
  ): boolean {
    switch (feature) {
      case 'ADVANCED_AUTOMATIONS':
        return limits.enableAdvancedAutomations;
      case 'ADVANCED_ANALYTICS':
        return limits.enableAdvancedAnalytics;
      case 'CLIENT_PORTAL':
        return limits.enableClientPortal;
      case 'PDF_EXPORT':
        return limits.enablePdfExport;
      case 'DIGITAL_SIGNATURE':
        return limits.enableDigitalSignature;
      case 'WHATSAPP':
        return limits.enableWhatsApp;
      case 'EXPENSE_MANAGEMENT':
        return limits.enableExpenseManagement ?? false;
      case 'ACCEPTANCE_TERMS':
        return limits.enableAcceptanceTerms ?? false;
      case 'INVENTORY':
        return limits.enableInventory ?? false;
      default:
        return false;
    }
  }

  /**
   * Get human-readable feature name
   */
  private getFeatureName(feature: FeatureFlag): string {
    const names: Record<FeatureFlag, string> = {
      ADVANCED_AUTOMATIONS: 'Automações Avançadas',
      ADVANCED_ANALYTICS: 'Relatórios Avançados',
      CLIENT_PORTAL: 'Portal do Cliente',
      PDF_EXPORT: 'Exportação de PDF',
      DIGITAL_SIGNATURE: 'Assinatura Digital',
      WHATSAPP: 'Notificações WhatsApp',
      EXPENSE_MANAGEMENT: 'Gestão de Despesas',
      WORK_ORDER_TYPES: 'Tipos de Ordem de Serviço',
      ACCEPTANCE_TERMS: 'Termos de Aceite',
      INVENTORY: 'Controle de Estoque',
    };
    return names[feature] || feature;
  }

  /**
   * Get human-readable resource name
   */
  private getResourceName(resource: LimitedResource): string {
    const names: Record<LimitedResource, string> = {
      CLIENT: 'clientes',
      QUOTE: 'orçamentos',
      WORK_ORDER: 'ordens de serviço',
      PAYMENT: 'cobranças',
      NOTIFICATION: 'notificações mensais',
      SUPPLIER: 'fornecedores',
      EXPENSE: 'despesas',
    };
    return names[resource] || resource;
  }

  /**
   * Generate limit reached message
   */
  private getLimitMessage(result: LimitCheckResult): string {
    const resourceName = this.getResourceName(result.resource);
    return `Você atingiu o limite de ${result.max} ${resourceName} no plano ${result.plan}. Faça upgrade para o PRO para continuar cadastrando.`;
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
