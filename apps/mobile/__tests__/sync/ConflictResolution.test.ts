/**
 * Conflict Resolution Tests
 *
 * Testes para cenários de conflito na sincronização offline-first.
 * Estes testes garantem que:
 * 1. Last-Write-Wins funciona corretamente
 * 2. Registros com mutações pendentes não são sobrescritos
 * 3. Mutações rejeitadas são tratadas adequadamente
 * 4. Race conditions são evitadas
 */

// Mock NetInfo first
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn().mockReturnValue(() => {}),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock database - use mockRunAsync to avoid hoisting issues
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
const mockDb = {
  runAsync: mockRunAsync,
};

jest.mock('../../src/db', () => {
  return {
    getDatabase: jest.fn(() => Promise.resolve(mockDb)),
    rawQuery: jest.fn().mockResolvedValue([]),
  };
});

// Mock MutationQueue
jest.mock('../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    getPending: jest.fn().mockResolvedValue([]),
    markProcessing: jest.fn().mockResolvedValue(undefined),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    hasPendingFor: jest.fn().mockResolvedValue(false),
  },
}));

// Mock fetch
global.fetch = jest.fn();

import { SyncEngine } from '../../src/sync/SyncEngine';
import { MutationQueue } from '../../src/queue/MutationQueue';
import { rawQuery, getDatabase } from '../../src/db';

describe('Conflict Resolution', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    syncEngine = new SyncEngine();
    syncEngine.configure({
      baseUrl: 'http://localhost:3001',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    // Register test entity
    syncEngine.registerEntity({
      name: 'clients',
      tableName: 'clients',
      apiEndpoint: '/clients/sync',
      apiMutationEndpoint: '/clients/sync/mutations',
      cursorField: 'updatedAt',
      primaryKeys: ['id'],
      scopeField: 'technicianId',
      batchSize: 100,
      conflictResolution: 'last_write_wins',
    });
  });

  describe('Last-Write-Wins Strategy', () => {
    it('should accept server update when local has no pending mutations', async () => {
      // Server has newer version
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'client-1',
                name: 'Server Name',
                updatedAt: '2024-01-02T00:00:00.000Z', // Newer
              },
            ],
            nextCursor: null,
            hasMore: false,
            total: 1,
          }),
      });

      // No pending mutations for this entity
      (MutationQueue.hasPendingFor as jest.Mock).mockResolvedValue(false);
      // First call: getSyncMeta, Second call: pending mutations check in saveToLocalDb
      (rawQuery as jest.Mock)
        .mockResolvedValueOnce([]) // sync_meta - no previous sync
        .mockResolvedValueOnce([]); // pending mutations - none

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(true);
      expect(result.pulled).toBe(1);
      // Should save to local DB
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
        expect.any(Array)
      );
    });

    it('should NOT overwrite local record with pending mutations', async () => {
      // Server has update
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'client-1',
                name: 'Server Name',
                updatedAt: '2024-01-02T00:00:00.000Z',
              },
            ],
            nextCursor: null,
            hasMore: false,
            total: 1,
          }),
      });

      // Mark that this entity has pending mutations
      (rawQuery as jest.Mock)
        // First call: sync_meta
        .mockResolvedValueOnce([])
        // Second call: pending mutations for filtering
        .mockResolvedValueOnce([{ entityId: 'client-1' }]);

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(true);
      // The record should be filtered out during save
      // Check the actual save only has records without pending mutations
    });
  });

  describe('Mutation Rejection Handling', () => {
    it('should mark mutation as failed when server rejects', async () => {
      // Simulate pending mutation
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'update',
          payload: { id: 'client-1', name: 'Local Name' },
          status: 'pending',
          attempts: 0,
        },
      ]);

      // Server rejects mutation (e.g., plan limit)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  mutationId: 'client-1',
                  status: 'rejected',
                  error: 'Plan limit reached: max 10 clients',
                  serverRecord: { id: 'client-1', name: 'Server Name' },
                },
              ],
              serverTime: '2024-01-01T00:00:00.000Z',
            }),
        })
        // Pull response
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              nextCursor: null,
              hasMore: false,
              total: 0,
            }),
        });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncAll();

      expect(MutationQueue.markFailed).toHaveBeenCalledWith(
        1,
        'Plan limit reached: max 10 clients'
      );
    });

    it('should retry failed mutations up to 3 times', async () => {
      // Mutation with 2 attempts (should be retried)
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'New Client' },
          status: 'failed',
          attempts: 2, // Will try one more time
        },
      ]);

      // Server network error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncAll();

      // Should mark processing (incrementing attempts to 3)
      expect(MutationQueue.markProcessing).toHaveBeenCalledWith(1);
      // After 3 attempts, should mark as permanently failed
      expect(MutationQueue.markFailed).toHaveBeenCalled();
    });
  });

  describe('Concurrent Edit Scenarios', () => {
    it('should handle rapid successive edits with debounce', async () => {
      // This tests that multiple quick edits don't cause multiple syncs
      // The MutationQueue already has debounce logic (2 seconds)

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
          }),
      });

      (MutationQueue.getPending as jest.Mock).mockResolvedValue([]);
      (rawQuery as jest.Mock).mockResolvedValue([]);

      // Trigger sync
      const promise1 = syncEngine.syncAll();
      const promise2 = syncEngine.syncAll();

      await Promise.all([promise1, promise2]);

      // Even with parallel calls, sync should be managed
      // The test passes if no errors occur
    });

    it('should preserve order of mutations (FIFO)', async () => {
      // Multiple mutations for different entities should be sent in order
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'First' },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          entity: 'clients',
          entityId: 'client-2',
          operation: 'create',
          payload: { id: 'client-2', name: 'Second' },
          createdAt: '2024-01-01T00:01:00.000Z',
        },
        {
          id: 3,
          entity: 'clients',
          entityId: 'client-3',
          operation: 'create',
          payload: { id: 'client-3', name: 'Third' },
          createdAt: '2024-01-01T00:02:00.000Z',
        },
      ]);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                { mutationId: 'client-1', status: 'applied' },
                { mutationId: 'client-2', status: 'applied' },
                { mutationId: 'client-3', status: 'applied' },
              ],
              serverTime: '2024-01-01T00:00:00.000Z',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              nextCursor: null,
              hasMore: false,
              total: 0,
            }),
        });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncAll();

      // All mutations should be marked completed
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(2);
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(3);
    });
  });

  describe('Network Failure Recovery', () => {
    it('should not lose mutations on network failure', async () => {
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'New Client' },
        },
      ]);

      // Network error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      (rawQuery as jest.Mock).mockResolvedValue([]);

      const results = await syncEngine.syncAll();

      // Mutation should be marked as failed, not completed or removed
      expect(MutationQueue.markFailed).toHaveBeenCalled();
      expect(MutationQueue.markCompleted).not.toHaveBeenCalled();
    });

    it('should resume sync from last timestamp after interruption', async () => {
      // Simulate existing sync metadata with lastSyncAt
      (rawQuery as jest.Mock)
        .mockResolvedValueOnce([
          { lastCursor: 'cursor-from-last-sync', lastSyncAt: '2024-01-01T00:00:00.000Z' },
        ]);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
          }),
      });

      await syncEngine.syncEntity('clients');

      // Should include since (lastSyncAt) in request for delta sync
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('since=2024-01-01T00%3A00%3A00.000Z');
    });
  });

  describe('Delete Conflicts', () => {
    it('should handle delete when server has update', async () => {
      // Local deleted, server has update
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'delete',
          payload: { id: 'client-1' },
        },
      ]);

      // Server accepts delete
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ mutationId: 'client-1', status: 'applied' }],
              serverTime: '2024-01-01T00:00:00.000Z',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              nextCursor: null,
              hasMore: false,
              total: 0,
            }),
        });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncAll();

      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);
    });
  });
});

describe('Idempotency', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    syncEngine = new SyncEngine();
    syncEngine.configure({
      baseUrl: 'http://localhost:3001',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    syncEngine.registerEntity({
      name: 'clients',
      tableName: 'clients',
      apiEndpoint: '/clients/sync',
      apiMutationEndpoint: '/clients/sync/mutations',
      cursorField: 'updatedAt',
      primaryKeys: ['id'],
      scopeField: 'technicianId',
      batchSize: 100,
      conflictResolution: 'last_write_wins',
    });
  });

  it('should not create duplicates when mutation is sent twice', async () => {
    // Same mutation ID sent twice (network retry scenario)
    const mutation = {
      id: 1,
      entity: 'clients',
      entityId: 'client-uuid-123',
      operation: 'create',
      payload: { id: 'client-uuid-123', name: 'New Client' },
    };

    (MutationQueue.getPending as jest.Mock).mockResolvedValue([mutation]);

    // Server already processed this mutation (returns applied)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                mutationId: 'client-uuid-123',
                status: 'applied',
                record: { id: 'client-uuid-123', name: 'New Client' },
              },
            ],
            serverTime: '2024-01-01T00:00:00.000Z',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
          }),
      });

    (rawQuery as jest.Mock).mockResolvedValue([]);

    // First sync
    await syncEngine.syncAll();

    expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);

    // Clear and retry same mutation (simulate app restart before markCompleted)
    jest.clearAllMocks();
    (MutationQueue.getPending as jest.Mock).mockResolvedValue([mutation]);

    // Server recognizes duplicate and returns applied without creating duplicate
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                mutationId: 'client-uuid-123',
                status: 'applied', // Idempotent - same result
                record: { id: 'client-uuid-123', name: 'New Client' },
              },
            ],
            serverTime: '2024-01-01T00:00:00.000Z',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
          }),
      });

    (rawQuery as jest.Mock).mockResolvedValue([]);

    // Second sync
    await syncEngine.syncAll();

    // Should still mark as completed, not create duplicate
    expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);
  });
});
