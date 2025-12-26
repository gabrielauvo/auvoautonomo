/**
 * AI Plan Service
 * Manages the PLAN -> CONFIRM -> EXECUTE flow
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiPlanStatus, AiAuditCategory } from '../enums';
import { ToolRegistryService } from './tool-registry.service';
import { AiAuditService } from './ai-audit.service';
import { PlanAction, ToolContext, PaymentPreviewData } from '../interfaces/tool.interface';
import { randomUUID } from 'crypto';

const PLAN_EXPIRY_MINUTES = 5;

export interface CreatePlanInput {
  conversationId: string;
  userId: string;
  summary: string;
  actions: PlanAction[];
  idempotencyKey?: string;
}

@Injectable()
export class AiPlanService {
  private readonly logger = new Logger(AiPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly auditService: AiAuditService,
  ) {}

  /**
   * Create a new plan for user confirmation
   */
  async createPlan(input: CreatePlanInput) {
    const { conversationId, userId, summary, actions, idempotencyKey } = input;

    // Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey || `plan_${randomUUID()}`;

    // Check for duplicate idempotency key
    const existing = await this.prisma.aiPlan.findUnique({
      where: { idempotencyKey: finalIdempotencyKey },
    });

    if (existing) {
      this.logger.warn(`Duplicate plan request with idempotencyKey: ${finalIdempotencyKey}`);
      return existing;
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PLAN_EXPIRY_MINUTES);

    // Create plan
    const plan = await this.prisma.aiPlan.create({
      data: {
        conversationId,
        userId,
        summary,
        actions: actions as object,
        status: AiPlanStatus.PENDING_CONFIRMATION,
        idempotencyKey: finalIdempotencyKey,
        expiresAt,
      },
    });

    // Create payment previews for payment actions
    const paymentActions = actions.filter((a) => a.paymentPreview);
    if (paymentActions.length > 0) {
      await this.prisma.aiPaymentPreview.createMany({
        data: paymentActions.map((a) => ({
          planId: plan.id,
          clientId: a.paymentPreview!.clientId,
          clientName: a.paymentPreview!.clientName,
          billingType: a.paymentPreview!.billingType,
          value: a.paymentPreview!.value,
          dueDate: a.paymentPreview!.dueDate,
          description: a.paymentPreview!.description,
        })),
      });
    }

    // Audit log
    await this.auditService.log({
      userId,
      conversationId,
      planId: plan.id,
      category: AiAuditCategory.PLAN_CREATED,
      action: 'create_plan',
      inputPayload: { summary, actionCount: actions.length },
      success: true,
    });

    this.logger.log(`Created plan ${plan.id} with ${actions.length} actions`);

    return plan;
  }

  /**
   * Get a plan by ID (with ownership check)
   */
  async getPlan(planId: string, userId: string) {
    const plan = await this.prisma.aiPlan.findFirst({
      where: {
        id: planId,
        userId, // CRITICAL: Multi-tenant filter
      },
      include: {
        previews: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  /**
   * Confirm a plan (user approves execution)
   */
  async confirmPlan(planId: string, userId: string, context: ToolContext) {
    const plan = await this.prisma.aiPlan.findFirst({
      where: {
        id: planId,
        userId, // CRITICAL: Multi-tenant filter
        status: AiPlanStatus.PENDING_CONFIRMATION,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found or already processed');
    }

    // Check if expired
    if (plan.expiresAt < new Date()) {
      await this.prisma.aiPlan.update({
        where: { id: planId },
        data: { status: AiPlanStatus.EXPIRED },
      });

      await this.auditService.log({
        userId,
        conversationId: plan.conversationId,
        planId,
        category: AiAuditCategory.PLAN_REJECTED,
        action: 'plan_expired',
        success: false,
        errorMessage: 'Plan expired before confirmation',
      });

      throw new BadRequestException('Plan expired');
    }

    // Update status to confirmed
    await this.prisma.aiPlan.update({
      where: { id: planId },
      data: {
        status: AiPlanStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    await this.auditService.log({
      userId,
      conversationId: plan.conversationId,
      planId,
      category: AiAuditCategory.PLAN_CONFIRMED,
      action: 'confirm_plan',
      success: true,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.logger.log(`Plan ${planId} confirmed by user ${userId}`);

    // Execute the plan
    return this.executePlan(planId, userId, context);
  }

  /**
   * Reject a plan (user declines execution)
   */
  async rejectPlan(planId: string, userId: string, context: ToolContext) {
    const result = await this.prisma.aiPlan.updateMany({
      where: {
        id: planId,
        userId, // CRITICAL: Multi-tenant filter
        status: AiPlanStatus.PENDING_CONFIRMATION,
      },
      data: {
        status: AiPlanStatus.REJECTED,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Plan not found or already processed');
    }

    await this.auditService.log({
      userId,
      planId,
      category: AiAuditCategory.PLAN_REJECTED,
      action: 'reject_plan',
      success: true,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.logger.log(`Plan ${planId} rejected by user ${userId}`);
  }

  /**
   * Execute a confirmed plan
   */
  private async executePlan(planId: string, userId: string, context: ToolContext) {
    const plan = await this.prisma.aiPlan.findFirst({
      where: {
        id: planId,
        userId,
        status: AiPlanStatus.CONFIRMED,
      },
      include: {
        previews: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found or not confirmed');
    }

    // Update status to executing
    await this.prisma.aiPlan.update({
      where: { id: planId },
      data: { status: AiPlanStatus.EXECUTING },
    });

    const actions = plan.actions as unknown as PlanAction[];
    const results: Array<{ actionId: string; success: boolean; result?: unknown; error?: string }> =
      [];
    let hasErrors = false;

    // Execute each action sequentially
    for (const action of actions) {
      const toolContext: ToolContext = {
        ...context,
        planId,
        idempotencyKey: `${planId}_${action.id}`,
      };

      const result = await this.toolRegistry.executeTool(action.tool, action.params, toolContext);

      results.push({
        actionId: action.id,
        success: result.success,
        result: result.data,
        error: result.error,
      });

      if (!result.success) {
        hasErrors = true;
        // Continue executing other actions or stop? For now, continue.
        this.logger.warn(`Action ${action.id} failed: ${result.error}`);
      }
    }

    // Update plan with results
    const finalStatus = hasErrors ? AiPlanStatus.FAILED : AiPlanStatus.COMPLETED;
    const successCount = results.filter((r) => r.success).length;

    await this.prisma.aiPlan.update({
      where: { id: planId },
      data: {
        status: finalStatus,
        executedAt: new Date(),
        resultSummary: `Executed ${successCount}/${actions.length} actions successfully`,
        errorMessage: hasErrors
          ? results
              .filter((r) => !r.success)
              .map((r) => r.error)
              .join('; ')
          : null,
      },
    });

    await this.auditService.log({
      userId,
      conversationId: plan.conversationId,
      planId,
      category: AiAuditCategory.PLAN_EXECUTED,
      action: 'execute_plan',
      outputPayload: { results },
      success: !hasErrors,
      errorMessage: hasErrors ? 'Some actions failed' : undefined,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.logger.log(
      `Plan ${planId} executed: ${successCount}/${actions.length} actions succeeded`,
    );

    return {
      planId,
      status: finalStatus,
      results,
    };
  }

  /**
   * Get pending plans for a user
   */
  async getPendingPlans(userId: string) {
    return this.prisma.aiPlan.findMany({
      where: {
        userId,
        status: AiPlanStatus.PENDING_CONFIRMATION,
        expiresAt: { gt: new Date() },
      },
      include: {
        previews: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cleanup expired plans (run via cron)
   */
  async cleanupExpiredPlans(): Promise<number> {
    const result = await this.prisma.aiPlan.updateMany({
      where: {
        status: AiPlanStatus.PENDING_CONFIRMATION,
        expiresAt: { lt: new Date() },
      },
      data: {
        status: AiPlanStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} plans`);
    }

    return result.count;
  }

  /**
   * Create a payment preview (dry-run)
   */
  async createPaymentPreview(
    planId: string,
    userId: string,
    preview: PaymentPreviewData,
  ) {
    // Verify plan ownership
    const plan = await this.prisma.aiPlan.findFirst({
      where: {
        id: planId,
        userId,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return this.prisma.aiPaymentPreview.create({
      data: {
        planId,
        clientId: preview.clientId,
        clientName: preview.clientName,
        billingType: preview.billingType,
        value: preview.value,
        dueDate: preview.dueDate,
        description: preview.description,
      },
    });
  }

  /**
   * Validate payment previews are still valid before execution
   */
  async validatePaymentPreviews(planId: string, userId: string): Promise<boolean> {
    const previews = await this.prisma.aiPaymentPreview.findMany({
      where: {
        planId,
        plan: { userId }, // CRITICAL: Multi-tenant filter
      },
    });

    for (const preview of previews) {
      // Check if client still exists
      const client = await this.prisma.client.findFirst({
        where: {
          id: preview.clientId,
          userId, // CRITICAL: Multi-tenant filter
        },
      });

      if (!client) {
        await this.prisma.aiPaymentPreview.update({
          where: { id: preview.id },
          data: { valid: false },
        });
        return false;
      }
    }

    return true;
  }
}
