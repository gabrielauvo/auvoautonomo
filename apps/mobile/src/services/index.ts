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

// Notifications
export {
  NotificationService,
  SyncTriggers,
  DeepLinkHandler,
  useNotifications,
} from './notifications';
