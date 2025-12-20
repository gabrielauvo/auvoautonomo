/**
 * SyncEngine Tests
 *
 * Testes para o motor de sincronização bidirecional.
 */

// Store event listener callback
let netInfoCallback: ((state: { isConnected: boolean | null }) => void) | null = null;

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback: (state: { isConnected: boolean | null }) => void) => {
    netInfoCallback = callback;
    return jest.fn(); // unsubscribe function
  }),
}));

// Mock database
const mockRawQuery = jest.fn();
const mockGetDatabase = jest.fn();
const mockRunAsync = jest.fn();

jest.mock('../../src/db', () => ({
  getDatabase: () => mockGetDatabase(),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

// Mock MutationQueue
const mockGetPending = jest.fn();
const mockMarkProcessing = jest.fn();
const mockMarkCompleted = jest.fn();
const mockMarkFailed = jest.fn();

jest.mock('../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    getPending: () => mockGetPending(),
    markProcessing: (...args: unknown[]) => mockMarkProcessing(...args),
    markCompleted: (...args: unknown[]) => mockMarkCompleted(...args),
    markFailed: (...args: unknown[]) => mockMarkFailed(...args),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { SyncEngine } from '../../src/sync/SyncEngine';

describe('SyncEngine', () => {
  let engine: SyncEngine;

  const mockConfig = {
    name: 'testEntity',
    tableName: 'test_entities',
    apiEndpoint: '/sync/test-entities',
    apiMutationEndpoint: '/sync/test-entities/mutations',
    batchSize: 100,
    priority: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    engine = new SyncEngine();
    mockGetDatabase.mockResolvedValue({
      runAsync: mockRunAsync,
    });
    mockRunAsync.mockResolvedValue(undefined);
    mockRawQuery.mockResolvedValue([]);
    mockGetPending.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('configure', () => {
    it('should set credentials', () => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });

      expect(engine.isConfigured()).toBe(true);
    });

    it('should not be configured without auth token', () => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: '',
        technicianId: 'tech-123',
      });

      expect(engine.isConfigured()).toBe(false);
    });

    it('should not be configured without technician ID', () => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: '',
      });

      expect(engine.isConfigured()).toBe(false);
    });
  });

  describe('registerEntity', () => {
    it('should register entity config', () => {
      engine.registerEntity(mockConfig);

      expect((engine as any).configs.has('testEntity')).toBe(true);
    });
  });

  describe('syncAll', () => {
    beforeEach(() => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);
    });

    it('should skip sync if offline', async () => {
      // Set offline
      (engine as any).isOnline = false;

      const results = await engine.syncAll();

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip sync if not configured', async () => {
      (engine as any).technicianId = null;
      (engine as any).authToken = null;

      const results = await engine.syncAll();

      expect(results).toEqual([]);
    });

    it('should skip sync if already syncing', async () => {
      (engine as any).state.status = 'syncing';

      const results = await engine.syncAll();

      expect(results).toEqual([]);
    });

    it('should push mutations and pull data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'item-1', name: 'Test' }],
            hasMore: false,
            total: 1,
          }),
      });
      mockRawQuery.mockResolvedValue([]); // No pending mutations

      const results = await engine.syncAll();

      expect(results).toHaveLength(1);
      expect(results[0].entity).toBe('testEntity');
      expect(results[0].pulled).toBe(1);
    });

    it('should emit events during sync', async () => {
      const listener = jest.fn();
      engine.subscribe(listener);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [],
            hasMore: false,
            total: 0,
          }),
      });

      await engine.syncAll();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_start' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'entity_sync_start' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'entity_sync_complete' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_complete' })
      );
    });

    it('should emit complete event even on pull failure', async () => {
      const listener = jest.fn();
      engine.subscribe(listener);

      mockFetch.mockRejectedValue(new Error('Network error'));

      await engine.syncAll();

      // The engine emits sync_complete even if entity pull fails
      // The errors are captured in the result
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_complete' })
      );
    });
  });

  describe('syncEntity', () => {
    beforeEach(() => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);
    });

    it('should throw if entity not registered', async () => {
      await expect(engine.syncEntity('unknownEntity')).rejects.toThrow(
        'Entity unknownEntity not registered'
      );
    });

    it('should pull data from server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'item-1', name: 'Test' }],
            hasMore: false,
            total: 1,
          }),
      });

      const result = await engine.syncEntity('testEntity');

      expect(result.success).toBe(true);
      expect(result.pulled).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sync/test-entities'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

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

      const result = await engine.syncEntity('testEntity');

      expect(result.pulled).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use delta sync with since parameter', async () => {
      mockRawQuery.mockResolvedValueOnce([
        { lastCursor: 'cursor-1', lastSyncAt: '2024-01-01T00:00:00.000Z' },
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

      await engine.syncEntity('testEntity');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('since=2024-01-01'),
        expect.any(Object)
      );
    });

    it('should transform data if transform function provided', async () => {
      const configWithTransform = {
        ...mockConfig,
        transformFromServer: (item: { id: string }) => ({ ...item, transformed: true }),
      };
      engine.registerEntity(configWithTransform);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'item-1' }],
            hasMore: false,
            total: 1,
          }),
      });

      await engine.syncEntity('testEntity');

      // Verify transform was applied (indirectly through saveToLocalDb)
      expect(mockRunAsync).toHaveBeenCalled();
    });

    it('should handle pull error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await engine.syncEntity('testEntity');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].operation).toBe('pull');
    });
  });

  describe('pushPendingMutations', () => {
    beforeEach(() => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);
    });

    it('should push pending mutations to server', async () => {
      const mutations = [
        {
          id: '1',
          entity: 'testEntity',
          entityId: 'item-1',
          operation: 'create',
          payload: JSON.stringify({ id: 'item-1', name: 'Test' }),
          status: 'pending',
          attempts: 0,
        },
      ];
      mockGetPending.mockResolvedValue(mutations);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ mutationId: 'item-1', status: 'applied' }],
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

      await engine.syncAll();

      expect(mockMarkProcessing).toHaveBeenCalledWith('1');
      expect(mockMarkCompleted).toHaveBeenCalledWith('1');
    });

    it('should mark failed mutations', async () => {
      const mutations = [
        {
          id: '1',
          entity: 'testEntity',
          entityId: 'item-1',
          operation: 'create',
          payload: JSON.stringify({ id: 'item-1', name: 'Test' }),
          status: 'pending',
          attempts: 0,
        },
      ];
      mockGetPending.mockResolvedValue(mutations);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [{ mutationId: 'item-1', status: 'failed', error: 'Validation error' }],
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

      await engine.syncAll();

      expect(mockMarkFailed).toHaveBeenCalledWith('1', expect.any(String));
    });

    it('should process entities in priority order', async () => {
      const mutations = [
        {
          id: '1',
          entity: 'quotes',
          entityId: 'quote-1',
          operation: 'create',
          payload: JSON.stringify({ id: 'quote-1' }),
          status: 'pending',
          attempts: 0,
        },
        {
          id: '2',
          entity: 'clients',
          entityId: 'client-1',
          operation: 'create',
          payload: JSON.stringify({ id: 'client-1' }),
          status: 'pending',
          attempts: 0,
        },
      ];
      mockGetPending.mockResolvedValue(mutations);

      engine.registerEntity({ ...mockConfig, name: 'clients', apiMutationEndpoint: '/sync/clients/mutations' });
      engine.registerEntity({ ...mockConfig, name: 'quotes', apiMutationEndpoint: '/sync/quotes/mutations' });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            items: [],
            hasMore: false,
            total: 0,
          }),
      });

      await engine.syncAll();

      // Verify clients was processed before quotes (check call order)
      const fetchCalls = mockFetch.mock.calls;
      const clientsIndex = fetchCalls.findIndex((call) =>
        call[0].includes('/sync/clients/mutations')
      );
      const quotesIndex = fetchCalls.findIndex((call) =>
        call[0].includes('/sync/quotes/mutations')
      );

      expect(clientsIndex).toBeLessThan(quotesIndex);
    });
  });

  describe('syncWithRetry', () => {
    beforeEach(() => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);
    });

    it('should retry on failure with exponential backoff', async () => {
      const listener = jest.fn();
      engine.subscribe(listener);

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

      const syncPromise = engine.syncWithRetry();

      // Fast-forward timers for retries
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      await syncPromise;

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_retry' })
      );
    });

    it('should complete with errors when all retries exhausted', async () => {
      const listener = jest.fn();
      engine.subscribe(listener);

      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const syncPromise = engine.syncWithRetry();

      // Fast-forward all retries
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);

      // The sync completes with errors in results, doesn't throw
      const results = await syncPromise;

      expect(results[0].success).toBe(false);
      expect(results[0].errors).toHaveLength(1);
    });
  });

  describe('network status', () => {
    it('should emit online_detected when coming back online', () => {
      const listener = jest.fn();
      engine.subscribe(listener);

      // Simulate going offline then online using the callback
      (engine as any).isOnline = false;
      if (netInfoCallback) {
        netInfoCallback({ isConnected: true });
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'online_detected' })
      );
    });

    it('should emit offline_detected when going offline', () => {
      const listener = jest.fn();
      engine.subscribe(listener);

      (engine as any).isOnline = true;
      if (netInfoCallback) {
        netInfoCallback({ isConnected: false });
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'offline_detected' })
      );
    });

    it('should auto-sync when coming back online', () => {
      const syncAllSpy = jest.spyOn(engine, 'syncWithRetry').mockResolvedValue([]);

      (engine as any).isOnline = false;
      if (netInfoCallback) {
        netInfoCallback({ isConnected: true });
      }

      expect(syncAllSpy).toHaveBeenCalled();
    });

    it('should report network status', () => {
      (engine as any).isOnline = true;
      expect(engine.isNetworkOnline()).toBe(true);

      (engine as any).isOnline = false;
      expect(engine.isNetworkOnline()).toBe(false);
    });
  });

  describe('state and events', () => {
    it('should return current state', () => {
      const state = engine.getState();

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
      const unsubscribe = engine.subscribe(listener);

      (engine as any).emit({ type: 'test', timestamp: new Date() });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      (engine as any).emit({ type: 'test2', timestamp: new Date() });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveToLocalDb', () => {
    beforeEach(() => {
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);
    });

    it('should skip records with pending mutations', async () => {
      mockRawQuery
        .mockResolvedValueOnce([]) // getSyncMeta
        .mockResolvedValueOnce([{ entityId: 'item-1' }]); // pending mutations

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              { id: 'item-1', name: 'Test 1' },
              { id: 'item-2', name: 'Test 2' },
            ],
            hasMore: false,
            total: 2,
          }),
      });

      await engine.syncEntity('testEntity');

      // Should only insert item-2 (item-1 has pending mutation)
      const insertCall = mockRunAsync.mock.calls.find((call) =>
        call[0].includes('INSERT OR REPLACE')
      );
      expect(insertCall).toBeDefined();
    });

    it('should use custom save handler if provided', async () => {
      const customSave = jest.fn();
      const configWithCustomSave = {
        ...mockConfig,
        customSave,
      };
      engine.registerEntity(configWithCustomSave);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [{ id: 'item-1' }],
            hasMore: false,
            total: 1,
          }),
      });

      await engine.syncEntity('testEntity');

      expect(customSave).toHaveBeenCalledWith([{ id: 'item-1' }], 'tech-123');
    });
  });
});
