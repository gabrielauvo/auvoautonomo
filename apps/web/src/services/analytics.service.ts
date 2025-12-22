/**
 * Analytics Service - Serviço de Analytics e Dashboard
 *
 * Consome endpoints do backend de analytics para:
 * - Overview geral
 * - Métricas de orçamentos
 * - Métricas de OS
 * - Métricas financeiras
 */

import api, { getErrorMessage } from './api';

/**
 * Tipos de dados de analytics
 */
export interface AnalyticsOverview {
  quotes: {
    total: number;
    totalValue: number;
    conversionRate: number;
    byStatus: Record<string, number>;
    avgTimeToApproval: number | null;
  };
  workOrders: {
    total: number;
    completed: number;
    completionRate: number;
    byStatus: Record<string, number>;
    avgCompletionTime: number | null;
  };
  revenue: {
    total: number;
    received: number;
    pending: number;
    overdue: number;
    receivedRate: number;
    overdueRate: number;
    averageTicket: number | null;
    paidCount: number;
  };
  clients: {
    total: number;
    active: number;
    withOverdue: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface RevenueSeriesItem {
  date: string;
  invoiced: number;
  received: number;
  overdue: number;
}

export interface RevenueByPeriodResponse {
  period: { startDate: string; endDate: string };
  groupBy: string;
  series: RevenueSeriesItem[];
  totals: {
    invoiced: number;
    received: number;
    overdue: number;
  };
}

// Legacy interface for backwards compatibility
export interface RevenueByPeriod {
  period: string;
  received: number;
  pending: number;
  overdue: number;
  total: number;
}

export interface QuoteConversion {
  month: string;
  total: number;
  approved: number;
  rejected: number;
  conversionRate: number;
}

// Backend response interface (actual API response)
interface BackendOverviewResponse {
  period: { startDate: string; endDate: string };
  quotes: {
    total: number;
    draft: number;
    sent: number;
    approved: number;
    rejected: number;
    expired: number;
    conversionRate: number;
  };
  workOrders: {
    created: number;
    completed: number;
    canceled: number;
    inProgress: number;
    scheduled: number;
    avgCompletionTimeHours: number | null;
  };
  revenue: {
    invoiced: number;
    received: number;
    overdue: number;
    canceled: number;
    invoicedCount: number;
    paidCount: number;
    overdueCount: number;
    averageTicketPaid: number | null;
  };
  clients: {
    total: number;
    active: number;
    new: number;
    delinquent: number;
  };
}

/**
 * Obtém overview geral do analytics
 */
export async function getOverview(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<AnalyticsOverview> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = `/analytics/overview${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<BackendOverviewResponse>(url);
    const data = response.data;

    // Transform backend response to frontend format
    const pending = data.revenue.invoiced - data.revenue.received - data.revenue.overdue;
    const receivedRate = data.revenue.invoiced > 0
      ? Math.round((data.revenue.received / data.revenue.invoiced) * 100)
      : 0;
    const overdueRate = data.revenue.invoiced > 0
      ? Math.round((data.revenue.overdue / data.revenue.invoiced) * 100)
      : 0;

    const total = data.workOrders.created;
    const completed = data.workOrders.completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Build byStatus for quotes
    const quotesByStatus: Record<string, number> = {};
    if (data.quotes.draft > 0) quotesByStatus['DRAFT'] = data.quotes.draft;
    if (data.quotes.sent > 0) quotesByStatus['SENT'] = data.quotes.sent;
    if (data.quotes.approved > 0) quotesByStatus['APPROVED'] = data.quotes.approved;
    if (data.quotes.rejected > 0) quotesByStatus['REJECTED'] = data.quotes.rejected;
    if (data.quotes.expired > 0) quotesByStatus['EXPIRED'] = data.quotes.expired;

    // Build byStatus for work orders
    const workOrdersByStatus: Record<string, number> = {};
    if (data.workOrders.scheduled > 0) workOrdersByStatus['SCHEDULED'] = data.workOrders.scheduled;
    if (data.workOrders.inProgress > 0) workOrdersByStatus['IN_PROGRESS'] = data.workOrders.inProgress;
    if (data.workOrders.completed > 0) workOrdersByStatus['DONE'] = data.workOrders.completed;
    if (data.workOrders.canceled > 0) workOrdersByStatus['CANCELED'] = data.workOrders.canceled;

    return {
      quotes: {
        total: data.quotes.total,
        totalValue: 0, // Not provided by backend
        conversionRate: Math.round(data.quotes.conversionRate * 100), // Backend returns 0-1, convert to 0-100
        byStatus: quotesByStatus,
        avgTimeToApproval: null, // Not provided by backend
      },
      workOrders: {
        total,
        completed,
        completionRate,
        byStatus: workOrdersByStatus,
        avgCompletionTime: data.workOrders.avgCompletionTimeHours,
      },
      revenue: {
        total: data.revenue.invoiced,
        received: data.revenue.received,
        pending: pending > 0 ? pending : 0,
        overdue: data.revenue.overdue,
        receivedRate,
        overdueRate,
        averageTicket: data.revenue.averageTicketPaid,
        paidCount: data.revenue.paidCount,
      },
      clients: {
        total: data.clients.total,
        active: data.clients.active,
        withOverdue: data.clients.delinquent,
      },
      period: data.period,
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obtém receita por período
 */
export async function getRevenueByPeriod(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}): Promise<RevenueByPeriod[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.groupBy) queryParams.append('groupBy', params.groupBy);

    const url = `/analytics/revenue-by-period${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<RevenueByPeriodResponse>(url);

    // Transform backend response to frontend format
    // Backend returns: { period, groupBy, series, totals }
    // Frontend expects: RevenueByPeriod[] with { period, received, pending, overdue, total }
    const data = response.data;
    if (data && data.series && Array.isArray(data.series)) {
      return data.series.map((item) => {
        // Pending = invoiced - received - overdue (mas nunca negativo)
        const pending = Math.max(0, item.invoiced - item.received - item.overdue);
        return {
          period: item.date,
          received: item.received,
          pending,
          overdue: item.overdue,
          total: item.invoiced,
        };
      });
    }

    return [];
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Obtém métricas de conversão de orçamentos
 */
export async function getQuoteConversion(params?: {
  months?: number;
}): Promise<QuoteConversion[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.months) queryParams.append('months', params.months.toString());

    const url = `/analytics/quotes/conversion${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<QuoteConversion[]>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const analyticsService = {
  getOverview,
  getRevenueByPeriod,
  getQuoteConversion,
};

export default analyticsService;
