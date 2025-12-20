/**
 * Push Notification Types
 *
 * Types for push notification payloads and handling.
 */

// =============================================================================
// EVENT TYPES
// =============================================================================

export type DomainEventType =
  // Work Order events
  | 'work_order.created'
  | 'work_order.updated'
  | 'work_order.assigned'
  | 'work_order.status_changed'
  | 'work_order.completed'
  | 'work_order.cancelled'
  // Quote events
  | 'quote.created'
  | 'quote.updated'
  | 'quote.sent'
  | 'quote.approved'
  | 'quote.rejected'
  | 'quote.expired'
  // Invoice events
  | 'invoice.created'
  | 'invoice.updated'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'invoice.cancelled'
  // Client events
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  // Payment events
  | 'payment.created'
  | 'payment.confirmed'
  | 'payment.overdue'
  // General sync
  | 'sync.full_required';

export type EntityType =
  | 'work_order'
  | 'quote'
  | 'invoice'
  | 'client'
  | 'payment';

export type ActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change';

export type ScopeHint = 'single' | 'list' | 'full';

// =============================================================================
// NOTIFICATION PAYLOAD
// =============================================================================

export interface PushNotificationPayload {
  eventType: DomainEventType;
  entity: EntityType;
  entityId: string;
  action: ActionType;
  scopeHint?: ScopeHint;
  timestamp: string;
  // Optional extra data
  title?: string;
  status?: string;
  clientName?: string;
  totalValue?: number;
  scheduledDate?: string;
  dueDate?: string;
  name?: string;
  value?: number;
}

// =============================================================================
// DEVICE REGISTRATION
// =============================================================================

export interface DeviceRegistrationRequest {
  expoPushToken: string;
  platform: 'IOS' | 'ANDROID';
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
}

export interface DeviceRegistrationResponse {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: 'IOS' | 'ANDROID';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// NOTIFICATION HANDLER
// =============================================================================

export type NotificationHandler = (payload: PushNotificationPayload) => void | Promise<void>;

export interface NotificationHandlerOptions {
  /**
   * Handle notification when app is in foreground
   */
  onForeground?: NotificationHandler;

  /**
   * Handle notification when user taps on it
   */
  onTap?: NotificationHandler;

  /**
   * Handle notification in background
   */
  onBackground?: NotificationHandler;
}
