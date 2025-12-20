// ==================== PERIOD ====================

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
}

// ==================== OVERVIEW ====================

export interface OverviewQuotes {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  rejected: number;
  expired: number;
  conversionRate: number; // approved / sent
}

export interface OverviewWorkOrders {
  created: number;
  completed: number;
  canceled: number;
  inProgress: number;
  scheduled: number;
  avgCompletionTimeHours: number | null;
}

export interface OverviewRevenue {
  invoiced: number;
  received: number;
  overdue: number;
  canceled: number;
  invoicedCount: number;
  paidCount: number;
  overdueCount: number;
  averageTicketPaid: number | null;
}

export interface OverviewClients {
  active: number;
  new: number;
  delinquent: number;
  total: number;
}

export interface OverviewResponse {
  period: AnalyticsPeriod;
  quotes: OverviewQuotes;
  workOrders: OverviewWorkOrders;
  revenue: OverviewRevenue;
  clients: OverviewClients;
}

// ==================== QUOTES FUNNEL ====================

export interface FunnelStep {
  stage: string;
  count: number;
}

export interface FunnelConversionRates {
  sentOverCreated: number;
  approvedOverSent: number;
  convertedOverApproved: number;
}

export interface QuotesFunnelResponse {
  period: AnalyticsPeriod;
  steps: FunnelStep[];
  conversionRates: FunnelConversionRates;
}

// ==================== WORK ORDERS ====================

export interface WorkOrdersByStatus {
  SCHEDULED: number;
  IN_PROGRESS: number;
  DONE: number;
  CANCELED: number;
}

export interface CompletionTimeBucket {
  bucket: string;
  count: number;
}

export interface WorkOrdersAnalyticsResponse {
  period: AnalyticsPeriod;
  total: number;
  byStatus: WorkOrdersByStatus;
  avgCompletionTimeHours: number | null;
  completionTimeDistribution: CompletionTimeBucket[];
  checklistCompletionRate: number | null;
}

// ==================== REVENUE BY PERIOD ====================

export interface RevenueSeriesItem {
  date: string;
  invoiced: number;
  received: number;
  overdue: number;
}

export interface RevenueByPeriodResponse {
  period: AnalyticsPeriod;
  groupBy: string;
  series: RevenueSeriesItem[];
  totals: {
    invoiced: number;
    received: number;
    overdue: number;
  };
}

// ==================== TOP CLIENTS ====================

export interface TopClient {
  clientId: string;
  name: string;
  totalPaid: number;
  ordersCount: number;
  lastServiceAt: string | null;
}

export interface TopClientsResponse {
  period: AnalyticsPeriod;
  clients: TopClient[];
}

// ==================== TOP SERVICES ====================

export interface TopService {
  name: string;
  type: string;
  totalRevenue: number;
  count: number;
  avgTicket: number;
}

export interface TopServicesResponse {
  period: AnalyticsPeriod;
  services: TopService[];
}

// ==================== DELINQUENCY ====================

export interface DelinquencySummary {
  totalOverdue: number;
  overdueCount: number;
  avgDaysOverdue: number | null;
}

export interface DelinquentClient {
  clientId: string;
  name: string;
  overdueTotal: number;
  overdueCount: number;
  maxDaysOverdue: number;
}

export interface DelinquencyResponse {
  period: AnalyticsPeriod;
  summary: DelinquencySummary;
  byClient: DelinquentClient[];
}
