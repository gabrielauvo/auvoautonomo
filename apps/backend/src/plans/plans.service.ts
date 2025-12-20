import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageLimits {
  maxClients: number;
  maxQuotes: number;
  maxWorkOrders: number;
  maxInvoices: number;
}

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async getUserPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { plan: true },
    });

    if (!user || !user.plan) {
      throw new ForbiddenException('User does not have an active plan');
    }

    return user.plan;
  }

  async getUserLimits(userId: string): Promise<UsageLimits> {
    const plan = await this.getUserPlan(userId);

    return {
      maxClients: plan.maxClients,
      maxQuotes: plan.maxQuotes,
      maxWorkOrders: plan.maxWorkOrders,
      maxInvoices: plan.maxInvoices,
    };
  }

  async checkClientLimit(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);

    // -1 significa ilimitado
    if (plan.maxClients === -1) {
      return;
    }

    const count = await this.prisma.client.count({
      where: { userId },
    });

    if (count >= plan.maxClients) {
      throw new ForbiddenException(
        `Client limit reached. Your plan allows ${plan.maxClients} clients.`,
      );
    }
  }

  async checkQuoteLimit(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);

    if (plan.maxQuotes === -1) {
      return;
    }

    const count = await this.prisma.quote.count({
      where: { userId },
    });

    if (count >= plan.maxQuotes) {
      throw new ForbiddenException(
        `Quote limit reached. Your plan allows ${plan.maxQuotes} quotes.`,
      );
    }
  }

  async checkWorkOrderLimit(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);

    if (plan.maxWorkOrders === -1) {
      return;
    }

    const count = await this.prisma.workOrder.count({
      where: { userId },
    });

    if (count >= plan.maxWorkOrders) {
      throw new ForbiddenException(
        `Work order limit reached. Your plan allows ${plan.maxWorkOrders} work orders.`,
      );
    }
  }

  async checkInvoiceLimit(userId: string): Promise<void> {
    const plan = await this.getUserPlan(userId);

    if (plan.maxInvoices === -1) {
      return;
    }

    const count = await this.prisma.invoice.count({
      where: { userId },
    });

    if (count >= plan.maxInvoices) {
      throw new ForbiddenException(
        `Invoice limit reached. Your plan allows ${plan.maxInvoices} invoices.`,
      );
    }
  }

  async getCurrentUsage(userId: string) {
    const [clients, quotes, workOrders, invoices, plan] = await Promise.all([
      this.prisma.client.count({ where: { userId } }),
      this.prisma.quote.count({ where: { userId } }),
      this.prisma.workOrder.count({ where: { userId } }),
      this.prisma.invoice.count({ where: { userId } }),
      this.getUserPlan(userId),
    ]);

    return {
      clients: {
        current: clients,
        limit: plan.maxClients,
        unlimited: plan.maxClients === -1,
      },
      quotes: {
        current: quotes,
        limit: plan.maxQuotes,
        unlimited: plan.maxQuotes === -1,
      },
      workOrders: {
        current: workOrders,
        limit: plan.maxWorkOrders,
        unlimited: plan.maxWorkOrders === -1,
      },
      invoices: {
        current: invoices,
        limit: plan.maxInvoices,
        unlimited: plan.maxInvoices === -1,
      },
    };
  }

  async getAllPlans() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
  }
}
