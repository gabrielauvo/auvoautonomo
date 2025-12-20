/**
 * WorkOrderExecutionService Tests
 *
 * Testes para o serviço de execução de ordens de serviço.
 */

// Mock dependencies
const mockGetById = jest.fn();
const mockUpdateStatus = jest.fn();
const mockGetActiveSession = jest.fn();
const mockGetTimeSummary = jest.fn();
const mockStartWorkSession = jest.fn();
const mockEndSession = jest.fn();
const mockStartPauseSession = jest.fn();
const mockGetByWorkOrder = jest.fn();

const mockStartWorkOrder = jest.fn();
const mockCompleteWorkOrder = jest.fn();
const mockCancelWorkOrder = jest.fn();

const mockPullChecklistsForWorkOrder = jest.fn();
const mockPushPendingAnswers = jest.fn();
const mockCountPendingSyncByWorkOrder = jest.fn();
const mockCountPendingUploadsByWorkOrder = jest.fn();
const mockCountPendingSync = jest.fn();
const mockAreAllCompleted = jest.fn();
const mockGetChecklistsByWorkOrder = jest.fn();

const mockProcessQueue = jest.fn();
const mockCountPending = jest.fn();

const mockIsNetworkOnline = jest.fn();

jest.mock('../../../../src/modules/workorders/WorkOrderRepository', () => ({
  workOrderRepository: {
    getById: (...args: unknown[]) => mockGetById(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  },
}));

jest.mock('../../../../src/modules/workorders/WorkOrderService', () => ({
  workOrderService: {
    startWorkOrder: (...args: unknown[]) => mockStartWorkOrder(...args),
    completeWorkOrder: (...args: unknown[]) => mockCompleteWorkOrder(...args),
    cancelWorkOrder: (...args: unknown[]) => mockCancelWorkOrder(...args),
  },
}));

jest.mock('../../../../src/modules/workorders/execution/ExecutionSessionRepository', () => ({
  ExecutionSessionRepository: {
    getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
    getTimeSummary: (...args: unknown[]) => mockGetTimeSummary(...args),
    startWorkSession: (...args: unknown[]) => mockStartWorkSession(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
    startPauseSession: (...args: unknown[]) => mockStartPauseSession(...args),
    getByWorkOrder: (...args: unknown[]) => mockGetByWorkOrder(...args),
  },
}));

jest.mock('../../../../src/modules/checklists/services/ChecklistSyncService', () => ({
  ChecklistSyncService: {
    configure: jest.fn(),
    pullChecklistsForWorkOrder: (...args: unknown[]) => mockPullChecklistsForWorkOrder(...args),
    pushPendingAnswers: (...args: unknown[]) => mockPushPendingAnswers(...args),
    countPendingSyncByWorkOrder: (...args: unknown[]) => mockCountPendingSyncByWorkOrder(...args),
    countPendingUploadsByWorkOrder: (...args: unknown[]) => mockCountPendingUploadsByWorkOrder(...args),
    countPendingSync: (...args: unknown[]) => mockCountPendingSync(...args),
  },
}));

jest.mock('../../../../src/modules/checklists/services/AttachmentUploadService', () => ({
  AttachmentUploadService: {
    configure: jest.fn(),
    processQueue: (...args: unknown[]) => mockProcessQueue(...args),
    countPending: (...args: unknown[]) => mockCountPending(...args),
  },
}));

jest.mock('../../../../src/modules/checklists/repositories/ChecklistInstanceRepository', () => ({
  ChecklistInstanceRepository: {
    areAllCompleted: (...args: unknown[]) => mockAreAllCompleted(...args),
    getByWorkOrder: (...args: unknown[]) => mockGetChecklistsByWorkOrder(...args),
  },
}));

jest.mock('../../../../src/queue/MutationQueue', () => ({
  MutationQueue: {},
}));

jest.mock('../../../../src/sync', () => ({
  syncEngine: {
    isNetworkOnline: () => mockIsNetworkOnline(),
  },
}));

jest.mock('../../../../src/modules/workorders/execution/types', () => ({
  formatTime: (seconds: number) => ({
    formatted: `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`,
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }),
}));

import { WorkOrderExecutionService } from '../../../../src/modules/workorders/execution/WorkOrderExecutionService';

describe('WorkOrderExecutionService', () => {
  const technicianId = 'tech-123';
  const workOrderId = 'wo-1';

  const mockWorkOrder = {
    id: workOrderId,
    clientId: 'client-1',
    title: 'Test WO',
    status: 'SCHEDULED',
    technicianId,
    executionStart: null,
    executionEnd: null,
  };

  const mockSession = {
    id: 'session-1',
    workOrderId,
    technicianId,
    sessionType: 'WORK',
    startedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    WorkOrderExecutionService.configure(technicianId);

    // Default mocks
    mockGetTimeSummary.mockResolvedValue({
      totalWorkTime: 0,
      totalPauseTime: 0,
      sessionCount: 0,
      isActive: false,
    });
    mockIsNetworkOnline.mockReturnValue(true);
    mockGetByWorkOrder.mockResolvedValue([]);
  });

  describe('configure', () => {
    it('should configure technician ID', () => {
      WorkOrderExecutionService.configure('new-tech');
      expect(() => WorkOrderExecutionService.configure('test')).not.toThrow();
    });
  });

  describe('getExecutionState', () => {
    it('should throw if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      await expect(
        WorkOrderExecutionService.getExecutionState(workOrderId)
      ).rejects.toThrow('Work order wo-1 not found');
    });

    it('should return state for scheduled work order', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(null);

      const state = await WorkOrderExecutionService.getExecutionState(workOrderId);

      expect(state.isExecuting).toBe(false);
      expect(state.isPaused).toBe(false);
      expect(state.activeSession).toBeNull();
    });

    it('should return executing state for active work session', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(mockSession);

      const state = await WorkOrderExecutionService.getExecutionState(workOrderId);

      expect(state.isExecuting).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.activeSession).toEqual(mockSession);
    });

    it('should return paused state for pause session', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue({ ...mockSession, sessionType: 'PAUSE' });

      const state = await WorkOrderExecutionService.getExecutionState(workOrderId);

      expect(state.isExecuting).toBe(false);
      expect(state.isPaused).toBe(true);
    });

    it('should calculate current session time', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue({ ...mockSession, startedAt: oneMinuteAgo });

      const state = await WorkOrderExecutionService.getExecutionState(workOrderId);

      expect(state.currentSessionTime).toBeGreaterThanOrEqual(59);
      expect(state.currentSessionTime).toBeLessThanOrEqual(61);
    });
  });

  describe('getExecutionSummary', () => {
    it('should throw if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      await expect(
        WorkOrderExecutionService.getExecutionSummary(workOrderId)
      ).rejects.toThrow('Work order wo-1 not found');
    });

    it('should return execution summary', async () => {
      mockGetById.mockResolvedValue({
        ...mockWorkOrder,
        status: 'DONE',
        executionStart: '2024-01-01T09:00:00.000Z',
        executionEnd: '2024-01-01T11:00:00.000Z',
      });
      mockGetTimeSummary.mockResolvedValue({
        totalWorkTime: 7200,
        totalPauseTime: 600,
        sessionCount: 3,
        isActive: false,
      });

      const summary = await WorkOrderExecutionService.getExecutionSummary(workOrderId);

      expect(summary.status).toBe('DONE');
      expect(summary.firstStartedAt).toBe('2024-01-01T09:00:00.000Z');
      expect(summary.lastEndedAt).toBe('2024-01-01T11:00:00.000Z');
      expect(summary.sessionCount).toBe(3);
    });
  });

  describe('startExecution', () => {
    it('should return error if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await WorkOrderExecutionService.startExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('não encontrada');
    });

    it('should return error for invalid status', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'DONE' });

      const result = await WorkOrderExecutionService.startExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Não é possível iniciar');
    });

    it('should return error if already executing', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue({ ...mockSession, sessionType: 'WORK' });

      const result = await WorkOrderExecutionService.startExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('já está em execução');
    });

    it('should start execution for scheduled work order', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(null);
      mockStartWorkOrder.mockResolvedValue(undefined);
      mockStartWorkSession.mockResolvedValue(mockSession);

      const result = await WorkOrderExecutionService.startExecution(workOrderId);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('IN_PROGRESS');
      expect(mockStartWorkOrder).toHaveBeenCalledWith(workOrderId);
      expect(mockStartWorkSession).toHaveBeenCalled();
    });

    it('should sync checklists if requested and online', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(null);
      mockStartWorkOrder.mockResolvedValue(undefined);
      mockStartWorkSession.mockResolvedValue(mockSession);
      mockPullChecklistsForWorkOrder.mockResolvedValue(undefined);

      await WorkOrderExecutionService.startExecution(workOrderId, {
        syncChecklistsFirst: true,
      });

      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledWith(workOrderId);
    });

    it('should not sync checklists if offline', async () => {
      mockIsNetworkOnline.mockReturnValue(false);
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(null);
      mockStartWorkOrder.mockResolvedValue(undefined);
      mockStartWorkSession.mockResolvedValue(mockSession);

      await WorkOrderExecutionService.startExecution(workOrderId, {
        syncChecklistsFirst: true,
      });

      expect(mockPullChecklistsForWorkOrder).not.toHaveBeenCalled();
    });
  });

  describe('pauseExecution', () => {
    it('should return error if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await WorkOrderExecutionService.pauseExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('não encontrada');
    });

    it('should return error if not in progress', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);

      const result = await WorkOrderExecutionService.pauseExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Só é possível pausar');
    });

    it('should return error if already paused', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue({ ...mockSession, sessionType: 'PAUSE' });

      const result = await WorkOrderExecutionService.pauseExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('já está pausada');
    });

    it('should pause execution', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(mockSession);
      mockEndSession.mockResolvedValue(undefined);
      mockStartPauseSession.mockResolvedValue({ ...mockSession, sessionType: 'PAUSE' });

      const result = await WorkOrderExecutionService.pauseExecution(workOrderId, 'LUNCH', 'Break time');

      expect(result.success).toBe(true);
      expect(mockEndSession).toHaveBeenCalledWith(mockSession.id);
      expect(mockStartPauseSession).toHaveBeenCalledWith(
        workOrderId,
        technicianId,
        'LUNCH',
        'Break time'
      );
    });
  });

  describe('resumeExecution', () => {
    it('should return error if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await WorkOrderExecutionService.resumeExecution(workOrderId);

      expect(result.success).toBe(false);
    });

    it('should return error if not in progress', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);

      const result = await WorkOrderExecutionService.resumeExecution(workOrderId);

      expect(result.success).toBe(false);
    });

    it('should return error if not paused', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(mockSession);

      const result = await WorkOrderExecutionService.resumeExecution(workOrderId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('não está pausada');
    });

    it('should resume execution', async () => {
      const pauseSession = { ...mockSession, sessionType: 'PAUSE' };
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(pauseSession);
      mockEndSession.mockResolvedValue(undefined);
      mockStartWorkSession.mockResolvedValue(mockSession);

      const result = await WorkOrderExecutionService.resumeExecution(workOrderId);

      expect(result.success).toBe(true);
      expect(mockEndSession).toHaveBeenCalledWith(pauseSession.id);
      expect(mockStartWorkSession).toHaveBeenCalled();
    });
  });

  describe('completeExecution', () => {
    it('should return error if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await WorkOrderExecutionService.completeExecution(workOrderId);

      expect(result.success).toBe(false);
    });

    it('should complete execution', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(mockSession);
      mockEndSession.mockResolvedValue(undefined);
      mockCompleteWorkOrder.mockResolvedValue(undefined);

      const result = await WorkOrderExecutionService.completeExecution(workOrderId);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('DONE');
      expect(mockCompleteWorkOrder).toHaveBeenCalledWith(workOrderId);
    });

    it('should check checklists if required', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(null);
      mockAreAllCompleted.mockResolvedValue(false);

      const result = await WorkOrderExecutionService.completeExecution(workOrderId, {
        requireAllChecklistsComplete: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('checklists devem ser completados');
    });

    it('should sync pending data if requested', async () => {
      mockGetById.mockResolvedValue({ ...mockWorkOrder, status: 'IN_PROGRESS' });
      mockGetActiveSession.mockResolvedValue(null);
      mockPushPendingAnswers.mockResolvedValue(undefined);
      mockProcessQueue.mockResolvedValue(undefined);
      mockCompleteWorkOrder.mockResolvedValue(undefined);

      await WorkOrderExecutionService.completeExecution(workOrderId, {
        syncPendingFirst: true,
      });

      expect(mockPushPendingAnswers).toHaveBeenCalledWith(workOrderId);
      expect(mockProcessQueue).toHaveBeenCalled();
    });
  });

  describe('cancelExecution', () => {
    it('should return error if work order not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await WorkOrderExecutionService.cancelExecution(workOrderId);

      expect(result.success).toBe(false);
    });

    it('should cancel execution', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(null);
      mockCancelWorkOrder.mockResolvedValue(undefined);

      const result = await WorkOrderExecutionService.cancelExecution(workOrderId);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('CANCELED');
      expect(mockCancelWorkOrder).toHaveBeenCalledWith(workOrderId);
    });

    it('should end active session before canceling', async () => {
      mockGetById.mockResolvedValue(mockWorkOrder);
      mockGetActiveSession.mockResolvedValue(mockSession);
      mockEndSession.mockResolvedValue(undefined);
      mockCancelWorkOrder.mockResolvedValue(undefined);

      await WorkOrderExecutionService.cancelExecution(workOrderId);

      expect(mockEndSession).toHaveBeenCalledWith(mockSession.id);
    });
  });

  describe('hasPendingSync', () => {
    it('should return true if pending answers', async () => {
      mockCountPendingSyncByWorkOrder.mockResolvedValue(5);
      mockCountPendingUploadsByWorkOrder.mockResolvedValue(0);

      const result = await WorkOrderExecutionService.hasPendingSync(workOrderId);

      expect(result).toBe(true);
    });

    it('should return true if pending uploads', async () => {
      mockCountPendingSyncByWorkOrder.mockResolvedValue(0);
      mockCountPendingUploadsByWorkOrder.mockResolvedValue(3);

      const result = await WorkOrderExecutionService.hasPendingSync(workOrderId);

      expect(result).toBe(true);
    });

    it('should return false if nothing pending', async () => {
      mockCountPendingSyncByWorkOrder.mockResolvedValue(0);
      mockCountPendingUploadsByWorkOrder.mockResolvedValue(0);

      const result = await WorkOrderExecutionService.hasPendingSync(workOrderId);

      expect(result).toBe(false);
    });
  });

  describe('getSessionHistory', () => {
    it('should return session history', async () => {
      const sessions = [mockSession, { ...mockSession, id: 'session-2' }];
      mockGetByWorkOrder.mockResolvedValue(sessions);

      const result = await WorkOrderExecutionService.getSessionHistory(workOrderId);

      expect(result).toEqual(sessions);
      expect(mockGetByWorkOrder).toHaveBeenCalledWith(workOrderId);
    });
  });

  describe('subscribe', () => {
    it('should add and remove listener', () => {
      const listener = jest.fn();

      const unsubscribe = WorkOrderExecutionService.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('getExecutionStats', () => {
    it('should return execution statistics', async () => {
      mockGetTimeSummary.mockResolvedValue({
        totalWorkTime: 7200,
        totalPauseTime: 600,
        sessionCount: 5,
      });
      mockGetChecklistsByWorkOrder.mockResolvedValue([
        { progress: 100 },
        { progress: 50 },
      ]);
      mockCountPendingSync.mockResolvedValue(3);
      mockCountPending.mockResolvedValue(2);

      const stats = await WorkOrderExecutionService.getExecutionStats(workOrderId);

      expect(stats.totalWorkTime).toBe(7200);
      expect(stats.totalPauseTime).toBe(600);
      expect(stats.sessionCount).toBe(5);
      expect(stats.checklistProgress).toBe(75);
      expect(stats.pendingSyncCount).toBe(5);
    });

    it('should handle empty checklists', async () => {
      mockGetTimeSummary.mockResolvedValue({
        totalWorkTime: 0,
        totalPauseTime: 0,
        sessionCount: 0,
      });
      mockGetChecklistsByWorkOrder.mockResolvedValue([]);
      mockCountPendingSync.mockResolvedValue(0);
      mockCountPending.mockResolvedValue(0);

      const stats = await WorkOrderExecutionService.getExecutionStats(workOrderId);

      expect(stats.checklistProgress).toBe(0);
    });
  });
});
