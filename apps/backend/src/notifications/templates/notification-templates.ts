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

/**
 * Notification Templates
 *
 * Templates for all notification types in both text and HTML format
 */

// Helper to format currency
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Helper to format date
const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// ============================================
// QUOTE_SENT
// ============================================
const renderQuoteSent = (ctx: QuoteSentContext): RenderedTemplate => {
  const subject = `Orçamento #${ctx.quoteNumber} - ${formatCurrency(ctx.totalValue)}`;

  const body = `Olá, ${ctx.clientName}!

Segue o orçamento #${ctx.quoteNumber} no valor de ${formatCurrency(ctx.totalValue)}.

Aguardamos sua aprovação para darmos continuidade ao serviço.

Qualquer dúvida, estamos à disposição!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7C3AED;">Orçamento #${ctx.quoteNumber}</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Segue o orçamento no valor de <strong>${formatCurrency(ctx.totalValue)}</strong>.</p>
      <p>Aguardamos sua aprovação para darmos continuidade ao serviço.</p>
      <p>Qualquer dúvida, estamos à disposição!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// QUOTE_APPROVED
// ============================================
const renderQuoteApproved = (ctx: QuoteApprovedContext): RenderedTemplate => {
  const subject = `Orçamento #${ctx.quoteNumber} Aprovado!`;

  const body = `Olá, ${ctx.clientName}!

Seu orçamento #${ctx.quoteNumber} foi aprovado com sucesso!

Valor total: ${formatCurrency(ctx.totalValue)}

Em breve entraremos em contato para agendar a execução do serviço.

Obrigado pela confiança!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Orçamento Aprovado!</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Seu orçamento <strong>#${ctx.quoteNumber}</strong> foi aprovado com sucesso!</p>
      <p>Valor total: <strong>${formatCurrency(ctx.totalValue)}</strong></p>
      <p>Em breve entraremos em contato para agendar a execução do serviço.</p>
      <p>Obrigado pela confiança!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// WORK_ORDER_CREATED
// ============================================
const renderWorkOrderCreated = (ctx: WorkOrderCreatedContext): RenderedTemplate => {
  const subject = `Ordem de Serviço #${ctx.workOrderNumber} Agendada`;

  let dateInfo = '';
  if (ctx.scheduledDate) {
    dateInfo = `\nData agendada: ${formatDate(ctx.scheduledDate)}`;
    if (ctx.scheduledTime) {
      dateInfo += ` às ${ctx.scheduledTime}`;
    }
  }

  let addressInfo = '';
  if (ctx.address) {
    addressInfo = `\nEndereço: ${ctx.address}`;
  }

  const body = `Olá, ${ctx.clientName}!

Sua ordem de serviço #${ctx.workOrderNumber} foi criada/agendada.

Serviço: ${ctx.title}${dateInfo}${addressInfo}

Aguardamos você!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #3B82F6;">Ordem de Serviço Agendada</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Sua ordem de serviço <strong>#${ctx.workOrderNumber}</strong> foi criada/agendada.</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Serviço:</strong> ${ctx.title}</p>
        ${ctx.scheduledDate ? `<p style="margin: 4px 0;"><strong>Data:</strong> ${formatDate(ctx.scheduledDate)}${ctx.scheduledTime ? ` às ${ctx.scheduledTime}` : ''}</p>` : ''}
        ${ctx.address ? `<p style="margin: 4px 0;"><strong>Endereço:</strong> ${ctx.address}</p>` : ''}
      </div>
      <p>Aguardamos você!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// WORK_ORDER_COMPLETED
// ============================================
const renderWorkOrderCompleted = (ctx: WorkOrderCompletedContext): RenderedTemplate => {
  const subject = `Serviço Concluído - OS #${ctx.workOrderNumber}`;

  const body = `Olá, ${ctx.clientName}!

Concluímos sua visita referente à OS #${ctx.workOrderNumber}.

Serviço: ${ctx.title}
Concluído em: ${formatDate(ctx.completedAt)}

Agradecemos pela confiança e ficamos à disposição para futuros serviços!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Serviço Concluído!</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Concluímos sua visita referente à OS <strong>#${ctx.workOrderNumber}</strong>.</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Serviço:</strong> ${ctx.title}</p>
        <p style="margin: 4px 0;"><strong>Concluído em:</strong> ${formatDate(ctx.completedAt)}</p>
      </div>
      <p>Agradecemos pela confiança e ficamos à disposição para futuros serviços!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_CREATED
// ============================================
const renderPaymentCreated = (ctx: PaymentCreatedContext): RenderedTemplate => {
  const subject = `Cobrança - ${formatCurrency(ctx.value)} - Vencimento ${formatDate(ctx.dueDate)}`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente ao Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento: ${ctx.paymentLink}`;
  }
  if (ctx.pixCode) {
    paymentInfo += `\n\nCódigo PIX: ${ctx.pixCode}`;
  }

  const body = `Olá, ${ctx.clientName}!

Segue o link para pagamento no valor de ${formatCurrency(ctx.value)}.

Forma de pagamento: ${ctx.billingType}
Vencimento: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}

Qualquer dúvida, estamos à disposição!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7C3AED;">Cobrança Gerada</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Valor:</strong> ${formatCurrency(ctx.value)}</p>
        <p style="margin: 4px 0;"><strong>Forma de pagamento:</strong> ${ctx.billingType}</p>
        <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${formatDate(ctx.dueDate)}</p>
        ${ctx.workOrderNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> OS #${ctx.workOrderNumber}</p>` : ''}
        ${ctx.quoteNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> Orçamento #${ctx.quoteNumber}</p>` : ''}
      </div>
      ${ctx.paymentLink ? `<p><a href="${ctx.paymentLink}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pagar Agora</a></p>` : ''}
      ${ctx.pixCode ? `<p style="background: #E5E7EB; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; font-size: 12px;">${ctx.pixCode}</p>` : ''}
      <p>Qualquer dúvida, estamos à disposição!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_CONFIRMED
// ============================================
const renderPaymentConfirmed = (ctx: PaymentConfirmedContext): RenderedTemplate => {
  const subject = `Pagamento Recebido - ${formatCurrency(ctx.value)}`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à OS #${ctx.workOrderNumber}`;
  }

  const body = `Olá, ${ctx.clientName}!

Pagamento recebido! Obrigado.

Valor: ${formatCurrency(ctx.value)}
Recebido em: ${formatDate(ctx.paidAt)}${refInfo}

Agradecemos pela confiança!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">Pagamento Confirmado!</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Pagamento recebido com sucesso. Obrigado!</p>
      <div style="background: #D1FAE5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Valor:</strong> ${formatCurrency(ctx.value)}</p>
        <p style="margin: 4px 0;"><strong>Recebido em:</strong> ${formatDate(ctx.paidAt)}</p>
        ${ctx.workOrderNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> OS #${ctx.workOrderNumber}</p>` : ''}
      </div>
      <p>Agradecemos pela confiança!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_OVERDUE
// ============================================
const renderPaymentOverdue = (ctx: PaymentOverdueContext): RenderedTemplate => {
  const subject = `Pagamento Pendente - ${formatCurrency(ctx.value)} - ${ctx.daysOverdue} dia(s) em atraso`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à OS #${ctx.workOrderNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento: ${ctx.paymentLink}`;
  }

  const body = `Olá, ${ctx.clientName}!

Notamos que o pagamento está em aberto desde ${formatDate(ctx.dueDate)}.

Valor: ${formatCurrency(ctx.value)}
Dias em atraso: ${ctx.daysOverdue}${refInfo}${paymentInfo}

Por favor, regularize seu pagamento. Qualquer dúvida, entre em contato conosco.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #EF4444;">Pagamento Pendente</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Notamos que o pagamento está em aberto.</p>
      <div style="background: #FEE2E2; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Valor:</strong> ${formatCurrency(ctx.value)}</p>
        <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${formatDate(ctx.dueDate)}</p>
        <p style="margin: 4px 0;"><strong>Dias em atraso:</strong> ${ctx.daysOverdue}</p>
        ${ctx.workOrderNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> OS #${ctx.workOrderNumber}</p>` : ''}
      </div>
      ${ctx.paymentLink ? `<p><a href="${ctx.paymentLink}" style="background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Regularizar Pagamento</a></p>` : ''}
      <p>Qualquer dúvida, entre em contato conosco.</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_REMINDER_BEFORE_DUE (Automations)
// ============================================
const renderPaymentReminderBeforeDue = (ctx: PaymentReminderBeforeDueContext): RenderedTemplate => {
  const daysText = ctx.daysUntilDue === 1 ? '1 dia' : `${ctx.daysUntilDue} dias`;
  const subject = `Lembrete: Pagamento de ${formatCurrency(ctx.value)} vence em ${daysText}`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente ao Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento: ${ctx.paymentLink}`;
  }
  if (ctx.pixCode) {
    paymentInfo += `\n\nCódigo PIX: ${ctx.pixCode}`;
  }

  const body = `Olá, ${ctx.clientName}!

Lembramos que você tem um pagamento que vence em ${daysText}.

Valor: ${formatCurrency(ctx.value)}
Vencimento: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}

Evite atrasos e efetue seu pagamento dentro do prazo!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #F59E0B;">Lembrete de Pagamento</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Lembramos que você tem um pagamento que vence em <strong>${daysText}</strong>.</p>
      <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Valor:</strong> ${formatCurrency(ctx.value)}</p>
        <p style="margin: 4px 0;"><strong>Vencimento:</strong> ${formatDate(ctx.dueDate)}</p>
        ${ctx.workOrderNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> OS #${ctx.workOrderNumber}</p>` : ''}
        ${ctx.quoteNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> Orçamento #${ctx.quoteNumber}</p>` : ''}
      </div>
      ${ctx.paymentLink ? `<p><a href="${ctx.paymentLink}" style="background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Pagar Agora</a></p>` : ''}
      ${ctx.pixCode ? `<p style="background: #E5E7EB; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; font-size: 12px;">${ctx.pixCode}</p>` : ''}
      <p>Evite atrasos e efetue seu pagamento dentro do prazo!</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// PAYMENT_REMINDER_AFTER_DUE (Automations)
// ============================================
const renderPaymentReminderAfterDue = (ctx: PaymentReminderAfterDueContext): RenderedTemplate => {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;
  const subject = `Pagamento em Atraso - ${formatCurrency(ctx.value)} - ${daysText}`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente ao Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento: ${ctx.paymentLink}`;
  }
  if (ctx.pixCode) {
    paymentInfo += `\n\nCódigo PIX: ${ctx.pixCode}`;
  }

  const body = `Olá, ${ctx.clientName}!

Identificamos que seu pagamento está em atraso há ${daysText}.

Valor: ${formatCurrency(ctx.value)}
Vencimento original: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}

Por favor, regularize sua situação o mais breve possível para evitar encargos adicionais.`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Pagamento em Atraso</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Identificamos que seu pagamento está em atraso há <strong>${daysText}</strong>.</p>
      <div style="background: #FEE2E2; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Valor:</strong> ${formatCurrency(ctx.value)}</p>
        <p style="margin: 4px 0;"><strong>Vencimento original:</strong> ${formatDate(ctx.dueDate)}</p>
        <p style="margin: 4px 0;"><strong>Dias em atraso:</strong> ${ctx.daysOverdue}</p>
        ${ctx.workOrderNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> OS #${ctx.workOrderNumber}</p>` : ''}
        ${ctx.quoteNumber ? `<p style="margin: 4px 0;"><strong>Referente à:</strong> Orçamento #${ctx.quoteNumber}</p>` : ''}
      </div>
      ${ctx.paymentLink ? `<p><a href="${ctx.paymentLink}" style="background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Regularizar Agora</a></p>` : ''}
      ${ctx.pixCode ? `<p style="background: #E5E7EB; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; font-size: 12px;">${ctx.pixCode}</p>` : ''}
      <p>Por favor, regularize sua situação o mais breve possível.</p>
    </div>
  `;

  return { subject, body, htmlBody };
};

// ============================================
// QUOTE_FOLLOW_UP (Automations)
// ============================================
const renderQuoteFollowUp = (ctx: QuoteFollowUpContext): RenderedTemplate => {
  const daysText = ctx.daysSinceSent === 1 ? '1 dia' : `${ctx.daysSinceSent} dias`;
  const subject = `Lembrete: Orçamento #${ctx.quoteNumber} aguarda sua aprovação`;

  const body = `Olá, ${ctx.clientName}!

Notamos que o orçamento #${ctx.quoteNumber} enviado há ${daysText} ainda não foi respondido.

Valor total: ${formatCurrency(ctx.totalValue)}

Gostaríamos de saber se há alguma dúvida ou se podemos ajudar com algo.

Estamos à disposição para conversarmos sobre o orçamento!`;

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7C3AED;">Lembrete de Orçamento</h2>
      <p>Olá, <strong>${ctx.clientName}</strong>!</p>
      <p>Notamos que o orçamento enviado há <strong>${daysText}</strong> ainda não foi respondido.</p>
      <div style="background: #EDE9FE; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Orçamento:</strong> #${ctx.quoteNumber}</p>
        <p style="margin: 4px 0;"><strong>Valor total:</strong> ${formatCurrency(ctx.totalValue)}</p>
      </div>
      <p>Gostaríamos de saber se há alguma dúvida ou se podemos ajudar com algo.</p>
      <p>Estamos à disposição para conversarmos sobre o orçamento!</p>
    </div>
  `;

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
      return renderPaymentReminderBeforeDue(contextData as PaymentReminderBeforeDueContext);

    case 'PAYMENT_REMINDER_AFTER_DUE':
      return renderPaymentReminderAfterDue(contextData as PaymentReminderAfterDueContext);

    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
}

export {
  formatCurrency,
  formatDate,
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
