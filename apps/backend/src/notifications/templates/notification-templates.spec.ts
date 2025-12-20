import { NotificationType } from '@prisma/client';
import {
  renderTemplate,
  formatCurrency,
  formatDate,
  renderQuoteSent,
  renderQuoteApproved,
  renderWorkOrderCreated,
  renderWorkOrderCompleted,
  renderPaymentCreated,
  renderPaymentConfirmed,
  renderPaymentOverdue,
} from './notification-templates';
import {
  QuoteSentContext,
  QuoteApprovedContext,
  WorkOrderCreatedContext,
  WorkOrderCompletedContext,
  PaymentCreatedContext,
  PaymentConfirmedContext,
  PaymentOverdueContext,
} from '../notifications.types';

describe('Notification Templates', () => {
  describe('formatCurrency', () => {
    it('should format currency in BRL', () => {
      expect(formatCurrency(1000)).toContain('1.000,00');
      expect(formatCurrency(1000)).toContain('R$');
    });

    it('should format decimal values', () => {
      expect(formatCurrency(1234.56)).toContain('1.234,56');
    });
  });

  describe('formatDate', () => {
    it('should format date in pt-BR format (dd/mm/yyyy)', () => {
      const result = formatDate('2024-01-15');
      // Check format matches dd/mm/yyyy pattern
      expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(result).toContain('2024');
    });
  });

  describe('renderQuoteSent', () => {
    const ctx: QuoteSentContext = {
      clientName: 'João Silva',
      clientEmail: 'joao@test.com',
      clientPhone: '11999999999',
      quoteId: 'quote-123',
      quoteNumber: 'ABCD1234',
      totalValue: 1500.50,
    };

    it('should render quote sent template', () => {
      const result = renderQuoteSent(ctx);

      expect(result.subject).toContain('ABCD1234');
      expect(result.subject).toContain('R$');
      expect(result.body).toContain('João Silva');
      expect(result.body).toContain('ABCD1234');
      expect(result.htmlBody).toContain('ABCD1234');
      expect(result.htmlBody).toContain('7C3AED'); // Auvo purple
    });
  });

  describe('renderQuoteApproved', () => {
    const ctx: QuoteApprovedContext = {
      clientName: 'Maria Costa',
      quoteId: 'quote-456',
      quoteNumber: 'EFGH5678',
      totalValue: 2000,
    };

    it('should render quote approved template', () => {
      const result = renderQuoteApproved(ctx);

      expect(result.subject).toContain('Aprovado');
      expect(result.body).toContain('Maria Costa');
      expect(result.body).toContain('EFGH5678');
      expect(result.htmlBody).toContain('10B981'); // Green success color
    });
  });

  describe('renderWorkOrderCreated', () => {
    const ctx: WorkOrderCreatedContext = {
      clientName: 'Pedro Alves',
      workOrderId: 'wo-123',
      workOrderNumber: 'WO123456',
      title: 'Manutenção Ar Condicionado',
      scheduledDate: '2024-02-20',
      scheduledTime: '14:30',
      address: 'Rua das Flores, 123',
    };

    it('should render work order created template with all info', () => {
      const result = renderWorkOrderCreated(ctx);

      expect(result.subject).toContain('WO123456');
      expect(result.body).toContain('Pedro Alves');
      expect(result.body).toContain('Manutenção Ar Condicionado');
      expect(result.body).toMatch(/\d{2}\/02\/2024/); // Date in February 2024
      expect(result.body).toContain('14:30');
      expect(result.body).toContain('Rua das Flores, 123');
    });

    it('should render without optional fields', () => {
      const minCtx: WorkOrderCreatedContext = {
        clientName: 'Ana Santos',
        workOrderId: 'wo-456',
        workOrderNumber: 'WO789',
        title: 'Instalação',
      };

      const result = renderWorkOrderCreated(minCtx);

      expect(result.body).toContain('Ana Santos');
      expect(result.body).toContain('Instalação');
      expect(result.body).not.toContain('Data agendada');
      expect(result.body).not.toContain('Endereço');
    });
  });

  describe('renderWorkOrderCompleted', () => {
    const ctx: WorkOrderCompletedContext = {
      clientName: 'Carlos Ferreira',
      workOrderId: 'wo-789',
      workOrderNumber: 'WO999',
      title: 'Revisão Equipamento',
      completedAt: '2024-02-21',
    };

    it('should render work order completed template', () => {
      const result = renderWorkOrderCompleted(ctx);

      expect(result.subject).toContain('Concluído');
      expect(result.subject).toContain('WO999');
      expect(result.body).toContain('Carlos Ferreira');
      expect(result.body).toContain('Revisão Equipamento');
    });
  });

  describe('renderPaymentCreated', () => {
    const ctx: PaymentCreatedContext = {
      clientName: 'Lucia Mendes',
      paymentId: 'pay-123',
      value: 500,
      billingType: 'PIX',
      dueDate: '2024-03-01',
      paymentLink: 'https://payment.link/xyz',
      pixCode: 'PIX123CODE456',
      workOrderNumber: 'WO111',
    };

    it('should render payment created template with all info', () => {
      const result = renderPaymentCreated(ctx);

      expect(result.subject).toContain('500');
      expect(result.subject).toMatch(/\d{2}\/\d{2}\/2024/); // Date in 2024
      expect(result.body).toContain('Lucia Mendes');
      expect(result.body).toContain('PIX');
      expect(result.body).toContain('payment.link/xyz');
      expect(result.body).toContain('PIX123CODE456');
      expect(result.body).toContain('WO111');
    });

    it('should render with quote reference instead of work order', () => {
      const quoteCtx: PaymentCreatedContext = {
        clientName: 'Lucia Mendes',
        paymentId: 'pay-456',
        value: 1000,
        billingType: 'Boleto',
        dueDate: '2024-03-15',
        quoteNumber: 'QT222',
      };

      const result = renderPaymentCreated(quoteCtx);

      expect(result.body).toContain('QT222');
      expect(result.body).not.toContain('OS #');
    });
  });

  describe('renderPaymentConfirmed', () => {
    const ctx: PaymentConfirmedContext = {
      clientName: 'Roberto Lima',
      paymentId: 'pay-789',
      value: 750,
      paidAt: '2024-02-25',
      workOrderNumber: 'WO333',
    };

    it('should render payment confirmed template', () => {
      const result = renderPaymentConfirmed(ctx);

      expect(result.subject).toContain('Pagamento Recebido');
      expect(result.body).toContain('Roberto Lima');
      expect(result.body).toContain('750');
      expect(result.body).toMatch(/\d{2}\/02\/2024/); // Date in February 2024
      expect(result.htmlBody).toContain('D1FAE5'); // Light green background
    });
  });

  describe('renderPaymentOverdue', () => {
    const ctx: PaymentOverdueContext = {
      clientName: 'Fernanda Costa',
      paymentId: 'pay-overdue',
      value: 250,
      dueDate: '2024-02-10',
      daysOverdue: 15,
      paymentLink: 'https://payment.link/overdue',
      workOrderNumber: 'WO444',
    };

    it('should render payment overdue template', () => {
      const result = renderPaymentOverdue(ctx);

      expect(result.subject).toContain('Pendente');
      expect(result.subject).toContain('15 dia(s)');
      expect(result.body).toContain('Fernanda Costa');
      expect(result.body).toContain('250');
      expect(result.body).toContain('15');
      expect(result.htmlBody).toContain('EF4444'); // Red error color
      expect(result.htmlBody).toContain('Regularizar');
    });
  });

  describe('renderTemplate', () => {
    it('should route to correct renderer based on type', () => {
      const quoteSentCtx: QuoteSentContext = {
        clientName: 'Test',
        quoteId: 'q1',
        quoteNumber: 'Q001',
        totalValue: 100,
      };

      const result = renderTemplate(NotificationType.QUOTE_SENT, quoteSentCtx);
      expect(result.subject).toContain('Q001');
    });

    it('should throw error for unknown type', () => {
      expect(() => {
        renderTemplate('UNKNOWN' as NotificationType, {} as any);
      }).toThrow('Unknown notification type');
    });
  });
});
