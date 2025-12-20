/**
 * Reports Types - Tipos para relatórios e analytics
 */

/**
 * Período de filtro para relatórios
 */
export type ReportPeriod = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

/**
 * Agrupamento de dados
 */
export type GroupBy = 'day' | 'week' | 'month' | 'year';

/**
 * Parâmetros base para filtros de relatórios
 */
export interface ReportFilters {
  period: ReportPeriod;
  startDate?: string;
  endDate?: string;
  groupBy?: GroupBy;
}

/**
 * KPI Card data
 */
export interface KpiData {
  label: string;
  value: number | string;
  previousValue?: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'currency' | 'percent';
  icon?: string;
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  date: string;
  label: string;
  value: number;
  [key: string]: string | number;
}

/**
 * Bar chart data point
 */
export interface BarChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

/**
 * Pie chart data point
 */
export interface PieChartDataPoint {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

/**
 * Finance Report Data
 */
export interface FinanceReportData {
  summary: {
    totalRevenue: number;
    totalReceived: number;
    totalPending: number;
    totalOverdue: number;
    receivedRate: number;
    overdueRate: number;
  };
  revenueByPeriod: TimeSeriesDataPoint[];
  revenueByStatus: PieChartDataPoint[];
  topClients: {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    chargesCount: number;
  }[];
  chargesByPaymentMethod: BarChartDataPoint[];
}

/**
 * Sales Report Data
 */
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
  quotesByPeriod: TimeSeriesDataPoint[];
  quotesByStatus: PieChartDataPoint[];
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

/**
 * Operations Report Data
 */
export interface OperationsReportData {
  summary: {
    totalWorkOrders: number;
    completedCount: number;
    completionRate: number;
    avgCompletionTime: number | null;
    inProgressCount: number;
    scheduledCount: number;
  };
  workOrdersByPeriod: TimeSeriesDataPoint[];
  workOrdersByStatus: PieChartDataPoint[];
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

/**
 * Clients Report Data
 */
export interface ClientsReportData {
  summary: {
    totalClients: number;
    activeClients: number;
    newClients: number;
    inactiveClients: number;
    withOverdue: number;
    avgRevenuePerClient: number;
  };
  clientsByPeriod: TimeSeriesDataPoint[];
  clientsByStatus: PieChartDataPoint[];
  topClientsByRevenue: {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    quotesCount: number;
    workOrdersCount: number;
  }[];
  clientsByCity: BarChartDataPoint[];
  retentionRate: {
    month: string;
    rate: number;
  }[];
}

/**
 * Dashboard Overview Data (enhanced)
 */
export interface DashboardOverviewData {
  kpis: {
    revenue: KpiData;
    quotes: KpiData;
    workOrders: KpiData;
    clients: KpiData;
  };
  revenueChart: TimeSeriesDataPoint[];
  quotesChart: TimeSeriesDataPoint[];
  workOrdersChart: TimeSeriesDataPoint[];
  alerts: {
    type: 'warning' | 'error' | 'info';
    message: string;
    action?: string;
    link?: string;
  }[];
}

export default {};
