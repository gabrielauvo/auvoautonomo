/**
 * ChecklistInstanceRepository Tests
 *
 * Testes para operações do repositório de instâncias de checklist.
 */

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { ChecklistInstanceRepository } from '../../../src/modules/checklists/repositories/ChecklistInstanceRepository';
import { ChecklistInstance, ChecklistInstanceStatus } from '../../../src/db/schema';

describe('ChecklistInstanceRepository', () => {
  const technicianId = 'tech-123';

  const mockInstance: ChecklistInstance = {
    id: 'instance-1',
    workOrderId: 'wo-1',
    templateId: 'template-1',
    templateName: 'Test Checklist',
    status: 'PENDING' as ChecklistInstanceStatus,
    progress: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new instance with generated ID', async () => {
      mockInsert.mockResolvedValue(undefined);

      const data = {
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateName: 'Test Checklist',
        status: 'PENDING' as ChecklistInstanceStatus,
        progress: 0,
        technicianId,
      };

      const result = await ChecklistInstanceRepository.create(data);

      expect(mockInsert).toHaveBeenCalledWith('checklist_instances', expect.objectContaining({
        id: 'test-uuid-123',
        workOrderId: 'wo-1',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(result.id).toBe('test-uuid-123');
    });

    it('should use provided ID if given', async () => {
      mockInsert.mockResolvedValue(undefined);

      const data = {
        id: 'custom-id',
        workOrderId: 'wo-1',
        templateId: 'template-1',
        templateName: 'Test Checklist',
        status: 'PENDING' as ChecklistInstanceStatus,
        progress: 0,
        technicianId,
      };

      const result = await ChecklistInstanceRepository.create(data);

      expect(result.id).toBe('custom-id');
    });
  });

  describe('getById', () => {
    it('should return instance by ID', async () => {
      mockFindById.mockResolvedValue(mockInstance);

      const result = await ChecklistInstanceRepository.getById('instance-1');

      expect(mockFindById).toHaveBeenCalledWith('checklist_instances', 'instance-1');
      expect(result).toEqual(mockInstance);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ChecklistInstanceRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByWorkOrder', () => {
    it('should return instances by work order', async () => {
      mockFindAll.mockResolvedValue([mockInstance]);

      const result = await ChecklistInstanceRepository.getByWorkOrder('wo-1');

      expect(mockFindAll).toHaveBeenCalledWith('checklist_instances', {
        where: { workOrderId: 'wo-1' },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockInstance]);
    });
  });

  describe('getByStatus', () => {
    it('should return instances by status', async () => {
      mockFindAll.mockResolvedValue([mockInstance]);

      const result = await ChecklistInstanceRepository.getByStatus(technicianId, 'PENDING');

      expect(mockFindAll).toHaveBeenCalledWith('checklist_instances', {
        where: { technicianId, status: 'PENDING' },
        orderBy: 'updatedAt',
        order: 'DESC',
      });
      expect(result).toEqual([mockInstance]);
    });
  });

  describe('getUnsyncedInstances', () => {
    it('should return unsynced instances', async () => {
      mockRawQuery.mockResolvedValue([mockInstance]);

      const result = await ChecklistInstanceRepository.getUnsyncedInstances(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('syncedAt IS NULL'),
        [technicianId]
      );
      expect(result).toEqual([mockInstance]);
    });
  });

  describe('update', () => {
    it('should update instance with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.update('instance-1', { progress: 50 });

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        progress: 50,
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateStatus', () => {
    it('should update status to PENDING', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateStatus('instance-1', 'PENDING');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        status: 'PENDING',
        updatedAt: expect.any(String),
      });
    });

    it('should set startedAt when status changes to IN_PROGRESS', async () => {
      mockFindById.mockResolvedValue({ ...mockInstance, startedAt: undefined });
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateStatus('instance-1', 'IN_PROGRESS');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        status: 'IN_PROGRESS',
        startedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should not override existing startedAt', async () => {
      mockFindById.mockResolvedValue({ ...mockInstance, startedAt: '2024-01-01T00:00:00.000Z' });
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateStatus('instance-1', 'IN_PROGRESS');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        status: 'IN_PROGRESS',
        updatedAt: expect.any(String),
      });
    });

    it('should set completedAt and progress when COMPLETED', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateStatus('instance-1', 'COMPLETED', 'tech-123');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        status: 'COMPLETED',
        completedAt: expect.any(String),
        completedBy: 'tech-123',
        progress: 100,
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateProgress', () => {
    it('should update progress within bounds', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateProgress('instance-1', 50);

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        progress: 50,
        updatedAt: expect.any(String),
      });
    });

    it('should cap progress at 100', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateProgress('instance-1', 150);

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        progress: 100,
        updatedAt: expect.any(String),
      });
    });

    it('should cap progress at 0', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.updateProgress('instance-1', -50);

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        progress: 0,
        updatedAt: expect.any(String),
      });
    });
  });

  describe('markSynced', () => {
    it('should mark instance as synced', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.markSynced('instance-1');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_instances', 'instance-1', {
        syncedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should handle server ID different from local ID', async () => {
      mockFindById.mockResolvedValue(mockInstance);
      mockInsert.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.markSynced('instance-1', 'server-id-123');

      expect(mockInsert).toHaveBeenCalledWith('checklist_instances', expect.objectContaining({
        id: 'server-id-123',
        syncedAt: expect.any(String),
      }));
      expect(mockRemove).toHaveBeenCalledWith('checklist_instances', 'instance-1');
    });

    it('should not do anything if instance not found with different server ID', async () => {
      mockFindById.mockResolvedValue(null);

      await ChecklistInstanceRepository.markSynced('instance-1', 'server-id-123');

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete instance', async () => {
      mockRemove.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.delete('instance-1');

      expect(mockRemove).toHaveBeenCalledWith('checklist_instances', 'instance-1');
    });
  });

  describe('deleteByWorkOrder', () => {
    it('should delete all instances of a work order', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.deleteByWorkOrder('wo-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM checklist_instances'),
        ['wo-1']
      );
    });
  });

  describe('batchUpsert', () => {
    it('should batch upsert instances', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistInstanceRepository.batchUpsert([mockInstance]);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO checklist_instances'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await ChecklistInstanceRepository.batchUpsert([]);

      expect(mockRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('countByStatus', () => {
    it('should return counts by status', async () => {
      mockRawQuery.mockResolvedValue([
        { status: 'PENDING', count: 2 },
        { status: 'IN_PROGRESS', count: 1 },
        { status: 'COMPLETED', count: 3 },
      ]);

      const result = await ChecklistInstanceRepository.countByStatus('wo-1');

      expect(result).toEqual({
        PENDING: 2,
        IN_PROGRESS: 1,
        COMPLETED: 3,
        CANCELLED: 0,
      });
    });

    it('should return zeros for empty result', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ChecklistInstanceRepository.countByStatus('wo-1');

      expect(result).toEqual({
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      });
    });
  });

  describe('areAllCompleted', () => {
    it('should return true when all are completed', async () => {
      mockRawQuery.mockResolvedValue([
        { status: 'COMPLETED', count: 3 },
      ]);

      const result = await ChecklistInstanceRepository.areAllCompleted('wo-1');

      expect(result).toBe(true);
    });

    it('should return true when all are completed or cancelled', async () => {
      mockRawQuery.mockResolvedValue([
        { status: 'COMPLETED', count: 2 },
        { status: 'CANCELLED', count: 1 },
      ]);

      const result = await ChecklistInstanceRepository.areAllCompleted('wo-1');

      expect(result).toBe(true);
    });

    it('should return false when some are pending', async () => {
      mockRawQuery.mockResolvedValue([
        { status: 'PENDING', count: 1 },
        { status: 'COMPLETED', count: 2 },
      ]);

      const result = await ChecklistInstanceRepository.areAllCompleted('wo-1');

      expect(result).toBe(false);
    });

    it('should return false when some are in progress', async () => {
      mockRawQuery.mockResolvedValue([
        { status: 'IN_PROGRESS', count: 1 },
        { status: 'COMPLETED', count: 2 },
      ]);

      const result = await ChecklistInstanceRepository.areAllCompleted('wo-1');

      expect(result).toBe(false);
    });

    it('should return true when no checklists exist', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ChecklistInstanceRepository.areAllCompleted('wo-1');

      expect(result).toBe(true);
    });
  });
});
