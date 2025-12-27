import { NotificationType } from '@prisma/client';
import {
  NotificationContextData,
  QuoteSentContext,
  QuoteApprovedContext,
  QuoteFollowUpContext,
  WorkOrderCreatedContext,
  WorkOrderCompletedContext,
  PaymentCreatedContext,
  PaymentConfirmedContext,
  PaymentOverdueContext,
  PaymentReminderBeforeDueContext,
  PaymentReminderAfterDueContext,
  RenderedTemplate,
} from '../notifications.types';

// Import professional email templates
import {
  quoteSentEmail,
  quoteSentText,
  quoteApprovedEmail,
  quoteApprovedText,
  quoteFollowUpEmail,
  quoteFollowUpText,
  workOrderCreatedEmail,
  workOrderCreatedText,
  workOrderCompletedEmail,
  workOrderCompletedText,
  paymentCreatedEmail,
  paymentCreatedText,
  paymentConfirmedEmail,
  paymentConfirmedText,
  paymentOverdueEmail,
  paymentOverdueText,
  paymentReminderBeforeEmail,
  paymentReminderBeforeText,
  paymentReminderAfterEmail,
  paymentReminderAfterText,
} from './email-templates';

// Import utilities from email-layout
import {
  formatCurrency as formatCurrencyUtil,
  formatDate as formatDateUtil,
} from './email-layout';

// Re-export utilities
export const formatCurrency = formatCurrencyUtil;
export const formatDate = formatDateUtil;

/**
 * Notification Templates
 *
 * Professional templates for all notification types.
 * Uses the new email layout system for HTML emails
 * while maintaining simple text versions for WhatsApp/SMS.
 */

// Helper to format Pix key type label
const formatPixKeyType = (type?: string): string => {
  const labels: Record<string, string> = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'E-mail',
    PHONE: 'Telefone',
    RANDOM: 'Chave aleatória',
  };
  return type ? labels[type] || type : '';
};

// Helper to generate Pix block for WhatsApp/text messages
const formatPixBlock = (
  pixKey?: string,
  pixKeyType?: string,
  pixKeyOwnerName?: string,
): string => {
  if (!pixKey) return '';

  const typeLabel = formatPixKeyType(pixKeyType);
  let block = `

📱 *PIX para pagamento*
Chave: ${pixKey}`;

  if (typeLabel) {
    block += `
Tipo: ${typeLabel}`;
  }

  if (pixKeyOwnerName) {
    block += `
Favorecido: ${pixKeyOwnerName}`;
  }

  block += `
Copie e cole a chave no seu banco para pagar via Pix.`;

  return block;
};

// ============================================
// QUOTE_SENT
// ============================================
const renderQuoteSent = (ctx: QuoteSentContext): RenderedTemplate => {
  const subject = `Orçamento #${ctx.quoteNumber} - ${formatCurrency(ctx.totalValue)}`;

  // Use professional HTML template
  const htmlBody = quoteSentEmail(ctx);

  // Use simple text for WhatsApp/SMS
  const body = quoteSentText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// QUOTE_APPROVED
// ============================================
const renderQuoteApproved = (ctx: QuoteApprovedContext): RenderedTemplate => {
  const subject = `Orçamento #${ctx.quoteNumber} Aprovado!`;

  const htmlBody = quoteApprovedEmail(ctx);
  const body = quoteApprovedText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// QUOTE_FOLLOW_UP
// ============================================
const renderQuoteFollowUp = (ctx: QuoteFollowUpContext): RenderedTemplate => {
  const subject = `Lembrete: Orçamento #${ctx.quoteNumber} aguarda sua aprovação`;

  const htmlBody = quoteFollowUpEmail(ctx);
  const body = quoteFollowUpText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// WORK_ORDER_CREATED
// ============================================
const renderWorkOrderCreated = (
  ctx: WorkOrderCreatedContext,
): RenderedTemplate => {
  const subject = `Ordem de Serviço #${ctx.workOrderNumber} Agendada`;

  const htmlBody = workOrderCreatedEmail(ctx);
  const body = workOrderCreatedText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// WORK_ORDER_COMPLETED
// ============================================
const renderWorkOrderCompleted = (
  ctx: WorkOrderCompletedContext,
): RenderedTemplate => {
  const subject = `Serviço Concluído - OS #${ctx.workOrderNumber}`;

  const htmlBody = workOrderCompletedEmail(ctx);
  const body = workOrderCompletedText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_CREATED
// ============================================
const renderPaymentCreated = (ctx: PaymentCreatedContext): RenderedTemplate => {
  const subject = `Cobrança - ${formatCurrency(ctx.value)} - Vencimento ${formatDate(ctx.dueDate)}`;

  const htmlBody = paymentCreatedEmail(ctx);
  const body = paymentCreatedText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_CONFIRMED
// ============================================
const renderPaymentConfirmed = (
  ctx: PaymentConfirmedContext,
): RenderedTemplate => {
  const subject = `Pagamento Recebido - ${formatCurrency(ctx.value)}`;

  const htmlBody = paymentConfirmedEmail(ctx);
  const body = paymentConfirmedText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_OVERDUE
// ============================================
const renderPaymentOverdue = (ctx: PaymentOverdueContext): RenderedTemplate => {
  const subject = `Pagamento Pendente - ${formatCurrency(ctx.value)} - ${ctx.daysOverdue} dia(s) em atraso`;

  const htmlBody = paymentOverdueEmail(ctx);
  const body = paymentOverdueText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_REMINDER_BEFORE_DUE (Automations)
// ============================================
const renderPaymentReminderBeforeDue = (
  ctx: PaymentReminderBeforeDueContext,
): RenderedTemplate => {
  const daysText = ctx.daysUntilDue === 1 ? '1 dia' : `${ctx.daysUntilDue} dias`;
  const subject = `Lembrete: Pagamento de ${formatCurrency(ctx.value)} vence em ${daysText}`;

  const htmlBody = paymentReminderBeforeEmail(ctx);
  const body = paymentReminderBeforeText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_REMINDER_AFTER_DUE (Automations)
// ============================================
const renderPaymentReminderAfterDue = (
  ctx: PaymentReminderAfterDueContext,
): RenderedTemplate => {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;
  const subject = `Pagamento em Atraso - ${formatCurrency(ctx.value)} - ${daysText}`;

  const htmlBody = paymentReminderAfterEmail(ctx);
  const body = paymentReminderAfterText(ctx);

  return { subject, body, htmlBody };
};

// ============================================
// MAIN RENDERER
// ============================================
export function renderTemplate(
  type: NotificationType,
  contextData: NotificationContextData,
): RenderedTemplate {
  switch (type) {
    case 'QUOTE_SENT':
      return renderQuoteSent(contextData as QuoteSentContext);

    case 'QUOTE_APPROVED':
      return renderQuoteApproved(contextData as QuoteApprovedContext);

    case 'QUOTE_FOLLOW_UP':
      return renderQuoteFollowUp(contextData as QuoteFollowUpContext);

    case 'WORK_ORDER_CREATED':
      return renderWorkOrderCreated(contextData as WorkOrderCreatedContext);

    case 'WORK_ORDER_COMPLETED':
      return renderWorkOrderCompleted(contextData as WorkOrderCompletedContext);

    case 'PAYMENT_CREATED':
      return renderPaymentCreated(contextData as PaymentCreatedContext);

    case 'PAYMENT_CONFIRMED':
      return renderPaymentConfirmed(contextData as PaymentConfirmedContext);

    case 'PAYMENT_OVERDUE':
      return renderPaymentOverdue(contextData as PaymentOverdueContext);

    case 'PAYMENT_REMINDER_BEFORE_DUE':
      return renderPaymentReminderBeforeDue(
        contextData as PaymentReminderBeforeDueContext,
      );

    case 'PAYMENT_REMINDER_AFTER_DUE':
      return renderPaymentReminderAfterDue(
        contextData as PaymentReminderAfterDueContext,
      );

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

export {
  renderQuoteSent,
  renderQuoteApproved,
  renderQuoteFollowUp,
  renderWorkOrderCreated,
  renderWorkOrderCompleted,
  renderPaymentCreated,
  renderPaymentConfirmed,
  renderPaymentOverdue,
  renderPaymentReminderBeforeDue,
  renderPaymentReminderAfterDue,
};

// Re-export professional templates for direct use
export {
  quoteSentEmail,
  quoteApprovedEmail,
  quoteFollowUpEmail,
  workOrderCreatedEmail,
  workOrderCompletedEmail,
  paymentCreatedEmail,
  paymentConfirmedEmail,
  paymentOverdueEmail,
  paymentReminderBeforeEmail,
  paymentReminderAfterEmail,
} from './email-templates';

// Re-export password reset and welcome templates
export {
  passwordResetEmail,
  passwordResetText,
  welcomeEmail,
  welcomeText,
} from './email-templates';
