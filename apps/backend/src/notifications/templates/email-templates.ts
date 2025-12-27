/**
 * Professional Email Templates
 *
 * Type-safe templates for all notification emails.
 * Uses the email layout system for consistent, professional styling.
 */

import {
  emailWrapper,
  emailHeader,
  emailContent,
  greeting,
  paragraph,
  infoCard,
  pixBlock,
  button,
  codeBlock,
  callout,
  closing,
  divider,
  formatCurrency,
  formatDate,
  type PixInfo,
  type LayoutOptions,
} from './email-layout';
import type {
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
} from '../notifications.types';

// =============================================================================
// QUOTE TEMPLATES
// =============================================================================

/**
 * Quote Sent Email
 */
export function quoteSentEmail(
  ctx: QuoteSentContext,
  options?: LayoutOptions,
): string {
  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Preparamos um orçamento especialmente para você. Confira os detalhes abaixo e, se tiver qualquer dúvida, estamos à disposição para ajudar.')}

    ${infoCard([
      { label: 'Orçamento', value: `#${ctx.quoteNumber}` },
      { label: 'Valor Total', value: formatCurrency(ctx.totalValue), highlight: true },
    ])}

    ${ctx.quotePublicUrl ? button('Ver Orçamento e Aprovar', ctx.quotePublicUrl, 'primary') : ''}

    ${ctx.quotePublicUrl
      ? paragraph('Clique no botão acima para visualizar todos os detalhes e aprovar o orçamento online.')
      : paragraph('Para aprovar o orçamento, basta responder este e-mail ou entrar em contato conosco.')}

    ${closing('Aguardamos seu retorno!')}
  `;

  const header = emailHeader(
    'Orçamento Disponível',
    'quote_sent',
    `#${ctx.quoteNumber}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Orçamento #${ctx.quoteNumber} - ${formatCurrency(ctx.totalValue)}`,
    },
  );
}

/**
 * Quote Sent - Plain Text Version
 */
export function quoteSentText(ctx: QuoteSentContext): string {
  const approvalSection = ctx.quotePublicUrl
    ? `\nPara ver os detalhes e aprovar o orçamento, acesse:\n${ctx.quotePublicUrl}\n`
    : '\nPara aprovar, basta responder este e-mail ou entrar em contato conosco.\n';

  return `
Olá, ${ctx.clientName}!

Preparamos um orçamento especialmente para você:

ORÇAMENTO #${ctx.quoteNumber}
Valor Total: ${formatCurrency(ctx.totalValue)}
${approvalSection}
Aguardamos seu retorno!

---
Auvo Autônomo
  `.trim();
}

/**
 * Quote Approved Email
 */
export function quoteApprovedEmail(
  ctx: QuoteApprovedContext,
  options?: LayoutOptions,
): string {
  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Temos uma ótima notícia! Seu orçamento foi aprovado com sucesso.')}

    ${infoCard(
      [
        { label: 'Orçamento', value: `#${ctx.quoteNumber}` },
        { label: 'Valor Aprovado', value: formatCurrency(ctx.totalValue), highlight: true },
      ],
      'success',
    )}

    ${paragraph('Em breve entraremos em contato para agendar a execução do serviço. Nosso time está ansioso para atendê-lo!')}

    ${closing('Obrigado pela confiança!')}
  `;

  const header = emailHeader(
    'Orçamento Aprovado!',
    'quote_approved',
    `#${ctx.quoteNumber}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Orçamento #${ctx.quoteNumber} aprovado - ${formatCurrency(ctx.totalValue)}`,
    },
  );
}

/**
 * Quote Approved - Plain Text Version
 */
export function quoteApprovedText(ctx: QuoteApprovedContext): string {
  return `
Olá, ${ctx.clientName}!

Ótima notícia! Seu orçamento foi aprovado com sucesso.

ORÇAMENTO #${ctx.quoteNumber}
Valor Aprovado: ${formatCurrency(ctx.totalValue)}

Em breve entraremos em contato para agendar a execução do serviço.

Obrigado pela confiança!

---
Auvo Autônomo
  `.trim();
}

/**
 * Quote Follow-Up Email
 */
export function quoteFollowUpEmail(
  ctx: QuoteFollowUpContext,
  options?: LayoutOptions,
): string {
  const daysText = ctx.daysSinceSent === 1 ? '1 dia' : `${ctx.daysSinceSent} dias`;

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph(`Notamos que o orçamento enviado há ${daysText} ainda não teve retorno. Queremos garantir que você tenha todas as informações necessárias para tomar sua decisão.`)}

    ${infoCard([
      { label: 'Orçamento', value: `#${ctx.quoteNumber}` },
      { label: 'Valor Total', value: formatCurrency(ctx.totalValue), highlight: true },
    ])}

    ${ctx.quotePublicUrl ? button('Ver Orçamento e Aprovar', ctx.quotePublicUrl, 'primary') : ''}

    ${paragraph('Se tiver qualquer dúvida sobre o orçamento ou precisar de algum ajuste, ficaremos felizes em ajudar.')}

    ${closing('Estamos à disposição para conversarmos!')}
  `;

  const header = emailHeader(
    'Seu Orçamento Aguarda Retorno',
    'quote_follow_up',
    `#${ctx.quoteNumber}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Orçamento #${ctx.quoteNumber} aguardando aprovação`,
    },
  );
}

/**
 * Quote Follow-Up - Plain Text Version
 */
export function quoteFollowUpText(ctx: QuoteFollowUpContext): string {
  const daysText = ctx.daysSinceSent === 1 ? '1 dia' : `${ctx.daysSinceSent} dias`;

  const linkSection = ctx.quotePublicUrl
    ? `\nPara ver os detalhes e aprovar o orçamento, acesse:\n${ctx.quotePublicUrl}\n`
    : '';

  return `
Olá, ${ctx.clientName}!

Notamos que o orçamento enviado há ${daysText} ainda não teve retorno.

ORÇAMENTO #${ctx.quoteNumber}
Valor Total: ${formatCurrency(ctx.totalValue)}
${linkSection}
Se tiver qualquer dúvida ou precisar de algum ajuste, estamos à disposição!

---
Auvo Autônomo
  `.trim();
}

// =============================================================================
// WORK ORDER TEMPLATES
// =============================================================================

/**
 * Work Order Created Email
 */
export function workOrderCreatedEmail(
  ctx: WorkOrderCreatedContext,
  options?: LayoutOptions,
): string {
  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Ordem de Serviço', value: `#${ctx.workOrderNumber}` },
    { label: 'Serviço', value: ctx.title },
  ];

  if (ctx.scheduledDate) {
    const dateValue = ctx.scheduledTime
      ? `${formatDate(ctx.scheduledDate)} às ${ctx.scheduledTime}`
      : formatDate(ctx.scheduledDate);
    infoItems.push({ label: 'Data Agendada', value: dateValue, highlight: true });
  }

  if (ctx.address) {
    infoItems.push({ label: 'Local', value: ctx.address });
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Sua ordem de serviço foi criada e agendada com sucesso. Confira os detalhes abaixo:')}

    ${infoCard(infoItems)}

    ${ctx.workOrderPublicUrl ? button('Ver Detalhes da OS', ctx.workOrderPublicUrl, 'primary') : ''}

    ${ctx.scheduledDate ? callout('Lembre-se de confirmar sua disponibilidade na data agendada.', 'info') : ''}

    ${closing('Nos vemos em breve!')}
  `;

  const header = emailHeader(
    'Serviço Agendado',
    'work_order_created',
    `OS #${ctx.workOrderNumber}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `OS #${ctx.workOrderNumber} - ${ctx.title}`,
    },
  );
}

/**
 * Work Order Created - Plain Text Version
 */
export function workOrderCreatedText(ctx: WorkOrderCreatedContext): string {
  let dateInfo = '';
  if (ctx.scheduledDate) {
    dateInfo = `\nData Agendada: ${formatDate(ctx.scheduledDate)}`;
    if (ctx.scheduledTime) {
      dateInfo += ` às ${ctx.scheduledTime}`;
    }
  }

  let addressInfo = '';
  if (ctx.address) {
    addressInfo = `\nLocal: ${ctx.address}`;
  }

  const linkSection = ctx.workOrderPublicUrl
    ? `\n\nPara ver todos os detalhes da OS, acesse:\n${ctx.workOrderPublicUrl}`
    : '';

  return `
Olá, ${ctx.clientName}!

Sua ordem de serviço foi criada e agendada com sucesso.

ORDEM DE SERVIÇO #${ctx.workOrderNumber}
Serviço: ${ctx.title}${dateInfo}${addressInfo}${linkSection}

Nos vemos em breve!

---
Auvo Autônomo
  `.trim();
}

/**
 * Work Order Completed Email
 */
export function workOrderCompletedEmail(
  ctx: WorkOrderCompletedContext,
  options?: LayoutOptions,
): string {
  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Temos o prazer de informar que o serviço foi concluído com sucesso!')}

    ${infoCard(
      [
        { label: 'Ordem de Serviço', value: `#${ctx.workOrderNumber}` },
        { label: 'Serviço', value: ctx.title },
        { label: 'Concluído em', value: formatDate(ctx.completedAt), highlight: true },
      ],
      'success',
    )}

    ${paragraph('Esperamos que o serviço tenha atendido às suas expectativas. Sua satisfação é nossa prioridade!')}

    ${closing('Agradecemos pela confiança e ficamos à disposição para futuros serviços!')}
  `;

  const header = emailHeader(
    'Serviço Concluído!',
    'work_order_completed',
    `OS #${ctx.workOrderNumber}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `OS #${ctx.workOrderNumber} concluída - ${ctx.title}`,
    },
  );
}

/**
 * Work Order Completed - Plain Text Version
 */
export function workOrderCompletedText(ctx: WorkOrderCompletedContext): string {
  return `
Olá, ${ctx.clientName}!

Temos o prazer de informar que o serviço foi concluído com sucesso!

ORDEM DE SERVIÇO #${ctx.workOrderNumber}
Serviço: ${ctx.title}
Concluído em: ${formatDate(ctx.completedAt)}

Agradecemos pela confiança e ficamos à disposição para futuros serviços!

---
Auvo Autônomo
  `.trim();
}

// =============================================================================
// PAYMENT TEMPLATES
// =============================================================================

/**
 * Payment Created Email
 */
export function paymentCreatedEmail(
  ctx: PaymentCreatedContext,
  options?: LayoutOptions,
): string {
  const billingTypeLabels: Record<string, string> = {
    BOLETO: 'Boleto Bancário',
    PIX: 'PIX',
    CREDIT_CARD: 'Cartão de Crédito',
    UNDEFINED: 'A definir',
  };

  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Valor', value: formatCurrency(ctx.value), highlight: true },
    { label: 'Forma de Pagamento', value: billingTypeLabels[ctx.billingType] || ctx.billingType },
    { label: 'Vencimento', value: formatDate(ctx.dueDate) },
  ];

  if (ctx.workOrderNumber) {
    infoItems.push({ label: 'Referente à', value: `OS #${ctx.workOrderNumber}` });
  } else if (ctx.quoteNumber) {
    infoItems.push({ label: 'Referente à', value: `Orçamento #${ctx.quoteNumber}` });
  }

  let pixSection = '';
  if (ctx.companyPixKey) {
    const pixInfo: PixInfo = {
      pixKey: ctx.companyPixKey,
      pixKeyType: ctx.companyPixKeyType,
      pixKeyOwnerName: ctx.companyPixKeyOwnerName,
    };
    pixSection = pixBlock(pixInfo);
  }

  let pixCodeSection = '';
  if (ctx.pixCode) {
    pixCodeSection = codeBlock(ctx.pixCode, 'Código PIX Copia e Cola (Asaas)');
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Sua cobrança foi gerada. Confira os detalhes abaixo e efetue o pagamento até a data de vencimento.')}

    ${infoCard(infoItems)}

    ${ctx.paymentLink ? button('Pagar Agora', ctx.paymentLink, 'primary') : ''}

    ${pixSection}
    ${pixCodeSection}

    ${closing('Qualquer dúvida, estamos à disposição!')}
  `;

  const header = emailHeader(
    'Cobrança Gerada',
    'payment_created',
    formatCurrency(ctx.value),
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Cobrança de ${formatCurrency(ctx.value)} - Vencimento ${formatDate(ctx.dueDate)}`,
    },
  );
}

/**
 * Payment Created - Plain Text Version
 */
export function paymentCreatedText(ctx: PaymentCreatedContext): string {
  const billingTypeLabels: Record<string, string> = {
    BOLETO: 'Boleto Bancário',
    PIX: 'PIX',
    CREDIT_CARD: 'Cartão de Crédito',
    UNDEFINED: 'A definir',
  };

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à: OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente à: Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento:\n${ctx.paymentLink}`;
  }

  let pixInfo = '';
  if (ctx.companyPixKey) {
    pixInfo = `\n\nPIX para pagamento:\nChave: ${ctx.companyPixKey}`;
    if (ctx.companyPixKeyType) {
      pixInfo += `\nTipo: ${ctx.companyPixKeyType}`;
    }
    if (ctx.companyPixKeyOwnerName) {
      pixInfo += `\nFavorecido: ${ctx.companyPixKeyOwnerName}`;
    }
  }

  if (ctx.pixCode) {
    pixInfo += `\n\nCódigo PIX (Asaas):\n${ctx.pixCode}`;
  }

  return `
Olá, ${ctx.clientName}!

Sua cobrança foi gerada. Confira os detalhes:

VALOR: ${formatCurrency(ctx.value)}
Forma de Pagamento: ${billingTypeLabels[ctx.billingType] || ctx.billingType}
Vencimento: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}${pixInfo}

Qualquer dúvida, estamos à disposição!

---
Auvo Autônomo
  `.trim();
}

/**
 * Payment Confirmed Email
 */
export function paymentConfirmedEmail(
  ctx: PaymentConfirmedContext,
  options?: LayoutOptions,
): string {
  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Valor Pago', value: formatCurrency(ctx.value), highlight: true },
    { label: 'Data do Pagamento', value: formatDate(ctx.paidAt) },
  ];

  if (ctx.workOrderNumber) {
    infoItems.push({ label: 'Referente à', value: `OS #${ctx.workOrderNumber}` });
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Recebemos seu pagamento. Muito obrigado!')}

    ${infoCard(infoItems, 'success')}

    ${callout('Pagamento confirmado com sucesso!', 'success')}

    ${closing('Agradecemos pela confiança e pontualidade!')}
  `;

  const header = emailHeader(
    'Pagamento Confirmado!',
    'payment_confirmed',
    formatCurrency(ctx.value),
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Pagamento de ${formatCurrency(ctx.value)} confirmado`,
    },
  );
}

/**
 * Payment Confirmed - Plain Text Version
 */
export function paymentConfirmedText(ctx: PaymentConfirmedContext): string {
  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à: OS #${ctx.workOrderNumber}`;
  }

  return `
Olá, ${ctx.clientName}!

Recebemos seu pagamento. Muito obrigado!

VALOR PAGO: ${formatCurrency(ctx.value)}
Data do Pagamento: ${formatDate(ctx.paidAt)}${refInfo}

Agradecemos pela confiança e pontualidade!

---
Auvo Autônomo
  `.trim();
}

/**
 * Payment Overdue Email
 */
export function paymentOverdueEmail(
  ctx: PaymentOverdueContext,
  options?: LayoutOptions,
): string {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;

  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Valor', value: formatCurrency(ctx.value), highlight: true },
    { label: 'Vencimento Original', value: formatDate(ctx.dueDate) },
    { label: 'Dias em Atraso', value: daysText },
  ];

  if (ctx.workOrderNumber) {
    infoItems.push({ label: 'Referente à', value: `OS #${ctx.workOrderNumber}` });
  }

  let pixSection = '';
  if (ctx.companyPixKey) {
    const pixInfo: PixInfo = {
      pixKey: ctx.companyPixKey,
      pixKeyType: ctx.companyPixKeyType,
      pixKeyOwnerName: ctx.companyPixKeyOwnerName,
    };
    pixSection = pixBlock(pixInfo);
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph('Identificamos que há um pagamento pendente em sua conta. Por favor, regularize sua situação o mais breve possível.')}

    ${infoCard(infoItems, 'error')}

    ${ctx.paymentLink ? button('Regularizar Pagamento', ctx.paymentLink, 'error') : ''}

    ${pixSection}

    ${callout('Evite encargos adicionais regularizando seu pagamento.', 'warning')}

    ${closing('Em caso de dúvidas ou se já efetuou o pagamento, entre em contato conosco.')}
  `;

  const header = emailHeader(
    'Pagamento Pendente',
    'payment_overdue',
    `${daysText} em atraso`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Pagamento de ${formatCurrency(ctx.value)} pendente - ${daysText} em atraso`,
    },
  );
}

/**
 * Payment Overdue - Plain Text Version
 */
export function paymentOverdueText(ctx: PaymentOverdueContext): string {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à: OS #${ctx.workOrderNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento:\n${ctx.paymentLink}`;
  }

  let pixInfo = '';
  if (ctx.companyPixKey) {
    pixInfo = `\n\nPIX para pagamento:\nChave: ${ctx.companyPixKey}`;
    if (ctx.companyPixKeyType) {
      pixInfo += `\nTipo: ${ctx.companyPixKeyType}`;
    }
    if (ctx.companyPixKeyOwnerName) {
      pixInfo += `\nFavorecido: ${ctx.companyPixKeyOwnerName}`;
    }
  }

  return `
Olá, ${ctx.clientName}!

Identificamos que há um pagamento pendente:

VALOR: ${formatCurrency(ctx.value)}
Vencimento Original: ${formatDate(ctx.dueDate)}
Dias em Atraso: ${daysText}${refInfo}${paymentInfo}${pixInfo}

Por favor, regularize sua situação o mais breve possível.

---
Auvo Autônomo
  `.trim();
}

/**
 * Payment Reminder Before Due Email
 */
export function paymentReminderBeforeEmail(
  ctx: PaymentReminderBeforeDueContext,
  options?: LayoutOptions,
): string {
  const daysText = ctx.daysUntilDue === 1 ? '1 dia' : `${ctx.daysUntilDue} dias`;

  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Valor', value: formatCurrency(ctx.value), highlight: true },
    { label: 'Vencimento', value: formatDate(ctx.dueDate) },
    { label: 'Vence em', value: daysText },
  ];

  if (ctx.workOrderNumber) {
    infoItems.push({ label: 'Referente à', value: `OS #${ctx.workOrderNumber}` });
  } else if (ctx.quoteNumber) {
    infoItems.push({ label: 'Referente à', value: `Orçamento #${ctx.quoteNumber}` });
  }

  let pixSection = '';
  if (ctx.companyPixKey) {
    const pixInfo: PixInfo = {
      pixKey: ctx.companyPixKey,
      pixKeyType: ctx.companyPixKeyType,
      pixKeyOwnerName: ctx.companyPixKeyOwnerName,
    };
    pixSection = pixBlock(pixInfo);
  }

  let pixCodeSection = '';
  if (ctx.pixCode) {
    pixCodeSection = codeBlock(ctx.pixCode, 'Código PIX Copia e Cola');
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph(`Este é um lembrete amigável: você tem um pagamento que vence em ${daysText}.`)}

    ${infoCard(infoItems, 'warning')}

    ${ctx.paymentLink ? button('Pagar Agora', ctx.paymentLink, 'warning') : ''}

    ${pixSection}
    ${pixCodeSection}

    ${callout('Evite atrasos e encargos efetuando o pagamento dentro do prazo.', 'info')}

    ${closing()}
  `;

  const header = emailHeader(
    'Lembrete de Pagamento',
    'payment_reminder_before',
    `Vence em ${daysText}`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Pagamento de ${formatCurrency(ctx.value)} vence em ${daysText}`,
    },
  );
}

/**
 * Payment Reminder Before Due - Plain Text Version
 */
export function paymentReminderBeforeText(ctx: PaymentReminderBeforeDueContext): string {
  const daysText = ctx.daysUntilDue === 1 ? '1 dia' : `${ctx.daysUntilDue} dias`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à: OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente à: Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento:\n${ctx.paymentLink}`;
  }

  let pixInfo = '';
  if (ctx.companyPixKey) {
    pixInfo = `\n\nPIX para pagamento:\nChave: ${ctx.companyPixKey}`;
  }

  if (ctx.pixCode) {
    pixInfo += `\n\nCódigo PIX:\n${ctx.pixCode}`;
  }

  return `
Olá, ${ctx.clientName}!

Lembrete: você tem um pagamento que vence em ${daysText}.

VALOR: ${formatCurrency(ctx.value)}
Vencimento: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}${pixInfo}

Evite atrasos efetuando o pagamento dentro do prazo!

---
Auvo Autônomo
  `.trim();
}

/**
 * Payment Reminder After Due Email
 */
export function paymentReminderAfterEmail(
  ctx: PaymentReminderAfterDueContext,
  options?: LayoutOptions,
): string {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;

  const infoItems: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Valor', value: formatCurrency(ctx.value), highlight: true },
    { label: 'Vencimento Original', value: formatDate(ctx.dueDate) },
    { label: 'Em atraso há', value: daysText },
  ];

  if (ctx.workOrderNumber) {
    infoItems.push({ label: 'Referente à', value: `OS #${ctx.workOrderNumber}` });
  } else if (ctx.quoteNumber) {
    infoItems.push({ label: 'Referente à', value: `Orçamento #${ctx.quoteNumber}` });
  }

  let pixSection = '';
  if (ctx.companyPixKey) {
    const pixInfo: PixInfo = {
      pixKey: ctx.companyPixKey,
      pixKeyType: ctx.companyPixKeyType,
      pixKeyOwnerName: ctx.companyPixKeyOwnerName,
    };
    pixSection = pixBlock(pixInfo);
  }

  let pixCodeSection = '';
  if (ctx.pixCode) {
    pixCodeSection = codeBlock(ctx.pixCode, 'Código PIX Copia e Cola');
  }

  const content = `
    ${greeting(ctx.clientName)}
    ${paragraph(`Identificamos que seu pagamento está em atraso há ${daysText}. Por favor, regularize sua situação para evitar encargos adicionais.`)}

    ${infoCard(infoItems, 'error')}

    ${ctx.paymentLink ? button('Regularizar Agora', ctx.paymentLink, 'error') : ''}

    ${pixSection}
    ${pixCodeSection}

    ${callout('Regularize o quanto antes para evitar juros e multas.', 'warning')}

    ${closing('Se já efetuou o pagamento, por favor desconsidere esta mensagem.')}
  `;

  const header = emailHeader(
    'Pagamento em Atraso',
    'payment_reminder_after',
    `${daysText} de atraso`,
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: `Pagamento de ${formatCurrency(ctx.value)} em atraso - ${daysText}`,
    },
  );
}

/**
 * Payment Reminder After Due - Plain Text Version
 */
export function paymentReminderAfterText(ctx: PaymentReminderAfterDueContext): string {
  const daysText = ctx.daysOverdue === 1 ? '1 dia' : `${ctx.daysOverdue} dias`;

  let refInfo = '';
  if (ctx.workOrderNumber) {
    refInfo = `\nReferente à: OS #${ctx.workOrderNumber}`;
  } else if (ctx.quoteNumber) {
    refInfo = `\nReferente à: Orçamento #${ctx.quoteNumber}`;
  }

  let paymentInfo = '';
  if (ctx.paymentLink) {
    paymentInfo = `\n\nLink para pagamento:\n${ctx.paymentLink}`;
  }

  let pixInfo = '';
  if (ctx.companyPixKey) {
    pixInfo = `\n\nPIX para pagamento:\nChave: ${ctx.companyPixKey}`;
  }

  if (ctx.pixCode) {
    pixInfo += `\n\nCódigo PIX:\n${ctx.pixCode}`;
  }

  return `
Olá, ${ctx.clientName}!

Identificamos que seu pagamento está em atraso há ${daysText}.

VALOR: ${formatCurrency(ctx.value)}
Vencimento Original: ${formatDate(ctx.dueDate)}${refInfo}${paymentInfo}${pixInfo}

Por favor, regularize sua situação o mais breve possível.

---
Auvo Autônomo
  `.trim();
}

// =============================================================================
// SPECIAL TEMPLATES
// =============================================================================

/**
 * Password Reset Email - Professional template for "Forgot Password" flow
 *
 * Design considerations:
 * - Clear, focused messaging
 * - Prominent CTA button
 * - Security reassurance
 * - Fallback link for accessibility
 * - Professional yet friendly tone
 */
export function passwordResetEmail(
  email: string,
  resetUrl: string,
  options?: LayoutOptions,
): string {
  // Mask email for display (jo***@example.com)
  const [localPart, domain] = email.split('@');
  const maskedEmail = localPart.length > 2
    ? `${localPart.substring(0, 2)}***@${domain}`
    : `${localPart[0]}***@${domain}`;

  const content = `
    <!-- Personalized greeting -->
    <p style="margin: 0 0 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.6; color: #374151;">
      Recebemos uma solicitação para redefinir a senha da conta associada a <strong style="color: #1F2937;">${maskedEmail}</strong>
    </p>

    <!-- Main message -->
    <p style="margin: 0 0 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.7; color: #6B7280;">
      Se foi você quem solicitou, clique no botão abaixo para criar uma nova senha. Se não reconhece esta solicitação, pode ignorar este e-mail com segurança.
    </p>

    <!-- CTA Button -->
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: 0 0 32px;">
      <tr>
        <td style="text-align: center;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 600; color: #FFFFFF; text-decoration: none; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%); border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);">
            Redefinir Minha Senha
          </a>
        </td>
      </tr>
    </table>

    <!-- Timer info -->
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: 0 0 32px;">
      <tr>
        <td style="text-align: center;">
          <table role="presentation" style="display: inline-block; border: none; border-spacing: 0;">
            <tr>
              <td style="padding: 12px 20px; background-color: #FEF3C7; border-radius: 8px;">
                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #92400E;">
                  ⏱️ Este link expira em <strong>1 hora</strong>
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: 32px 0;">
      <tr>
        <td style="border-top: 1px solid #E5E7EB; font-size: 1px; line-height: 1px;">&nbsp;</td>
      </tr>
    </table>

    <!-- Security tips -->
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0; margin: 0 0 24px;">
      <tr>
        <td style="padding: 20px; background-color: #F9FAFB; border-radius: 8px;">
          <p style="margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #374151;">
            🔒 Dicas de segurança:
          </p>
          <ul style="margin: 0; padding: 0 0 0 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.8; color: #6B7280;">
            <li>Use uma senha com pelo menos 8 caracteres</li>
            <li>Combine letras maiúsculas, minúsculas e números</li>
            <li>Evite usar a mesma senha de outros sites</li>
            <li>Nunca compartilhe sua senha com ninguém</li>
          </ul>
        </td>
      </tr>
    </table>

    <!-- Fallback link -->
    <p style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #9CA3AF;">
      Se o botão não funcionar, copie e cole este link no seu navegador:
    </p>
    <p style="margin: 0 0 24px; font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; color: #7C3AED; word-break: break-all; background-color: #F3F4F6; padding: 12px; border-radius: 6px;">
      ${resetUrl}
    </p>

    <!-- Didn't request section -->
    <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
      <tr>
        <td style="padding: 16px; background-color: #FEF2F2; border-radius: 8px; border-left: 4px solid #EF4444;">
          <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #991B1B;">
            <strong>Não solicitou esta redefinição?</strong><br>
            Se você não pediu para redefinir sua senha, ignore este e-mail. Sua conta permanece segura e nenhuma alteração será feita.
          </p>
        </td>
      </tr>
    </table>
  `;

  const header = passwordResetHeader();

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: 'Redefina sua senha - Link válido por 1 hora',
    },
  );
}

/**
 * Custom header for password reset (more focused design)
 */
function passwordResetHeader(): string {
  return `
    <!-- Header -->
    <tr>
      <td style="padding: 0;">
        <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
          <!-- Brand Bar -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%);">
              <table role="presentation" style="width: 100%; border: none; border-spacing: 0;">
                <tr>
                  <td style="text-align: center;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
                      Auvo Autônomo
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Icon + Title -->
          <tr>
            <td style="padding: 40px 32px 24px; text-align: center;">
              <!-- Lock Icon -->
              <div style="display: inline-block; width: 72px; height: 72px; line-height: 72px; font-size: 32px; background: linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%); border-radius: 50%; margin-bottom: 20px;">
                🔐
              </div>

              <!-- Title -->
              <h1 style="margin: 0 0 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; font-weight: 700; color: #1F2937; line-height: 1.2;">
                Redefinir sua senha
              </h1>

              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #9CA3AF;">
                Solicitação recebida em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * Password Reset - Plain Text Version
 */
export function passwordResetText(resetUrl: string): string {
  return `
═══════════════════════════════════════
   REDEFINIR SENHA - Auvo Autônomo
═══════════════════════════════════════

Recebemos uma solicitação para redefinir a senha da sua conta.

Se foi você quem solicitou, clique no link abaixo para criar uma nova senha:

${resetUrl}

⏱️ IMPORTANTE: Este link expira em 1 hora.

───────────────────────────────────────

🔒 DICAS DE SEGURANÇA:
• Use uma senha com pelo menos 8 caracteres
• Combine letras maiúsculas, minúsculas e números
• Evite usar a mesma senha de outros sites
• Nunca compartilhe sua senha com ninguém

───────────────────────────────────────

Não solicitou esta redefinição?
Se você não pediu para redefinir sua senha, ignore este e-mail.
Sua conta permanece segura e nenhuma alteração será feita.

───────────────────────────────────────
© ${new Date().getFullYear()} Auvo Autônomo
  `.trim();
}

/**
 * Welcome Email
 */
export function welcomeEmail(
  name: string,
  loginUrl: string,
  options?: LayoutOptions,
): string {
  const content = `
    ${greeting(name)}
    ${paragraph('Seja bem-vindo ao Auvo Autônomo! Estamos muito felizes em ter você conosco.')}

    ${paragraph('Com o Auvo, você pode:')}

    ${infoCard([
      { label: '📋', value: 'Criar e enviar orçamentos profissionais' },
      { label: '📅', value: 'Gerenciar suas ordens de serviço' },
      { label: '💰', value: 'Controlar cobranças e pagamentos' },
      { label: '📊', value: 'Acompanhar seu faturamento' },
    ])}

    ${button('Acessar Minha Conta', loginUrl, 'primary')}

    ${closing('Conte conosco para o que precisar!')}
  `;

  const header = emailHeader(
    'Bem-vindo ao Auvo!',
    'welcome',
    'Sua conta foi criada com sucesso',
  );

  return emailWrapper(
    header + emailContent(content),
    {
      ...options,
      previewText: 'Bem-vindo ao Auvo Autônomo!',
    },
  );
}

/**
 * Welcome - Plain Text Version
 */
export function welcomeText(name: string, loginUrl: string): string {
  return `
Olá, ${name}!

Seja bem-vindo ao Auvo Autônomo! Estamos muito felizes em ter você conosco.

Com o Auvo, você pode:
- Criar e enviar orçamentos profissionais
- Gerenciar suas ordens de serviço
- Controlar cobranças e pagamentos
- Acompanhar seu faturamento

Acesse sua conta: ${loginUrl}

Conte conosco para o que precisar!

---
Auvo Autônomo
  `.trim();
}
