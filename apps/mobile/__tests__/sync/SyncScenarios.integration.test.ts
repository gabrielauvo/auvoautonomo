/**
 * Sync Scenarios Integration Tests
 *
 * Testes de integração de alto nível que validam cenários de sincronização.
 * Estes testes complementam os testes existentes (SyncEngine.test.ts, ConflictResolution.test.ts)
 * focando em cenários de negócio documentados em docs/sync-test-scenarios.md
 */

// ============================================================================
// MOCKS MUST BE DEFINED BEFORE ANY IMPORTS
// ============================================================================

// Store for mock state - must use 'mock' prefix for Jest
let mockNetInfoCallback: ((state: { isConnected: boolean | null }) => void) | null = null;

// Mock fetch for API calls - define before mocks that use it
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback: (state: { isConnected: boolean | null }) => void) => {
    // Store in global for access in tests
    (global as any).__mockNetInfoCallback = callback;
    return jest.fn();
  }),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

// Mock database
jest.mock('../../src/db', () => {
  const mockRunAsync = jest.fn().mockResolvedValue({ changes: 1 });
  const mockGetAllAsync = jest.fn().mockResolvedValue([]);
  return {
    getDatabase: jest.fn(() =>
      Promise.resolve({
        runAsync: mockRunAsync,
        getAllAsync: mockGetAllAsync,
      })
    ),
    rawQuery: jest.fn().mockResolvedValue([]),
  };
});

// Mock MutationQueue - all methods must be defined
jest.mock('../../src/queue/MutationQueue', () => {
  return {
    MutationQueue: {
      getPending: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(undefined),
      markProcessing: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      hasPendingFor: jest.fn().mockResolvedValue(false),
      resetFailed: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock FastPushService
jest.mock('../../src/sync/FastPushService', () => ({
  FastPushService: {
    getInstance: jest.fn(() => ({
      queueMutation: jest.fn(),
    })),
    configure: jest.fn(),
  },
}));

// Mock sync flags
jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: {
    ENABLE_FAST_PUSH: false,
    ENABLE_PARALLEL_SYNC: false,
  },
}));

// Mock fetchWithTimeout to use our mockFetch
jest.mock('../../src/utils/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn((...args: unknown[]) => (global.fetch as jest.Mock)(...args)),
}));

// Mock BulkInsertService
jest.mock('../../src/db/BulkInsertService', () => ({
  bulkInsert: jest.fn().mockResolvedValue({ inserted: 0, updated: 0, failed: 0 }),
}));

// ============================================================================
// IMPORTS AFTER MOCKS
// ============================================================================

import { SyncEngine } from '../../src/sync/SyncEngine';
import { MutationQueue } from '../../src/queue/MutationQueue';
import { rawQuery } from '../../src/db';

describe('Sync Scenarios Integration Tests', () => {
  let syncEngine: SyncEngine;

  const BASE_URL = 'http://localhost:3001';
  const AUTH_TOKEN = 'test-token';
  const TECHNICIAN_ID = 'tech-123';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations
    mockFetch.mockReset();
    (MutationQueue.getPending as jest.Mock).mockResolvedValue([]);

    syncEngine = new SyncEngine();
    syncEngine.configure({
      baseUrl: BASE_URL,
      authToken: AUTH_TOKEN,
      technicianId: TECHNICIAN_ID,
    });

    // Register test entity
    syncEngine.registerEntity({
      name: 'clients',
      tableName: 'clients',
      apiEndpoint: '/clients/sync',
      apiMutationEndpoint: '/clients/sync/mutations',
      cursorField: 'updatedAt',
      primaryKeys: ['id'],
      batchSize: 100,
    });
  });

  // ============================================================================
  // ENGINE CONFIGURATION
  // ============================================================================
  describe('Engine Configuration', () => {
    it('should be configured after setup', () => {
      expect(syncEngine.isConfigured()).toBe(true);
    });

    it('should not be configured without auth token', () => {
      const engine = new SyncEngine();
      engine.configure({
        baseUrl: BASE_URL,
        authToken: '',
        technicianId: TECHNICIAN_ID,
      });
      expect(engine.isConfigured()).toBe(false);
    });

    it('should register entities', () => {
      expect((syncEngine as any).configs.has('clients')).toBe(true);
    });
  });

  // ============================================================================
  // OFFLINE DETECTION (CLI-03)
  // ============================================================================
  describe('CLI-03: Offline Detection', () => {
    it('should skip sync when offline', async () => {
      (syncEngine as any).isOnline = false;

      const results = await syncEngine.syncAll();

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should report network status correctly', () => {
      (syncEngine as any).isOnline = true;
      expect(syncEngine.isNetworkOnline()).toBe(true);

      (syncEngine as any).isOnline = false;
      expect(syncEngine.isNetworkOnline()).toBe(false);
    });

    it('should emit online_detected when coming back online', () => {
      const listener = jest.fn();
      syncEngine.subscribe(listener);

      // Simulate going offline then online
      (syncEngine as any).isOnline = false;

      const callback = (global as any).__mockNetInfoCallback;
      if (callback) {
        callback({ isConnected: true });
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'online_detected' })
      );
    });

    it('should emit offline_detected when going offline', () => {
      const listener = jest.fn();
      syncEngine.subscribe(listener);

      (syncEngine as any).isOnline = true;

      const callback = (global as any).__mockNetInfoCallback;
      if (callback) {
        callback({ isConnected: false });
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'offline_detected' })
      );
    });
  });

  // ============================================================================
  // SYNC STATE AND EVENTS
  // ============================================================================
  describe('Sync State and Events', () => {
    it('should return initial state', () => {
      const state = syncEngine.getState();

      expect(state).toEqual(
        expect.objectContaining({
          status: 'idle',
          lastSyncAt: null,
          error: null,
        })
      );
    });

    it('should allow subscribing and unsubscribing', () => {
      const listener = jest.fn();
      const unsubscribe = syncEngine.subscribe(listener);

      // Emit event
      (syncEngine as any).emit({ type: 'test', timestamp: new Date() });
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();
      (syncEngine as any).emit({ type: 'test2', timestamp: new Date() });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should emit sync events during sync', async () => {
      const listener = jest.fn();
      syncEngine.subscribe(listener);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            hasMore: false,
            total: 0,
          }),
      });

      await syncEngine.syncAll();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_start' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_complete' })
      );
    });
  });

  // ============================================================================
  // SYNC ENTITY (CLI-01, CLI-02)
  // ============================================================================
  describe('Sync Entity Operations', () => {
    it('should throw if entity not registered', async () => {
      await expect(syncEngine.syncEntity('unknownEntity')).rejects.toThrow(
        'Entity unknownEntity not registered'
      );
    });

    it('should make API call with correct authorization', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            hasMore: false,
            total: 0,
          }),
      });

      await syncEngine.syncEntity('clients');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/clients/sync'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle successful pull response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'client-1', name: 'Test Client' }],
            hasMore: false,
            total: 1,
          }),
      });

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(true);
      expect(result.pulled).toBe(1);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await syncEngine.syncEntity('clients');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].operation).toBe('pull');
    });
  });

  // ============================================================================
  // PAGINATION (CLI-10: Large datasets)
  // ============================================================================
  describe('Pagination Support', () => {
    it('should handle pagination with cursor', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: 'item-1' }],
              cursor: 'cursor-1',
              hasMore: true,
              total: 2,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: 'item-2' }],
              cursor: 'cursor-2',
              hasMore: false,
              total: 2,
            }),
        });

      const result = await syncEngine.syncEntity('clients');

      expect(result.pulled).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // DELTA SYNC (Incremental updates)
  // ============================================================================
  describe('Delta Sync', () => {
    it('should use since parameter for delta sync', async () => {
      const lastSyncAt = '2024-01-01T00:00:00.000Z';

      (rawQuery as jest.Mock).mockResolvedValueOnce([
        { lastCursor: 'cursor-1', lastSyncAt },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            hasMore: false,
            total: 0,
          }),
      });

      await syncEngine.syncEntity('clients');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('since='),
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // SYNC WITH RETRY (EC-01: Unstable connection)
  // ============================================================================
  describe('Sync with Retry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      mockFetch.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              hasMore: false,
              total: 0,
            }),
        });
      });

      const syncPromise = syncEngine.syncWithRetry();

      // Advance timers for retries
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      await syncPromise;

      expect(attempts).toBe(3);
    });

    it('should emit retry events', async () => {
      const listener = jest.fn();
      syncEngine.subscribe(listener);

      mockFetch.mockRejectedValue(new Error('Network error'));

      const syncPromise = syncEngine.syncWithRetry();

      await jest.advanceTimersByTimeAsync(1000);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_retry' })
      );

      // Clean up
      jest.runAllTimers();
      await syncPromise.catch(() => {});
    });
  });

  // ============================================================================
  // CONCURRENT SYNC PREVENTION
  // ============================================================================
  describe('Concurrent Sync Prevention', () => {
    it('should skip sync if already syncing', async () => {
      (syncEngine as any).state.status = 'syncing';

      const results = await syncEngine.syncAll();

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // MUTATION PUSH (CLI-02: Create on Mobile)
  // ============================================================================
  describe('Mutation Push', () => {
    it('should push pending mutations before pull', async () => {
      const mutation = {
        id: '1',
        entity: 'clients',
        entityId: 'client-1',
        operation: 'create',
        payload: JSON.stringify({ id: 'client-1', name: 'New Client' }),
        status: 'pending',
        attempts: 0,
      };

      (MutationQueue.getPending as jest.Mock).mockResolvedValue([mutation]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ mutationId: 'client-1', status: 'applied' }],
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              hasMore: false,
              total: 0,
            }),
        });

      await syncEngine.syncAll();

      expect(MutationQueue.markProcessing).toHaveBeenCalledWith('1');
      expect(MutationQueue.markCompleted).toHaveBeenCalledWith('1');
    });

    it('should mark mutations as failed when rejected', async () => {
      const mutation = {
        id: '1',
        entity: 'clients',
        entityId: 'client-1',
        operation: 'create',
        payload: JSON.stringify({ id: 'client-1', name: 'New Client' }),
        status: 'pending',
        attempts: 0,
      };

      (MutationQueue.getPending as jest.Mock).mockResolvedValue([mutation]);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  mutationId: 'client-1',
                  status: 'rejected',
                  error: 'Validation error',
                },
              ],
            }),
        })
        .mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              hasMore: false,
              total: 0,
            }),
        });

      await syncEngine.syncAll();

      expect(MutationQueue.markFailed).toHaveBeenCalledWith(
        '1',
        expect.any(String)
      );
    });
  });
});

// ============================================================================
// PERFORMANCE SCENARIOS (EC-10)
// ============================================================================
describe('Performance Scenarios', () => {
  it('should handle large number of items efficiently', async () => {
    const syncEngine = new SyncEngine();
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
      batchSize: 500,
    });

    // Generate 1000 clients
    const manyClients = Array.from({ length: 1000 }, (_, i) => ({
      id: `client-${i}`,
      name: `Client ${i}`,
      updatedAt: new Date().toISOString(),
    }));

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: manyClients,
          hasMore: false,
          total: 1000,
        }),
    });

    const startTime = Date.now();
    const result = await syncEngine.syncEntity('clients');
    const duration = Date.now() - startTime;

    expect(result.pulled).toBe(1000);
    // Should complete in a reasonable time (under 5 seconds)
    expect(duration).toBeLessThan(5000);
  });
});
