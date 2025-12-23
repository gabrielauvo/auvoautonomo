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
