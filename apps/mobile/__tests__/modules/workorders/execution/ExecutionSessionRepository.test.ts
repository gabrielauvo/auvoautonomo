/**
 * ExecutionSessionRepository Tests
 *
 * Testes para operações do repositório de sessões de execução.
 */

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { ExecutionSessionRepository } from '../../../../src/modules/workorders/execution/ExecutionSessionRepository';
import { ExecutionSession, ExecutionSessionType } from '../../../../src/db/schema';

describe('ExecutionSessionRepository', () => {
  const technicianId = 'tech-123';
  const workOrderId = 'wo-1';

  const mockSession: ExecutionSession = {
    id: 'session-1',
    workOrderId,
    technicianId,
    sessionType: 'WORK' as ExecutionSessionType,
    startedAt: '2024-01-01T09:00:00.000Z',
    duration: 3600,
    createdAt: '2024-01-01T09:00:00.000Z',
    updatedAt: '2024-01-01T10:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      mockInsert.mockResolvedValue(undefined);

      const data = {
        workOrderId,
        technicianId,
        sessionType: 'WORK' as ExecutionSessionType,
        startedAt: '2024-01-01T09:00:00.000Z',
      };

      const result = await ExecutionSessionRepository.create(data);

      expect(mockInsert).toHaveBeenCalledWith('work_order_execution_sessions', expect.objectContaining({
        id: 'test-uuid-123',
        workOrderId,
        technicianId,
        sessionType: 'WORK',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(result.id).toBe('test-uuid-123');
    });
  });

  describe('getById', () => {
    it('should return session by ID', async () => {
      mockFindById.mockResolvedValue(mockSession);

      const result = await ExecutionSessionRepository.getById('session-1');

      expect(mockFindById).toHaveBeenCalledWith('work_order_execution_sessions', 'session-1');
      expect(result).toEqual(mockSession);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ExecutionSessionRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByWorkOrder', () => {
    it('should return sessions by work order', async () => {
      mockFindAll.mockResolvedValue([mockSession]);

      const result = await ExecutionSessionRepository.getByWorkOrder(workOrderId);

      expect(mockFindAll).toHaveBeenCalledWith('work_order_execution_sessions', {
        where: { workOrderId },
        orderBy: 'startedAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockSession]);
    });
  });

  describe('getActiveSession', () => {
    it('should return active session', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockRawQuery.mockResolvedValue([activeSession]);

      const result = await ExecutionSessionRepository.getActiveSession(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('endedAt IS NULL'),
        [workOrderId]
      );
      expect(result).toEqual(activeSession);
    });

    it('should return null if no active session', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ExecutionSessionRepository.getActiveSession(workOrderId);

      expect(result).toBeNull();
    });
  });

  describe('getLastWorkSession', () => {
    it('should return last work session', async () => {
      mockRawQuery.mockResolvedValue([mockSession]);

      const result = await ExecutionSessionRepository.getLastWorkSession(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("sessionType = 'WORK'"),
        [workOrderId]
      );
      expect(result).toEqual(mockSession);
    });

    it('should return null if no work session', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ExecutionSessionRepository.getLastWorkSession(workOrderId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update session with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ExecutionSessionRepository.update('session-1', { notes: 'Updated' });

      expect(mockUpdate).toHaveBeenCalledWith('work_order_execution_sessions', 'session-1', {
        notes: 'Updated',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('endSession', () => {
    it('should end an active session', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockFindById
        .mockResolvedValueOnce(activeSession)
        .mockResolvedValueOnce({ ...activeSession, endedAt: '2024-01-01T10:00:00.000Z' });
      mockUpdate.mockResolvedValue(undefined);

      const result = await ExecutionSessionRepository.endSession('session-1');

      expect(mockUpdate).toHaveBeenCalledWith('work_order_execution_sessions', 'session-1', expect.objectContaining({
        endedAt: expect.any(String),
        duration: expect.any(Number),
      }));
      expect(result).toBeDefined();
    });

    it('should end session with notes', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockFindById
        .mockResolvedValueOnce(activeSession)
        .mockResolvedValueOnce({ ...activeSession, endedAt: '2024-01-01T10:00:00.000Z' });
      mockUpdate.mockResolvedValue(undefined);

      await ExecutionSessionRepository.endSession('session-1', 'Final notes');

      expect(mockUpdate).toHaveBeenCalledWith('work_order_execution_sessions', 'session-1', expect.objectContaining({
        notes: 'Final notes',
      }));
    });

    it('should return null if session not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ExecutionSessionRepository.endSession('non-existent');

      expect(result).toBeNull();
    });

    it('should return null if session already ended', async () => {
      const endedSession = { ...mockSession, endedAt: '2024-01-01T10:00:00.000Z' };
      mockFindById.mockResolvedValue(endedSession);

      const result = await ExecutionSessionRepository.endSession('session-1');

      expect(result).toBeNull();
    });
  });

  describe('endAllActiveSessions', () => {
    it('should end all active sessions', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockRawQuery.mockResolvedValue([activeSession]);
      mockUpdate.mockResolvedValue(undefined);

      await ExecutionSessionRepository.endAllActiveSessions(workOrderId);

      expect(mockUpdate).toHaveBeenCalledWith('work_order_execution_sessions', mockSession.id, expect.objectContaining({
        endedAt: expect.any(String),
        duration: expect.any(Number),
      }));
    });
  });

  describe('getTotalWorkTime', () => {
    it('should return total work time', async () => {
      mockRawQuery.mockResolvedValue([{ total: 7200 }]);

      const result = await ExecutionSessionRepository.getTotalWorkTime(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("sessionType = 'WORK'"),
        [workOrderId]
      );
      expect(result).toBe(7200);
    });

    it('should return 0 if no sessions', async () => {
      mockRawQuery.mockResolvedValue([{ total: null }]);

      const result = await ExecutionSessionRepository.getTotalWorkTime(workOrderId);

      expect(result).toBe(0);
    });
  });

  describe('getTotalPauseTime', () => {
    it('should return total pause time', async () => {
      mockRawQuery.mockResolvedValue([{ total: 1800 }]);

      const result = await ExecutionSessionRepository.getTotalPauseTime(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("sessionType = 'PAUSE'"),
        [workOrderId]
      );
      expect(result).toBe(1800);
    });
  });

  describe('getTimeSummary', () => {
    it('should return time summary', async () => {
      mockRawQuery
        .mockResolvedValueOnce([{ total: 7200 }])  // work time
        .mockResolvedValueOnce([{ total: 1800 }])  // pause time
        .mockResolvedValueOnce([])                  // active session
      mockFindAll.mockResolvedValue([mockSession, mockSession]);  // sessions

      const result = await ExecutionSessionRepository.getTimeSummary(workOrderId);

      expect(result).toEqual({
        totalWorkTime: 7200,
        totalPauseTime: 1800,
        sessionCount: 2,
        isActive: false,
      });
    });

    it('should indicate active session', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockRawQuery
        .mockResolvedValueOnce([{ total: 3600 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([activeSession])
      mockFindAll.mockResolvedValue([activeSession]);

      const result = await ExecutionSessionRepository.getTimeSummary(workOrderId);

      expect(result.isActive).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      mockRemove.mockResolvedValue(undefined);

      await ExecutionSessionRepository.delete('session-1');

      expect(mockRemove).toHaveBeenCalledWith('work_order_execution_sessions', 'session-1');
    });
  });

  describe('deleteByWorkOrder', () => {
    it('should delete all sessions of a work order', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ExecutionSessionRepository.deleteByWorkOrder(workOrderId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM work_order_execution_sessions'),
        [workOrderId]
      );
    });
  });

  describe('startWorkSession', () => {
    it('should start a work session', async () => {
      mockRawQuery.mockResolvedValue([]);  // no active sessions
      mockInsert.mockResolvedValue(undefined);
      mockFindById.mockResolvedValue(mockSession);

      const result = await ExecutionSessionRepository.startWorkSession(workOrderId, technicianId);

      expect(mockInsert).toHaveBeenCalledWith('work_order_execution_sessions', expect.objectContaining({
        workOrderId,
        technicianId,
        sessionType: 'WORK',
      }));
      expect(result).toBeDefined();
    });

    it('should end active sessions first', async () => {
      const activeSession = { ...mockSession, endedAt: undefined };
      mockRawQuery
        .mockResolvedValueOnce([activeSession])  // endAllActiveSessions
        .mockResolvedValueOnce([]);              // getActiveSession (for logging)
      mockUpdate.mockResolvedValue(undefined);
      mockInsert.mockResolvedValue(undefined);
      mockFindById.mockResolvedValue(mockSession);

      await ExecutionSessionRepository.startWorkSession(workOrderId, technicianId);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('startPauseSession', () => {
    it('should start a pause session', async () => {
      mockRawQuery.mockResolvedValue([]);
      mockInsert.mockResolvedValue(undefined);

      const result = await ExecutionSessionRepository.startPauseSession(workOrderId, technicianId, 'Lunch');

      expect(mockInsert).toHaveBeenCalledWith('work_order_execution_sessions', expect.objectContaining({
        workOrderId,
        technicianId,
        sessionType: 'PAUSE',
        pauseReason: 'Lunch',
      }));
      expect(result.sessionType).toBe('PAUSE');
    });
  });
});
