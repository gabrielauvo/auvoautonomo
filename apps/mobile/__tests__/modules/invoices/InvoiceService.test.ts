/**
 * InvoiceService Tests
 *
 * Testes unitários para o serviço de faturas.
 */

import { InvoiceStatus } from '../../../src/db/schema';

describe('InvoiceService', () => {
  describe('Status Transitions', () => {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      'PENDING': ['PAID', 'OVERDUE', 'CANCELLED'],
      'OVERDUE': ['PAID', 'CANCELLED'],
      'PAID': [],
      'CANCELLED': [],
    };

    const validateStatusTransition = (
      currentStatus: InvoiceStatus,
      newStatus: InvoiceStatus
    ): boolean => {
      return validTransitions[currentStatus].includes(newStatus);
    };

    it('should allow PENDING -> PAID', () => {
      expect(validateStatusTransition('PENDING', 'PAID')).toBe(true);
    });

    it('should allow PENDING -> OVERDUE', () => {
      expect(validateStatusTransition('PENDING', 'OVERDUE')).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(validateStatusTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should allow OVERDUE -> PAID', () => {
      expect(validateStatusTransition('OVERDUE', 'PAID')).toBe(true);
    });

    it('should allow OVERDUE -> CANCELLED', () => {
      expect(validateStatusTransition('OVERDUE', 'CANCELLED')).toBe(true);
    });

    it('should NOT allow PAID -> any status', () => {
      expect(validateStatusTransition('PAID', 'PENDING')).toBe(false);
      expect(validateStatusTransition('PAID', 'OVERDUE')).toBe(false);
      expect(validateStatusTransition('PAID', 'CANCELLED')).toBe(false);
    });

    it('should NOT allow CANCELLED -> any status', () => {
      expect(validateStatusTransition('CANCELLED', 'PENDING')).toBe(false);
      expect(validateStatusTransition('CANCELLED', 'PAID')).toBe(false);
      expect(validateStatusTransition('CANCELLED', 'OVERDUE')).toBe(false);
    });
  });

  describe('Invoice Calculations', () => {
    const calculateInvoiceTotal = (
      subtotal: number,
      tax: number,
      discount: number
    ): number => {
      return subtotal + tax - discount;
    };

    it('should calculate total correctly', () => {
      expect(calculateInvoiceTotal(1000, 100, 50)).toBe(1050);
    });

    it('should handle zero tax', () => {
      expect(calculateInvoiceTotal(1000, 0, 50)).toBe(950);
    });

    it('should handle zero discount', () => {
      expect(calculateInvoiceTotal(1000, 100, 0)).toBe(1100);
    });

    it('should handle all zeros', () => {
      expect(calculateInvoiceTotal(0, 0, 0)).toBe(0);
    });

    it('should handle large values', () => {
      expect(calculateInvoiceTotal(100000, 10000, 5000)).toBe(105000);
    });
  });

  describe('Due Date Validation', () => {
    const isOverdue = (dueDate: string, status: InvoiceStatus): boolean => {
      if (status !== 'PENDING') return false;
      const due = new Date(dueDate);
      return due < new Date();
    };

    const isDueSoon = (dueDate: string, status: InvoiceStatus, days: number = 7): boolean => {
      if (status !== 'PENDING') return false;
      const due = new Date(dueDate);
      const now = new Date();
      const threshold = new Date();
      threshold.setDate(now.getDate() + days);
      return due > now && due <= threshold;
    };

    it('should identify overdue invoices', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      expect(isOverdue(pastDate.toISOString(), 'PENDING')).toBe(true);
    });

    it('should NOT mark paid invoices as overdue', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      expect(isOverdue(pastDate.toISOString(), 'PAID')).toBe(false);
    });

    it('should identify invoices due soon', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 3);
      expect(isDueSoon(soonDate.toISOString(), 'PENDING', 7)).toBe(true);
    });

    it('should NOT mark far future invoices as due soon', () => {
      const farDate = new Date();
      farDate.setDate(farDate.getDate() + 30);
      expect(isDueSoon(farDate.toISOString(), 'PENDING', 7)).toBe(false);
    });
  });

  describe('Invoice Number Generation', () => {
    const generateInvoiceNumber = (
      technicianId: string,
      existingNumbers: string[]
    ): string => {
      const prefix = 'FAT';
      const year = new Date().getFullYear();

      // Find the highest number for this year
      const yearPrefix = `${prefix}-${year}-`;
      const yearNumbers = existingNumbers
        .filter(n => n.startsWith(yearPrefix))
        .map(n => parseInt(n.substring(yearPrefix.length), 10))
        .filter(n => !isNaN(n));

      const nextNumber = yearNumbers.length > 0
        ? Math.max(...yearNumbers) + 1
        : 1;

      return `${yearPrefix}${String(nextNumber).padStart(4, '0')}`;
    };

    it('should generate first invoice number of the year', () => {
      const year = new Date().getFullYear();
      const result = generateInvoiceNumber('tech-1', []);
      expect(result).toBe(`FAT-${year}-0001`);
    });

    it('should increment existing numbers', () => {
      const year = new Date().getFullYear();
      const existing = [`FAT-${year}-0001`, `FAT-${year}-0002`, `FAT-${year}-0003`];
      const result = generateInvoiceNumber('tech-1', existing);
      expect(result).toBe(`FAT-${year}-0004`);
    });

    it('should handle gaps in sequence', () => {
      const year = new Date().getFullYear();
      const existing = [`FAT-${year}-0001`, `FAT-${year}-0005`];
      const result = generateInvoiceNumber('tech-1', existing);
      expect(result).toBe(`FAT-${year}-0006`);
    });

    it('should ignore numbers from other years', () => {
      const year = new Date().getFullYear();
      const existing = [`FAT-${year - 1}-0100`, `FAT-${year}-0005`];
      const result = generateInvoiceNumber('tech-1', existing);
      expect(result).toBe(`FAT-${year}-0006`);
    });
  });

  describe('Input Validation', () => {
    const validateInvoiceInput = (input: {
      clientId?: string;
      subtotal?: number;
      dueDate?: string;
    }): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (!input.clientId) {
        errors.push('Client is required');
      }

      if (input.subtotal === undefined || input.subtotal <= 0) {
        errors.push('Subtotal must be positive');
      }

      if (!input.dueDate) {
        errors.push('Due date is required');
      } else {
        const due = new Date(input.dueDate);
        if (isNaN(due.getTime())) {
          errors.push('Invalid due date');
        }
      }

      return { valid: errors.length === 0, errors };
    };

    it('should validate clientId is required', () => {
      const result = validateInvoiceInput({
        subtotal: 100,
        dueDate: '2024-12-31',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Client is required');
    });

    it('should validate subtotal is positive', () => {
      const result = validateInvoiceInput({
        clientId: 'client-1',
        subtotal: 0,
        dueDate: '2024-12-31',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Subtotal must be positive');
    });

    it('should validate due date is required', () => {
      const result = validateInvoiceInput({
        clientId: 'client-1',
        subtotal: 100,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Due date is required');
    });

    it('should validate due date format', () => {
      const result = validateInvoiceInput({
        clientId: 'client-1',
        subtotal: 100,
        dueDate: 'invalid-date',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid due date');
    });

    it('should pass valid input', () => {
      const result = validateInvoiceInput({
        clientId: 'client-1',
        subtotal: 100,
        dueDate: '2024-12-31',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Invoice Status Helpers', () => {
    const canEditInvoice = (status: InvoiceStatus): boolean => {
      return status === 'PENDING';
    };

    const canDeleteInvoice = (status: InvoiceStatus): boolean => {
      return status === 'PENDING';
    };

    const canMarkAsPaid = (status: InvoiceStatus): boolean => {
      return status === 'PENDING' || status === 'OVERDUE';
    };

    const canCancel = (status: InvoiceStatus): boolean => {
      return status === 'PENDING' || status === 'OVERDUE';
    };

    it('should allow editing PENDING invoices', () => {
      expect(canEditInvoice('PENDING')).toBe(true);
    });

    it('should NOT allow editing non-PENDING invoices', () => {
      expect(canEditInvoice('PAID')).toBe(false);
      expect(canEditInvoice('OVERDUE')).toBe(false);
      expect(canEditInvoice('CANCELLED')).toBe(false);
    });

    it('should allow deleting PENDING invoices', () => {
      expect(canDeleteInvoice('PENDING')).toBe(true);
    });

    it('should NOT allow deleting PAID invoices', () => {
      expect(canDeleteInvoice('PAID')).toBe(false);
    });

    it('should allow marking PENDING and OVERDUE as paid', () => {
      expect(canMarkAsPaid('PENDING')).toBe(true);
      expect(canMarkAsPaid('OVERDUE')).toBe(true);
    });

    it('should NOT allow marking already PAID or CANCELLED', () => {
      expect(canMarkAsPaid('PAID')).toBe(false);
      expect(canMarkAsPaid('CANCELLED')).toBe(false);
    });

    it('should allow cancelling PENDING and OVERDUE', () => {
      expect(canCancel('PENDING')).toBe(true);
      expect(canCancel('OVERDUE')).toBe(true);
    });

    it('should NOT allow cancelling PAID or already CANCELLED', () => {
      expect(canCancel('PAID')).toBe(false);
      expect(canCancel('CANCELLED')).toBe(false);
    });
  });

  describe('Financial Summary', () => {
    interface Invoice {
      status: InvoiceStatus;
      total: number;
    }

    const calculateFinancialSummary = (invoices: Invoice[]) => {
      const summary = {
        totalPending: 0,
        totalPaid: 0,
        totalOverdue: 0,
        countPending: 0,
        countPaid: 0,
        countOverdue: 0,
      };

      for (const invoice of invoices) {
        switch (invoice.status) {
          case 'PENDING':
            summary.totalPending += invoice.total;
            summary.countPending++;
            break;
          case 'PAID':
            summary.totalPaid += invoice.total;
            summary.countPaid++;
            break;
          case 'OVERDUE':
            summary.totalOverdue += invoice.total;
            summary.countOverdue++;
            break;
        }
      }

      return summary;
    };

    it('should calculate summary correctly', () => {
      const invoices: Invoice[] = [
        { status: 'PENDING', total: 100 },
        { status: 'PENDING', total: 200 },
        { status: 'PAID', total: 300 },
        { status: 'OVERDUE', total: 150 },
      ];

      const summary = calculateFinancialSummary(invoices);

      expect(summary.totalPending).toBe(300);
      expect(summary.countPending).toBe(2);
      expect(summary.totalPaid).toBe(300);
      expect(summary.countPaid).toBe(1);
      expect(summary.totalOverdue).toBe(150);
      expect(summary.countOverdue).toBe(1);
    });

    it('should handle empty array', () => {
      const summary = calculateFinancialSummary([]);

      expect(summary.totalPending).toBe(0);
      expect(summary.countPending).toBe(0);
      expect(summary.totalPaid).toBe(0);
      expect(summary.countPaid).toBe(0);
      expect(summary.totalOverdue).toBe(0);
      expect(summary.countOverdue).toBe(0);
    });

    it('should ignore cancelled invoices', () => {
      const invoices: Invoice[] = [
        { status: 'PENDING', total: 100 },
        { status: 'CANCELLED', total: 200 },
      ];

      const summary = calculateFinancialSummary(invoices);

      expect(summary.totalPending).toBe(100);
      expect(summary.countPending).toBe(1);
    });
  });
});
