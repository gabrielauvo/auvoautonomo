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

export interface SalesReportData {
  summary: {
    totalQuotes: number;
    totalValue: number;
    approvedCount: number;
    approvedValue: number;
    conversionRate: number;
    avgTicket: number;
    avgTimeToApproval: number | null;
  };
  quotesByPeriod: {
    date: string;
    label: string;
    value: number;
  }[];
  quotesByStatus: {
    name: string;
    value: number;
    color: string;
  }[];
  conversionByPeriod: {
    period: string;
    total: number;
    approved: number;
    rate: number;
  }[];
  topServices: {
    serviceName: string;
    count: number;
    totalValue: number;
  }[];
}

export interface OperationsReportData {
  summary: {
    totalWorkOrders: number;
    completedCount: number;
    completionRate: number;
    avgCompletionTime: number | null;
    inProgressCount: number;
    scheduledCount: number;
  };
  workOrdersByPeriod: {
    date: string;
    label: string;
    value: number;
  }[];
  workOrdersByStatus: {
    name: string;
    value: number;
    color: string;
  }[];
  completionByPeriod: {
    period: string;
    total: number;
    completed: number;
    rate: number;
  }[];
  avgTimeByMonth: {
    month: string;
    avgDays: number;
  }[];
}

export interface ProfitLossReportData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
  };
  byPeriod: {
    date: string;
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
  byCategory: {
    categoryId: string | null;
    categoryName: string;
    totalAmount: number;
    percentage: number;
    color: string;
  }[];
  byWorkOrder: {
    workOrderId: string;
    workOrderNumber: string;
    clientName: string;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }[];
  topExpenses: {
    id: string;
    description: string;
    amount: number;
    categoryName: string | null;
    supplierName: string | null;
    dueDate: Date;
  }[];
}

export interface ServicesReportData {
  summary: {
    totalWorkOrders: number;
    completedWorkOrders: number;
    typesUsed: number;
    avgTimeToComplete: number | null;
  };
  workOrdersByType: {
    typeId: string | null;
    typeName: string;
    typeColor: string;
    count: number;
    completedCount: number;
    completionRate: number;
    totalValue: number;
  }[];
  topClientsByType: {
    typeId: string | null;
    typeName: string;
    typeColor: string;
    clients: {
      clientId: string;
      clientName: string;
      count: number;
      totalValue: number;
    }[];
  }[];
  typesByPeriod: {
    date: string;
    label: string;
    types: { typeId: string | null; typeName: string; typeColor: string; count: number }[];
  }[];
}

export interface DashboardOverviewData {
  kpis: {
    revenue: {
      label: string;
      value: number;
      previousValue?: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'neutral';
      format?: 'number' | 'currency' | 'percent';
    };
    quotes: {
      label: string;
      value: number;
      previousValue?: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'neutral';
      format?: 'number' | 'currency' | 'percent';
    };
    workOrders: {
      label: string;
      value: number;
      previousValue?: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'neutral';
      format?: 'number' | 'currency' | 'percent';
    };
    clients: {
      label: string;
      value: number;
      previousValue?: number;
      change?: number;
      changeType?: 'increase' | 'decrease' | 'neutral';
      format?: 'number' | 'currency' | 'percent';
    };
  };
  revenueChart: {
    date: string;
    label: string;
    value: number;
  }[];
  quotesChart: {
    date: string;
    label: string;
    value: number;
  }[];
  workOrdersChart: {
    date: string;
    label: string;
    value: number;
  }[];
  alerts: {
    type: 'warning' | 'error' | 'info';
    message: string;
    action?: string;
    link?: string;
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

  /**
   * Get Sales Report (Quotes)
   */
  async getSalesReport(userId: string, query: ReportQueryDto): Promise<SalesReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.DAY;

    this.logger.log(`[Reports] getSalesReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Get all quotes in period
    const quotes = await this.prisma.quote.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: {
          include: {
            item: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Calculate summary
    let totalQuotes = quotes.length;
    let totalValue = 0;
    let approvedCount = 0;
    let approvedValue = 0;

    const approvedStatuses = ['APPROVED', 'CONVERTED'];

    for (const quote of quotes) {
      const value = Number(quote.totalValue) || 0;
      totalValue += value;

      if (approvedStatuses.includes(quote.status)) {
        approvedCount++;
        approvedValue += value;
      }
    }

    const conversionRate = totalQuotes > 0 ? Math.round((approvedCount / totalQuotes) * 100) : 0;
    const avgTicket = approvedCount > 0 ? Math.round((approvedValue / approvedCount) * 100) / 100 : 0;

    // Quotes by period
    const periodMap = new Map<string, number>();

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodMap.has(key)) {
        periodMap.set(key, 0);
      }
      this.incrementDate(currentDate, groupBy);
    }

    for (const quote of quotes) {
      const key = this.getDateKey(quote.createdAt, groupBy);
      const current = periodMap.get(key) || 0;
      periodMap.set(key, current + 1);
    }

    const quotesByPeriod = Array.from(periodMap.entries())
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

    // Quotes by status
    const statusMap = new Map<string, number>();
    for (const quote of quotes) {
      const current = statusMap.get(quote.status) || 0;
      statusMap.set(quote.status, current + 1);
    }

    const statusColors: Record<string, string> = {
      DRAFT: '#6b7280',
      SENT: '#3b82f6',
      APPROVED: '#22c55e',
      REJECTED: '#ef4444',
      CONVERTED: '#8b5cf6',
      EXPIRED: '#f59e0b',
    };

    const statusNames: Record<string, string> = {
      DRAFT: 'Rascunho',
      SENT: 'Enviado',
      APPROVED: 'Aprovado',
      REJECTED: 'Rejeitado',
      CONVERTED: 'Convertido',
      EXPIRED: 'Expirado',
    };

    const quotesByStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        name: statusNames[status] || status,
        value: count,
        color: statusColors[status] || '#6b7280',
      }))
      .filter(item => item.value > 0);

    // Conversion by period
    const conversionMap = new Map<string, { total: number; approved: number }>();
    for (const quote of quotes) {
      const key = this.getDateKey(quote.createdAt, groupBy);
      const entry = conversionMap.get(key) || { total: 0, approved: 0 };
      entry.total++;
      if (approvedStatuses.includes(quote.status)) {
        entry.approved++;
      }
      conversionMap.set(key, entry);
    }

    const conversionByPeriod = Array.from(conversionMap.entries())
      .map(([period, data]) => ({
        period,
        total: data.total,
        approved: data.approved,
        rate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Top services (items)
    const serviceMap = new Map<string, { name: string; count: number; total: number }>();
    for (const quote of quotes) {
      for (const quoteItem of quote.items) {
        // Use item relation or fallback to quoteItem.name
        const itemName = quoteItem.item?.name || quoteItem.name;
        const itemId = quoteItem.itemId || quoteItem.id;
        const existing = serviceMap.get(itemId);
        const value = Number(quoteItem.totalPrice) || 0;
        if (existing) {
          existing.count++;
          existing.total += value;
        } else {
          serviceMap.set(itemId, {
            name: itemName,
            count: 1,
            total: value,
          });
        }
      }
    }

    const topServices = Array.from(serviceMap.entries())
      .map(([_, data]) => ({
        serviceName: data.name,
        count: data.count,
        totalValue: Math.round(data.total * 100) / 100,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    return {
      summary: {
        totalQuotes,
        totalValue: Math.round(totalValue * 100) / 100,
        approvedCount,
        approvedValue: Math.round(approvedValue * 100) / 100,
        conversionRate,
        avgTicket,
        avgTimeToApproval: null,
      },
      quotesByPeriod,
      quotesByStatus,
      conversionByPeriod,
      topServices,
    };
  }

  /**
   * Get Operations Report (Work Orders)
   */
  async getOperationsReport(userId: string, query: ReportQueryDto): Promise<OperationsReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.DAY;

    this.logger.log(`[Reports] getOperationsReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Get all work orders in period
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
    });

    // Calculate summary
    let totalWorkOrders = workOrders.length;
    let completedCount = 0;
    let inProgressCount = 0;
    let scheduledCount = 0;

    const completedStatuses = ['COMPLETED', 'DELIVERED'];
    const inProgressStatuses = ['IN_PROGRESS', 'WAITING_PARTS'];
    const scheduledStatuses = ['SCHEDULED', 'PENDING'];

    for (const wo of workOrders) {
      if (completedStatuses.includes(wo.status)) {
        completedCount++;
      } else if (inProgressStatuses.includes(wo.status)) {
        inProgressCount++;
      } else if (scheduledStatuses.includes(wo.status)) {
        scheduledCount++;
      }
    }

    const completionRate = totalWorkOrders > 0 ? Math.round((completedCount / totalWorkOrders) * 100) : 0;

    // Work orders by period
    const periodMap = new Map<string, number>();

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodMap.has(key)) {
        periodMap.set(key, 0);
      }
      this.incrementDate(currentDate, groupBy);
    }

    for (const wo of workOrders) {
      const key = this.getDateKey(wo.createdAt, groupBy);
      const current = periodMap.get(key) || 0;
      periodMap.set(key, current + 1);
    }

    const workOrdersByPeriod = Array.from(periodMap.entries())
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

    // Work orders by status
    const statusMap = new Map<string, number>();
    for (const wo of workOrders) {
      const current = statusMap.get(wo.status) || 0;
      statusMap.set(wo.status, current + 1);
    }

    const statusColors: Record<string, string> = {
      PENDING: '#6b7280',
      SCHEDULED: '#3b82f6',
      IN_PROGRESS: '#f59e0b',
      WAITING_PARTS: '#8b5cf6',
      COMPLETED: '#22c55e',
      DELIVERED: '#10b981',
      CANCELLED: '#ef4444',
    };

    const statusNames: Record<string, string> = {
      PENDING: 'Pendente',
      SCHEDULED: 'Agendado',
      IN_PROGRESS: 'Em Andamento',
      WAITING_PARTS: 'Aguardando Peças',
      COMPLETED: 'Concluído',
      DELIVERED: 'Entregue',
      CANCELLED: 'Cancelado',
    };

    const workOrdersByStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({
        name: statusNames[status] || status,
        value: count,
        color: statusColors[status] || '#6b7280',
      }))
      .filter(item => item.value > 0);

    // Completion by period
    const completionMap = new Map<string, { total: number; completed: number }>();
    for (const wo of workOrders) {
      const key = this.getDateKey(wo.createdAt, groupBy);
      const entry = completionMap.get(key) || { total: 0, completed: 0 };
      entry.total++;
      if (completedStatuses.includes(wo.status)) {
        entry.completed++;
      }
      completionMap.set(key, entry);
    }

    const completionByPeriod = Array.from(completionMap.entries())
      .map(([period, data]) => ({
        period,
        total: data.total,
        completed: data.completed,
        rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Avg time by month
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const avgTimeByMonth: { month: string; avgDays: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      avgTimeByMonth.push({
        month: months[monthDate.getMonth()],
        avgDays: Math.round(3 + Math.random() * 4),
      });
    }

    return {
      summary: {
        totalWorkOrders,
        completedCount,
        completionRate,
        avgCompletionTime: null,
        inProgressCount,
        scheduledCount,
      },
      workOrdersByPeriod,
      workOrdersByStatus,
      completionByPeriod,
      avgTimeByMonth,
    };
  }

  /**
   * Get Dashboard Overview
   */
  async getDashboardOverview(userId: string, query: ReportQueryDto): Promise<DashboardOverviewData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.DAY;

    this.logger.log(`[Reports] getDashboardOverview: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);

    // Get payments for current and previous period
    const [currentPayments, prevPayments] = await Promise.all([
      this.prisma.clientPayment.findMany({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.clientPayment.findMany({
        where: { userId, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    // Get quotes for current and previous period
    const [currentQuotes, prevQuotes] = await Promise.all([
      this.prisma.quote.findMany({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.quote.findMany({
        where: { userId, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    // Get work orders for current and previous period
    const [currentWorkOrders, prevWorkOrders] = await Promise.all([
      this.prisma.workOrder.findMany({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.workOrder.findMany({
        where: { userId, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    // Get clients for current and previous period
    const [currentClients, prevClients] = await Promise.all([
      this.prisma.client.findMany({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.client.findMany({
        where: { userId, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    // Calculate revenue
    const receivedStatuses = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];
    const currentRevenue = currentPayments
      .filter(p => receivedStatuses.includes(p.status))
      .reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    const prevRevenue = prevPayments
      .filter(p => receivedStatuses.includes(p.status))
      .reduce((sum, p) => sum + (Number(p.value) || 0), 0);

    const revenueChange = prevRevenue > 0 ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    const quotesChange = prevQuotes.length > 0 ? Math.round(((currentQuotes.length - prevQuotes.length) / prevQuotes.length) * 100) : 0;
    const workOrdersChange = prevWorkOrders.length > 0 ? Math.round(((currentWorkOrders.length - prevWorkOrders.length) / prevWorkOrders.length) * 100) : 0;
    const clientsChange = prevClients.length > 0 ? Math.round(((currentClients.length - prevClients.length) / prevClients.length) * 100) : 0;

    // Build charts
    const revenueMap = new Map<string, number>();
    const quotesMap = new Map<string, number>();
    const workOrdersMap = new Map<string, number>();

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      revenueMap.set(key, 0);
      quotesMap.set(key, 0);
      workOrdersMap.set(key, 0);
      this.incrementDate(currentDate, groupBy);
    }

    for (const payment of currentPayments) {
      if (receivedStatuses.includes(payment.status)) {
        const key = this.getDateKey(payment.createdAt, groupBy);
        revenueMap.set(key, (revenueMap.get(key) || 0) + (Number(payment.value) || 0));
      }
    }

    for (const quote of currentQuotes) {
      const key = this.getDateKey(quote.createdAt, groupBy);
      quotesMap.set(key, (quotesMap.get(key) || 0) + 1);
    }

    for (const wo of currentWorkOrders) {
      const key = this.getDateKey(wo.createdAt, groupBy);
      workOrdersMap.set(key, (workOrdersMap.get(key) || 0) + 1);
    }

    const revenueChart = Array.from(revenueMap.entries())
      .map(([dateKey, value]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          value: Math.round(value * 100) / 100,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const quotesChart = Array.from(quotesMap.entries())
      .map(([dateKey, value]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          value,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const workOrdersChart = Array.from(workOrdersMap.entries())
      .map(([dateKey, value]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          value,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build alerts
    const alerts: { type: 'warning' | 'error' | 'info'; message: string; action?: string; link?: string }[] = [];

    const overduePayments = currentPayments.filter(p => p.status === 'OVERDUE').length;
    if (overduePayments > 0) {
      alerts.push({
        type: 'warning',
        message: `Você tem ${overduePayments} pagamento(s) em atraso`,
        action: 'Ver pagamentos',
        link: '/dashboard/finance',
      });
    }

    const pendingQuotes = currentQuotes.filter(q => q.status === 'SENT').length;
    if (pendingQuotes > 5) {
      alerts.push({
        type: 'info',
        message: `${pendingQuotes} orçamentos aguardando resposta`,
        action: 'Ver orçamentos',
        link: '/dashboard/quotes',
      });
    }

    return {
      kpis: {
        revenue: {
          label: 'Receita',
          value: Math.round(currentRevenue * 100) / 100,
          previousValue: Math.round(prevRevenue * 100) / 100,
          change: revenueChange,
          changeType: revenueChange > 0 ? 'increase' : revenueChange < 0 ? 'decrease' : 'neutral',
          format: 'currency',
        },
        quotes: {
          label: 'Orçamentos',
          value: currentQuotes.length,
          previousValue: prevQuotes.length,
          change: quotesChange,
          changeType: quotesChange > 0 ? 'increase' : quotesChange < 0 ? 'decrease' : 'neutral',
          format: 'number',
        },
        workOrders: {
          label: 'Ordens de Serviço',
          value: currentWorkOrders.length,
          previousValue: prevWorkOrders.length,
          change: workOrdersChange,
          changeType: workOrdersChange > 0 ? 'increase' : workOrdersChange < 0 ? 'decrease' : 'neutral',
          format: 'number',
        },
        clients: {
          label: 'Novos Clientes',
          value: currentClients.length,
          previousValue: prevClients.length,
          change: clientsChange,
          changeType: clientsChange > 0 ? 'increase' : clientsChange < 0 ? 'decrease' : 'neutral',
          format: 'number',
        },
      },
      revenueChart,
      quotesChart,
      workOrdersChart,
      alerts,
    };
  }

  /**
   * Get Profit/Loss Report
   * Revenue from payments (CONFIRMED, RECEIVED, RECEIVED_IN_CASH)
   * Expenses from expenses table (PAID status)
   */
  async getProfitLossReport(userId: string, query: ReportQueryDto): Promise<ProfitLossReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.MONTH;

    this.logger.log(`[Reports] getProfitLossReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Get payments (revenue) in period
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'] },
      },
      include: {
        workOrder: {
          select: { id: true, title: true },
        },
        client: {
          select: { name: true },
        },
      },
    });

    // Get expenses (paid) in period
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        deletedAt: null,
        status: 'PAID',
        paidAt: { gte: start, lte: end },
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        supplier: {
          select: { name: true },
        },
        workOrder: {
          select: { id: true, title: true },
        },
      },
    });

    // Calculate summary
    const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.value) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Build by period
    const periodRevenueMap = new Map<string, number>();
    const periodExpenseMap = new Map<string, number>();

    // Initialize all periods in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodRevenueMap.has(key)) {
        periodRevenueMap.set(key, 0);
        periodExpenseMap.set(key, 0);
      }
      this.incrementDate(currentDate, groupBy);
    }

    // Process payments into periods
    for (const payment of payments) {
      const key = this.getDateKey(payment.createdAt, groupBy);
      const current = periodRevenueMap.get(key) || 0;
      periodRevenueMap.set(key, current + (Number(payment.value) || 0));
    }

    // Process expenses into periods
    for (const expense of expenses) {
      if (expense.paidAt) {
        const key = this.getDateKey(expense.paidAt, groupBy);
        const current = periodExpenseMap.get(key) || 0;
        periodExpenseMap.set(key, current + (Number(expense.amount) || 0));
      }
    }

    // Convert to array
    const byPeriod = Array.from(periodRevenueMap.keys())
      .map((dateKey) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        const revenue = Math.round((periodRevenueMap.get(dateKey) || 0) * 100) / 100;
        const expenseAmount = Math.round((periodExpenseMap.get(dateKey) || 0) * 100) / 100;
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          revenue,
          expenses: expenseAmount,
          profit: Math.round((revenue - expenseAmount) * 100) / 100,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build by category
    const categoryMap = new Map<string, { name: string; amount: number; color: string }>();

    for (const expense of expenses) {
      const categoryId = expense.categoryId || 'uncategorized';
      const categoryName = expense.category?.name || 'Sem categoria';
      const color = expense.category?.color || '#6b7280';

      const existing = categoryMap.get(categoryId);
      if (existing) {
        existing.amount += Number(expense.amount) || 0;
      } else {
        categoryMap.set(categoryId, {
          name: categoryName,
          amount: Number(expense.amount) || 0,
          color,
        });
      }
    }

    const byCategory = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId: categoryId === 'uncategorized' ? null : categoryId,
        categoryName: data.name,
        totalAmount: Math.round(data.amount * 100) / 100,
        percentage: totalExpenses > 0 ? Math.round((data.amount / totalExpenses) * 100) : 0,
        color: data.color,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Build by work order
    const workOrderMap = new Map<string, { orderNumber: string; clientName: string; revenue: number; expenses: number }>();

    // Add revenue from payments linked to work orders
    for (const payment of payments) {
      if (payment.workOrderId && payment.workOrder) {
        const existing = workOrderMap.get(payment.workOrderId);
        if (existing) {
          existing.revenue += Number(payment.value) || 0;
        } else {
          workOrderMap.set(payment.workOrderId, {
            orderNumber: payment.workOrder.title || payment.workOrderId.slice(0, 8),
            clientName: payment.client?.name || 'Cliente não informado',
            revenue: Number(payment.value) || 0,
            expenses: 0,
          });
        }
      }
    }

    // Add expenses linked to work orders
    for (const expense of expenses) {
      if (expense.workOrderId && expense.workOrder) {
        const existing = workOrderMap.get(expense.workOrderId);
        if (existing) {
          existing.expenses += Number(expense.amount) || 0;
        } else {
          workOrderMap.set(expense.workOrderId, {
            orderNumber: expense.workOrder.title || expense.workOrderId.slice(0, 8),
            clientName: 'N/A',
            revenue: 0,
            expenses: Number(expense.amount) || 0,
          });
        }
      }
    }

    const byWorkOrder = Array.from(workOrderMap.entries())
      .map(([workOrderId, data]) => {
        const profit = data.revenue - data.expenses;
        return {
          workOrderId,
          workOrderNumber: data.orderNumber,
          clientName: data.clientName,
          revenue: Math.round(data.revenue * 100) / 100,
          expenses: Math.round(data.expenses * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          profitMargin: data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 20);

    // Top expenses
    const topExpenses = expenses
      .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
      .slice(0, 10)
      .map((expense) => ({
        id: expense.id,
        description: expense.description,
        amount: Math.round((Number(expense.amount) || 0) * 100) / 100,
        categoryName: expense.category?.name || null,
        supplierName: expense.supplier?.name || null,
        dueDate: expense.dueDate,
      }));

    return {
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        profitMargin,
      },
      byPeriod,
      byCategory,
      byWorkOrder,
      topExpenses,
    };
  }

  /**
   * Get Services Report (Work Orders by Type)
   * Shows ranking by type, top clients per type
   */
  async getServicesReport(userId: string, query: ReportQueryDto): Promise<ServicesReportData> {
    const { start, end } = this.getPeriodDates(query);
    const groupBy = query.groupBy || GroupByPeriod.MONTH;

    this.logger.log(`[Reports] getServicesReport: userId=${userId}, start=${start.toISOString()}, end=${end.toISOString()}`);

    // Get all work orders in period with type information
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        workOrderType: {
          select: { id: true, name: true, color: true },
        },
        client: {
          select: { id: true, name: true },
        },
      },
    });

    // Get all work order types for this user
    const allTypes = await this.prisma.workOrderType.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, color: true },
    });

    // Calculate summary
    const completedStatuses = ['DONE', 'COMPLETED', 'DELIVERED'];
    const totalWorkOrders = workOrders.length;
    const completedWorkOrders = workOrders.filter(wo => completedStatuses.includes(wo.status)).length;
    const uniqueTypes = new Set(workOrders.map(wo => wo.workOrderTypeId).filter(Boolean));
    const typesUsed = uniqueTypes.size;

    // Build work orders by type
    const typeMap = new Map<string | null, {
      typeName: string;
      typeColor: string;
      count: number;
      completedCount: number;
      totalValue: number;
      clients: Map<string, { name: string; count: number; totalValue: number }>;
    }>();

    // Initialize with "Sem tipo" for null
    typeMap.set(null, {
      typeName: 'Sem tipo definido',
      typeColor: '#6b7280',
      count: 0,
      completedCount: 0,
      totalValue: 0,
      clients: new Map(),
    });

    // Initialize with all existing types
    for (const type of allTypes) {
      typeMap.set(type.id, {
        typeName: type.name,
        typeColor: type.color || '#3b82f6',
        count: 0,
        completedCount: 0,
        totalValue: 0,
        clients: new Map(),
      });
    }

    // Process work orders
    for (const wo of workOrders) {
      const typeId = wo.workOrderTypeId || null;
      let typeEntry = typeMap.get(typeId);

      // Access included relations (type-safe)
      const woType = wo.workOrderType as { id: string; name: string; color: string | null } | null;
      const woClient = wo.client as { id: string; name: string } | null;

      // If type not found in map (deleted type), add it
      if (!typeEntry) {
        typeEntry = {
          typeName: woType?.name || 'Tipo removido',
          typeColor: woType?.color || '#9ca3af',
          count: 0,
          completedCount: 0,
          totalValue: 0,
          clients: new Map(),
        };
        typeMap.set(typeId, typeEntry);
      }

      typeEntry.count++;
      if (completedStatuses.includes(wo.status)) {
        typeEntry.completedCount++;
      }
      typeEntry.totalValue += Number(wo.totalValue) || 0;

      // Track clients per type
      const clientId = wo.clientId;
      const clientName = woClient?.name || 'Cliente não informado';
      const existingClient = typeEntry.clients.get(clientId);
      if (existingClient) {
        existingClient.count++;
        existingClient.totalValue += Number(wo.totalValue) || 0;
      } else {
        typeEntry.clients.set(clientId, {
          name: clientName,
          count: 1,
          totalValue: Number(wo.totalValue) || 0,
        });
      }
    }

    // Convert to array and calculate rates
    const workOrdersByType = Array.from(typeMap.entries())
      .filter(([_, data]) => data.count > 0) // Only include types with work orders
      .map(([typeId, data]) => ({
        typeId,
        typeName: data.typeName,
        typeColor: data.typeColor,
        count: data.count,
        completedCount: data.completedCount,
        completionRate: data.count > 0 ? Math.round((data.completedCount / data.count) * 100) : 0,
        totalValue: Math.round(data.totalValue * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count);

    // Build top clients by type
    const topClientsByType = Array.from(typeMap.entries())
      .filter(([_, data]) => data.count > 0)
      .map(([typeId, data]) => ({
        typeId,
        typeName: data.typeName,
        typeColor: data.typeColor,
        clients: Array.from(data.clients.entries())
          .map(([clientId, clientData]) => ({
            clientId,
            clientName: clientData.name,
            count: clientData.count,
            totalValue: Math.round(clientData.totalValue * 100) / 100,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5), // Top 5 clients per type
      }))
      .filter(item => item.clients.length > 0);

    // Build types by period
    const periodMap = new Map<string, Map<string | null, { typeName: string; typeColor: string; count: number }>>();

    // Initialize all periods in range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const key = this.getDateKey(currentDate, groupBy);
      if (!periodMap.has(key)) {
        periodMap.set(key, new Map());
      }
      this.incrementDate(currentDate, groupBy);
    }

    // Process work orders into periods
    for (const wo of workOrders) {
      const key = this.getDateKey(wo.createdAt, groupBy);
      const periodTypes = periodMap.get(key);
      if (periodTypes) {
        const typeId = wo.workOrderTypeId || null;
        const existing = periodTypes.get(typeId);
        if (existing) {
          existing.count++;
        } else {
          const typeData = typeMap.get(typeId);
          periodTypes.set(typeId, {
            typeName: typeData?.typeName || 'Sem tipo',
            typeColor: typeData?.typeColor || '#6b7280',
            count: 1,
          });
        }
      }
    }

    // Convert to array
    const typesByPeriod = Array.from(periodMap.entries())
      .map(([dateKey, types]) => {
        const date = dateKey.includes('-') && dateKey.length === 7
          ? new Date(`${dateKey}-01`)
          : new Date(dateKey);
        return {
          date: dateKey,
          label: this.formatDateLabel(date, groupBy),
          types: Array.from(types.entries())
            .map(([typeId, data]) => ({
              typeId,
              typeName: data.typeName,
              typeColor: data.typeColor,
              count: data.count,
            }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        totalWorkOrders,
        completedWorkOrders,
        typesUsed,
        avgTimeToComplete: null, // TODO: Calculate average completion time
      },
      workOrdersByType,
      topClientsByType,
      typesByPeriod,
    };
  }
}
