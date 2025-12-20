/**
 * WorkOrderRepository Tests
 *
 * Testes para o repositório de ordens de serviço.
 */

// Mock database
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn((callback) => callback());

const mockDb = {
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  runAsync: mockRunAsync,
  withTransactionAsync: mockWithTransactionAsync,
};

jest.mock('../../../src/db/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));

import { WorkOrderRepository } from '../../../src/modules/workorders/WorkOrderRepository';
import { WorkOrder, WorkOrderStatus } from '../../../src/db/schema';

describe('WorkOrderRepository', () => {
  let repository: WorkOrderRepository;
  const technicianId = 'tech-123';

  const mockWorkOrder: WorkOrder = {
    id: 'wo-1',
    clientId: 'client-1',
    title: 'Test Work Order',
    description: 'Test description',
    status: 'SCHEDULED' as WorkOrderStatus,
    scheduledDate: '2024-01-15',
    scheduledStartTime: '2024-01-15T09:00:00.000Z',
    scheduledEndTime: '2024-01-15T11:00:00.000Z',
    address: '123 Main St',
    notes: 'Test notes',
    isActive: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
    clientName: 'John Doe',
    clientPhone: '1234567890',
    clientAddress: '123 Main St',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new WorkOrderRepository();
  });

  describe('getByDateRange', () => {
    it('should return work orders in date range', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 1 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      const result = await repository.getByDateRange(technicianId, '2024-01-01', '2024-01-31');

      expect(mockGetFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ?'),
        expect.arrayContaining([technicianId])
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should apply pagination', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 100 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      await repository.getByDateRange(technicianId, '2024-01-01', '2024-01-31', {
        limit: 10,
        offset: 20,
      });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ? OFFSET ?'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getByDay', () => {
    it('should return work orders for a specific day', async () => {
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      const result = await repository.getByDay(technicianId, '2024-01-15');

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('technicianId = ?'),
        expect.arrayContaining([technicianId, '2024-01-15'])
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('should return work order by ID', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(mockWorkOrder);

      const result = await repository.getById('wo-1');

      expect(mockGetFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        ['wo-1']
      );
      expect(result).toBeDefined();
      expect(result?.id).toBe('wo-1');
    });

    it('should return null if not found', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);

      const result = await repository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list work orders with default options', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 1 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      const result = await repository.list(technicianId);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 1 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      await repository.list(technicianId, { status: ['SCHEDULED', 'IN_PROGRESS'] });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('status IN'),
        expect.any(Array)
      );
    });

    it('should filter by clientId', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 1 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      await repository.list(technicianId, { clientId: 'client-1' });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('clientId = ?'),
        expect.arrayContaining(['client-1'])
      );
    });

    it('should apply search query', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 1 });
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      await repository.list(technicianId, { searchQuery: 'test' });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIKE'),
        expect.arrayContaining(['%test%'])
      );
    });
  });

  describe('getUpcoming', () => {
    it('should return upcoming work orders', async () => {
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      const result = await repository.getUpcoming(technicianId, 5);

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('status IN'),
        expect.any(Array)
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('countByStatus', () => {
    it('should return counts by status', async () => {
      mockGetAllAsync.mockResolvedValueOnce([
        { status: 'SCHEDULED', count: 5 },
        { status: 'IN_PROGRESS', count: 2 },
        { status: 'DONE', count: 10 },
        { status: 'CANCELED', count: 1 },
      ]);

      const result = await repository.countByStatus(technicianId);

      expect(result.SCHEDULED).toBe(5);
      expect(result.IN_PROGRESS).toBe(2);
      expect(result.DONE).toBe(10);
      expect(result.CANCELED).toBe(1);
    });
  });

  describe('insert', () => {
    it('should insert a new work order', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 1 });

      await repository.insert(mockWorkOrder);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO work_orders'),
        expect.any(Array)
      );
    });
  });

  describe('update', () => {
    it('should update a work order', async () => {
      // First getById call (to check if exists) returns the existing record
      mockGetFirstAsync.mockResolvedValueOnce(mockWorkOrder);
      mockRunAsync.mockResolvedValueOnce({ changes: 1 });
      // Second getById call (after update) returns the updated record
      mockGetFirstAsync.mockResolvedValueOnce({ ...mockWorkOrder, title: 'Updated' });

      const result = await repository.update('wo-1', { title: 'Updated' });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE work_orders SET'),
        expect.any(Array)
      );
      expect(result?.title).toBe('Updated');
    });
  });

  describe('updateStatus', () => {
    it('should update work order status', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 1 });
      mockGetFirstAsync.mockResolvedValueOnce({ ...mockWorkOrder, status: 'IN_PROGRESS' });

      const result = await repository.updateStatus('wo-1', 'IN_PROGRESS', {
        executionStart: '2024-01-15T09:00:00.000Z',
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE work_orders SET'),
        expect.arrayContaining(['IN_PROGRESS'])
      );
      expect(result?.status).toBe('IN_PROGRESS');
    });

    it('should update execution times', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 1 });
      mockGetFirstAsync.mockResolvedValueOnce({ ...mockWorkOrder, status: 'DONE' });

      await repository.updateStatus('wo-1', 'DONE', {
        executionStart: '2024-01-15T09:00:00.000Z',
        executionEnd: '2024-01-15T11:00:00.000Z',
      });

      // When status is DONE, only executionEnd is set (per implementation logic)
      // The implementation uses provided executionEnd or current time
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE work_orders SET'),
        expect.arrayContaining(['DONE', '2024-01-15T11:00:00.000Z', 'wo-1'])
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete a work order', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 1 });

      const result = await repository.softDelete('wo-1');

      expect(mockRunAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if no rows affected', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 0 });

      const result = await repository.softDelete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('upsertBatch', () => {
    it('should batch upsert work orders', async () => {
      mockRunAsync.mockResolvedValue({ changes: 1 });

      await repository.upsertBatch([mockWorkOrder, { ...mockWorkOrder, id: 'wo-2' }]);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await repository.upsertBatch([]);

      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });

  describe('getPendingSync', () => {
    it('should return work orders pending sync', async () => {
      mockGetAllAsync.mockResolvedValueOnce([mockWorkOrder]);

      const result = await repository.getPendingSync(technicianId);

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('syncedAt IS NULL'),
        expect.arrayContaining([technicianId])
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('markAsSynced', () => {
    it('should mark work orders as synced', async () => {
      mockRunAsync.mockResolvedValueOnce({ changes: 2 });

      await repository.markAsSynced(['wo-1', 'wo-2']);

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE work_orders SET syncedAt = ?'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await repository.markAsSynced([]);

      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });
});
