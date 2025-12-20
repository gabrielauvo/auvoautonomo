/**
 * SyncEngine Clients Tests
 *
 * Testes para o SyncEngine com foco em clientes.
 */

// Mock NetInfo - don't call callback automatically to avoid triggering auto-sync
// The SyncEngine initializes isOnline = true by default
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn().mockReturnValue(() => {}),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

// Mock database
const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
jest.mock('../../src/db', () => ({
  getDatabase: jest.fn().mockResolvedValue({
    runAsync: (...args: any[]) => mockRunAsync(...args),
  }),
  rawQuery: jest.fn().mockResolvedValue([]),
}));

// Mock MutationQueue
jest.mock('../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    getPending: jest.fn().mockResolvedValue([]),
    markProcessing: jest.fn().mockResolvedValue(undefined),
    markCompleted: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    resetFailed: jest.fn().mockResolvedValue(0),
  },
}));

// Mock fetch
global.fetch = jest.fn();

import { SyncEngine } from '../../src/sync/SyncEngine';
import { MutationQueue } from '../../src/queue/MutationQueue';
import { rawQuery } from '../../src/db';

describe('SyncEngine - Clients', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
    syncEngine = new SyncEngine();
    syncEngine.configure({
      baseUrl: 'http://localhost:3001',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    // Register clients entity
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

  describe('Pull with pagination', () => {
    it('should fetch all pages when hasMore is true', async () => {
      // First page
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                { id: '1', name: 'Client 1', updatedAt: '2024-01-01T00:00:00.000Z' },
                { id: '2', name: 'Client 2', updatedAt: '2024-01-01T00:00:00.000Z' },
              ],
              nextCursor: 'cursor-1',
              hasMore: true,
              total: 5,
            }),
        })
        // Second page
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                { id: '3', name: 'Client 3', updatedAt: '2024-01-01T00:00:00.000Z' },
                { id: '4', name: 'Client 4', updatedAt: '2024-01-01T00:00:00.000Z' },
              ],
              nextCursor: 'cursor-2',
              hasMore: true,
              total: 5,
            }),
        })
        // Third page (last)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [
                { id: '5', name: 'Client 5', updatedAt: '2024-01-01T00:00:00.000Z' },
              ],
              nextCursor: null,
              hasMore: false,
              total: 5,
            }),
        });

      // Mock sync_meta query
      (rawQuery as jest.Mock).mockResolvedValue([]);

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(true);
      expect(result.pulled).toBe(5);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should pass cursor to subsequent requests', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: '1', name: 'Client 1', updatedAt: '2024-01-01T00:00:00.000Z' }],
              nextCursor: 'abc123',
              hasMore: true,
              total: 2,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: '2', name: 'Client 2', updatedAt: '2024-01-01T00:00:00.000Z' }],
              nextCursor: null,
              hasMore: false,
              total: 2,
            }),
        });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncEntity('clients');

      // Check second call includes cursor
      const secondCallUrl = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(secondCallUrl).toContain('cursor=abc123');
    });

    it('should use since parameter for delta sync', async () => {
      // Mock sync_meta with last sync date
      (rawQuery as jest.Mock).mockResolvedValueOnce([
        { lastCursor: 'old-cursor', lastSyncAt: '2024-01-01T00:00:00.000Z' },
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

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      // URL encodes ':' as '%3A'
      expect(callUrl).toContain('since=2024-01-01T00%3A00%3A00.000Z');
    });
  });

  describe('Push mutations', () => {
    it('should send mutations in batch', async () => {
      // Mock pending mutations
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'New Client' },
        },
        {
          id: 2,
          entity: 'clients',
          entityId: 'client-2',
          operation: 'update',
          payload: { id: 'client-2', name: 'Updated Client' },
        },
      ]);

      // Mock push response - use new mutationId format: entityId-operation-localMutationId
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { mutationId: 'client-1-create-1', status: 'applied', record: { id: 'client-1' } },
              { mutationId: 'client-2-update-2', status: 'applied', record: { id: 'client-2' } },
            ],
            serverTime: '2024-01-01T00:00:00.000Z',
          }),
      });

      // Mock pull response (empty)
      (rawQuery as jest.Mock).mockResolvedValue([]);
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

      await syncEngine.syncAll();

      // Check mutations were marked completed
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(2);
    });

    it('should mark failed mutations on error', async () => {
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'New Client' },
        },
      ]);

      // Mock push response with rejection - use new mutationId format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { mutationId: 'client-1-create-1', status: 'rejected', error: 'Client limit reached' },
            ],
            serverTime: '2024-01-01T00:00:00.000Z',
          }),
      });

      // Mock pull
      (rawQuery as jest.Mock).mockResolvedValue([]);
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

      await syncEngine.syncAll();

      expect(MutationQueue.markFailed).toHaveBeenCalledWith(1, 'Client limit reached');
    });

    it('should not duplicate mutations on retry (idempotency)', async () => {
      // Same mutation submitted twice
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([
        {
          id: 1,
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: { id: 'client-1', name: 'New Client' },
        },
      ]);

      // First successful response - use new mutationId format
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              { mutationId: 'client-1-create-1', status: 'applied', record: { id: 'client-1' } },
            ],
            serverTime: '2024-01-01T00:00:00.000Z',
          }),
      });

      (rawQuery as jest.Mock).mockResolvedValue([]);

      // First sync
      await syncEngine.syncAll();

      // Mutation should be marked completed
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith(1);

      // Reset mocks and simulate second sync
      jest.clearAllMocks();
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([]);

      // Second sync should not send any mutations
      await syncEngine.syncAll();

      // fetch should only be called for pull, not push
      const pushCalls = (global.fetch as jest.Mock).mock.calls.filter(
        (call) => call[1]?.method === 'POST'
      );
      expect(pushCalls).toHaveLength(0);
    });
  });

  describe('Conflict resolution', () => {
    it('should save to local DB using batch upsert', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'client-1',
                name: 'Server Client',
                updatedAt: '2024-01-02T00:00:00.000Z',
              },
            ],
            nextCursor: null,
            hasMore: false,
            total: 1,
          }),
      });

      // Mock sync_meta
      (rawQuery as jest.Mock).mockResolvedValueOnce([]);

      await syncEngine.syncEntity('clients');

      // Should use INSERT OR REPLACE for efficient batch upsert
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO clients'),
        expect.any(Array)
      );
    });
  });

  describe('Sync events', () => {
    it('should emit events during sync', async () => {
      const events: string[] = [];
      syncEngine.subscribe((event) => events.push(event.type));

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

      (rawQuery as jest.Mock).mockResolvedValue([]);
      (MutationQueue.getPending as jest.Mock).mockResolvedValue([]);

      await syncEngine.syncAll();

      expect(events).toContain('sync_start');
      expect(events).toContain('entity_sync_start');
      expect(events).toContain('entity_sync_complete');
      expect(events).toContain('sync_complete');
    });
  });
});
