/**
 * Reports Service
 *
 * Servico para buscar dados de relatorios e analytics.
 * Combina dados de DashboardService e ExpensesService.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// TYPES
// =============================================================================

export interface AnalyticsOverview {
  revenue: {
    total: number;
    received: number;
    pending: number;
    overdue: number;
  };
  quotes: {
    total: number;
    approved: number;
    conversionRate: number;
  };
  workOrders: {
    total: number;
    completed: number;
    completionRate: number;
  };
  clients: {
    total: number;
    active: number;
  };
}

export interface ExpenseSummary {
  paid: { amount: number; count: number };
  pending: { amount: number; count: number };
  overdue: { amount: number; count: number };
  total: { amount: number; count: number };
}

export interface RevenueByPeriod {
  period: string;
  received: number;
  pending: number;
}

export interface ReportsData {
  analytics: AnalyticsOverview | null;
  expenses: ExpenseSummary | null;
  revenueByPeriod: RevenueByPeriod[];
}

// Finance Report Types
export interface FinanceReportData {
  revenue: {
    total: number;
    received: number;
    pending: number;
    overdue: number;
  };
  revenueByPeriod: { period: string; received: number; pending: number; overdue: number }[];
  chargesByMethod: { method: string; amount: number; count: number }[];
  topClients: { id: string; name: string; revenue: number; chargesCount: number }[];
}

// Sales Report Types
export interface SalesReportData {
  quotes: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
    expired: number;
    totalValue: number;
    conversionRate: number;
    averageTicket: number;
    avgApprovalDays: number;
  };
  quotesByPeriod: { period: string; total: number; approved: number }[];
  topServices: { id: string; name: string; quantity: number; value: number }[];
}

// Operations Report Types
export interface OperationsReportData {
  workOrders: {
    total: number;
    completed: number;
    inProgress: number;
    scheduled: number;
    completionRate: number;
    avgCompletionDays: number;
  };
  workOrdersByPeriod: { period: string; total: number; completed: number }[];
  completionByMonth: { period: string; rate: number }[];
}

// Clients Report Types
export interface ClientsReportData {
  clients: {
    total: number;
    active: number;
    new: number;
    inactive: number;
    avgRevenuePerClient: number;
    retentionRate: number;
  };
  clientsByPeriod: { period: string; total: number; new: number }[];
  clientsByCity: { city: string; count: number }[];
  topClients: { id: string; name: string; quotesCount: number; workOrdersCount: number; revenue: number }[];
}

export type ReportPeriod = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'this_year' | 'custom';

interface CachedReportsData {
  data: ReportsData;
  timestamp: number;
  period: ReportPeriod;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = '@reports_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const STALE_TTL = 24 * 60 * 60 * 1000; // 24 horas

// =============================================================================
// CACHE HELPERS
// =============================================================================

function getCacheKey(period: ReportPeriod, startDate?: string, endDate?: string): string {
  return `${STORAGE_KEY_PREFIX}${period}_${startDate || ''}_${endDate || ''}`;
}

async function getFromStorage(key: string): Promise<CachedReportsData | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const parsed: CachedReportsData = JSON.parse(stored);

    if (Date.now() - parsed.timestamp > STALE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[ReportsService] Error reading from storage:', error);
    return null;
  }
}

async function saveToStorage(key: string, data: ReportsData, period: ReportPeriod): Promise<void> {
  try {
    const cacheData: CachedReportsData = {
      data,
      timestamp: Date.now(),
      period,
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('[ReportsService] Error saving to storage:', error);
  }
}

// Memory cache
const memoryCache: Map<string, CachedReportsData> = new Map();

// =============================================================================
// PERIOD HELPERS
// =============================================================================

function getPeriodDates(period: ReportPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let startDate: Date;
  let endDate: Date = today;

  switch (period) {
    case 'today':
      startDate = today;
      break;
    case 'yesterday':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      endDate = startDate;
      break;
    case 'last_7_days':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case 'last_30_days':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'this_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export const ReportsService = {
  /**
   * Busca dados completos de relatorios
   */
  async getReportsData(
    period: ReportPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string; forceRefresh?: boolean }
  ): Promise<{ data: ReportsData; fromCache: boolean; cacheAge: number | null }> {
    const cacheKey = getCacheKey(period, options?.startDate, options?.endDate);

    // 1. Tenta memoria primeiro
    let cached = memoryCache.get(cacheKey);

    // 2. Se nao tem em memoria, tenta AsyncStorage
    if (!cached) {
      cached = await getFromStorage(cacheKey) || undefined;
      if (cached) {
        memoryCache.set(cacheKey, cached);
      }
    }

    // 3. Se tem cache e nao e forceRefresh e dados sao frescos, retorna cache
    const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);
    if (cached && !options?.forceRefresh && isFresh) {
      return {
        data: cached.data,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp,
      };
    }

    // 4. Tenta buscar da API
    const token = await AuthService.getAccessToken();
    if (!token) {
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
        };
      }
      return {
        data: { analytics: null, expenses: null, revenueByPeriod: [] },
        fromCache: false,
        cacheAge: null
      };
    }

    try {
      const baseUrl = getApiBaseUrl();
      const { startDate, endDate } = options?.startDate && options?.endDate
        ? { startDate: options.startDate, endDate: options.endDate }
        : getPeriodDates(period);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch all data in parallel
      const [analyticsRes, expensesRes, revenueRes] = await Promise.all([
        fetchWithTimeout(
          `${baseUrl}/analytics/overview?startDate=${startDate}&endDate=${endDate}`,
          { method: 'GET', headers, timeout: 15000 }
        ).catch(() => null),
        fetchWithTimeout(
          `${baseUrl}/expenses/summary?startDate=${startDate}&endDate=${endDate}`,
          { method: 'GET', headers, timeout: 15000 }
        ).catch(() => null),
        fetchWithTimeout(
          `${baseUrl}/analytics/revenue?startDate=${startDate}&endDate=${endDate}&groupBy=month`,
          { method: 'GET', headers, timeout: 15000 }
        ).catch(() => null),
      ]);

      const analytics = analyticsRes?.ok ? await analyticsRes.json() : null;
      const expenses = expensesRes?.ok ? await expensesRes.json() : null;
      const revenueByPeriod = revenueRes?.ok ? await revenueRes.json() : [];

      const data: ReportsData = {
        analytics,
        expenses,
        revenueByPeriod: revenueByPeriod || [],
      };

      // Salva em memoria e storage
      const newCacheData: CachedReportsData = {
        data,
        timestamp: Date.now(),
        period,
      };
      memoryCache.set(cacheKey, newCacheData);
      await saveToStorage(cacheKey, data, period);

      return { data, fromCache: false, cacheAge: null };
    } catch (error) {
      console.warn('[ReportsService] Error fetching data:', error);
      if (cached) {
        return {
          data: cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
        };
      }
      return {
        data: { analytics: null, expenses: null, revenueByPeriod: [] },
        fromCache: false,
        cacheAge: null
      };
    }
  },

  /**
   * Limpa todo o cache
   */
  async clearCache(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const reportKeys = keys.filter(k => k.startsWith(STORAGE_KEY_PREFIX));
      if (reportKeys.length > 0) {
        await AsyncStorage.multiRemove(reportKeys);
      }
    } catch (error) {
      console.warn('[ReportsService] Error clearing cache:', error);
    }
  },

  /**
   * Formata idade do cache
   */
  formatCacheAge(ageMs: number | null): string {
    if (ageMs === null) return '';

    const minutes = Math.floor(ageMs / 60000);
    const hours = Math.floor(ageMs / 3600000);

    if (hours > 0) {
      return `${hours}h`;
    }
    if (minutes > 0) {
      return `${minutes}min`;
    }
    return '< 1min';
  },

  /**
   * Busca dados do relatorio financeiro
   */
  async getFinanceReport(
    period: ReportPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string }
  ): Promise<FinanceReportData | null> {
    const token = await AuthService.getAccessToken();
    if (!token) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const { startDate, endDate } = options?.startDate && options?.endDate
        ? { startDate: options.startDate, endDate: options.endDate }
        : getPeriodDates(period);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const res = await fetchWithTimeout(
        `${baseUrl}/reports/finance?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET', headers, timeout: 15000 }
      );

      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('[ReportsService] Error fetching finance report:', error);
      return null;
    }
  },

  /**
   * Busca dados do relatorio de vendas
   */
  async getSalesReport(
    period: ReportPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string }
  ): Promise<SalesReportData | null> {
    const token = await AuthService.getAccessToken();
    if (!token) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const { startDate, endDate } = options?.startDate && options?.endDate
        ? { startDate: options.startDate, endDate: options.endDate }
        : getPeriodDates(period);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const res = await fetchWithTimeout(
        `${baseUrl}/reports/sales?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET', headers, timeout: 15000 }
      );

      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('[ReportsService] Error fetching sales report:', error);
      return null;
    }
  },

  /**
   * Busca dados do relatorio de operacoes
   */
  async getOperationsReport(
    period: ReportPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string }
  ): Promise<OperationsReportData | null> {
    const token = await AuthService.getAccessToken();
    if (!token) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const { startDate, endDate } = options?.startDate && options?.endDate
        ? { startDate: options.startDate, endDate: options.endDate }
        : getPeriodDates(period);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const res = await fetchWithTimeout(
        `${baseUrl}/reports/operations?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET', headers, timeout: 15000 }
      );

      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('[ReportsService] Error fetching operations report:', error);
      return null;
    }
  },

  /**
   * Busca dados do relatorio de clientes
   */
  async getClientsReport(
    period: ReportPeriod = 'last_30_days',
    options?: { startDate?: string; endDate?: string }
  ): Promise<ClientsReportData | null> {
    const token = await AuthService.getAccessToken();
    if (!token) return null;

    try {
      const baseUrl = getApiBaseUrl();
      const { startDate, endDate } = options?.startDate && options?.endDate
        ? { startDate: options.startDate, endDate: options.endDate }
        : getPeriodDates(period);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const res = await fetchWithTimeout(
        `${baseUrl}/reports/clients?startDate=${startDate}&endDate=${endDate}`,
        { method: 'GET', headers, timeout: 15000 }
      );

      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('[ReportsService] Error fetching clients report:', error);
      return null;
    }
  },
};

export default ReportsService;
