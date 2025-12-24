/**
 * Services Module
 *
 * Exportação centralizada dos serviços.
 */

export { AuthService } from './AuthService';
export type { User, AuthTokens, LoginResponse } from './AuthService';

export { AuthProvider, useAuth } from './AuthProvider';

export { BillingService } from './BillingService';
export type { QuotaInfo, PlanInfo, SubscriptionInfo, LimitedResource } from './BillingService';

export { ShareService } from './ShareService';
export type { ShareEntityType, ShareLinkResponse } from './ShareService';

export { DashboardService } from './DashboardService';
export type { DashboardOverview, DashboardPeriod } from './DashboardService';

export { ExpensesService } from './ExpensesService';
export type { ExpenseSummary } from './ExpensesService';

// Notifications
export {
  NotificationService,
  SyncTriggers,
  DeepLinkHandler,
  useNotifications,
} from './notifications';

// Device Contacts
export { DeviceContactsService } from './DeviceContactsService';
export type { CreateContactInput, ContactCreationResult } from './DeviceContactsService';
export { normalizePhone, areNamesSimilar } from './DeviceContactsService';

// Referral
export { ReferralService } from './ReferralService';

// Growth (Google Business)
export { GrowthService } from './GrowthService';
export type {
  GoogleIntegrationStatus,
  GoogleIntegrationStatusResponse,
  KpiCard,
  DashboardSummary,
  TimeSeriesPoint,
  TimeSeries,
  ChannelBreakdown,
  ConversionFunnelStage,
  ConversionFunnel,
  DashboardData,
  DashboardPeriod as GrowthDashboardPeriod,
  DashboardQueryParams,
  GrowthInsightType,
  GrowthInsightSeverity,
  GrowthInsight,
} from './GrowthService';
