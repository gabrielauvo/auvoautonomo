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
    const response = await api.get<AnalyticsOverview>(url);
    return response.data;
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

    const url = `/analytics/revenue/by-period${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<RevenueByPeriod[]>(url);
    return response.data;
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
