/**
 * ChecklistSyncService Tests
 *
 * Testes para o serviço de sincronização de checklists.
 */

// Mock syncEngine
const mockIsConfigured = jest.fn(() => true);
const mockIsNetworkOnline = jest.fn(() => true);

jest.mock('../../../../src/sync', () => ({
  syncEngine: {
    isConfigured: () => mockIsConfigured(),
    isNetworkOnline: () => mockIsNetworkOnline(),
    baseUrl: 'https://api.example.com',
    authToken: 'test-token',
  },
}));

// Mock repositories
const mockGetByWorkOrder = jest.fn();
const mockGetById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateStatus = jest.fn();

jest.mock('../../../../src/modules/checklists/repositories/ChecklistInstanceRepository', () => ({
  ChecklistInstanceRepository: {
    getByWorkOrder: (...args: unknown[]) => mockGetByWorkOrder(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

const mockGetByInstance = jest.fn();
const mockGetPendingSync = jest.fn();
const mockUpdateSyncStatus = jest.fn();
const mockMarkManySynced = jest.fn();
const mockGetByQuestion = jest.fn();
const mockCreateAnswer = jest.fn();
const mockUpdateAnswer = jest.fn();

jest.mock('../../../../src/modules/checklists/repositories/ChecklistAnswerRepository', () => ({
  ChecklistAnswerRepository: {
    getByInstance: (...args: unknown[]) => mockGetByInstance(...args),
    getPendingSync: (...args: unknown[]) => mockGetPendingSync(...args),
    updateSyncStatus: (...args: unknown[]) => mockUpdateSyncStatus(...args),
    markManySynced: (...args: unknown[]) => mockMarkManySynced(...args),
    getByQuestion: (...args: unknown[]) => mockGetByQuestion(...args),
    create: (...args: unknown[]) => mockCreateAnswer(...args),
    update: (...args: unknown[]) => mockUpdateAnswer(...args),
  },
}));

const mockCountPendingUpload = jest.fn();
const mockCountPendingUploadByWorkOrder = jest.fn();

jest.mock('../../../../src/modules/checklists/repositories/ChecklistAttachmentRepository', () => ({
  ChecklistAttachmentRepository: {
    countPendingUpload: (...args: unknown[]) => mockCountPendingUpload(...args),
    countPendingUploadByWorkOrder: (...args: unknown[]) => mockCountPendingUploadByWorkOrder(...args),
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { ChecklistSyncService } from '../../../../src/modules/checklists/services/ChecklistSyncService';

describe('ChecklistSyncService', () => {
  const technicianId = 'tech-123';
  const workOrderId = 'wo-1';
  const instanceId = 'inst-1';

  const mockInstance = {
    id: instanceId,
    workOrderId,
    templateId: 'tpl-1',
    templateName: 'Checklist Teste',
    status: 'IN_PROGRESS',
    progress: 50,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  const mockAnswer = {
    id: 'ans-1',
    instanceId,
    questionId: 'q-1',
    questionType: 'TEXT',
    valueText: 'Resposta teste',
    syncStatus: 'PENDING',
    localId: 'local-ans-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConfigured.mockReturnValue(true);
    mockIsNetworkOnline.mockReturnValue(true);
    ChecklistSyncService.configure(technicianId);
  });

  describe('configure', () => {
    it('should set technician ID', () => {
      ChecklistSyncService.configure('new-tech');
      expect(() => ChecklistSyncService.configure('test')).not.toThrow();
    });
  });

  describe('isOnline', () => {
    it('should return true when network is online', () => {
      mockIsNetworkOnline.mockReturnValue(true);

      const result = ChecklistSyncService.isOnline();

      expect(result).toBe(true);
      expect(mockIsNetworkOnline).toHaveBeenCalled();
    });

    it('should return false when network is offline', () => {
      mockIsNetworkOnline.mockReturnValue(false);

      const result = ChecklistSyncService.isOnline();

      expect(result).toBe(false);
    });
  });

  describe('pullChecklistsForWorkOrder', () => {
    it('should fetch checklists from API when online', async () => {
      const serverInstances = [
        {
          id: instanceId,
          workOrderId,
          templateId: 'tpl-1',
          status: 'IN_PROGRESS',
          progress: 50,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          template: { name: 'Checklist Teste' },
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverInstances),
      });

      const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);

      expect(result.success).toBe(true);
      expect(result.checklists).toHaveLength(1);
      expect(result.checklists[0].id).toBe(instanceId);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/checklist-instances/work-orders/${workOrderId}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should return empty list when work order not found (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);

      expect(result.success).toBe(true);
      expect(result.checklists).toHaveLength(0);
    });

    it('should fallback to local DB when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockGetByWorkOrder.mockResolvedValue([mockInstance]);

      const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);

      expect(result.success).toBe(true);
      expect(result.checklists).toHaveLength(1);
      expect(mockGetByWorkOrder).toHaveBeenCalledWith(workOrderId);
    });

    it('should use local DB when offline', async () => {
      mockIsNetworkOnline.mockReturnValue(false);
      mockGetByWorkOrder.mockResolvedValue([mockInstance]);

      const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockGetByWorkOrder).toHaveBeenCalledWith(workOrderId);
    });

    it('should return error when both API and local fail', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockGetByWorkOrder.mockRejectedValue(new Error('DB error'));

      const result = await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Não foi possível carregar checklists');
    });
  });

  describe('pullChecklistFull', () => {
    it('should fetch full checklist from API when online', async () => {
      const serverData = {
        id: instanceId,
        workOrderId,
        templateId: 'tpl-1',
        status: 'IN_PROGRESS',
        progress: 50,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        template: { name: 'Checklist Teste' },
        templateVersionSnapshot: { sections: [] },
        answers: [
          {
            id: 'ans-1',
            instanceId,
            questionId: 'q-1',
            type: 'TEXT',
            valueText: 'Answer',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(serverData),
      });

      const result = await ChecklistSyncService.pullChecklistFull(instanceId);

      expect(result.success).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.answers).toHaveLength(1);
      expect(result.snapshot).toEqual({ sections: [] });
    });

    it('should fallback to local DB when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockGetById.mockResolvedValue(mockInstance);
      mockGetByInstance.mockResolvedValue([mockAnswer]);

      const result = await ChecklistSyncService.pullChecklistFull(instanceId);

      expect(result.success).toBe(true);
      expect(result.instance).toBeDefined();
      expect(result.answers).toHaveLength(1);
    });

    it('should return error when checklist not found locally', async () => {
      mockIsNetworkOnline.mockReturnValue(false);
      mockGetById.mockResolvedValue(null);
      mockGetByInstance.mockResolvedValue([]);

      const result = await ChecklistSyncService.pullChecklistFull(instanceId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Checklist não encontrado localmente');
    });
  });

  describe('pushPendingAnswers', () => {
    it('should return error when offline', async () => {
      mockIsNetworkOnline.mockReturnValue(false);

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sem conexão com a internet');
    });

    it('should return success when no pending answers', async () => {
      mockGetPendingSync.mockResolvedValue([]);

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(true);
      expect(result.syncedAnswers).toBe(0);
    });

    it('should sync pending answers successfully', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { success: true, localId: 'local-ans-1', skipped: false },
          ],
        }),
      });

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(true);
      expect(result.syncedAnswers).toBe(1);
      expect(mockUpdateSyncStatus).toHaveBeenCalledWith('ans-1', 'SYNCING');
      expect(mockMarkManySynced).toHaveBeenCalledWith(['local-ans-1']);
    });

    it('should handle skipped answers', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { success: true, localId: 'local-ans-1', skipped: true },
          ],
        }),
      });

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(true);
      expect(result.skippedAnswers).toBe(1);
    });

    it('should handle failed answers', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [
            { success: false, localId: 'local-ans-1', questionId: 'q-1', error: 'Invalid answer' },
          ],
        }),
      });

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(false);
      expect(result.failedAnswers).toBe(1);
      expect(result.errors).toContain('q-1: Invalid answer');
    });

    it('should handle API error and revert status', async () => {
      mockGetPendingSync.mockResolvedValueOnce([mockAnswer]);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockGetByInstance.mockResolvedValue([{ ...mockAnswer, syncStatus: 'SYNCING' }]);

      const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Network error');
      expect(mockUpdateSyncStatus).toHaveBeenCalledWith('ans-1', 'PENDING');
    });
  });

  describe('pushAllPendingAnswers', () => {
    it('should return when offline', async () => {
      mockIsNetworkOnline.mockReturnValue(false);

      const result = await ChecklistSyncService.pushAllPendingAnswers();

      expect(result.success).toBe(false);
      expect(result.totalSynced).toBe(0);
    });

    it('should sync all pending answers grouped by instance', async () => {
      const pendingAnswers = [
        { ...mockAnswer, instanceId: 'inst-1' },
        { ...mockAnswer, id: 'ans-2', instanceId: 'inst-1', questionId: 'q-2' },
        { ...mockAnswer, id: 'ans-3', instanceId: 'inst-2', questionId: 'q-3' },
      ];

      mockGetPendingSync
        .mockResolvedValueOnce(pendingAnswers) // getAllPending
        .mockResolvedValueOnce([pendingAnswers[0], pendingAnswers[1]]) // inst-1
        .mockResolvedValueOnce([pendingAnswers[2]]); // inst-2

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: [
              { success: true, localId: 'local-ans-1' },
              { success: true, localId: 'local-ans-2' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            results: [
              { success: true, localId: 'local-ans-3' },
            ],
          }),
        });

      const result = await ChecklistSyncService.pushAllPendingAnswers();

      expect(result.success).toBe(true);
      expect(result.totalSynced).toBe(3);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('updateInstanceStatus', () => {
    it('should update status locally first', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await ChecklistSyncService.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(mockUpdateStatus).toHaveBeenCalledWith(instanceId, 'COMPLETED');
    });

    it('should update status on server when online', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await ChecklistSyncService.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.example.com/checklist-instances/${instanceId}/status`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'COMPLETED' }),
        })
      );
    });

    it('should return true when offline (saved locally)', async () => {
      mockIsNetworkOnline.mockReturnValue(false);

      const result = await ChecklistSyncService.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false when server update fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await ChecklistSyncService.updateInstanceStatus(instanceId, 'COMPLETED');

      expect(result).toBe(false);
    });
  });

  describe('completeChecklist', () => {
    it('should sync pending answers before completing', async () => {
      mockGetPendingSync.mockResolvedValue([]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await ChecklistSyncService.completeChecklist(instanceId);

      expect(mockGetPendingSync).toHaveBeenCalledWith(instanceId);
    });

    it('should fail if answers sync failed', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          results: [{ success: false, localId: 'local-ans-1' }],
        }),
      });

      const result = await ChecklistSyncService.completeChecklist(instanceId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Falha ao sincronizar');
    });

    it('should complete successfully when online', async () => {
      mockGetPendingSync.mockResolvedValue([]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await ChecklistSyncService.completeChecklist(instanceId);

      expect(result.success).toBe(true);
      expect(mockUpdateStatus).toHaveBeenCalledWith(instanceId, 'COMPLETED');
    });

    it('should handle missing questions error', async () => {
      mockGetPendingSync.mockResolvedValue([]);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          missingQuestions: ['q-1', 'q-2'],
        }),
      });

      const result = await ChecklistSyncService.completeChecklist(instanceId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Perguntas obrigatórias não respondidas');
      expect(result.missingQuestions).toEqual(['q-1', 'q-2']);
    });

    it('should complete locally when offline', async () => {
      mockIsNetworkOnline.mockReturnValue(false);
      mockGetPendingSync.mockResolvedValue([]);

      const result = await ChecklistSyncService.completeChecklist(instanceId);

      expect(result.success).toBe(true);
      expect(mockUpdateStatus).toHaveBeenCalledWith(instanceId, 'COMPLETED');
    });
  });

  describe('countPendingSync', () => {
    it('should return count of pending answers', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer, mockAnswer]);

      const result = await ChecklistSyncService.countPendingSync(instanceId);

      expect(result).toBe(2);
      expect(mockGetPendingSync).toHaveBeenCalledWith(instanceId);
    });

    it('should count all pending when no instanceId', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);

      const result = await ChecklistSyncService.countPendingSync();

      expect(result).toBe(1);
      expect(mockGetPendingSync).toHaveBeenCalledWith(undefined);
    });
  });

  describe('countPendingSyncByWorkOrder', () => {
    it('should return 0 when no instances', async () => {
      mockGetByWorkOrder.mockResolvedValue([]);

      const result = await ChecklistSyncService.countPendingSyncByWorkOrder(workOrderId);

      expect(result).toBe(0);
    });

    it('should count pending for all instances', async () => {
      mockGetByWorkOrder.mockResolvedValue([
        { id: 'inst-1' },
        { id: 'inst-2' },
      ]);
      mockGetPendingSync
        .mockResolvedValueOnce([mockAnswer, mockAnswer])
        .mockResolvedValueOnce([mockAnswer]);

      const result = await ChecklistSyncService.countPendingSyncByWorkOrder(workOrderId);

      expect(result).toBe(3);
    });
  });

  describe('countPendingUploads', () => {
    it('should delegate to repository', async () => {
      mockCountPendingUpload.mockResolvedValue(5);

      const result = await ChecklistSyncService.countPendingUploads(technicianId);

      expect(result).toBe(5);
      expect(mockCountPendingUpload).toHaveBeenCalledWith(technicianId);
    });
  });

  describe('countPendingUploadsByWorkOrder', () => {
    it('should delegate to repository', async () => {
      mockCountPendingUploadByWorkOrder.mockResolvedValue(3);

      const result = await ChecklistSyncService.countPendingUploadsByWorkOrder(workOrderId);

      expect(result).toBe(3);
      expect(mockCountPendingUploadByWorkOrder).toHaveBeenCalledWith(workOrderId);
    });
  });

  describe('hasPendingData', () => {
    it('should return true when pending answers exist', async () => {
      mockGetPendingSync.mockResolvedValue([mockAnswer]);
      mockCountPendingUpload.mockResolvedValue(0);

      const result = await ChecklistSyncService.hasPendingData();

      expect(result).toBe(true);
    });

    it('should return true when pending uploads exist', async () => {
      mockGetPendingSync.mockResolvedValue([]);
      mockCountPendingUpload.mockResolvedValue(1);

      const result = await ChecklistSyncService.hasPendingData();

      expect(result).toBe(true);
    });

    it('should return false when no pending data', async () => {
      mockGetPendingSync.mockResolvedValue([]);
      mockCountPendingUpload.mockResolvedValue(0);

      const result = await ChecklistSyncService.hasPendingData();

      expect(result).toBe(false);
    });
  });

});

