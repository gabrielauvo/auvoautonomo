/**
 * ChecklistAnswerRepository Tests
 *
 * Testes para operações do repositório de respostas de checklist.
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

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { ChecklistAnswerRepository } from '../../../src/modules/checklists/repositories/ChecklistAnswerRepository';
import { ChecklistAnswer, AnswerSyncStatus, ChecklistQuestionType } from '../../../src/db/schema';

describe('ChecklistAnswerRepository', () => {
  const mockAnswer: ChecklistAnswer = {
    id: 'answer-1',
    instanceId: 'instance-1',
    questionId: 'question-1',
    type: 'TEXT' as ChecklistQuestionType,
    valueText: 'Test answer',
    answeredAt: '2024-01-01T00:00:00.000Z',
    answeredBy: 'tech-123',
    localId: 'local-1',
    syncStatus: 'PENDING' as AnswerSyncStatus,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new answer with generated IDs', async () => {
      mockInsert.mockResolvedValue(undefined);

      const data = {
        instanceId: 'instance-1',
        questionId: 'question-1',
        type: 'TEXT' as ChecklistQuestionType,
        valueText: 'Test answer',
        answeredAt: '2024-01-01T00:00:00.000Z',
        answeredBy: 'tech-123',
        syncStatus: 'PENDING' as AnswerSyncStatus,
      };

      const result = await ChecklistAnswerRepository.create(data);

      expect(mockInsert).toHaveBeenCalledWith('checklist_answers', expect.objectContaining({
        id: 'test-uuid-123',
        localId: 'test-uuid-123',
        instanceId: 'instance-1',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(result.id).toBe('test-uuid-123');
      expect(result.localId).toBe('test-uuid-123');
    });
  });

  describe('getById', () => {
    it('should return answer by ID', async () => {
      mockFindById.mockResolvedValue(mockAnswer);

      const result = await ChecklistAnswerRepository.getById('answer-1');

      expect(mockFindById).toHaveBeenCalledWith('checklist_answers', 'answer-1');
      expect(result).toEqual(mockAnswer);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ChecklistAnswerRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByLocalId', () => {
    it('should return answer by localId', async () => {
      mockFindOne.mockResolvedValue(mockAnswer);

      const result = await ChecklistAnswerRepository.getByLocalId('local-1');

      expect(mockFindOne).toHaveBeenCalledWith('checklist_answers', { localId: 'local-1' });
      expect(result).toEqual(mockAnswer);
    });
  });

  describe('getByQuestion', () => {
    it('should return answer by instance and question', async () => {
      mockFindOne.mockResolvedValue(mockAnswer);

      const result = await ChecklistAnswerRepository.getByQuestion('instance-1', 'question-1');

      expect(mockFindOne).toHaveBeenCalledWith('checklist_answers', {
        instanceId: 'instance-1',
        questionId: 'question-1',
      });
      expect(result).toEqual(mockAnswer);
    });
  });

  describe('getByInstance', () => {
    it('should return all answers for an instance', async () => {
      mockFindAll.mockResolvedValue([mockAnswer]);

      const result = await ChecklistAnswerRepository.getByInstance('instance-1');

      expect(mockFindAll).toHaveBeenCalledWith('checklist_answers', {
        where: { instanceId: 'instance-1' },
        orderBy: 'createdAt',
        order: 'ASC',
      });
      expect(result).toEqual([mockAnswer]);
    });
  });

  describe('getPendingSync', () => {
    it('should return pending sync answers for instance', async () => {
      mockRawQuery.mockResolvedValue([mockAnswer]);

      const result = await ChecklistAnswerRepository.getPendingSync('instance-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus IN ('PENDING', 'FAILED')"),
        ['instance-1']
      );
      expect(result).toEqual([mockAnswer]);
    });

    it('should return all pending sync answers without instance filter', async () => {
      mockRawQuery.mockResolvedValue([mockAnswer]);

      const result = await ChecklistAnswerRepository.getPendingSync();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("syncStatus IN ('PENDING', 'FAILED')"),
        []
      );
      expect(result).toEqual([mockAnswer]);
    });
  });

  describe('upsert', () => {
    it('should create new answer if not exists', async () => {
      mockFindOne.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      const result = await ChecklistAnswerRepository.upsert(
        'instance-1',
        'question-1',
        'TEXT',
        { valueText: 'New answer' }
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result.valueText).toBe('New answer');
    });

    it('should update existing answer', async () => {
      mockFindOne.mockResolvedValue(mockAnswer);
      mockUpdate.mockResolvedValue(undefined);
      mockFindById.mockResolvedValue({ ...mockAnswer, valueText: 'Updated answer' });

      const result = await ChecklistAnswerRepository.upsert(
        'instance-1',
        'question-1',
        'TEXT',
        { valueText: 'Updated answer' }
      );

      expect(mockUpdate).toHaveBeenCalledWith('checklist_answers', 'answer-1', expect.objectContaining({
        valueText: 'Updated answer',
        syncStatus: 'PENDING',
      }));
      expect(result.valueText).toBe('Updated answer');
    });
  });

  describe('update', () => {
    it('should update answer with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.update('answer-1', { valueText: 'Updated' });

      expect(mockUpdate).toHaveBeenCalledWith('checklist_answers', 'answer-1', {
        valueText: 'Updated',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('updateSyncStatus', () => {
    it('should update sync status', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.updateSyncStatus('answer-1', 'SYNCING');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_answers', 'answer-1', {
        syncStatus: 'SYNCING',
        updatedAt: expect.any(String),
      });
    });

    it('should set syncedAt when SYNCED', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.updateSyncStatus('answer-1', 'SYNCED');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_answers', 'answer-1', {
        syncStatus: 'SYNCED',
        syncedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('markManySynced', () => {
    it('should mark multiple answers as synced', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.markManySynced(['answer-1', 'answer-2']);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("SET syncStatus = 'SYNCED'"),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await ChecklistAnswerRepository.markManySynced([]);

      expect(mockRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('markSyncedWithServerId', () => {
    it('should update answer when server ID matches', async () => {
      mockFindOne.mockResolvedValue(mockAnswer);
      mockUpdate.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.markSyncedWithServerId('local-1', 'answer-1');

      expect(mockUpdate).toHaveBeenCalledWith('checklist_answers', 'answer-1', {
        syncStatus: 'SYNCED',
        syncedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should create new and delete old when server ID differs', async () => {
      mockFindOne.mockResolvedValue(mockAnswer);
      mockInsert.mockResolvedValue(undefined);
      mockRemove.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.markSyncedWithServerId('local-1', 'server-id-123');

      expect(mockInsert).toHaveBeenCalledWith('checklist_answers', expect.objectContaining({
        id: 'server-id-123',
        syncStatus: 'SYNCED',
      }));
      expect(mockRemove).toHaveBeenCalledWith('checklist_answers', 'answer-1');
    });

    it('should do nothing if answer not found', async () => {
      mockFindOne.mockResolvedValue(null);

      await ChecklistAnswerRepository.markSyncedWithServerId('non-existent', 'server-id');

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete answer', async () => {
      mockRemove.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.delete('answer-1');

      expect(mockRemove).toHaveBeenCalledWith('checklist_answers', 'answer-1');
    });
  });

  describe('deleteByInstance', () => {
    it('should delete all answers of an instance', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.deleteByInstance('instance-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM checklist_answers'),
        ['instance-1']
      );
    });
  });

  describe('batchUpsert', () => {
    it('should batch upsert answers', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await ChecklistAnswerRepository.batchUpsert([mockAnswer]);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO checklist_answers'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await ChecklistAnswerRepository.batchUpsert([]);

      expect(mockRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('countBySyncStatus', () => {
    it('should return counts by sync status for instance', async () => {
      mockRawQuery.mockResolvedValue([
        { syncStatus: 'PENDING', count: 2 },
        { syncStatus: 'SYNCED', count: 5 },
      ]);

      const result = await ChecklistAnswerRepository.countBySyncStatus('instance-1');

      expect(result).toEqual({
        PENDING: 2,
        SYNCING: 0,
        SYNCED: 5,
        FAILED: 0,
      });
    });

    it('should return counts without instance filter', async () => {
      mockRawQuery.mockResolvedValue([
        { syncStatus: 'PENDING', count: 10 },
      ]);

      const result = await ChecklistAnswerRepository.countBySyncStatus();

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY syncStatus'),
        []
      );
      expect(result.PENDING).toBe(10);
    });
  });

  describe('countByInstance', () => {
    it('should return count of answers for instance', async () => {
      mockRawQuery.mockResolvedValue([{ count: 15 }]);

      const result = await ChecklistAnswerRepository.countByInstance('instance-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['instance-1']
      );
      expect(result).toBe(15);
    });

    it('should return 0 for empty result', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await ChecklistAnswerRepository.countByInstance('instance-1');

      expect(result).toBe(0);
    });
  });

  describe('getAnsweredQuestionIds', () => {
    it('should return answered question IDs', async () => {
      mockRawQuery.mockResolvedValue([
        { questionId: 'q1' },
        { questionId: 'q2' },
        { questionId: 'q3' },
      ]);

      const result = await ChecklistAnswerRepository.getAnsweredQuestionIds('instance-1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT questionId'),
        ['instance-1']
      );
      expect(result).toEqual(['q1', 'q2', 'q3']);
    });
  });
});
