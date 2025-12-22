import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentBillingType } from '@prisma/client';
import { OverviewQueryDto, PaymentsQueryDto, RevenueByDayQueryDto, RevenueByClientQueryDto } from './dto';

/**
 * Status categories for financial calculations
 * Based on PaymentStatus enum from Prisma
 */
const PAID_STATUSES: PaymentStatus[] = [PaymentStatus.RECEIVED, PaymentStatus.CONFIRMED, PaymentStatus.RECEIVED_IN_CASH];
const PENDING_STATUSES: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED, PaymentStatus.AWAITING_RISK_ANALYSIS];
const OVERDUE_STATUSES: PaymentStatus[] = [PaymentStatus.OVERDUE];
const CANCELED_STATUSES: PaymentStatus[] = [PaymentStatus.DELETED];
const REFUSED_STATUSES: PaymentStatus[] = [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUND_IN_PROGRESS, PaymentStatus.REFUND_REQUESTED, PaymentStatus.CHARGEBACK_REQUESTED, PaymentStatus.CHARGEBACK_DISPUTE, PaymentStatus.AWAITING_CHARGEBACK_REVERSAL];

export interface OverviewResponse {
  period: string;
  startDate: string;
  endDate: string;
  received: number;
  pending: number;
  overdue: number;
  canceled: number;
  refused: number;
  totalExpected: number;
  netRevenue: number;
  invoicedCount: number;
  paidCount: number;
  overdueCount: number;
  averageTicket: number;
  averageTicketPaid: number;
  paymentDistribution: {
    PIX: number;
    BOLETO: number;
    CREDIT_CARD: number;
  };
}

export interface RevenueByDayItem {
  date: string;
  value: number;
}

export interface RevenueByClientItem {
  clientId: string;
  name: string;
  totalPaid: number;
  count: number;
}

export interface ClientExtractResponse {
  clientId: string;
  clientName: string;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  history: Array<{
    paymentId: string;
    value: number;
    status: PaymentStatus;
    dueDate: Date;
    paidAt: Date | null;
    description: string | null;
  }>;
}

export interface WorkOrderExtractResponse {
  workOrderId: string;
  workOrderTitle: string;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  payments: Array<{
    paymentId: string;
    value: number;
    status: PaymentStatus;
    billingType: PaymentBillingType;
    dueDate: Date;
    paidAt: Date | null;
    description: string | null;
  }>;
}

@Injectable()
export class FinancialDashboardService {
  private readonly logger = new Logger(FinancialDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate date range based on period parameter
   */
  private getDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date; periodLabel: string } {
    const now = new Date();

    if (period === 'custom' && startDate && endDate) {
      return {
        start: new Date(startDate),
        end: new Date(endDate),
        periodLabel: 'custom',
      };
    }

    switch (period) {
      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end, periodLabel: 'last_month' };
      }
      case 'current_year': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        return { start, end, periodLabel: 'current_year' };
      }
      case 'all_time': {
        const start = new Date(2000, 0, 1);
        const end = new Date(2100, 11, 31, 23, 59, 59, 999);
        return { start, end, periodLabel: 'all_time' };
      }
      case 'current_month':
      default: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end, periodLabel: 'current_month' };
      }
    }
  }

  /**
   * GET /financial/dashboard/overview
   * Returns aggregated metrics for the specified period
   */
  async getOverview(userId: string, query: OverviewQueryDto): Promise<OverviewResponse> {
    this.logger.log(`Getting financial overview for user ${userId}`);

    const { start, end, periodLabel } = this.getDateRange(query.period, query.startDate, query.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all payments for the user in the period
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        OR: [
          // Paid payments with paidAt: filter by paidAt
          {
            status: { in: PAID_STATUSES },
            paidAt: { not: null, gte: start, lte: end },
          },
          // Paid payments WITHOUT paidAt (fallback to dueDate)
          {
            status: { in: PAID_STATUSES },
            paidAt: null,
            dueDate: { gte: start, lte: end },
          },
          // Non-paid payments: filter by dueDate
          {
            status: { notIn: PAID_STATUSES },
            dueDate: { gte: start, lte: end },
          },
        ],
      },
    });

    // Calculate aggregates
    let received = 0;
    let pending = 0;
    let overdue = 0;
    let canceled = 0;
    let refused = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let totalValue = 0;
    let paidTotalValue = 0;

    const paymentDistribution = {
      PIX: 0,
      BOLETO: 0,
      CREDIT_CARD: 0,
    };

    for (const payment of payments) {
      const value = payment.value.toNumber();
      totalValue += value;

      if (PAID_STATUSES.includes(payment.status)) {
        received += value;
        paidCount++;
        paidTotalValue += value;
        paymentDistribution[payment.billingType] += value;
      } else if (PENDING_STATUSES.includes(payment.status)) {
        // Check if overdue based on dueDate
        if (payment.dueDate < today) {
          overdue += value;
          overdueCount++;
        } else {
          pending += value;
        }
      } else if (OVERDUE_STATUSES.includes(payment.status)) {
        overdue += value;
        overdueCount++;
      } else if (CANCELED_STATUSES.includes(payment.status)) {
        canceled += value;
      } else if (REFUSED_STATUSES.includes(payment.status)) {
        refused += value;
      }
    }

    const invoicedCount = payments.length;
    const totalExpected = received + pending + overdue;
    const netRevenue = received;
    const averageTicket = invoicedCount > 0 ? totalValue / invoicedCount : 0;
    const averageTicketPaid = paidCount > 0 ? paidTotalValue / paidCount : 0;

    return {
      period: periodLabel,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      received: Math.round(received * 100) / 100,
      pending: Math.round(pending * 100) / 100,
      overdue: Math.round(overdue * 100) / 100,
      canceled: Math.round(canceled * 100) / 100,
      refused: Math.round(refused * 100) / 100,
      totalExpected: Math.round(totalExpected * 100) / 100,
      netRevenue: Math.round(netRevenue * 100) / 100,
      invoicedCount,
      paidCount,
      overdueCount,
      averageTicket: Math.round(averageTicket * 100) / 100,
      averageTicketPaid: Math.round(averageTicketPaid * 100) / 100,
      paymentDistribution: {
        PIX: Math.round(paymentDistribution.PIX * 100) / 100,
        BOLETO: Math.round(paymentDistribution.BOLETO * 100) / 100,
        CREDIT_CARD: Math.round(paymentDistribution.CREDIT_CARD * 100) / 100,
      },
    };
  }

  /**
   * GET /financial/dashboard/revenue-by-day
   * Returns daily revenue for the specified date range
   */
  async getRevenueByDay(userId: string, query: RevenueByDayQueryDto): Promise<RevenueByDayItem[]> {
    this.logger.log(`Getting revenue by day for user ${userId}`);

    const now = new Date();
    const startDate = query.startDate ? new Date(query.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = query.endDate ? new Date(query.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get paid payments in the date range
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        status: { in: PAID_STATUSES },
        paidAt: {
          gte: startDate,
          lte: new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1),
        },
      },
      select: {
        paidAt: true,
        value: true,
      },
    });

    // Group by date
    const revenueByDate = new Map<string, number>();

    // Initialize all days with zero
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      revenueByDate.set(dateKey, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sum payments by date
    for (const payment of payments) {
      if (payment.paidAt) {
        const dateKey = payment.paidAt.toISOString().split('T')[0];
        const currentValue = revenueByDate.get(dateKey) || 0;
        revenueByDate.set(dateKey, currentValue + payment.value.toNumber());
      }
    }

    // Convert to array and sort
    const result: RevenueByDayItem[] = [];
    for (const [date, value] of revenueByDate) {
      result.push({
        date,
        value: Math.round(value * 100) / 100,
      });
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * GET /financial/dashboard/revenue-by-client
   * Returns revenue grouped by client
   */
  async getRevenueByClient(userId: string, query: RevenueByClientQueryDto): Promise<RevenueByClientItem[]> {
    this.logger.log(`Getting revenue by client for user ${userId}`);

    const { start, end } = this.getDateRange(query.period, query.startDate, query.endDate);

    // Get paid payments grouped by client
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        status: { in: PAID_STATUSES },
        paidAt: { gte: start, lte: end },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by client
    const clientMap = new Map<string, { name: string; totalPaid: number; count: number }>();

    for (const payment of payments) {
      const clientId = payment.clientId;
      const existing = clientMap.get(clientId);

      if (existing) {
        existing.totalPaid += payment.value.toNumber();
        existing.count++;
      } else {
        clientMap.set(clientId, {
          name: payment.client.name,
          totalPaid: payment.value.toNumber(),
          count: 1,
        });
      }
    }

    // Convert to array and sort by totalPaid descending
    const result: RevenueByClientItem[] = [];
    for (const [clientId, data] of clientMap) {
      result.push({
        clientId,
        name: data.name,
        totalPaid: Math.round(data.totalPaid * 100) / 100,
        count: data.count,
      });
    }

    return result.sort((a, b) => b.totalPaid - a.totalPaid);
  }

  /**
   * GET /financial/dashboard/payments
   * Returns filtered list of payments
   */
  async getPayments(userId: string, query: PaymentsQueryDto) {
    this.logger.log(`Getting payments list for user ${userId}`);

    const where: any = { userId };

    // Status filter
    if (query.status) {
      where.status = query.status;
    }

    // Billing type filter
    if (query.billingType) {
      where.billingType = query.billingType;
    }

    // Client filter
    if (query.clientId) {
      where.clientId = query.clientId;
    }

    // Work order filter
    if (query.workOrderId) {
      where.workOrderId = query.workOrderId;
    }

    // Quote filter
    if (query.quoteId) {
      where.quoteId = query.quoteId;
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      const dateField = query.dateField || 'dueDate';
      where[dateField] = {};

      if (query.startDate) {
        where[dateField].gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where[dateField].lte = new Date(query.endDate + 'T23:59:59.999Z');
      }
    }

    // Sort configuration
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const payments = await this.prisma.clientPayment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
          },
        },
        quote: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
    });

    return payments.map((payment) => ({
      id: payment.id,
      asaasPaymentId: payment.asaasPaymentId,
      clientId: payment.clientId,
      clientName: payment.client.name,
      workOrderId: payment.workOrderId,
      workOrderTitle: payment.workOrder?.title || null,
      quoteId: payment.quoteId,
      billingType: payment.billingType,
      value: payment.value.toNumber(),
      description: payment.description,
      dueDate: payment.dueDate,
      status: payment.status,
      paidAt: payment.paidAt,
      canceledAt: payment.canceledAt,
      createdAt: payment.createdAt,
    }));
  }

  /**
   * GET /financial/dashboard/client/:clientId
   * Returns financial extract for a specific client
   */
  async getClientExtract(userId: string, clientId: string): Promise<ClientExtractResponse> {
    this.logger.log(`Getting client extract for client ${clientId}`);

    // Verify client belongs to user
    const client = await this.prisma.client.findUnique({
      where: { id: clientId, userId },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    // Get all payments for this client
    const payments = await this.prisma.clientPayment.findMany({
      where: { userId, clientId },
      orderBy: { createdAt: 'desc' },
    });

    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const history = payments.map((payment) => {
      const value = payment.value.toNumber();

      if (PAID_STATUSES.includes(payment.status)) {
        totalPaid += value;
      } else if (OVERDUE_STATUSES.includes(payment.status) || (PENDING_STATUSES.includes(payment.status) && payment.dueDate < today)) {
        totalOverdue += value;
      } else if (PENDING_STATUSES.includes(payment.status)) {
        totalPending += value;
      }

      return {
        paymentId: payment.id,
        value,
        status: payment.status,
        dueDate: payment.dueDate,
        paidAt: payment.paidAt,
        description: payment.description,
      };
    });

    return {
      clientId: client.id,
      clientName: client.name,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      history,
    };
  }

  /**
   * GET /financial/dashboard/work-order/:workOrderId
   * Returns financial extract for a specific work order
   */
  async getWorkOrderExtract(userId: string, workOrderId: string): Promise<WorkOrderExtractResponse> {
    this.logger.log(`Getting work order extract for work order ${workOrderId}`);

    // Verify work order belongs to user
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId, userId },
    });

    if (!workOrder) {
      throw new NotFoundException('Work order not found');
    }

    // Get all payments for this work order
    const payments = await this.prisma.clientPayment.findMany({
      where: { userId, workOrderId },
      orderBy: { createdAt: 'desc' },
    });

    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentsList = payments.map((payment) => {
      const value = payment.value.toNumber();

      if (PAID_STATUSES.includes(payment.status)) {
        totalPaid += value;
      } else if (OVERDUE_STATUSES.includes(payment.status) || (PENDING_STATUSES.includes(payment.status) && payment.dueDate < today)) {
        totalOverdue += value;
      } else if (PENDING_STATUSES.includes(payment.status)) {
        totalPending += value;
      }

      return {
        paymentId: payment.id,
        value,
        status: payment.status,
        billingType: payment.billingType,
        dueDate: payment.dueDate,
        paidAt: payment.paidAt,
        description: payment.description,
      };
    });

    return {
      workOrderId: workOrder.id,
      workOrderTitle: workOrder.title,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      payments: paymentsList,
    };
  }
}
