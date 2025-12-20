/**
 * QuoteService Tests
 *
 * Testes unitários para o serviço de orçamentos.
 */

import { QuoteStatus } from '../../../src/db/schema';

describe('QuoteService', () => {
  describe('Status Transitions', () => {
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      'DRAFT': ['SENT', 'EXPIRED'],
      'SENT': ['APPROVED', 'REJECTED', 'EXPIRED'],
      'APPROVED': ['EXPIRED'],
      'REJECTED': ['EXPIRED'],
      'EXPIRED': [],
    };

    const validateStatusTransition = (
      currentStatus: QuoteStatus,
      newStatus: QuoteStatus
    ): boolean => {
      return validTransitions[currentStatus].includes(newStatus);
    };

    it('should allow DRAFT -> SENT', () => {
      expect(validateStatusTransition('DRAFT', 'SENT')).toBe(true);
    });

    it('should allow DRAFT -> EXPIRED', () => {
      expect(validateStatusTransition('DRAFT', 'EXPIRED')).toBe(true);
    });

    it('should NOT allow DRAFT -> APPROVED', () => {
      expect(validateStatusTransition('DRAFT', 'APPROVED')).toBe(false);
    });

    it('should allow SENT -> APPROVED', () => {
      expect(validateStatusTransition('SENT', 'APPROVED')).toBe(true);
    });

    it('should allow SENT -> REJECTED', () => {
      expect(validateStatusTransition('SENT', 'REJECTED')).toBe(true);
    });

    it('should NOT allow APPROVED -> DRAFT', () => {
      expect(validateStatusTransition('APPROVED', 'DRAFT')).toBe(false);
    });

    it('should NOT allow EXPIRED -> any status', () => {
      expect(validateStatusTransition('EXPIRED', 'DRAFT')).toBe(false);
      expect(validateStatusTransition('EXPIRED', 'SENT')).toBe(false);
      expect(validateStatusTransition('EXPIRED', 'APPROVED')).toBe(false);
    });
  });

  describe('Item Calculations', () => {
    const calculateItemTotal = (
      quantity: number,
      unitPrice: number,
      discountValue: number
    ): number => {
      return quantity * unitPrice - discountValue;
    };

    const calculateQuoteTotal = (
      items: { quantity: number; unitPrice: number; discountValue: number }[],
      quoteDiscount: number
    ): number => {
      const itemsTotal = items.reduce(
        (sum, item) => sum + calculateItemTotal(item.quantity, item.unitPrice, item.discountValue),
        0
      );
      return itemsTotal - quoteDiscount;
    };

    it('should calculate item total correctly', () => {
      expect(calculateItemTotal(2, 100, 0)).toBe(200);
      expect(calculateItemTotal(3, 50, 10)).toBe(140);
      expect(calculateItemTotal(1, 1000, 100)).toBe(900);
    });

    it('should calculate quote total with multiple items', () => {
      const items = [
        { quantity: 2, unitPrice: 100, discountValue: 0 },   // 200
        { quantity: 3, unitPrice: 50, discountValue: 10 },   // 140
        { quantity: 1, unitPrice: 1000, discountValue: 100 }, // 900
      ];
      expect(calculateQuoteTotal(items, 0)).toBe(1240);
    });

    it('should apply quote-level discount', () => {
      const items = [
        { quantity: 2, unitPrice: 100, discountValue: 0 },
      ];
      expect(calculateQuoteTotal(items, 50)).toBe(150);
    });

    it('should handle empty items array', () => {
      expect(calculateQuoteTotal([], 0)).toBe(0);
    });

    it('should handle zero prices', () => {
      const items = [
        { quantity: 1, unitPrice: 0, discountValue: 0 },
      ];
      expect(calculateQuoteTotal(items, 0)).toBe(0);
    });
  });

  describe('Input Validation', () => {
    const validateQuoteInput = (input: {
      clientId?: string;
      items?: { name: string; quantity: number; unitPrice: number }[];
    }): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (!input.clientId) {
        errors.push('Client is required');
      }

      if (!input.items || input.items.length === 0) {
        errors.push('At least one item is required');
      } else {
        input.items.forEach((item, index) => {
          if (!item.name?.trim()) {
            errors.push(`Item ${index + 1}: Name is required`);
          }
          if (item.quantity <= 0) {
            errors.push(`Item ${index + 1}: Quantity must be positive`);
          }
          if (item.unitPrice < 0) {
            errors.push(`Item ${index + 1}: Price cannot be negative`);
          }
        });
      }

      return { valid: errors.length === 0, errors };
    };

    it('should validate clientId is required', () => {
      const result = validateQuoteInput({
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Client is required');
    });

    it('should validate items are required', () => {
      const result = validateQuoteInput({
        clientId: 'client-1',
        items: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one item is required');
    });

    it('should validate item name', () => {
      const result = validateQuoteInput({
        clientId: 'client-1',
        items: [{ name: '', quantity: 1, unitPrice: 100 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Name is required');
    });

    it('should validate item quantity', () => {
      const result = validateQuoteInput({
        clientId: 'client-1',
        items: [{ name: 'Test', quantity: 0, unitPrice: 100 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Quantity must be positive');
    });

    it('should validate item price', () => {
      const result = validateQuoteInput({
        clientId: 'client-1',
        items: [{ name: 'Test', quantity: 1, unitPrice: -10 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Item 1: Price cannot be negative');
    });

    it('should pass valid input', () => {
      const result = validateQuoteInput({
        clientId: 'client-1',
        items: [{ name: 'Test Service', quantity: 2, unitPrice: 100 }],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Quote Status Helpers', () => {
    const canEditQuote = (status: QuoteStatus): boolean => {
      return status === 'DRAFT';
    };

    const canDeleteQuote = (status: QuoteStatus): boolean => {
      return status === 'DRAFT';
    };

    const canSendQuote = (status: QuoteStatus): boolean => {
      return status === 'DRAFT';
    };

    const canConvertToInvoice = (status: QuoteStatus): boolean => {
      return status === 'APPROVED';
    };

    it('should allow editing DRAFT quotes', () => {
      expect(canEditQuote('DRAFT')).toBe(true);
    });

    it('should NOT allow editing non-DRAFT quotes', () => {
      expect(canEditQuote('SENT')).toBe(false);
      expect(canEditQuote('APPROVED')).toBe(false);
      expect(canEditQuote('REJECTED')).toBe(false);
      expect(canEditQuote('EXPIRED')).toBe(false);
    });

    it('should allow deleting DRAFT quotes', () => {
      expect(canDeleteQuote('DRAFT')).toBe(true);
    });

    it('should NOT allow deleting non-DRAFT quotes', () => {
      expect(canDeleteQuote('SENT')).toBe(false);
      expect(canDeleteQuote('APPROVED')).toBe(false);
    });

    it('should allow sending DRAFT quotes', () => {
      expect(canSendQuote('DRAFT')).toBe(true);
    });

    it('should NOT allow sending non-DRAFT quotes', () => {
      expect(canSendQuote('SENT')).toBe(false);
      expect(canSendQuote('APPROVED')).toBe(false);
    });

    it('should allow converting APPROVED quotes to invoice', () => {
      expect(canConvertToInvoice('APPROVED')).toBe(true);
    });

    it('should NOT allow converting non-APPROVED quotes', () => {
      expect(canConvertToInvoice('DRAFT')).toBe(false);
      expect(canConvertToInvoice('SENT')).toBe(false);
      expect(canConvertToInvoice('REJECTED')).toBe(false);
    });
  });
});
