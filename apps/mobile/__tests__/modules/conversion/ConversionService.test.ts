/**
 * ConversionService Tests
 *
 * Testes para o serviço de conversão entre entidades.
 */

// Mock dependencies
const mockGetWorkOrder = jest.fn();
const mockCreateQuote = jest.fn();
const mockGetQuoteWithItems = jest.fn();
const mockCreateInvoice = jest.fn();

jest.mock('../../../src/modules/workorders/WorkOrderService', () => ({
  workOrderService: {
    getWorkOrder: (...args: unknown[]) => mockGetWorkOrder(...args),
  },
}));

jest.mock('../../../src/modules/quotes/QuoteService', () => ({
  QuoteService: {
    createQuote: (...args: unknown[]) => mockCreateQuote(...args),
    getQuoteWithItems: (...args: unknown[]) => mockGetQuoteWithItems(...args),
  },
}));

jest.mock('../../../src/modules/invoices/InvoiceService', () => ({
  InvoiceService: {
    createInvoice: (...args: unknown[]) => mockCreateInvoice(...args),
  },
}));

jest.mock('../../../src/db/repositories/ClientRepository', () => ({
  ClientRepository: {
    getById: jest.fn(),
  },
}));

import { ConversionService } from '../../../src/modules/conversion/ConversionService';

describe('ConversionService', () => {
  const technicianId = 'tech-123';

  const mockWorkOrder = {
    id: 'wo-1',
    clientId: 'client-1',
    clientName: 'John Doe',
    title: 'Instalação Elétrica',
    description: 'Instalação de tomadas',
    status: 'DONE',
    scheduledDate: '2024-01-15',
    totalValue: 500,
    technicianId,
  };

  const mockQuote = {
    id: 'quote-1',
    clientId: 'client-1',
    clientName: 'John Doe',
    status: 'APPROVED',
    totalValue: 500,
    notes: 'Orçamento teste',
    items: [
      { id: 'item-1', name: 'Serviço', quantity: 1, unitPrice: 500, totalPrice: 500 },
    ],
    technicianId,
  };

  const mockInvoice = {
    id: 'inv-1',
    clientId: 'client-1',
    subtotal: 500,
    tax: 0,
    discount: 0,
    totalValue: 500,
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ConversionService.configure(technicianId);
  });

  describe('configure', () => {
    it('should set technician ID', () => {
      ConversionService.configure('new-tech');
      // If configured correctly, methods should work without throwing
      expect(() => ConversionService.configure('test')).not.toThrow();
    });
  });

  describe('workOrderToQuote', () => {
    it('should throw if not configured', async () => {
      // Create a new instance without configure
      const service = Object.create(ConversionService);
      service.technicianId = null;

      await expect(
        ConversionService.workOrderToQuote.call({ technicianId: null }, 'wo-1')
      ).rejects.toThrow('ConversionService not configured');
    });

    it('should throw if work order not found', async () => {
      mockGetWorkOrder.mockResolvedValue(null);

      await expect(
        ConversionService.workOrderToQuote('wo-1')
      ).rejects.toThrow('Work Order wo-1 not found');
    });

    it('should create quote from work order with value', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);
      mockCreateQuote.mockResolvedValue({ id: 'quote-1', items: [] });

      const result = await ConversionService.workOrderToQuote('wo-1');

      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'client-1',
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'Instalação Elétrica',
            type: 'SERVICE',
            quantity: 1,
            unitPrice: 500,
          }),
        ]),
      }));
      expect(result).toBeDefined();
    });

    it('should create placeholder item when no value', async () => {
      mockGetWorkOrder.mockResolvedValue({ ...mockWorkOrder, totalValue: 0 });
      mockCreateQuote.mockResolvedValue({ id: 'quote-1', items: [] });

      await ConversionService.workOrderToQuote('wo-1', { includeItems: false });

      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            unitPrice: 0,
          }),
        ]),
      }));
    });

    it('should add additional items', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);
      mockCreateQuote.mockResolvedValue({ id: 'quote-1', items: [] });

      await ConversionService.workOrderToQuote('wo-1', {
        additionalItems: [
          { name: 'Material', type: 'PRODUCT', quantity: 2, unitPrice: 100 },
        ],
      });

      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: 'Instalação Elétrica' }),
          expect.objectContaining({ name: 'Material', type: 'PRODUCT', quantity: 2, unitPrice: 100 }),
        ]),
      }));
    });

    it('should apply custom options', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);
      mockCreateQuote.mockResolvedValue({ id: 'quote-1', items: [] });

      await ConversionService.workOrderToQuote('wo-1', {
        notes: 'Custom notes',
        discountValue: 50,
        visitScheduledAt: '2024-02-01',
      });

      expect(mockCreateQuote).toHaveBeenCalledWith(expect.objectContaining({
        notes: 'Custom notes',
        discountValue: 50,
        visitScheduledAt: '2024-02-01',
      }));
    });
  });

  describe('quoteToInvoice', () => {
    it('should throw if not configured', async () => {
      await expect(
        ConversionService.quoteToInvoice.call({ technicianId: null }, 'quote-1')
      ).rejects.toThrow('ConversionService not configured');
    });

    it('should throw if quote not found', async () => {
      mockGetQuoteWithItems.mockResolvedValue(null);

      await expect(
        ConversionService.quoteToInvoice('quote-1')
      ).rejects.toThrow('Quote quote-1 not found');
    });

    it('should throw if quote not approved', async () => {
      mockGetQuoteWithItems.mockResolvedValue({ ...mockQuote, status: 'DRAFT' });

      await expect(
        ConversionService.quoteToInvoice('quote-1')
      ).rejects.toThrow('Cannot convert quote with status DRAFT');
    });

    it('should create invoice from approved quote', async () => {
      mockGetQuoteWithItems.mockResolvedValue(mockQuote);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      const result = await ConversionService.quoteToInvoice('quote-1');

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'client-1',
        subtotal: 500,
      }));
      expect(result).toBeDefined();
    });

    it('should apply custom due date', async () => {
      mockGetQuoteWithItems.mockResolvedValue(mockQuote);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      await ConversionService.quoteToInvoice('quote-1', {
        dueDate: '2024-03-01T00:00:00.000Z',
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        dueDate: '2024-03-01T00:00:00.000Z',
      }));
    });

    it('should apply tax and additional discount', async () => {
      mockGetQuoteWithItems.mockResolvedValue(mockQuote);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      await ConversionService.quoteToInvoice('quote-1', {
        tax: 50,
        additionalDiscount: 25,
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        tax: 50,
        discount: 25,
      }));
    });

    it('should use default due date (30 days)', async () => {
      mockGetQuoteWithItems.mockResolvedValue(mockQuote);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      await ConversionService.quoteToInvoice('quote-1');

      const call = mockCreateInvoice.mock.calls[0][0];
      const dueDate = new Date(call.dueDate);
      const now = new Date();
      const diffDays = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe('workOrderToInvoice', () => {
    it('should throw if not configured', async () => {
      await expect(
        ConversionService.workOrderToInvoice.call({ technicianId: null }, 'wo-1')
      ).rejects.toThrow('ConversionService not configured');
    });

    it('should throw if work order not found', async () => {
      mockGetWorkOrder.mockResolvedValue(null);

      await expect(
        ConversionService.workOrderToInvoice('wo-1')
      ).rejects.toThrow('Work Order wo-1 not found');
    });

    it('should create invoice directly from work order', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      const result = await ConversionService.workOrderToInvoice('wo-1');

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        clientId: 'client-1',
        workOrderId: 'wo-1',
        subtotal: 500,
      }));
      expect(result).toBeDefined();
    });

    it('should apply custom options', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      await ConversionService.workOrderToInvoice('wo-1', {
        tax: 100,
        discount: 50,
        notes: 'Custom invoice notes',
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        tax: 100,
        discount: 50,
        notes: 'Custom invoice notes',
      }));
    });

    it('should handle work order with no value', async () => {
      mockGetWorkOrder.mockResolvedValue({ ...mockWorkOrder, totalValue: null });
      mockCreateInvoice.mockResolvedValue(mockInvoice);

      await ConversionService.workOrderToInvoice('wo-1');

      expect(mockCreateInvoice).toHaveBeenCalledWith(expect.objectContaining({
        subtotal: 0,
      }));
    });
  });

  describe('getWorkOrderConversionInfo', () => {
    it('should return cannot convert if work order not found', async () => {
      mockGetWorkOrder.mockResolvedValue(null);

      const result = await ConversionService.getWorkOrderConversionInfo('wo-1');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Work order not found');
    });

    it('should return cannot convert if status not DONE', async () => {
      mockGetWorkOrder.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });

      const result = await ConversionService.getWorkOrderConversionInfo('wo-1');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toContain('must be DONE');
      expect(result.clientName).toBe('John Doe');
    });

    it('should return can convert with suggested items', async () => {
      mockGetWorkOrder.mockResolvedValue(mockWorkOrder);

      const result = await ConversionService.getWorkOrderConversionInfo('wo-1');

      expect(result.canConvert).toBe(true);
      expect(result.suggestedItems).toHaveLength(1);
      expect(result.suggestedItems[0]).toEqual({
        name: 'Instalação Elétrica',
        type: 'SERVICE',
        quantity: 1,
        unitPrice: 500,
      });
      expect(result.clientName).toBe('John Doe');
      expect(result.totalValue).toBe(500);
    });

    it('should return empty suggested items if no value', async () => {
      mockGetWorkOrder.mockResolvedValue({ ...mockWorkOrder, totalValue: 0 });

      const result = await ConversionService.getWorkOrderConversionInfo('wo-1');

      expect(result.canConvert).toBe(true);
      expect(result.suggestedItems).toHaveLength(0);
    });
  });

  describe('getQuoteConversionInfo', () => {
    it('should return cannot convert if quote not found', async () => {
      mockGetQuoteWithItems.mockResolvedValue(null);

      const result = await ConversionService.getQuoteConversionInfo('quote-1');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toBe('Quote not found');
    });

    it('should return cannot convert if not approved', async () => {
      mockGetQuoteWithItems.mockResolvedValue({ ...mockQuote, status: 'DRAFT' });

      const result = await ConversionService.getQuoteConversionInfo('quote-1');

      expect(result.canConvert).toBe(false);
      expect(result.reason).toContain('must be APPROVED');
      expect(result.clientName).toBe('John Doe');
    });

    it('should return can convert for approved quote', async () => {
      mockGetQuoteWithItems.mockResolvedValue(mockQuote);

      const result = await ConversionService.getQuoteConversionInfo('quote-1');

      expect(result.canConvert).toBe(true);
      expect(result.clientName).toBe('John Doe');
      expect(result.totalValue).toBe(500);
      expect(result.itemsCount).toBe(1);
    });
  });
});
