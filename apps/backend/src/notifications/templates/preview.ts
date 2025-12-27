/**
 * Email Template Preview Generator
 *
 * Run with: npx ts-node src/notifications/templates/preview.ts
 *
 * Generates HTML preview files for all email templates.
 * Useful for development and testing without sending actual emails.
 */

import * as fs from 'fs';
import * as path from 'path';
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

const sampleQuoteSent = {
  clientName: 'João Silva',
  clientEmail: 'joao@example.com',
  clientPhone: '11999999999',
  quoteId: 'quote-123',
  quoteNumber: '2024001',
  totalValue: 1500.0,
  items: [
    { name: 'Instalação de ar condicionado', quantity: 1, unitPrice: 800 },
    { name: 'Manutenção preventiva', quantity: 2, unitPrice: 350 },
  ],
  quotePublicUrl: 'https://app.auvoautonomo.com/p/quotes/abc123xyz',
};

const sampleQuoteApproved = {
  clientName: 'Maria Santos',
  clientEmail: 'maria@example.com',
  clientPhone: '11988888888',
  quoteId: 'quote-456',
  quoteNumber: '2024002',
  totalValue: 2350.0,
};

const sampleQuoteFollowUp = {
  clientName: 'Carlos Oliveira',
  clientEmail: 'carlos@example.com',
  clientPhone: '11977777777',
  quoteId: 'quote-789',
  quoteNumber: '2024003',
  totalValue: 890.0,
  daysSinceSent: 3,
  quotePublicUrl: 'https://app.auvoautonomo.com/p/quotes/def456uvw',
};

const sampleWorkOrderCreated = {
  clientName: 'Ana Paula',
  clientEmail: 'ana@example.com',
  clientPhone: '11966666666',
  workOrderId: 'wo-123',
  workOrderNumber: 'OS2024001',
  title: 'Manutenção de ar condicionado Split 12000 BTUs',
  scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  scheduledTime: '14:00',
  address: 'Rua das Flores, 123 - Centro - São Paulo/SP',
  workOrderPublicUrl: 'https://app.auvoautonomo.com/os/ghi789rst',
};

const sampleWorkOrderCompleted = {
  clientName: 'Roberto Almeida',
  clientEmail: 'roberto@example.com',
  clientPhone: '11955555555',
  workOrderId: 'wo-456',
  workOrderNumber: 'OS2024002',
  title: 'Instalação de Split Inverter',
  completedAt: new Date().toISOString(),
};

const samplePaymentCreated = {
  clientName: 'Fernanda Costa',
  clientEmail: 'fernanda@example.com',
  clientPhone: '11944444444',
  paymentId: 'pay-123',
  value: 750.0,
  billingType: 'PIX',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  paymentLink: 'https://pay.example.com/abc123',
  pixCode:
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426614174000520400005303986540775.005802BR5913Nome do Loja6008Cidade MG62070503***6304ABCD',
  workOrderNumber: 'OS2024001',
  companyPixKey: '12.345.678/0001-90',
  companyPixKeyType: 'CNPJ',
  companyPixKeyOwnerName: 'Climatização Silva LTDA',
};

const samplePaymentConfirmed = {
  clientName: 'Lucas Pereira',
  clientEmail: 'lucas@example.com',
  clientPhone: '11933333333',
  paymentId: 'pay-456',
  value: 1200.0,
  paidAt: new Date().toISOString(),
  workOrderNumber: 'OS2024003',
};

const samplePaymentOverdue = {
  clientName: 'Patricia Lima',
  clientEmail: 'patricia@example.com',
  clientPhone: '11922222222',
  paymentId: 'pay-789',
  value: 500.0,
  dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  daysOverdue: 5,
  paymentLink: 'https://pay.example.com/xyz789',
  workOrderNumber: 'OS2024004',
  companyPixKey: 'empresa@email.com',
  companyPixKeyType: 'EMAIL',
  companyPixKeyOwnerName: 'Empresa de Serviços',
};

const samplePaymentReminderBefore = {
  clientName: 'Marcos Souza',
  clientEmail: 'marcos@example.com',
  clientPhone: '11911111111',
  paymentId: 'pay-abc',
  value: 350.0,
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  daysUntilDue: 2,
  paymentLink: 'https://pay.example.com/reminder1',
  workOrderNumber: 'OS2024005',
  companyPixKey: '11999998888',
  companyPixKeyType: 'PHONE',
};

const samplePaymentReminderAfter = {
  clientName: 'Juliana Ramos',
  clientEmail: 'juliana@example.com',
  clientPhone: '11900000000',
  paymentId: 'pay-def',
  value: 980.0,
  dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  daysOverdue: 10,
  paymentLink: 'https://pay.example.com/reminder2',
  quoteNumber: '2024010',
  companyPixKey: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  companyPixKeyType: 'RANDOM',
  companyPixKeyOwnerName: 'Técnico Autônomo',
};

// =============================================================================
// GENERATE PREVIEWS
// =============================================================================

const templates = [
  {
    name: 'quote-sent',
    title: 'Orçamento Enviado',
    html: quoteSentEmail(sampleQuoteSent),
  },
  {
    name: 'quote-approved',
    title: 'Orçamento Aprovado',
    html: quoteApprovedEmail(sampleQuoteApproved),
  },
  {
    name: 'quote-follow-up',
    title: 'Follow-up de Orçamento',
    html: quoteFollowUpEmail(sampleQuoteFollowUp),
  },
  {
    name: 'work-order-created',
    title: 'OS Criada',
    html: workOrderCreatedEmail(sampleWorkOrderCreated),
  },
  {
    name: 'work-order-completed',
    title: 'OS Concluída',
    html: workOrderCompletedEmail(sampleWorkOrderCompleted),
  },
  {
    name: 'payment-created',
    title: 'Cobrança Criada',
    html: paymentCreatedEmail(samplePaymentCreated),
  },
  {
    name: 'payment-confirmed',
    title: 'Pagamento Confirmado',
    html: paymentConfirmedEmail(samplePaymentConfirmed),
  },
  {
    name: 'payment-overdue',
    title: 'Pagamento em Atraso',
    html: paymentOverdueEmail(samplePaymentOverdue),
  },
  {
    name: 'payment-reminder-before',
    title: 'Lembrete Pré-Vencimento',
    html: paymentReminderBeforeEmail(samplePaymentReminderBefore),
  },
  {
    name: 'payment-reminder-after',
    title: 'Lembrete Pós-Vencimento',
    html: paymentReminderAfterEmail(samplePaymentReminderAfter),
  },
  {
    name: 'password-reset',
    title: 'Redefinir Senha',
    html: passwordResetEmail('usuario@example.com', 'https://app.example.com/reset?token=abc123'),
  },
  {
    name: 'welcome',
    title: 'Boas-vindas',
    html: welcomeEmail('Novo Usuário', 'https://app.example.com/login'),
  },
];

// Create output directory
const outputDir = path.join(__dirname, '..', '..', '..', 'email-previews');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate preview files
console.log('📧 Generating email template previews...\n');

templates.forEach((template) => {
  const filePath = path.join(outputDir, `${template.name}.html`);
  fs.writeFileSync(filePath, template.html);
  console.log(`  ✓ ${template.title} → ${template.name}.html`);
});

// Generate index file
const indexHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template Previews - Auvo Autônomo</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.5;
    }
    header {
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    header h1 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
    }
    header p {
      opacity: 0.9;
      font-size: 0.9rem;
    }
    main {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1rem;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .card h3 {
      font-size: 1rem;
      margin-bottom: 0.5rem;
      color: #1f2937;
    }
    .card a {
      display: inline-block;
      color: #7c3aed;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .card a:hover {
      text-decoration: underline;
    }
    .category {
      margin-bottom: 2rem;
    }
    .category h2 {
      font-size: 1.1rem;
      color: #6b7280;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }
    footer {
      text-align: center;
      padding: 2rem;
      color: #9ca3af;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <header>
    <h1>📧 Email Templates</h1>
    <p>Auvo Autônomo - Preview dos templates de email</p>
  </header>
  <main>
    <div class="category">
      <h2>Orçamentos</h2>
      <div class="grid">
        <div class="card">
          <h3>📋 Orçamento Enviado</h3>
          <a href="quote-sent.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>✅ Orçamento Aprovado</h3>
          <a href="quote-approved.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>🔔 Follow-up de Orçamento</h3>
          <a href="quote-follow-up.html" target="_blank">Visualizar →</a>
        </div>
      </div>
    </div>

    <div class="category">
      <h2>Ordens de Serviço</h2>
      <div class="grid">
        <div class="card">
          <h3>📅 OS Criada/Agendada</h3>
          <a href="work-order-created.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>🎉 OS Concluída</h3>
          <a href="work-order-completed.html" target="_blank">Visualizar →</a>
        </div>
      </div>
    </div>

    <div class="category">
      <h2>Cobranças e Pagamentos</h2>
      <div class="grid">
        <div class="card">
          <h3>💳 Cobrança Criada</h3>
          <a href="payment-created.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>✓ Pagamento Confirmado</h3>
          <a href="payment-confirmed.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>⚠️ Pagamento em Atraso</h3>
          <a href="payment-overdue.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>⏰ Lembrete Pré-Vencimento</h3>
          <a href="payment-reminder-before.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>🚨 Lembrete Pós-Vencimento</h3>
          <a href="payment-reminder-after.html" target="_blank">Visualizar →</a>
        </div>
      </div>
    </div>

    <div class="category">
      <h2>Autenticação</h2>
      <div class="grid">
        <div class="card">
          <h3>🔐 Redefinir Senha</h3>
          <a href="password-reset.html" target="_blank">Visualizar →</a>
        </div>
        <div class="card">
          <h3>👋 Boas-vindas</h3>
          <a href="welcome.html" target="_blank">Visualizar →</a>
        </div>
      </div>
    </div>
  </main>
  <footer>
    Gerado em ${new Date().toLocaleString('pt-BR')}
  </footer>
</body>
</html>
`;

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);
console.log(`\n✓ Index file generated`);

console.log(`\n📂 Preview files saved to: ${outputDir}`);
console.log(`\n💡 Open ${path.join(outputDir, 'index.html')} in your browser to preview all templates.`);
