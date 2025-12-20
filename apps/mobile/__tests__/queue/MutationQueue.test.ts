/**
 * Tests for MutationQueue
 *
 * Note: These tests mock the database module to avoid actual SQLite calls.
 */

import { MutationQueue } from '../../src/queue/MutationQueue';

// Mock the database module
jest.mock('../../src/db', () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
    })
  ),
  rawQuery: jest.fn(),
}));

import { getDatabase, rawQuery } from '../../src/db';

const mockGetDatabase = getDatabase as jest.Mock;
const mockRawQuery = rawQuery as jest.Mock;

describe('MutationQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should enqueue a mutation', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 42 })),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      const id = await MutationQueue.enqueue(
        'clients',
        'client-123',
        'create',
        { name: 'John Doe' }
      );

      expect(id).toBe(42);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mutations_queue'),
        expect.arrayContaining(['clients', 'client-123', 'create'])
      );
    });

    it('should serialize payload as JSON', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1 })),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      const payload = { name: 'John', age: 30 };
      await MutationQueue.enqueue('clients', 'client-123', 'create', payload);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(payload)])
      );
    });
  });

  describe('getPending', () => {
    it('should return pending mutations', async () => {
      const mockMutations = [
        { id: 1, entity: 'clients', entityId: 'c1', status: 'pending' },
        { id: 2, entity: 'clients', entityId: 'c2', status: 'pending' },
      ];
      mockRawQuery.mockResolvedValue(mockMutations);

      const result = await MutationQueue.getPending();

      expect(result).toEqual(mockMutations);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('pending'),
        expect.any(Array)
      );
    });

    it('should include failed mutations with less than MAX_RETRY_COUNT attempts', async () => {
      mockRawQuery.mockResolvedValue([]);

      await MutationQueue.getPending();

      // MAX_RETRY_COUNT is 5
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('attempts < ?'),
        expect.arrayContaining([5])
      );
    });

    it('should respect limit parameter', async () => {
      mockRawQuery.mockResolvedValue([]);

      await MutationQueue.getPending(25);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [25]
      );
    });
  });

  describe('getByEntity', () => {
    it('should return mutations for specific entity', async () => {
      const mockMutations = [
        { id: 1, entity: 'clients', entityId: 'c1' },
      ];
      mockRawQuery.mockResolvedValue(mockMutations);

      const result = await MutationQueue.getByEntity('clients', 'c1');

      expect(result).toEqual(mockMutations);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('entity = ? AND entityId = ?'),
        ['clients', 'c1']
      );
    });
  });

  describe('markProcessing', () => {
    it('should update status to processing', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve()),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.markProcessing(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("status = 'processing'"),
        expect.arrayContaining([1])
      );
    });

    it('should increment attempts', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve()),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.markProcessing(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('attempts = attempts + 1'),
        expect.any(Array)
      );
    });
  });

  describe('markCompleted', () => {
    it('should update status to completed', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve()),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.markCompleted(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        [1]
      );
    });
  });

  describe('markFailed', () => {
    it('should update status to failed with error message', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve()),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.markFailed(1, 'Network error');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        ['Network error', 1]
      );
    });
  });

  describe('remove', () => {
    it('should delete mutation from queue', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve()),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.remove(1);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM mutations_queue'),
        [1]
      );
    });
  });

  describe('cleanup', () => {
    it('should delete old completed mutations', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve({ changes: 5 })),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      const result = await MutationQueue.cleanup(7);

      expect(result).toBe(5);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("status = 'completed'"),
        expect.any(Array)
      );
    });

    it('should default to 7 days', async () => {
      const mockDb = {
        runAsync: jest.fn(() => Promise.resolve({ changes: 0 })),
      };
      mockGetDatabase.mockResolvedValue(mockDb);

      await MutationQueue.cleanup();

      expect(mockDb.runAsync).toHaveBeenCalled();
    });
  });

  describe('countPending', () => {
    it('should return count of pending mutations', async () => {
      mockRawQuery.mockResolvedValue([{ count: 10 }]);

      const result = await MutationQueue.countPending();

      expect(result).toBe(10);
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'pending'")
      );
    });

    it('should return 0 when no pending mutations', async () => {
      mockRawQuery.mockResolvedValue([]);

      const result = await MutationQueue.countPending();

      expect(result).toBe(0);
    });
  });

  describe('hasPendingFor', () => {
    it('should return true when has pending mutations', async () => {
      mockRawQuery.mockResolvedValue([{ count: 2 }]);

      const result = await MutationQueue.hasPendingFor('clients', 'c1');

      expect(result).toBe(true);
    });

    it('should return false when no pending mutations', async () => {
      mockRawQuery.mockResolvedValue([{ count: 0 }]);

      const result = await MutationQueue.hasPendingFor('clients', 'c1');

      expect(result).toBe(false);
    });

    it('should check for both pending and processing status', async () => {
      mockRawQuery.mockResolvedValue([{ count: 0 }]);

      await MutationQueue.hasPendingFor('clients', 'c1');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining("'pending', 'processing'"),
        ['clients', 'c1']
      );
    });
  });

  // ===========================================================================
  // EVENT SYSTEM TESTS (Item 5)
  // ===========================================================================

  describe('Event System (Item 5)', () => {
    beforeEach(() => {
      // Reset listener count between tests
      // Since listeners is module-level, we need to clean up
    });

    describe('subscribe', () => {
      it('should add listener and return unsubscribe function', () => {
        const listener = jest.fn();

        const unsubscribe = MutationQueue.subscribe(listener);

        expect(typeof unsubscribe).toBe('function');
        expect(MutationQueue.getListenerCount()).toBeGreaterThan(0);

        // Cleanup
        unsubscribe();
      });

      it('should remove listener on unsubscribe', () => {
        const listener = jest.fn();
        const initialCount = MutationQueue.getListenerCount();

        const unsubscribe = MutationQueue.subscribe(listener);
        expect(MutationQueue.getListenerCount()).toBe(initialCount + 1);

        unsubscribe();
        expect(MutationQueue.getListenerCount()).toBe(initialCount);
      });

      it('should support multiple listeners', () => {
        const listener1 = jest.fn();
        const listener2 = jest.fn();
        const initialCount = MutationQueue.getListenerCount();

        const unsub1 = MutationQueue.subscribe(listener1);
        const unsub2 = MutationQueue.subscribe(listener2);

        expect(MutationQueue.getListenerCount()).toBe(initialCount + 2);

        unsub1();
        unsub2();
      });
    });

    describe('event emission', () => {
      it('should emit mutation_added on enqueue', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 42 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 1 }]); // For countPending

        await MutationQueue.enqueue('clients', 'c1', 'create', { name: 'Test' });

        // Wait for async event emission
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutation_added',
            mutationId: 42,
            entity: 'clients',
            entityId: 'c1',
            pendingCount: expect.any(Number),
            timestamp: expect.any(Date),
          })
        );

        unsubscribe();
      });

      it('should emit mutation_completed on markCompleted', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve()),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 0 }]); // For countPending

        await MutationQueue.markCompleted(123);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutation_completed',
            mutationId: 123,
            pendingCount: expect.any(Number),
          })
        );

        unsubscribe();
      });

      it('should emit mutation_failed on markFailed', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve()),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 1 }]);

        await MutationQueue.markFailed(456, 'Network error');

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutation_failed',
            mutationId: 456,
          })
        );

        unsubscribe();
      });

      it('should emit mutation_removed on remove', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve()),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 0 }]);

        await MutationQueue.remove(789);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutation_removed',
            mutationId: 789,
          })
        );

        unsubscribe();
      });

      it('should emit mutations_reset on resetFailed with changes', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ changes: 3 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 3 }]);

        await MutationQueue.resetFailed();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutations_reset',
            pendingCount: 3,
          })
        );

        unsubscribe();
      });

      it('should NOT emit mutations_reset on resetFailed with no changes', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ changes: 0 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);

        await MutationQueue.resetFailed();

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).not.toHaveBeenCalled();

        unsubscribe();
      });

      it('should emit mutations_cleanup on cleanup with changes', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ changes: 5 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 2 }]);

        await MutationQueue.cleanup(7);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mutations_cleanup',
          })
        );

        unsubscribe();
      });

      it('should include pendingCount in all events', async () => {
        const listener = jest.fn();
        const unsubscribe = MutationQueue.subscribe(listener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 42 }]); // countPending returns 42

        await MutationQueue.enqueue('clients', 'c1', 'create', {});

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            pendingCount: 42,
          })
        );

        unsubscribe();
      });
    });

    describe('error handling', () => {
      it('should not throw if listener throws', async () => {
        const errorListener = jest.fn(() => {
          throw new Error('Listener error');
        });
        const normalListener = jest.fn();

        const unsub1 = MutationQueue.subscribe(errorListener);
        const unsub2 = MutationQueue.subscribe(normalListener);

        const mockDb = {
          runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1 })),
        };
        mockGetDatabase.mockResolvedValue(mockDb);
        mockRawQuery.mockResolvedValue([{ count: 1 }]);

        // Should not throw
        await expect(
          MutationQueue.enqueue('clients', 'c1', 'create', {})
        ).resolves.toBeDefined();

        await new Promise((resolve) => setTimeout(resolve, 10));

        // Both listeners should have been called
        expect(errorListener).toHaveBeenCalled();
        expect(normalListener).toHaveBeenCalled();

        unsub1();
        unsub2();
      });
    });
  });
});
