/**
 * Send Test Emails
 *
 * Run with: npx ts-node src/notifications/templates/send-test.ts <email> [template]
 *
 * Examples:
 *   npx ts-node src/notifications/templates/send-test.ts seu@email.com
 *   npx ts-node src/notifications/templates/send-test.ts seu@email.com payment-created
 */

import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import {
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
  passwordResetEmail,
  welcomeEmail,
} from './email-templates';

// =============================================================================
// SAMPLE DATA
// =============================================================================

const sampleData = {
  'quote-sent': {
    subject: 'Orçamento #2024001 - R$ 1.500,00',
    html: quoteSentEmail({
      clientName: 'João Silva',
      clientEmail: 'joao@example.com',
      quoteId: 'quote-123',
      quoteNumber: '2024001',
      totalValue: 1500.0,
      quotePublicUrl: 'https://app.auvoautonomo.com/p/quotes/abc123xyz',
    }),
  },
  'quote-approved': {
    subject: 'Orçamento #2024002 Aprovado!',
    html: quoteApprovedEmail({
      clientName: 'Maria Santos',
      clientEmail: 'maria@example.com',
      quoteId: 'quote-456',
      quoteNumber: '2024002',
      totalValue: 2350.0,
    }),
  },
  'quote-follow-up': {
    subject: 'Lembrete: Orçamento #2024003 aguarda sua aprovação',
    html: quoteFollowUpEmail({
      clientName: 'Carlos Oliveira',
      quoteId: 'quote-789',
      quoteNumber: '2024003',
      totalValue: 890.0,
      daysSinceSent: 3,
      quotePublicUrl: 'https://app.auvoautonomo.com/p/quotes/def456uvw',
    }),
  },
  'work-order-created': {
    subject: 'Ordem de Serviço #OS2024001 Agendada',
    html: workOrderCreatedEmail({
      clientName: 'Ana Paula',
      workOrderId: 'wo-123',
      workOrderNumber: 'OS2024001',
      title: 'Manutenção de ar condicionado Split 12000 BTUs',
      scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledTime: '14:00',
      address: 'Rua das Flores, 123 - Centro - São Paulo/SP',
      workOrderPublicUrl: 'https://app.auvoautonomo.com/os/ghi789rst',
    }),
  },
  'work-order-completed': {
    subject: 'Serviço Concluído - OS #OS2024002',
    html: workOrderCompletedEmail({
      clientName: 'Roberto Almeida',
      workOrderId: 'wo-456',
      workOrderNumber: 'OS2024002',
      title: 'Instalação de Split Inverter',
      completedAt: new Date().toISOString(),
    }),
  },
  'payment-created': {
    subject: 'Cobrança - R$ 750,00',
    html: paymentCreatedEmail({
      clientName: 'Fernanda Costa',
      paymentId: 'pay-123',
      value: 750.0,
      billingType: 'PIX',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      paymentLink: 'https://pay.example.com/abc123',
      workOrderNumber: 'OS2024001',
      companyPixKey: '12.345.678/0001-90',
      companyPixKeyType: 'CNPJ',
      companyPixKeyOwnerName: 'Climatização Silva LTDA',
    }),
  },
  'payment-confirmed': {
    subject: 'Pagamento Recebido - R$ 1.200,00',
    html: paymentConfirmedEmail({
      clientName: 'Lucas Pereira',
      paymentId: 'pay-456',
      value: 1200.0,
      paidAt: new Date().toISOString(),
      workOrderNumber: 'OS2024003',
    }),
  },
  'payment-overdue': {
    subject: 'Pagamento Pendente - R$ 500,00',
    html: paymentOverdueEmail({
      clientName: 'Patricia Lima',
      paymentId: 'pay-789',
      value: 500.0,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      daysOverdue: 5,
      paymentLink: 'https://pay.example.com/xyz789',
      workOrderNumber: 'OS2024004',
      companyPixKey: 'empresa@email.com',
      companyPixKeyType: 'EMAIL',
    }),
  },
  'payment-reminder-before': {
    subject: 'Lembrete: Pagamento vence em 2 dias',
    html: paymentReminderBeforeEmail({
      clientName: 'Marcos Souza',
      paymentId: 'pay-abc',
      value: 350.0,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntilDue: 2,
      paymentLink: 'https://pay.example.com/reminder1',
      workOrderNumber: 'OS2024005',
    }),
  },
  'payment-reminder-after': {
    subject: 'Pagamento em Atraso - 10 dias',
    html: paymentReminderAfterEmail({
      clientName: 'Juliana Ramos',
      paymentId: 'pay-def',
      value: 980.0,
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      daysOverdue: 10,
      paymentLink: 'https://pay.example.com/reminder2',
      quoteNumber: '2024010',
    }),
  },
  'password-reset': {
    subject: 'Redefinir sua senha - Auvo Autônomo',
    html: passwordResetEmail('usuario@example.com', 'https://app.auvoautonomo.com/reset?token=abc123'),
  },
  'welcome': {
    subject: 'Bem-vindo ao Auvo Autônomo!',
    html: welcomeEmail('Novo Usuário', 'https://app.auvoautonomo.com/login'),
  },
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const templateName = args[1];

  if (!email) {
    console.log('❌ Por favor, forneça um email de destino.\n');
    console.log('Uso: npx ts-node src/notifications/templates/send-test.ts <email> [template]\n');
    console.log('Templates disponíveis:');
    Object.keys(sampleData).forEach((name) => console.log(`  - ${name}`));
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('❌ RESEND_API_KEY não configurada no .env');
    process.exit(1);
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.EMAIL_FROM || 'noreply@auvoautonomo.com';
  const fromName = process.env.EMAIL_FROM_NAME || 'Auvo Autônomo';

  const templatesToSend = templateName
    ? { [templateName]: sampleData[templateName as keyof typeof sampleData] }
    : sampleData;

  if (templateName && !sampleData[templateName as keyof typeof sampleData]) {
    console.log(`❌ Template "${templateName}" não encontrado.\n`);
    console.log('Templates disponíveis:');
    Object.keys(sampleData).forEach((name) => console.log(`  - ${name}`));
    process.exit(1);
  }

  console.log(`\n📧 Enviando emails de teste para: ${email}\n`);

  for (const [name, data] of Object.entries(templatesToSend)) {
    try {
      const result = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: `[TESTE] ${data.subject}`,
        html: data.html,
      });

      if (result.error) {
        console.log(`  ❌ ${name}: ${result.error.message}`);
      } else {
        console.log(`  ✓ ${name}: enviado (ID: ${result.data?.id})`);
      }
    } catch (error) {
      console.log(`  ❌ ${name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }

    // Small delay between emails
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('\n✅ Concluído!\n');
}

main();
