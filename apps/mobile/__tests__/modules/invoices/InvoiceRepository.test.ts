/**
 * InvoiceRepository Tests
 *
 * Testes para operações do repositório de faturas.
 */

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockCount = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  count: (...args: unknown[]) => mockCount(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { InvoiceRepository } from '../../../src/modules/invoices/InvoiceRepository';
import { Invoice, InvoiceStatus } from '../../../src/db/schema';

describe('InvoiceRepository', () => {
  const technicianId = 'tech-123';

  const mockInvoice: Invoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV-2024-0001',
    clientId: 'client-1',
    workOrderId: 'wo-1',
    clientName: 'John Doe',
    clientPhone: '1234567890',
    clientEmail: 'john@example.com',
    clientAddress: '123 Main St',
    status: 'PENDING' as InvoiceStatus,
    total: 1000,
    dueDate: '2024-02-01',
    notes: 'Test notes',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all invoices for a technician', async () => {
      mockFindAll.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.getAll(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('invoices', {
        where: { technicianId },
        orderBy: 'updatedAt',
        order: 'DESC',
      });
      expect(result).toEqual([mockInvoice]);
    });

    it('should pass additional options', async () => {
      mockFindAll.mockResolvedValue([]);

      await InvoiceRepository.getAll(technicianId, { limit: 10, offset: 5 });

      expect(mockFindAll).toHaveBeenCalledWith('invoices', {
        where: { technicianId },
        orderBy: 'updatedAt',
        order: 'DESC',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getById', () => {
    it('should return invoice by ID', async () => {
      mockFindById.mockResolvedValue(mockInvoice);

      const result = await InvoiceRepository.getById('invoice-1');

      expect(mockFindById).toHaveBeenCalledWith('invoices', 'invoice-1');
      expect(result).toEqual(mockInvoice);
    });

    it('should return null if invoice not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await InvoiceRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByNumber', () => {
    it('should return invoice by number', async () => {
      mockFindOne.mockResolvedValue(mockInvoice);

      const result = await InvoiceRepository.getByNumber('INV-2024-0001', technicianId);

      expect(mockFindOne).toHaveBeenCalledWith('invoices', {
        invoiceNumber: 'INV-2024-0001',
        technicianId,
      });
      expect(result).toEqual(mockInvoice);
    });

    it('should return null if invoice not found', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await InvoiceRepository.getByNumber('non-existent', technicianId);

      expect(result).toBeNull();
    });
  });

  describe('getByClient', () => {
    it('should return invoices by client', async () => {
      mockFindAll.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.getByClient('client-1', technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('invoices', {
        where: { clientId: 'client-1', technicianId },
        orderBy: 'dueDate',
        order: 'DESC',
      });
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('getByWorkOrder', () => {
    it('should return invoice by work order', async () => {
      mockFindOne.mockResolvedValue(mockInvoice);

      const result = await InvoiceRepository.getByWorkOrder('wo-1');

      expect(mockFindOne).toHaveBeenCalledWith('invoices', { workOrderId: 'wo-1' });
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('getByStatus', () => {
    it('should return invoices by status', async () => {
      mockFindAll.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.getByStatus(technicianId, 'PENDING');

      expect(mockFindAll).toHaveBeenCalledWith('invoices', {
        where: { technicianId, status: 'PENDING' },
        orderBy: 'dueDate',
        order: 'ASC',
      });
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('getOverdue', () => {
    it('should return overdue invoices', async () => {
      mockRawQuery.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.getOverdue(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'PENDING'"),
        expect.arrayContaining([technicianId])
      );
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('getDueSoon', () => {
    it('should return invoices due soon', async () => {
      mockRawQuery.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.getDueSoon(technicianId, 7);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('dueDate >= ? AND dueDate <= ?'),
        expect.arrayContaining([technicianId])
      );
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('getPaginated', () => {
    it('should return paginated invoices', async () => {
      mockFindAll.mockResolvedValue([mockInvoice]);
      mockCount.mockResolvedValue(100);

      const result = await InvoiceRepository.getPaginated(technicianId, 1, 50);

      expect(mockFindAll).toHaveBeenCalledWith('invoices', {
        where: { technicianId },
        orderBy: 'dueDate',
        order: 'DESC',
        limit: 50,
        offset: 0,
      });
      expect(result).toEqual({
        data: [mockInvoice],
        total: 100,
        pages: 2,
      });
    });

    it('should filter by status', async () => {
      mockFindAll.mockResolvedValue([mockInvoice]);
      mockCount.mockResolvedValue(50);

      await InvoiceRepository.getPaginated(technicianId, 1, 50, 'PENDING');

      expect(mockFindAll).toHaveBeenCalledWith('invoices', expect.objectContaining({
        where: { technicianId, status: 'PENDING' },
      }));
    });

    it('should calculate correct offset for page 2', async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      await InvoiceRepository.getPaginated(technicianId, 2, 50);

      expect(mockFindAll).toHaveBeenCalledWith('invoices', expect.objectContaining({
        offset: 50,
      }));
    });
  });

  describe('search', () => {
    it('should search invoices by query', async () => {
      mockRawQuery.mockResolvedValue([mockInvoice]);

      const result = await InvoiceRepository.search(technicianId, 'John');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('invoiceNumber LIKE'),
        [technicianId, '%John%', '%John%', '%John%', 50]
      );
      expect(result).toEqual([mockInvoice]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);

      await InvoiceRepository.search(technicianId, 'test', 10);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        [technicianId, '%test%', '%test%', '%test%', 10]
      );
    });
  });

  describe('create', () => {
    it('should create a new invoice with timestamps', async () => {
      mockInsert.mockResolvedValue(undefined);

      const newInvoice = { ...mockInvoice };
      delete (newInvoice as Partial<Invoice>).createdAt;
      delete (newInvoice as Partial<Invoice>).updatedAt;

      await InvoiceRepository.create(newInvoice);

      expect(mockInsert).toHaveBeenCalledWith('invoices', expect.objectContaining({
        id: mockInvoice.id,
        invoiceNumber: mockInvoice.invoiceNumber,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });
  });

  describe('update', () => {
    it('should update invoice with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.update('invoice-1', { notes: 'Updated notes' });

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        notes: 'Updated notes',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update invoice status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.updateStatus('invoice-1', 'OVERDUE');

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        status: 'OVERDUE',
        updatedAt: expect.any(String),
      });
    });

    it('should set paidDate when status is PAID', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.updateStatus('invoice-1', 'PAID');

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        status: 'PAID',
        updatedAt: expect.any(String),
        paidDate: expect.any(String),
      });
    });
  });

  describe('markAsPaid', () => {
    it('should mark invoice as paid with current date', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.markAsPaid('invoice-1');

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        status: 'PAID',
        paidDate: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should mark invoice as paid with custom date', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.markAsPaid('invoice-1', '2024-01-15T00:00:00.000Z');

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        status: 'PAID',
        paidDate: '2024-01-15T00:00:00.000Z',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('delete', () => {
    it('should delete invoice', async () => {
      mockRemove.mockResolvedValue(undefined);

      await InvoiceRepository.delete('invoice-1');

      expect(mockRemove).toHaveBeenCalledWith('invoices', 'invoice-1');
    });
  });

  describe('count', () => {
    it('should return count of invoices', async () => {
      mockCount.mockResolvedValue(42);

      const result = await InvoiceRepository.count(technicianId);

      expect(mockCount).toHaveBeenCalledWith('invoices', { technicianId });
      expect(result).toBe(42);
    });

    it('should return count with status filter', async () => {
      mockCount.mockResolvedValue(10);

      const result = await InvoiceRepository.count(technicianId, 'PENDING');

      expect(mockCount).toHaveBeenCalledWith('invoices', { technicianId, status: 'PENDING' });
      expect(result).toBe(10);
    });
  });

  describe('getFinancialSummary', () => {
    it('should return financial summary', async () => {
      mockRawQuery
        .mockResolvedValueOnce([{ total: 5000, count: 5 }])  // pending
        .mockResolvedValueOnce([{ total: 10000, count: 10 }]) // paid
        .mockResolvedValueOnce([{ total: 2000, count: 2 }]);  // overdue

      const result = await InvoiceRepository.getFinancialSummary(technicianId);

      expect(result).toEqual({
        totalPending: 5000,
        totalPaid: 10000,
        totalOverdue: 2000,
        countPending: 5,
        countPaid: 10,
        countOverdue: 2,
      });
    });

    it('should handle empty results', async () => {
      mockRawQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await InvoiceRepository.getFinancialSummary(technicianId);

      expect(result).toEqual({
        totalPending: 0,
        totalPaid: 0,
        totalOverdue: 0,
        countPending: 0,
        countPaid: 0,
        countOverdue: 0,
      });
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate first invoice number of the year', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await InvoiceRepository.generateInvoiceNumber(technicianId);

      const year = new Date().getFullYear();
      expect(result).toBe(`INV-${year}-0001`);
    });

    it('should increment from last invoice number', async () => {
      const year = new Date().getFullYear();
      mockRawQuery.mockResolvedValue([{ invoiceNumber: `INV-${year}-0042` }]);

      const result = await InvoiceRepository.generateInvoiceNumber(technicianId);

      expect(result).toBe(`INV-${year}-0043`);
    });
  });

  describe('getModifiedAfter', () => {
    it('should return invoices modified after date', async () => {
      mockRawQuery.mockResolvedValue([mockInvoice]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      const result = await InvoiceRepository.getModifiedAfter(technicianId, afterDate);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('updatedAt > ?'),
        [technicianId, afterDate, 100]
      );
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('batchUpsert', () => {
    it('should insert new invoices', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await InvoiceRepository.batchUpsert([mockInvoice]);

      expect(mockInsert).toHaveBeenCalledWith('invoices', expect.objectContaining({
        id: mockInvoice.id,
        syncedAt: expect.any(String),
      }));
    });

    it('should update existing invoices', async () => {
      mockFindById.mockResolvedValue(mockInvoice);
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.batchUpsert([mockInvoice]);

      expect(mockUpdate).toHaveBeenCalledWith('invoices', mockInvoice.id, expect.objectContaining({
        syncedAt: expect.any(String),
      }));
    });

    it('should do nothing for empty array', async () => {
      await InvoiceRepository.batchUpsert([]);

      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('markSynced', () => {
    it('should update syncedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await InvoiceRepository.markSynced('invoice-1');

      expect(mockUpdate).toHaveBeenCalledWith('invoices', 'invoice-1', {
        syncedAt: expect.any(String),
      });
    });
  });

  describe('updateOverdueStatus', () => {
    it('should update overdue invoices', async () => {
      mockRawQuery.mockResolvedValue([{}, {}]); // 2 records updated

      const result = await InvoiceRepository.updateOverdueStatus(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'OVERDUE'"),
        expect.any(Array)
      );
      expect(result).toBe(2);
    });
  });
});
