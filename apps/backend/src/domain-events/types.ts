/**
 * Domain Event Types
 *
 * Define all event types and payloads for the push notification system.
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

// =============================================================================
// EVENT PAYLOADS
// =============================================================================

export interface BaseEventPayload {
  eventType: DomainEventType;
  entity: EntityType;
  entityId: string;
  action: ActionType;
  scopeHint?: 'single' | 'list' | 'full';
  timestamp: string;
}

export interface WorkOrderEventPayload extends BaseEventPayload {
  entity: 'work_order';
  title?: string;
  status?: string;
  clientName?: string;
  scheduledDate?: string;
}

export interface QuoteEventPayload extends BaseEventPayload {
  entity: 'quote';
  status?: string;
  clientName?: string;
  totalValue?: number;
}

export interface InvoiceEventPayload extends BaseEventPayload {
  entity: 'invoice';
  status?: string;
  clientName?: string;
  totalValue?: number;
  dueDate?: string;
}

export interface ClientEventPayload extends BaseEventPayload {
  entity: 'client';
  name?: string;
}

export interface PaymentEventPayload extends BaseEventPayload {
  entity: 'payment';
  value?: number;
  clientName?: string;
  status?: string;
}

export type EventPayload =
  | WorkOrderEventPayload
  | QuoteEventPayload
  | InvoiceEventPayload
  | ClientEventPayload
  | PaymentEventPayload;

// =============================================================================
// PUSH NOTIFICATION
// =============================================================================

export interface PushNotificationData {
  title: string;
  body: string;
  data: EventPayload;
}

// =============================================================================
// EXPO PUSH API
// =============================================================================

export interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
  expiration?: number;
  mutableContent?: boolean;
  categoryId?: string;
}

export interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials' | 'ExpoError';
  };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials' | 'ExpoError';
  };
}
