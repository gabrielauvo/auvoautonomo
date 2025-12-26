/**
 * Base Tool Abstract Class
 * Provides common functionality for all AI tools
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../services/tool-registry.service';
import {
  ITool,
  ToolMetadata,
  ToolContext,
  ToolResult,
} from '../interfaces/tool.interface';

@Injectable()
export abstract class BaseTool<TParams = unknown, TResult = unknown>
  implements ITool<TParams, TResult>, OnModuleInit
{
  abstract readonly metadata: ToolMetadata;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly toolRegistry: ToolRegistryService,
  ) {}

  /**
   * Register this tool on module initialization
   */
  onModuleInit() {
    this.toolRegistry.registerTool(this as unknown as ITool);
  }

  /**
   * Default permission check - override in subclasses for specific checks
   */
  async checkPermission(context: ToolContext): Promise<boolean> {
    // Base implementation: just verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return false;
    }

    // Check required features if specified
    if (this.metadata.requiredFeatures?.length) {
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId: context.userId },
        include: { plan: { include: { usageLimits: true } } },
      });

      if (!subscription?.plan?.usageLimits) {
        return false;
      }

      // Check each required feature
      const limits = subscription.plan.usageLimits;
      for (const feature of this.metadata.requiredFeatures) {
        const featureKey = `enable${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof typeof limits;
        if (featureKey in limits && !limits[featureKey]) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Abstract methods to be implemented by each tool
   */
  abstract validate(params: TParams, context: ToolContext): Promise<true | string>;
  abstract execute(params: TParams, context: ToolContext): Promise<ToolResult<TResult>>;

  /**
   * Helper: Ensure entity belongs to user (multi-tenant check)
   */
  protected async verifyOwnership(
    entityType: 'client' | 'quote' | 'workOrder' | 'clientPayment',
    entityId: string,
    userId: string,
  ): Promise<boolean> {
    const entity = await (this.prisma[entityType] as any).findFirst({
      where: {
        id: entityId,
        userId,
        ...(entityType === 'client' && { deletedAt: null }),
      },
      select: { id: true },
    });

    return !!entity;
  }

  /**
   * Helper: Get user's limits
   */
  protected async getUserLimits(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: { include: { usageLimits: true } } },
    });

    return subscription?.plan?.usageLimits ?? null;
  }

  /**
   * Helper: Check if user can create more entities
   */
  protected async checkEntityLimit(
    userId: string,
    entityType: 'clients' | 'quotes' | 'workOrders' | 'payments',
  ): Promise<boolean> {
    const limits = await this.getUserLimits(userId);
    if (!limits) return false;

    const limitKey = `max${entityType.charAt(0).toUpperCase() + entityType.slice(1)}` as keyof typeof limits;
    const maxLimit = limits[limitKey] as number;

    // -1 means unlimited
    if (maxLimit === -1) return true;

    // Count current entities
    let count: number;
    switch (entityType) {
      case 'clients':
        count = await this.prisma.client.count({ where: { userId, deletedAt: null } });
        break;
      case 'quotes':
        count = await this.prisma.quote.count({ where: { userId } });
        break;
      case 'workOrders':
        count = await this.prisma.workOrder.count({ where: { userId } });
        break;
      case 'payments':
        count = await this.prisma.clientPayment.count({ where: { userId } });
        break;
    }

    return count < maxLimit;
  }
}
