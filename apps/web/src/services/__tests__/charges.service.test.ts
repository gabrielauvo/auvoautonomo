/**
 * Charges Service Tests
 *
 * Testes unitários para o serviço de cobranças
 */

import {
  canEditCharge,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
  isChargeFinalized,
  chargeStatusLabels,
  billingTypeLabels,
  type Charge,
  type ChargeStatus,
  type BillingType,
} from '../charges.service';

// Mock charge factory
function createMockCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: '1',
    userId: 'user-1',
    clientId: 'client-1',
    value: 100,
    billingType: 'PIX',
    status: 'PENDING',
    dueDate: '2024-12-31',
    urls: {},
    client: {
      id: 'client-1',
      name: 'Cliente Teste',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('Charges Service', () => {
  describe('canEditCharge', () => {
    it('should return true for PENDING charges', () => {
      const charge = createMockCharge({ status: 'PENDING' });
      expect(canEditCharge(charge)).toBe(true);
    });

    it('should return false for OVERDUE charges', () => {
      const charge = createMockCharge({ status: 'OVERDUE' });
      expect(canEditCharge(charge)).toBe(false);
    });

    it('should return false for CONFIRMED charges', () => {
      const charge = createMockCharge({ status: 'CONFIRMED' });
      expect(canEditCharge(charge)).toBe(false);
    });

    it('should return false for RECEIVED charges', () => {
      const charge = createMockCharge({ status: 'RECEIVED' });
      expect(canEditCharge(charge)).toBe(false);
    });

    it('should return false for CANCELED charges', () => {
      const charge = createMockCharge({ status: 'CANCELED' });
      expect(canEditCharge(charge)).toBe(false);
    });
  });

  describe('canCancelCharge', () => {
    it('should return true for PENDING charges', () => {
      const charge = createMockCharge({ status: 'PENDING' });
      expect(canCancelCharge(charge)).toBe(true);
    });

    it('should return true for OVERDUE charges', () => {
      const charge = createMockCharge({ status: 'OVERDUE' });
      expect(canCancelCharge(charge)).toBe(true);
    });

    it('should return false for CONFIRMED charges', () => {
      const charge = createMockCharge({ status: 'CONFIRMED' });
      expect(canCancelCharge(charge)).toBe(false);
    });

    it('should return false for RECEIVED charges', () => {
      const charge = createMockCharge({ status: 'RECEIVED' });
      expect(canCancelCharge(charge)).toBe(false);
    });

    it('should return false for CANCELED charges', () => {
      const charge = createMockCharge({ status: 'CANCELED' });
      expect(canCancelCharge(charge)).toBe(false);
    });

    it('should return false for REFUNDED charges', () => {
      const charge = createMockCharge({ status: 'REFUNDED' });
      expect(canCancelCharge(charge)).toBe(false);
    });
  });

  describe('canRegisterManualPayment', () => {
    it('should return true for PENDING charges', () => {
      const charge = createMockCharge({ status: 'PENDING' });
      expect(canRegisterManualPayment(charge)).toBe(true);
    });

    it('should return true for OVERDUE charges', () => {
      const charge = createMockCharge({ status: 'OVERDUE' });
      expect(canRegisterManualPayment(charge)).toBe(true);
    });

    it('should return false for CONFIRMED charges', () => {
      const charge = createMockCharge({ status: 'CONFIRMED' });
      expect(canRegisterManualPayment(charge)).toBe(false);
    });

    it('should return false for RECEIVED charges', () => {
      const charge = createMockCharge({ status: 'RECEIVED' });
      expect(canRegisterManualPayment(charge)).toBe(false);
    });

    it('should return false for RECEIVED_IN_CASH charges', () => {
      const charge = createMockCharge({ status: 'RECEIVED_IN_CASH' });
      expect(canRegisterManualPayment(charge)).toBe(false);
    });
  });

  describe('isChargePaid', () => {
    it('should return true for CONFIRMED status', () => {
      const charge = createMockCharge({ status: 'CONFIRMED' });
      expect(isChargePaid(charge)).toBe(true);
    });

    it('should return true for RECEIVED status', () => {
      const charge = createMockCharge({ status: 'RECEIVED' });
      expect(isChargePaid(charge)).toBe(true);
    });

    it('should return true for RECEIVED_IN_CASH status', () => {
      const charge = createMockCharge({ status: 'RECEIVED_IN_CASH' });
      expect(isChargePaid(charge)).toBe(true);
    });

    it('should return false for PENDING status', () => {
      const charge = createMockCharge({ status: 'PENDING' });
      expect(isChargePaid(charge)).toBe(false);
    });

    it('should return false for OVERDUE status', () => {
      const charge = createMockCharge({ status: 'OVERDUE' });
      expect(isChargePaid(charge)).toBe(false);
    });

    it('should return false for CANCELED status', () => {
      const charge = createMockCharge({ status: 'CANCELED' });
      expect(isChargePaid(charge)).toBe(false);
    });

    it('should return false for REFUNDED status', () => {
      const charge = createMockCharge({ status: 'REFUNDED' });
      expect(isChargePaid(charge)).toBe(false);
    });
  });

  describe('isChargeFinalized', () => {
    it('should return true for CONFIRMED status', () => {
      const charge = createMockCharge({ status: 'CONFIRMED' });
      expect(isChargeFinalized(charge)).toBe(true);
    });

    it('should return true for RECEIVED status', () => {
      const charge = createMockCharge({ status: 'RECEIVED' });
      expect(isChargeFinalized(charge)).toBe(true);
    });

    it('should return true for RECEIVED_IN_CASH status', () => {
      const charge = createMockCharge({ status: 'RECEIVED_IN_CASH' });
      expect(isChargeFinalized(charge)).toBe(true);
    });

    it('should return true for REFUNDED status', () => {
      const charge = createMockCharge({ status: 'REFUNDED' });
      expect(isChargeFinalized(charge)).toBe(true);
    });

    it('should return true for CANCELED status', () => {
      const charge = createMockCharge({ status: 'CANCELED' });
      expect(isChargeFinalized(charge)).toBe(true);
    });

    it('should return false for PENDING status', () => {
      const charge = createMockCharge({ status: 'PENDING' });
      expect(isChargeFinalized(charge)).toBe(false);
    });

    it('should return false for OVERDUE status', () => {
      const charge = createMockCharge({ status: 'OVERDUE' });
      expect(isChargeFinalized(charge)).toBe(false);
    });
  });

  describe('chargeStatusLabels', () => {
    it('should have labels for all statuses', () => {
      const statuses: ChargeStatus[] = [
        'PENDING',
        'OVERDUE',
        'CONFIRMED',
        'RECEIVED',
        'RECEIVED_IN_CASH',
        'REFUNDED',
        'CANCELED',
      ];

      statuses.forEach((status) => {
        expect(chargeStatusLabels[status]).toBeDefined();
        expect(typeof chargeStatusLabels[status]).toBe('string');
        expect(chargeStatusLabels[status].length).toBeGreaterThan(0);
      });
    });

    it('should have correct Portuguese labels', () => {
      expect(chargeStatusLabels.PENDING).toBe('Aguardando');
      expect(chargeStatusLabels.OVERDUE).toBe('Vencida');
      expect(chargeStatusLabels.CONFIRMED).toBe('Confirmada');
      expect(chargeStatusLabels.RECEIVED).toBe('Recebida');
      expect(chargeStatusLabels.RECEIVED_IN_CASH).toBe('Recebida em Dinheiro');
      expect(chargeStatusLabels.REFUNDED).toBe('Estornada');
      expect(chargeStatusLabels.CANCELED).toBe('Cancelada');
    });
  });

  describe('billingTypeLabels', () => {
    it('should have labels for all billing types', () => {
      const types: BillingType[] = ['BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED'];

      types.forEach((type) => {
        expect(billingTypeLabels[type]).toBeDefined();
        expect(typeof billingTypeLabels[type]).toBe('string');
        expect(billingTypeLabels[type].length).toBeGreaterThan(0);
      });
    });

    it('should have correct Portuguese labels', () => {
      expect(billingTypeLabels.BOLETO).toBe('Boleto');
      expect(billingTypeLabels.PIX).toBe('PIX');
      expect(billingTypeLabels.CREDIT_CARD).toBe('Cartão de Crédito');
      expect(billingTypeLabels.UNDEFINED).toBe('Não definido');
    });
  });
});
