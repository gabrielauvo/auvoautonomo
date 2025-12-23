import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AnalyticsPeriod,
  OverviewResponse,
  QuotesFunnelResponse,
  WorkOrdersAnalyticsResponse,
  RevenueByPeriodResponse,
  TopClientsResponse,
  TopServicesResponse,
  DelinquencyResponse,
  CompletionTimeBucket,
} from './interfaces/analytics-responses.interface';
import { GroupByPeriod } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== PERIOD HELPERS ====================

  /**
   * Get period dates - defaults to last 30 days if not provided
   */
  getPeriod(startDate?: string, endDate?: string): AnalyticsPeriod {
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  private getPeriodDates(period: AnalyticsPeriod): { start: Date; end: Date } {
    const start = new Date(period.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(period.endDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // ==================== OVERVIEW ====================

  async getOverview(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<OverviewResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Run all queries in parallel for performance
    const [
      quotesData,
      workOrdersData,
      revenueData,
      clientsData,
    ] = await Promise.all([
      this.getQuotesOverview(userId, start, end),
      this.getWorkOrdersOverview(userId, start, end),
      this.getRevenueOverview(userId, start, end),
      this.getClientsOverview(userId, start, end),
    ]);

    return {
      period,
      quotes: quotesData,
      workOrders: workOrdersData,
      revenue: revenueData,
      clients: clientsData,
    };
  }

  private async getQuotesOverview(userId: string, start: Date, end: Date) {
    const quotes = await this.prisma.quote.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    const statusCounts = quotes.reduce(
      (acc, q) => {
        acc[q.status] = q._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const draft = statusCounts['DRAFT'] || 0;
    const sent = statusCounts['SENT'] || 0;
    const approved = statusCounts['APPROVED'] || 0;
    const rejected = statusCounts['REJECTED'] || 0;
    const expired = statusCounts['EXPIRED'] || 0;

    // Conversion rate: approved / (sent + approved + rejected) - quotes that were actually sent
    const sentTotal = sent + approved + rejected;
    const conversionRate = sentTotal > 0 ? approved / sentTotal : 0;

    return {
      total,
      draft,
      sent,
      approved,
      rejected,
      expired,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }

  private async getWorkOrdersOverview(userId: string, start: Date, end: Date) {
    const workOrders = await this.prisma.workOrder.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    const statusCounts = workOrders.reduce(
      (acc, wo) => {
        acc[wo.status] = wo._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    const created = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const completed = statusCounts['DONE'] || 0;
    const canceled = statusCounts['CANCELED'] || 0;
    const inProgress = statusCounts['IN_PROGRESS'] || 0;
    const scheduled = statusCounts['SCHEDULED'] || 0;

    // Calculate average completion time for completed WOs
    const completedWOs = await this.prisma.workOrder.findMany({
      where: {
        userId,
        status: 'DONE',
        createdAt: { gte: start, lte: end },
        executionEnd: { not: null },
        executionStart: { not: null },
      },
      select: {
        executionStart: true,
        executionEnd: true,
      },
    });

    let avgCompletionTimeHours: number | null = null;
    if (completedWOs.length > 0) {
      const totalHours = completedWOs.reduce((sum, wo) => {
        if (wo.executionStart && wo.executionEnd) {
          const hours =
            (wo.executionEnd.getTime() - wo.executionStart.getTime()) /
            (1000 * 60 * 60);
          return sum + hours;
        }
        return sum;
      }, 0);
      avgCompletionTimeHours = Math.round((totalHours / completedWOs.length) * 10) / 10;
    }

    return {
      created,
      completed,
      canceled,
      inProgress,
      scheduled,
      avgCompletionTimeHours,
    };
  }

  private async getRevenueOverview(userId: string, start: Date, end: Date) {
    // Buscar pagamentos por dueDate para invoiced/overdue/canceled
    const paymentsByDueDate = await this.prisma.clientPayment.groupBy({
      by: ['status'],
      where: {
        userId,
        dueDate: { gte: start, lte: end },
      },
      _count: { id: true },
      _sum: { value: true },
    });

    // Buscar pagamentos recebidos separadamente usando updatedAt (quando foi marcado como recebido)
    // Isso garante que pagamentos com vencimento futuro mas já recebidos apareçam no período correto
    const receivedPayments = await this.prisma.clientPayment.groupBy({
      by: ['status'],
      where: {
        userId,
        status: { in: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'] },
        updatedAt: { gte: start, lte: end },
      },
      _count: { id: true },
      _sum: { value: true },
    });

    let invoiced = 0;
    let received = 0;
    let overdue = 0;
    let canceled = 0;
    let invoicedCount = 0;
    let paidCount = 0;
    let overdueCount = 0;

    // Processar pagamentos por dueDate para invoiced/overdue/canceled
    for (const p of paymentsByDueDate) {
      const value = Number(p._sum.value) || 0;
      const count = p._count.id;

      // All payments contribute to invoiced (except canceled)
      if (p.status !== 'DELETED') {
        invoiced += value;
        invoicedCount += count;
      }

      switch (p.status) {
        case 'OVERDUE':
          overdue += value;
          overdueCount += count;
          break;
        case 'DELETED':
          canceled += value;
          break;
      }
    }

    // Processar pagamentos recebidos por updatedAt
    for (const p of receivedPayments) {
      const value = Number(p._sum.value) || 0;
      const count = p._count.id;
      received += value;
      paidCount += count;
    }

    const averageTicketPaid = paidCount > 0 ? Math.round((received / paidCount) * 100) / 100 : null;

    return {
      invoiced: Math.round(invoiced * 100) / 100,
      received: Math.round(received * 100) / 100,
      overdue: Math.round(overdue * 100) / 100,
      canceled: Math.round(canceled * 100) / 100,
      invoicedCount,
      paidCount,
      overdueCount,
      averageTicketPaid,
    };
  }

  private async getClientsOverview(userId: string, start: Date, end: Date) {
    // Total clients
    const totalClients = await this.prisma.client.count({
      where: { userId },
    });

    // New clients in period
    const newClients = await this.prisma.client.count({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
    });

    // Delinquent clients
    const delinquentClients = await this.prisma.client.count({
      where: {
        userId,
        isDelinquent: true,
      },
    });

    // Active clients: had WO or payment in period
    const activeClientsFromWO = await this.prisma.workOrder.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const activeClientsFromPayments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const activeClientIds = new Set([
      ...activeClientsFromWO.map((w) => w.clientId),
      ...activeClientsFromPayments.map((p) => p.clientId),
    ]);

    return {
      total: totalClients,
      active: activeClientIds.size,
      new: newClients,
      delinquent: delinquentClients,
    };
  }

  // ==================== QUOTES FUNNEL ====================

  async getQuotesFunnel(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<QuotesFunnelResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Count quotes by status
    const quotesByStatus = await this.prisma.quote.groupBy({
      by: ['status'],
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
    });

    const statusCounts = quotesByStatus.reduce(
      (acc, q) => {
        acc[q.status] = q._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Total created
    const created = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const sent = (statusCounts['SENT'] || 0) + (statusCounts['APPROVED'] || 0) + (statusCounts['REJECTED'] || 0);
    const approved = statusCounts['APPROVED'] || 0;
    const rejected = statusCounts['REJECTED'] || 0;

    // Count quotes converted to work orders
    const convertedCount = await this.prisma.workOrder.count({
      where: {
        userId,
        quoteId: { not: null },
        quote: {
          createdAt: { gte: start, lte: end },
        },
      },
    });

    const steps = [
      { stage: 'CREATED', count: created },
      { stage: 'SENT', count: sent },
      { stage: 'APPROVED', count: approved },
      { stage: 'REJECTED', count: rejected },
      { stage: 'CONVERTED_TO_WORK_ORDER', count: convertedCount },
    ];

    const conversionRates = {
      sentOverCreated: created > 0 ? Math.round((sent / created) * 100) / 100 : 0,
      approvedOverSent: sent > 0 ? Math.round((approved / sent) * 100) / 100 : 0,
      convertedOverApproved: approved > 0 ? Math.round((convertedCount / approved) * 100) / 100 : 0,
    };

    return {
      period,
      steps,
      conversionRates,
    };
  }

  // ==================== WORK ORDERS ANALYTICS ====================

  async getWorkOrdersAnalytics(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<WorkOrdersAnalyticsResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Get all WOs in period with relevant data
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        status: true,
        executionStart: true,
        executionEnd: true,
        checklists: {
          select: {
            id: true,
            templateId: true,
            answers: {
              select: { id: true },
            },
          },
        },
        checklistInstances: {
          select: {
            id: true,
            status: true,
            answers: {
              select: { id: true },
            },
          },
        },
      },
    });

    const total = workOrders.length;

    // Count by status
    const byStatus = {
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      CANCELED: 0,
    };

    const completionTimes: number[] = [];

    for (const wo of workOrders) {
      byStatus[wo.status as keyof typeof byStatus]++;

      // Calculate completion time for done WOs
      if (wo.status === 'DONE' && wo.executionStart && wo.executionEnd) {
        const hours =
          (wo.executionEnd.getTime() - wo.executionStart.getTime()) /
          (1000 * 60 * 60);
        completionTimes.push(hours);
      }
    }

    // Average completion time
    const avgCompletionTimeHours =
      completionTimes.length > 0
        ? Math.round(
            (completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10,
          ) / 10
        : null;

    // Completion time distribution
    const completionTimeDistribution = this.calculateCompletionDistribution(completionTimes);

    // Checklist completion rate (using new checklistInstances system)
    let checklistCompletionRate: number | null = null;
    const wosWithChecklists = workOrders.filter(
      (wo) => wo.checklistInstances.length > 0 || wo.checklists.length > 0
    );

    if (wosWithChecklists.length > 0) {
      let completedChecklists = 0;
      let totalChecklists = 0;

      for (const wo of wosWithChecklists) {
        // Count new system instances (completed status)
        for (const instance of wo.checklistInstances) {
          totalChecklists++;
          if (instance.status === 'COMPLETED') {
            completedChecklists++;
          }
        }

        // Count legacy checklists (has answers = considered complete)
        for (const checklist of wo.checklists) {
          totalChecklists++;
          if (checklist.answers.length > 0) {
            completedChecklists++;
          }
        }
      }

      checklistCompletionRate =
        totalChecklists > 0
          ? Math.round((completedChecklists / totalChecklists) * 100) / 100
          : null;
    }

    return {
      period,
      total,
      byStatus,
      avgCompletionTimeHours,
      completionTimeDistribution,
      checklistCompletionRate,
    };
  }

  private calculateCompletionDistribution(times: number[]): CompletionTimeBucket[] {
    const buckets = [
      { bucket: '0-2h', min: 0, max: 2, count: 0 },
      { bucket: '2-4h', min: 2, max: 4, count: 0 },
      { bucket: '4-8h', min: 4, max: 8, count: 0 },
      { bucket: '>8h', min: 8, max: Infinity, count: 0 },
    ];

    for (const time of times) {
      for (const bucket of buckets) {
        if (time >= bucket.min && time < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return buckets.map(({ bucket, count }) => ({ bucket, count }));
  }

  // ==================== REVENUE BY PERIOD ====================

  async getRevenueByPeriod(
    userId: string,
    groupBy: GroupByPeriod = GroupByPeriod.DAY,
    startDate?: string,
    endDate?: string,
  ): Promise<RevenueByPeriodResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Get all payments in period (baseado em dueDate para consistência)
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        dueDate: { gte: start, lte: end },
      },
      select: {
        value: true,
        status: true,
        dueDate: true,
      },
    });

    // Build series based on groupBy
    const seriesMap = new Map<
      string,
      { invoiced: number; received: number; overdue: number }
    >();

    // Initialize all periods in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!seriesMap.has(key)) {
        seriesMap.set(key, { invoiced: 0, received: 0, overdue: 0 });
      }
      this.incrementDate(currentDate, groupBy);
    }

    // Process payments
    // IMPORTANTE: Para consistência visual no gráfico, usamos dueDate como base
    // para todas as métricas. Isso evita que "received" apareça em um período
    // diferente de "invoiced" para o mesmo pagamento.
    for (const payment of payments) {
      const value = Number(payment.value);

      // Todos os valores são agrupados por dueDate para consistência
      if (payment.dueDate >= start && payment.dueDate <= end) {
        const key = this.getDateKey(payment.dueDate, groupBy);
        const entry = seriesMap.get(key);
        if (entry) {
          // Invoiced: todos os pagamentos não deletados
          if (payment.status !== 'DELETED') {
            entry.invoiced += value;
          }

          // Received: pagamentos confirmados/recebidos
          if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(payment.status)) {
            entry.received += value;
          }

          // Overdue: pagamentos vencidos
          if (payment.status === 'OVERDUE') {
            entry.overdue += value;
          }
        }
      }
    }

    // Convert to array and sort
    const series = Array.from(seriesMap.entries())
      .map(([date, data]) => ({
        date,
        invoiced: Math.round(data.invoiced * 100) / 100,
        received: Math.round(data.received * 100) / 100,
        overdue: Math.round(data.overdue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate totals
    const totals = series.reduce(
      (acc, item) => {
        acc.invoiced += item.invoiced;
        acc.received += item.received;
        acc.overdue += item.overdue;
        return acc;
      },
      { invoiced: 0, received: 0, overdue: 0 },
    );

    return {
      period,
      groupBy,
      series,
      totals: {
        invoiced: Math.round(totals.invoiced * 100) / 100,
        received: Math.round(totals.received * 100) / 100,
        overdue: Math.round(totals.overdue * 100) / 100,
      },
    };
  }

  private getDateKey(date: Date, groupBy: GroupByPeriod): string {
    switch (groupBy) {
      case GroupByPeriod.DAY:
        return date.toISOString().split('T')[0];
      case GroupByPeriod.WEEK:
        // Get Monday of the week
        const monday = new Date(date);
        const day = monday.getDay();
        const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
        monday.setDate(diff);
        return monday.toISOString().split('T')[0];
      case GroupByPeriod.MONTH:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private incrementDate(date: Date, groupBy: GroupByPeriod): void {
    switch (groupBy) {
      case GroupByPeriod.DAY:
        date.setDate(date.getDate() + 1);
        break;
      case GroupByPeriod.WEEK:
        date.setDate(date.getDate() + 7);
        break;
      case GroupByPeriod.MONTH:
        date.setMonth(date.getMonth() + 1);
        break;
    }
  }

  // ==================== TOP CLIENTS ====================

  async getTopClients(
    userId: string,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ): Promise<TopClientsResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Get payments aggregated by client
    const paymentsByClient = await this.prisma.clientPayment.groupBy({
      by: ['clientId'],
      where: {
        userId,
        paidAt: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'] },
      },
      _sum: { value: true },
    });

    // Get work orders count and last service date
    const workOrderStats = await this.prisma.workOrder.groupBy({
      by: ['clientId'],
      where: {
        userId,
        status: 'DONE',
        executionEnd: { gte: start, lte: end },
      },
      _count: { id: true },
      _max: { executionEnd: true },
    });

    // Create a map of client stats
    const clientStatsMap = new Map<
      string,
      { totalPaid: number; ordersCount: number; lastServiceAt: Date | null }
    >();

    for (const p of paymentsByClient) {
      clientStatsMap.set(p.clientId, {
        totalPaid: Number(p._sum.value) || 0,
        ordersCount: 0,
        lastServiceAt: null,
      });
    }

    for (const wo of workOrderStats) {
      const existing = clientStatsMap.get(wo.clientId);
      if (existing) {
        existing.ordersCount = wo._count.id;
        existing.lastServiceAt = wo._max.executionEnd;
      } else {
        clientStatsMap.set(wo.clientId, {
          totalPaid: 0,
          ordersCount: wo._count.id,
          lastServiceAt: wo._max.executionEnd,
        });
      }
    }

    // Sort by totalPaid and take top N
    const sortedClientIds = Array.from(clientStatsMap.entries())
      .sort((a, b) => b[1].totalPaid - a[1].totalPaid)
      .slice(0, limit)
      .map(([id]) => id);

    // Fetch client names
    const clients = await this.prisma.client.findMany({
      where: { id: { in: sortedClientIds } },
      select: { id: true, name: true },
    });

    const clientNameMap = new Map(clients.map((c) => [c.id, c.name]));

    // Build response
    const topClients = sortedClientIds.map((clientId) => {
      const stats = clientStatsMap.get(clientId)!;
      return {
        clientId,
        name: clientNameMap.get(clientId) || 'Unknown',
        totalPaid: Math.round(stats.totalPaid * 100) / 100,
        ordersCount: stats.ordersCount,
        lastServiceAt: stats.lastServiceAt?.toISOString() || null,
      };
    });

    return {
      period,
      clients: topClients,
    };
  }

  // ==================== TOP SERVICES ====================

  async getTopServices(
    userId: string,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
  ): Promise<TopServicesResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);

    // Get work order items from completed WOs in period
    const workOrderItems = await this.prisma.workOrderItem.findMany({
      where: {
        workOrder: {
          userId,
          status: 'DONE',
          executionEnd: { gte: start, lte: end },
        },
      },
      select: {
        name: true,
        type: true,
        totalPrice: true,
      },
    });

    // Aggregate by name and type
    const serviceMap = new Map<
      string,
      { type: string; totalRevenue: number; count: number }
    >();

    for (const item of workOrderItems) {
      const key = `${item.name}|${item.type}`;
      const existing = serviceMap.get(key);

      if (existing) {
        existing.totalRevenue += Number(item.totalPrice);
        existing.count++;
      } else {
        serviceMap.set(key, {
          type: item.type,
          totalRevenue: Number(item.totalPrice),
          count: 1,
        });
      }
    }

    // Sort by totalRevenue and take top N
    const topServices = Array.from(serviceMap.entries())
      .map(([key, data]) => ({
        name: key.split('|')[0],
        type: data.type,
        totalRevenue: Math.round(data.totalRevenue * 100) / 100,
        count: data.count,
        avgTicket: Math.round((data.totalRevenue / data.count) * 100) / 100,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return {
      period,
      services: topServices,
    };
  }

  // ==================== DELINQUENCY ====================

  async getDelinquency(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<DelinquencyResponse> {
    const period = this.getPeriod(startDate, endDate);
    const { start, end } = this.getPeriodDates(period);
    const today = new Date();

    // Get overdue payments
    const overduePayments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        status: 'OVERDUE',
        dueDate: { gte: start, lte: end },
      },
      select: {
        clientId: true,
        value: true,
        dueDate: true,
      },
    });

    // Calculate summary
    let totalOverdue = 0;
    let totalDaysOverdue = 0;

    const clientOverdue = new Map<
      string,
      { total: number; count: number; maxDays: number }
    >();

    for (const payment of overduePayments) {
      const value = Number(payment.value);
      const daysOverdue = Math.floor(
        (today.getTime() - payment.dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      totalOverdue += value;
      totalDaysOverdue += daysOverdue;

      const existing = clientOverdue.get(payment.clientId);
      if (existing) {
        existing.total += value;
        existing.count++;
        existing.maxDays = Math.max(existing.maxDays, daysOverdue);
      } else {
        clientOverdue.set(payment.clientId, {
          total: value,
          count: 1,
          maxDays: daysOverdue,
        });
      }
    }

    const overdueCount = overduePayments.length;
    const avgDaysOverdue =
      overdueCount > 0
        ? Math.round((totalDaysOverdue / overdueCount) * 10) / 10
        : null;

    // Get client names
    const clientIds = Array.from(clientOverdue.keys());
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });

    const clientNameMap = new Map(clients.map((c) => [c.id, c.name]));

    // Build byClient array sorted by total
    const byClient = Array.from(clientOverdue.entries())
      .map(([clientId, data]) => ({
        clientId,
        name: clientNameMap.get(clientId) || 'Unknown',
        overdueTotal: Math.round(data.total * 100) / 100,
        overdueCount: data.count,
        maxDaysOverdue: data.maxDays,
      }))
      .sort((a, b) => b.overdueTotal - a.overdueTotal);

    return {
      period,
      summary: {
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        overdueCount,
        avgDaysOverdue,
      },
      byClient,
    };
  }
}
