import {
  NotificationChannel,
  NotificationType,
  NotificationStatus,
} from '@prisma/client';

/**
 * Notification Types and Interfaces
 */

// Context data for each notification type
export interface QuoteSentContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteId: string;
  quoteNumber: string;
  totalValue: number;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
}

export interface QuoteApprovedContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteId: string;
  quoteNumber: string;
  totalValue: number;
}

export interface WorkOrderCreatedContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  scheduledDate?: string;
  scheduledTime?: string;
  address?: string;
}

export interface WorkOrderCompletedContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  completedAt: string;
}

export interface PaymentCreatedContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  billingType: string;
  dueDate: string;
  paymentLink?: string;
  pixCode?: string;
  workOrderNumber?: string;
  quoteNumber?: string;
}

export interface PaymentConfirmedContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  paidAt: string;
  workOrderNumber?: string;
}

export interface PaymentOverdueContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  dueDate: string;
  daysOverdue: number;
  paymentLink?: string;
  workOrderNumber?: string;
}

export interface PaymentReminderBeforeDueContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  dueDate: string;
  daysUntilDue: number;
  paymentLink?: string;
  pixCode?: string;
  workOrderNumber?: string;
  quoteNumber?: string;
}

export interface PaymentReminderAfterDueContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  dueDate: string;
  daysOverdue: number;
  paymentLink?: string;
  pixCode?: string;
  workOrderNumber?: string;
  quoteNumber?: string;
}

export interface QuoteFollowUpContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteId: string;
  quoteNumber: string;
  totalValue: number;
  daysSinceSent: number;
}

// Union type for all context types
export type NotificationContextData =
  | QuoteSentContext
  | QuoteApprovedContext
  | QuoteFollowUpContext
  | WorkOrderCreatedContext
  | WorkOrderCompletedContext
  | PaymentCreatedContext
  | PaymentConfirmedContext
  | PaymentOverdueContext
  | PaymentReminderBeforeDueContext
  | PaymentReminderAfterDueContext;

// Notification message structure
export interface NotificationMessage {
  to: string; // email or phone number
  subject?: string; // for email
  body: string;
  htmlBody?: string; // for email
}

// Result from channel send
export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Send notification request
export interface SendNotificationRequest {
  userId: string;
  clientId?: string;
  workOrderId?: string;
  quoteId?: string;
  clientPaymentId?: string;
  type: NotificationType;
  contextData: NotificationContextData;
}

// Channel interface
export interface INotificationChannel {
  channel: NotificationChannel;
  send(message: NotificationMessage): Promise<NotificationResult>;
}

// Template renderer result
export interface RenderedTemplate {
  subject?: string;
  body: string;
  htmlBody?: string;
}

// Preference flags mapping
// Note: New automation types (QUOTE_FOLLOW_UP, PAYMENT_REMINDER_*) are controlled
// by FinancialAutomationSettings, not NotificationPreference
export const NOTIFICATION_TYPE_PREFERENCE_MAP: Record<NotificationType, string> = {
  QUOTE_SENT: 'notifyOnQuoteSent',
  QUOTE_APPROVED: 'notifyOnQuoteApproved',
  QUOTE_FOLLOW_UP: 'notifyOnQuoteSent', // Uses same preference as quote sent
  WORK_ORDER_CREATED: 'notifyOnWorkOrderCreated',
  WORK_ORDER_COMPLETED: 'notifyOnWorkOrderCompleted',
  PAYMENT_CREATED: 'notifyOnPaymentCreated',
  PAYMENT_CONFIRMED: 'notifyOnPaymentConfirmed',
  PAYMENT_OVERDUE: 'notifyOnPaymentOverdue',
  PAYMENT_REMINDER_BEFORE_DUE: 'notifyOnPaymentCreated', // Uses same preference
  PAYMENT_REMINDER_AFTER_DUE: 'notifyOnPaymentOverdue', // Uses same preference
};

export { NotificationChannel, NotificationType, NotificationStatus };
