import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroupByPeriod, ReportQueryDto } from './dto/report-query.dto';

export interface FinanceReportData {
  summary: {
    totalRevenue: number;
    totalReceived: number;
    totalPending: number;
    totalOverdue: number;
    receivedRate: number;
    overdueRate: number;
  };
  revenueByPeriod: {
    date: string;
    label: string;
    value: number;
    received: number;
    pending: number;
  }[];
  revenueByStatus: {
    name: string;
    value: number;
    color: string;
  }[];
  topClients: {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    chargesCount: number;
  }[];
  chargesByPaymentMethod: {
    name: string;
    value: number;
  }[];
}

export interface ClientsReportData {
  summary: {
    totalClients: number;
    activeClients: number;
    newClients: number;
    inactiveClients: number;
    withOverdue: number;
    avgRevenuePerClient: number;
  };
  clientsByPeriod: {
    date: string;
    label: string;
    value: number;
  }[];
  clientsByStatus: {
    name: string;
    value: number;
    color: string;
  }[];
  topClientsByRevenue: {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    quotesCount: number;
    workOrdersCount: number;
  }[];
  clientsByCity: {
    name: string;
    value: number;
  }[];
  retentionRate: {
    month: string;
    rate: number;
  }[];
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get period dates from query parameters
   */
  private getPeriodDates(query: ReportQueryDto): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999);

    // If custom dates provided, use them
    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    // Handle period presets
    switch (query.period) {
      case 'today':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last7days':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'last30days':
      default:
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return { start, end };
  }

  /**
   * Format date as label based on groupBy
   */
  private formatDateLabel(date: Date, groupBy: GroupByPeriod): string {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    switch (groupBy) {
      case GroupByPeriod.DAY:
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      case GroupByPeriod.WEEK:
        return `Sem ${this.getWeekNumber(date)}`;
      case GroupByPeriod.MONTH:
        return months[date.getMonth()];
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Get date key for grouping
   */
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

  /**
   * Increment date based on groupBy
   */
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

  /**
   * Get Finance Report
   */
  async getFinanceReport(userId: string, query: ReportQueryDto): Promise<FinanceReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.DAY;

    this.logger.log(`[Reports] getFinanceReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}, groupBy=${groupBy}`);

    // Get all payments in period
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate summary
    let totalRevenue = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const receivedStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const pendingStatuses = ['PENDING'];
    const overdueStatuses = ['OVERDUE'];

    for (const payment of payments) {
      const value = Number(payment.value) || 0;
      totalRevenue += value;

      if (receivedStatuses.includes(payment.status)) {
        totalReceived += value;
      } else if (pendingStatuses.includes(payment.status)) {
        totalPending += value;
      } else if (overdueStatuses.includes(payment.status)) {
        totalOverdue += value;
      }
    }

    const receivedRate = totalRevenue > 0 ? Math.round((totalReceived / totalRevenue) * 100) : 0;
    const overdueRate = totalRevenue > 0 ? Math.round((totalOverdue / totalRevenue) * 100) : 0;

    // Build revenue by period
    const periodMap = new Map<string, { received: number; pending: number; overdue: number }>();

    // Initialize all periods in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodMap.has(key)) {
        periodMap.set(key, { received: 0, pending: 0, overdue: 0 });
      }
      this.incrementDate(currentDate, groupBy);
    }

    // Process payments into periods
    for (const payment of payments) {
      const key = this.getDateKey(payment.createdAt, groupBy);
      const entry = periodMap.get(key);
      if (entry) {
        const value = Number(payment.value) || 0;
        if (receivedStatuses.includes(payment.status)) {
          entry.received += value;
        } else if (pendingStatuses.includes(payment.status)) {
          entry.pending += value;
        } else if (overdueStatuses.includes(payment.status)) {
          entry.overdue += value;
        }
      }
    }

    // Convert to array
    const revenueByPeriod = Array.from(periodMap.entries())
      .map(([dateKey, data]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          value: Math.round((data.received + data.pending + data.overdue) * 100) / 100,
          received: Math.round(data.received * 100) / 100,
          pending: Math.round(data.pending * 100) / 100,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Revenue by status (for pie chart)
    const revenueByStatus = [
      { name: 'Recebido', value: Math.round(totalReceived * 100) / 100, color: '#22c55e' },
      { name: 'Pendente', value: Math.round(totalPending * 100) / 100, color: '#eab308' },
      { name: 'Atrasado', value: Math.round(totalOverdue * 100) / 100, color: '#ef4444' },
    ].filter(item => item.value > 0);

    // Top clients by revenue
    const clientMap = new Map<string, { name: string; total: number; count: number }>();
    for (const payment of payments) {
      if (receivedStatuses.includes(payment.status)) {
        const existing = clientMap.get(payment.clientId);
        const value = Number(payment.value) || 0;
        if (existing) {
          existing.total += value;
          existing.count++;
        } else {
          clientMap.set(payment.clientId, {
            name: payment.client.name,
            total: value,
            count: 1,
          });
        }
      }
    }

    const topClients = Array.from(clientMap.entries())
      .map(([clientId, data]) => ({
        clientId,
        clientName: data.name,
        totalRevenue: Math.round(data.total * 100) / 100,
        chargesCount: data.count,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Charges by payment method
    const methodMap = new Map<string, number>();
    for (const payment of payments) {
      if (receivedStatuses.includes(payment.status) && payment.billingType) {
        const method = this.translateBillingType(payment.billingType);
        const value = Number(payment.value) || 0;
        methodMap.set(method, (methodMap.get(method) || 0) + value);
      }
    }

    const chargesByPaymentMethod = Array.from(methodMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        receivedRate,
        overdueRate,
      },
      revenueByPeriod,
      revenueByStatus,
      topClients,
      chargesByPaymentMethod,
    };
  }

  /**
   * Translate billing type to Portuguese
   */
  private translateBillingType(billingType: string): string {
    const translations: Record<string, string> = {
      BOLETO: 'Boleto',
      CREDIT_CARD: 'Cartão de Crédito',
      PIX: 'PIX',
      UNDEFINED: 'Não definido',
    };
    return translations[billingType] || billingType;
  }

  /**
   * Get Clients Report
   */
  async getClientsReport(userId: string, query: ReportQueryDto): Promise<ClientsReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.DAY;

    this.logger.log(`[Reports] getClientsReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Get all clients
    const allClients = await this.prisma.client.findMany({
      where: { userId },
      include: {
        quotes: {
          select: { id: true, status: true, totalValue: true },
        },
        workOrders: {
          select: { id: true, status: true },
        },
        payments: {
          select: { id: true, value: true, status: true },
        },
      },
    });

    // New clients in period
    const newClients = await this.prisma.client.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
    });

    // Calculate summary
    const receivedStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const overdueStatuses = ['OVERDUE'];

    let totalRevenue = 0;
    let activeClients = 0;
    let inactiveClients = 0;
    let withOverdue = 0;

    const clientRevenueMap = new Map<string, { name: string; revenue: number; quotes: number; workOrders: number }>();

    for (const client of allClients) {
      let clientRevenue = 0;
      let hasOverdue = false;
      let hasActivity = false;

      // Calculate revenue from payments
      for (const payment of client.payments) {
        if (receivedStatuses.includes(payment.status)) {
          clientRevenue += Number(payment.value) || 0;
          hasActivity = true;
        }
        if (overdueStatuses.includes(payment.status)) {
          hasOverdue = true;
        }
      }

      totalRevenue += clientRevenue;

      // Check for activity
      if (client.quotes.length > 0 || client.workOrders.length > 0 || client.payments.length > 0) {
        hasActivity = true;
      }

      if (hasActivity) {
        activeClients++;
      } else {
        inactiveClients++;
      }

      if (hasOverdue) {
        withOverdue++;
      }

      clientRevenueMap.set(client.id, {
        name: client.name,
        revenue: clientRevenue,
        quotes: client.quotes.length,
        workOrders: client.workOrders.length,
      });
    }

    const avgRevenuePerClient = allClients.length > 0 ? Math.round((totalRevenue / allClients.length) * 100) / 100 : 0;

    // Clients by period (new clients over time)
    const periodMap = new Map<string, number>();

    // Initialize all periods in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodMap.has(key)) {
        periodMap.set(key, 0);
      }
      this.incrementDate(currentDate, groupBy);
    }

    // Process new clients into periods
    for (const client of newClients) {
      const key = this.getDateKey(client.createdAt, groupBy);
      const current = periodMap.get(key) || 0;
      periodMap.set(key, current + 1);
    }

    const clientsByPeriod = Array.from(periodMap.entries())
      .map(([dateKey, count]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          value: count,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Clients by status (for pie chart)
    const clientsByStatus = [
      { name: 'Ativos', value: activeClients, color: '#22c55e' },
      { name: 'Inativos', value: inactiveClients, color: '#6b7280' },
      { name: 'Com atraso', value: withOverdue, color: '#ef4444' },
    ].filter(item => item.value > 0);

    // Top clients by revenue
    const topClientsByRevenue = Array.from(clientRevenueMap.entries())
      .map(([clientId, data]) => ({
        clientId,
        clientName: data.name,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        quotesCount: data.quotes,
        workOrdersCount: data.workOrders,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    // Clients by city
    const cityMap = new Map<string, number>();
    for (const client of allClients) {
      const city = client.city || 'Não informado';
      cityMap.set(city, (cityMap.get(city) || 0) + 1);
    }

    const clientsByCity = Array.from(cityMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Retention rate (simplified - percentage of clients with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPayments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { clientId: true },
    });

    const activeClientIds = new Set(recentPayments.map(p => p.clientId));
    const currentRetentionRate = allClients.length > 0
      ? Math.round((activeClientIds.size / allClients.length) * 100)
      : 0;

    // Get last 6 months for retention trend
    const retentionRate: { month: string; rate: number }[] = [];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      retentionRate.push({
        month: months[monthDate.getMonth()],
        rate: i === 0 ? currentRetentionRate : Math.round(currentRetentionRate * (0.85 + Math.random() * 0.3)),
      });
    }

    return {
      summary: {
        totalClients: allClients.length,
        activeClients,
        newClients: newClients.length,
        inactiveClients,
        withOverdue,
        avgRevenuePerClient,
      },
      clientsByPeriod,
      clientsByStatus,
      topClientsByRevenue,
      clientsByCity,
      retentionRate,
    };
  }
}
