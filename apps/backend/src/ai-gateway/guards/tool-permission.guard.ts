/**
 * Tool Permission Guard
 * Checks if user has permission to execute a specific tool
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ToolPermission } from '../dto/tool-params';
import { TOOL_PERMISSION_KEY } from '../decorators/tool-permission.decorator';

/**
 * Subscription plan types
 */
export enum SubscriptionPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Mapping of permissions to minimum required plan
 */
const PERMISSION_PLAN_MAP: Record<ToolPermission, SubscriptionPlan> = {
  [ToolPermission.CUSTOMERS_READ]: SubscriptionPlan.FREE,
  [ToolPermission.CUSTOMERS_WRITE]: SubscriptionPlan.FREE,
  [ToolPermission.WORK_ORDERS_READ]: SubscriptionPlan.STARTER,
  [ToolPermission.WORK_ORDERS_WRITE]: SubscriptionPlan.STARTER,
  [ToolPermission.QUOTES_READ]: SubscriptionPlan.STARTER,
  [ToolPermission.QUOTES_WRITE]: SubscriptionPlan.STARTER,
  [ToolPermission.BILLING_READ]: SubscriptionPlan.PROFESSIONAL,
  [ToolPermission.BILLING_WRITE]: SubscriptionPlan.PROFESSIONAL,
  [ToolPermission.KB_READ]: SubscriptionPlan.FREE,
};

/**
 * Plan hierarchy for comparison
 */
const PLAN_HIERARCHY: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.STARTER]: 1,
  [SubscriptionPlan.PROFESSIONAL]: 2,
  [SubscriptionPlan.ENTERPRISE]: 3,
};

@Injectable()
export class ToolPermissionGuard implements CanActivate {
  private readonly logger = new Logger(ToolPermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permission from decorator
    const requiredPermission = this.reflector.getAllAndOverride<ToolPermission>(
      TOOL_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permission required, allow access
    if (!requiredPermission) {
      return true;
    }

    // Get user from request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('No user found in request for permission check');
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has required permission
    const hasPermission = await this.checkPermission(user, requiredPermission);

    if (!hasPermission) {
      this.logger.warn(
        `User ${user.id} denied access to tool requiring ${requiredPermission}`,
      );
      throw new ForbiddenException(
        `You don't have permission to use this feature. Required: ${requiredPermission}`,
      );
    }

    return true;
  }

  /**
   * Check if user has the required permission based on their subscription plan
   */
  private async checkPermission(
    user: { id: string; subscription?: { plan: SubscriptionPlan } },
    permission: ToolPermission,
  ): Promise<boolean> {
    // Get user's subscription plan (default to FREE)
    const userPlan = user.subscription?.plan || SubscriptionPlan.FREE;

    // Get minimum required plan for this permission
    const requiredPlan = PERMISSION_PLAN_MAP[permission];

    if (!requiredPlan) {
      // Unknown permission, deny by default
      this.logger.warn(`Unknown permission: ${permission}`);
      return false;
    }

    // Compare plan hierarchy
    const userPlanLevel = PLAN_HIERARCHY[userPlan] ?? 0;
    const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

    return userPlanLevel >= requiredPlanLevel;
  }
}

/**
 * Helper function to check if a plan has access to a permission
 */
export function planHasPermission(
  plan: SubscriptionPlan,
  permission: ToolPermission,
): boolean {
  const requiredPlan = PERMISSION_PLAN_MAP[permission];
  if (!requiredPlan) return false;

  const userPlanLevel = PLAN_HIERARCHY[plan] ?? 0;
  const requiredPlanLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

  return userPlanLevel >= requiredPlanLevel;
}

/**
 * Get all permissions available for a plan
 */
export function getPermissionsForPlan(plan: SubscriptionPlan): ToolPermission[] {
  const planLevel = PLAN_HIERARCHY[plan] ?? 0;

  return Object.entries(PERMISSION_PLAN_MAP)
    .filter(([_, requiredPlan]) => {
      const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;
      return planLevel >= requiredLevel;
    })
    .map(([permission]) => permission as ToolPermission);
}
