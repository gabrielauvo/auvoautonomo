/**
 * ChecklistAttachmentRepository Tests
 *
 * Testes para operações do repositório de anexos de checklist.
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

import { ChecklistAttachmentRepository } from '../../../src/modules/checklists/repositories/ChecklistAttachmentRepository';
import { ChecklistAttachment, AttachmentSyncStatus } from '../../../src/db/schema';

describe('ChecklistAttachmentRepository', () => {
  const technicianId = 'tech-123';
  const workOrderId = 'wo-1';
  const answerId = 'answer-1';

  const mockAttachment: ChecklistAttachment = {
    id: 'attach-1',
    answerId,
    workOrderId,
    type: 'PHOTO',
    fileName: 'photo.jpg',
    fileSize: 1024000,
    mimeType: 'image/jpeg',
    localPath: '/local/path/photo.jpg',
    remotePath: null,
    thumbnailPath: '/local/path/thumb.jpg',
    base64Data: 'base64data...',
    syncStatus: 'PENDING' as AttachmentSyncStatus,
    uploadAttempts: 0,
    lastUploadError: null,
    localId: 'local-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new attachment with generated IDs', async () => {
      mockInsert.mockResolvedValue(undefined);

      const data = {
        answerId,
        workOrderId,
        type: 'PHOTO' as const,
        fileName: 'photo.jpg',
        fileSize: 1024000,
        mimeType: 'image/jpeg',
        localPath: '/local/path/photo.jpg',
        technicianId,
      };

      const result = await ChecklistAttachmentRepository.create(data);

      expect(mockInsert).toHaveBeenCalledWith('checklist_attachments', expect.objectContaining({
        id: 'test-uuid-123',
        localId: 'test-uuid-123',
        answerId,
        syncStatus: 'PENDING',
        uploadAttempts: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(result.id).toBe('test-uuid-123');
      expect(result.localId).toBe('test-uuid-123');
    });
  });

  describe('getById', () => {
    it('should return attachment by ID', async () => {
      mockFindById.mockResolvedValue(mockAttachment);

      const result = await ChecklistAttachmentRepository.getById('attach-1');

      expect(mockFindById).toHaveBeenCalledWith('checklist_attachments', 'attach-1');
      expect(result).toEqual(mockAttachment);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ChecklistAttachmentRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByLocalId', () => {
    it('should return attachment by localId', async () => {
      mockRawQuery.mockResolvedValue([mockAttachment]);

      const result = await ChecklistAttachmentRepository.getByLocalId('local-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE localId = ?'),
        ['local-1']
      );
      expect(result).toEqual(mockAttachment);
    });

    it('should return null if not found', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ChecklistAttachmentRepository.getByLocalId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByAnswer', () => {
    it('should return attachments by answer', async () => {
      mockFindAll.mockResolvedValue([mockAttachment]);

      const result = await ChecklistAttachmentRepository.getByAnswer(answerId);

      expect(mockFindAll).toHaveBeenCalledWith('checklist_attachments', {
        where: { answerId },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockAttachment]);
    });
  });

  describe('getByWorkOrder', () => {
    it('should return attachments by work order', async () => {
      mockFindAll.mockResolvedValue([mockAttachment]);

      const result = await ChecklistAttachmentRepository.getByWorkOrder(workOrderId);

      expect(mockFindAll).toHaveBeenCalledWith('checklist_attachments', {
        where: { workOrderId },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockAttachment]);
    });
  });

  describe('getPendingUpload', () => {
    it('should return pending upload attachments', async () => {
      mockRawQuery.mockResolvedValue([mockAttachment]);

      const result = await ChecklistAttachmentRepository.getPendingUpload();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus IN ('PENDING', 'FAILED')"),
        [10]
      );
      expect(result).toEqual([mockAttachment]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);

      await ChecklistAttachmentRepository.getPendingUpload(5);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        [5]
      );
    });
  });

  describe('getBySyncStatus', () => {
    it('should return attachments by sync status', async () => {
      mockRawQuery.mockResolvedValue([mockAttachment]);

      const result = await ChecklistAttachmentRepository.getBySyncStatus('PENDING');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('syncStatus = ?'),
        ['PENDING']
      );
      expect(result).toEqual([mockAttachment]);
    });

    it('should filter by technician when provided', async () => {
      mockRawQuery.mockResolvedValue([]);

      await ChecklistAttachmentRepository.getBySyncStatus('SYNCED', technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('syncStatus = ? AND technicianId = ?'),
        ['SYNCED', technicianId]
      );
    });
  });

  describe('update', () => {
    it('should update attachment with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.update('attach-1', { fileName: 'new.jpg' });

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', {
        fileName: 'new.jpg',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateSyncStatus', () => {
    it('should update sync status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.updateSyncStatus('attach-1', 'UPLOADING');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        syncStatus: 'UPLOADING',
      }));
    });

    it('should set error on FAILED status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.updateSyncStatus('attach-1', 'FAILED', 'Network error');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        syncStatus: 'FAILED',
        lastUploadError: 'Network error',
      }));
    });

    it('should set syncedAt on SYNCED status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.updateSyncStatus('attach-1', 'SYNCED');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        syncStatus: 'SYNCED',
        syncedAt: expect.any(String),
      }));
    });
  });

  describe('incrementUploadAttempts', () => {
    it('should increment upload attempts', async () => {
      mockFindById.mockResolvedValue(mockAttachment);
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.incrementUploadAttempts('attach-1', 'Timeout');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        uploadAttempts: 1,
        lastUploadError: 'Timeout',
        syncStatus: 'FAILED',
      }));
    });

    it('should do nothing if attachment not found', async () => {
      mockFindById.mockResolvedValue(null);

      await ChecklistAttachmentRepository.incrementUploadAttempts('non-existent');

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('markUploading', () => {
    it('should mark as uploading', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.markUploading('attach-1');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        syncStatus: 'UPLOADING',
      }));
    });
  });

  describe('markSynced', () => {
    it('should mark as synced and clear base64', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.markSynced('attach-1', 'https://cdn.example.com/photo.jpg');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_attachments', 'attach-1', expect.objectContaining({
        remotePath: 'https://cdn.example.com/photo.jpg',
        syncStatus: 'SYNCED',
        syncedAt: expect.any(String),
        base64Data: undefined,
      }));
    });
  });

  describe('delete', () => {
    it('should delete attachment', async () => {
      mockRemove.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.delete('attach-1');

      expect(mockRemove).toHaveBeenCalledWith('checklist_attachments', 'attach-1');
    });
  });

  describe('deleteByAnswer', () => {
    it('should delete attachments by answer', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.deleteByAnswer(answerId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        'DELETE FROM checklist_attachments WHERE answerId = ?',
        [answerId]
      );
    });
  });

  describe('deleteByWorkOrder', () => {
    it('should delete attachments by work order', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.deleteByWorkOrder(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        'DELETE FROM checklist_attachments WHERE workOrderId = ?',
        [workOrderId]
      );
    });
  });

  describe('batchUpsert', () => {
    it('should batch upsert attachments', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAttachmentRepository.batchUpsert([mockAttachment]);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO checklist_attachments'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await ChecklistAttachmentRepository.batchUpsert([]);

      expect(mockRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('countBySyncStatus', () => {
    it('should return counts by sync status', async () => {
      mockRawQuery.mockResolvedValue([
        { syncStatus: 'PENDING', count: 5 },
        { syncStatus: 'SYNCED', count: 10 },
      ]);

      const result = await ChecklistAttachmentRepository.countBySyncStatus();

      expect(result).toEqual({
        PENDING: 5,
        UPLOADING: 0,
        SYNCED: 10,
        FAILED: 0,
      });
    });

    it('should filter by work order when provided', async () => {
      mockRawQuery.mockResolvedValue([]);

      await ChecklistAttachmentRepository.countBySyncStatus(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE workOrderId = ?'),
        [workOrderId]
      );
    });
  });

  describe('countPendingUpload', () => {
    it('should return count of pending uploads', async () => {
      mockRawQuery.mockResolvedValue([{ count: 15 }]);

      const result = await ChecklistAttachmentRepository.countPendingUpload();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus IN ('PENDING', 'FAILED')"),
        []
      );
      expect(result).toBe(15);
    });

    it('should filter by technician when provided', async () => {
      mockRawQuery.mockResolvedValue([{ count: 5 }]);

      const result = await ChecklistAttachmentRepository.countPendingUpload(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('technicianId = ?'),
        [technicianId]
      );
      expect(result).toBe(5);
    });

    it('should return 0 when no results', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ChecklistAttachmentRepository.countPendingUpload();

      expect(result).toBe(0);
    });
  });

  describe('countPendingUploadByWorkOrder', () => {
    it('should return count by work order', async () => {
      mockRawQuery.mockResolvedValue([{ count: 3 }]);

      const result = await ChecklistAttachmentRepository.countPendingUploadByWorkOrder(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('workOrderId = ?'),
        [workOrderId]
      );
      expect(result).toBe(3);
    });
  });

  describe('getPendingUploadSize', () => {
    it('should return total size of pending uploads', async () => {
      mockRawQuery.mockResolvedValue([{ total: 5000000 }]);

      const result = await ChecklistAttachmentRepository.getPendingUploadSize();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(SUM(fileSize), 0)'),
        []
      );
      expect(result).toBe(5000000);
    });

    it('should filter by technician when provided', async () => {
      mockRawQuery.mockResolvedValue([{ total: 1000000 }]);

      const result = await ChecklistAttachmentRepository.getPendingUploadSize(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('technicianId = ?'),
        [technicianId]
      );
      expect(result).toBe(1000000);
    });
  });

  describe('clearSyncedBase64', () => {
    it('should clear base64 data from synced attachments', async () => {
      mockRawQuery
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce([{ count: 5 }]); // COUNT

      const result = await ChecklistAttachmentRepository.clearSyncedBase64();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET base64Data = NULL"),
        expect.any(Array)
      );
      expect(result).toBe(5);
    });
  });
});
