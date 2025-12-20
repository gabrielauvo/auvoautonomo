import { FinancialAutomationSettings } from '@prisma/client';

/**
 * Financial Automations Types
 */

// Automation settings with defaults
export interface AutomationSettingsResponse {
  id: string;
  userId: string;
  isEnabled: boolean;
  paymentReminderDaysBefore: number[];
  paymentReminderDaysAfter: number[];
  autoMarkOverdueAsDelinquentAfterDays: number | null;
  enableQuoteFollowUp: boolean;
  quoteFollowUpDays: number[];
  autoCancelPaymentAfterDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Daily automation run result
export interface DailyAutomationResult {
  runAt: Date;
  usersProcessed: number;
  results: {
    paymentRemindersBeforeDue: AutomationRunStats;
    paymentRemindersAfterDue: AutomationRunStats;
    delinquentClients: AutomationRunStats;
    quoteFollowUps: AutomationRunStats;
    autoCancelPayments: AutomationRunStats;
  };
  errors: string[];
}

// Stats for each automation type
export interface AutomationRunStats {
  processed: number;
  successful: number;
  failed: number;
}

// Payment reminder context
export interface PaymentReminderContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  paymentId: string;
  value: number;
  dueDate: string;
  daysUntilDue?: number;
  daysOverdue?: number;
  paymentLink?: string;
  pixCode?: string;
  workOrderNumber?: string;
  quoteNumber?: string;
}

// Quote follow-up context
export interface QuoteFollowUpContext {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  quoteId: string;
  quoteNumber: string;
  totalValue: number;
  daysSinceSent: number;
}

// Default settings values
export const DEFAULT_AUTOMATION_SETTINGS = {
  isEnabled: true,
  paymentReminderDaysBefore: [3, 1],
  paymentReminderDaysAfter: [3, 7],
  autoMarkOverdueAsDelinquentAfterDays: 30,
  enableQuoteFollowUp: true,
  quoteFollowUpDays: [3, 7],
  autoCancelPaymentAfterDays: null,
};
