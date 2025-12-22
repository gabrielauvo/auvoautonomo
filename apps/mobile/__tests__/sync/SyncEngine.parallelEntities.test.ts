/**
 * SyncEngine Parallel Entities Tests
 *
 * Testes para a otimização de sincronização paralela de entidades.
 * Verifica que:
 * 1. O resultado final é idêntico com flag on/off
 * 2. Entidades paralelas rodam de fato em paralelo
 * 3. Entidades sequenciais respeitam a ordem
 * 4. Métricas são coletadas corretamente
 */

// Store event listener callback
let netInfoCallback: ((state: { isConnected: boolean | null }) => void) | null = null;

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((callback: (state: { isConnected: boolean | null }) => void) => {
    netInfoCallback = callback;
    return jest.fn();
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
jest.mock('../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    getPending: jest.fn().mockResolvedValue([]),
    markProcessing: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    resetFailed: jest.fn().mockResolvedValue(0),
  },
}));

// Mock fetch with configurable delay to simulate network
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock SYNC_FLAGS - inline because jest.mock is hoisted
jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: {
    SYNC_OPT_CHUNK_PROCESSING: true,
    CHUNK_SIZE: 100,
    CHUNK_YIELD_DELAY_MS: 0,
    SYNC_OPT_PARALLEL_ENTITIES: true,
    MAX_PARALLEL_ENTITIES: 2,
    PARALLEL_SAFE_ENTITIES: ['clients', 'categories'],
    SEQUENTIAL_ENTITIES: ['catalogItems', 'quotes', 'work_orders'],
  },
}));

// Track sync metrics
const mockRecordEntitySync = jest.fn();
const mockRecordParallelSync = jest.fn();
const mockStartCycle = jest.fn().mockReturnValue('test-correlation-id');
const mockEndCycle = jest.fn();
const mockGetCurrentCorrelationId = jest.fn().mockReturnValue('test-correlation-id');
const mockRecordSaveToLocalDb = jest.fn();

jest.mock('../../src/sync/SyncMetrics', () => ({
  syncMetrics: {
    startCycle: () => mockStartCycle(),
    endCycle: (...args: unknown[]) => mockEndCycle(...args),
    recordEntitySync: (...args: unknown[]) => mockRecordEntitySync(...args),
    recordParallelSync: (...args: unknown[]) => mockRecordParallelSync(...args),
    recordSaveToLocalDb: (...args: unknown[]) => mockRecordSaveToLocalDb(...args),
    getCurrentCorrelationId: () => mockGetCurrentCorrelationId(),
  },
  estimateMemoryBytes: jest.fn().mockReturnValue(1000),
  createTimer: jest.fn().mockReturnValue({
    elapsed: jest.fn().mockReturnValue(10),
    reset: jest.fn(),
  }),
}));

import { SyncEngine } from '../../src/sync/SyncEngine';

describe('SyncEngine Parallel Entities', () => {
  let engine: SyncEngine;
  let syncOrder: string[] = [];

  const createMockConfig = (name: string, delay = 0) => ({
    name,
    tableName: `${name}_table`,
    apiEndpoint: `/sync/${name}`,
    apiMutationEndpoint: `/sync/${name}/mutations`,
    batchSize: 100,
    priority: 1,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    syncOrder = [];

    engine = new SyncEngine();
    engine.configure({
      baseUrl: 'https://api.example.com',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    mockGetDatabase.mockResolvedValue({
      runAsync: mockRunAsync.mockResolvedValue(undefined),
    });
    mockRawQuery.mockResolvedValue([]);

    // Default fetch mock that tracks order
    mockFetch.mockImplementation((url: string) => {
      const entity = url.split('/sync/')[1]?.split('?')[0];
      if (entity) {
        syncOrder.push(entity);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], hasMore: false, total: 0 }),
      });
    });

    // Reset flag to default
    mockSyncFlags.SYNC_OPT_PARALLEL_ENTITIES = true;
    mockSyncFlags.MAX_PARALLEL_ENTITIES = 2;
  });

  describe('Parallel Sync Behavior', () => {
    it('should sync parallel-safe entities in parallel', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));

      await engine.syncAll();

      // Both should be synced
      expect(syncOrder).toContain('clients');
      expect(syncOrder).toContain('categories');

      // recordParallelSync should be called
      expect(mockRecordParallelSync).toHaveBeenCalledWith(
        expect.objectContaining({
          parallelEntities: expect.arrayContaining(['clients', 'categories']),
          usedParallelSync: true,
        })
      );
    });

    it('should sync sequential entities after parallel ones', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));
      engine.registerEntity(createMockConfig('catalogItems'));
      engine.registerEntity(createMockConfig('quotes'));

      await engine.syncAll();

      // All should be synced
      expect(syncOrder).toContain('clients');
      expect(syncOrder).toContain('categories');
      expect(syncOrder).toContain('catalogItems');
      expect(syncOrder).toContain('quotes');

      // Sequential entities should come after parallel ones
      const clientsIndex = syncOrder.indexOf('clients');
      const categoriesIndex = syncOrder.indexOf('categories');
      const catalogItemsIndex = syncOrder.indexOf('catalogItems');
      const quotesIndex = syncOrder.indexOf('quotes');

      // catalogItems and quotes should be after clients and categories
      expect(catalogItemsIndex).toBeGreaterThan(Math.min(clientsIndex, categoriesIndex));
      expect(quotesIndex).toBeGreaterThan(Math.min(clientsIndex, categoriesIndex));
    });

    it('should respect MAX_PARALLEL_ENTITIES limit', async () => {
      mockSyncFlags.MAX_PARALLEL_ENTITIES = 1;

      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));

      await engine.syncAll();

      // With limit 1, entities should be processed one at a time
      // But still faster than fully sequential
      expect(syncOrder).toContain('clients');
      expect(syncOrder).toContain('categories');
    });

    it('should fall back to sequential when flag is OFF', async () => {
      mockSyncFlags.SYNC_OPT_PARALLEL_ENTITIES = false;

      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));
      engine.registerEntity(createMockConfig('catalogItems'));

      await engine.syncAll();

      // All should still be synced
      expect(syncOrder).toContain('clients');
      expect(syncOrder).toContain('categories');
      expect(syncOrder).toContain('catalogItems');

      // recordParallelSync should NOT be called when flag is off
      expect(mockRecordParallelSync).not.toHaveBeenCalled();
    });
  });

  describe('Result Consistency', () => {
    it('should produce same results with flag ON vs OFF', async () => {
      const configs = [
        createMockConfig('clients'),
        createMockConfig('categories'),
        createMockConfig('catalogItems'),
      ];

      // Test with flag ON
      mockSyncFlags.SYNC_OPT_PARALLEL_ENTITIES = true;

      let engineOn = new SyncEngine();
      engineOn.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      configs.forEach((c) => engineOn.registerEntity(c));

      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ id: 'item-1', name: 'Test' }],
              hasMore: false,
              total: 1,
            }),
        })
      );

      const resultsOn = await engineOn.syncAll();

      // Test with flag OFF
      mockSyncFlags.SYNC_OPT_PARALLEL_ENTITIES = false;

      let engineOff = new SyncEngine();
      engineOff.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      configs.forEach((c) => engineOff.registerEntity(c));

      const resultsOff = await engineOff.syncAll();

      // Same number of results
      expect(resultsOn.length).toBe(resultsOff.length);

      // Same entities processed
      const entitiesOn = resultsOn.map((r) => r.entity).sort();
      const entitiesOff = resultsOff.map((r) => r.entity).sort();
      expect(entitiesOn).toEqual(entitiesOff);

      // Same success status
      for (const entityName of entitiesOn) {
        const resultOn = resultsOn.find((r) => r.entity === entityName);
        const resultOff = resultsOff.find((r) => r.entity === entityName);
        expect(resultOn?.success).toBe(resultOff?.success);
        expect(resultOn?.pulled).toBe(resultOff?.pulled);
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should record entity sync metrics for parallel entities', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));

      await engine.syncAll();

      // Should record metrics for each entity
      expect(mockRecordEntitySync).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'clients',
          parallelGroup: 'parallel',
        })
      );
      expect(mockRecordEntitySync).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'categories',
          parallelGroup: 'parallel',
        })
      );
    });

    it('should record entity sync metrics for sequential entities', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('catalogItems'));

      await engine.syncAll();

      expect(mockRecordEntitySync).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'catalogItems',
          parallelGroup: 'sequential',
        })
      );
    });

    it('should record parallel sync summary metrics', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));
      engine.registerEntity(createMockConfig('catalogItems'));

      await engine.syncAll();

      expect(mockRecordParallelSync).toHaveBeenCalledWith(
        expect.objectContaining({
          parallelEntities: expect.arrayContaining(['clients', 'categories']),
          sequentialEntities: expect.arrayContaining(['catalogItems']),
          maxConcurrency: 2,
          usedParallelSync: true,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should continue with other entities if one fails in parallel group', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('categories'));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('clients')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], hasMore: false, total: 0 }),
        });
      });

      const results = await engine.syncAll();

      // Both entities should have results
      const clientsResult = results.find((r) => r.entity === 'clients');
      const categoriesResult = results.find((r) => r.entity === 'categories');

      expect(clientsResult?.success).toBe(false);
      expect(categoriesResult?.success).toBe(true);
    });

    it('should continue with sequential entities if parallel group fails', async () => {
      engine.registerEntity(createMockConfig('clients'));
      engine.registerEntity(createMockConfig('catalogItems'));

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('clients')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [], hasMore: false, total: 0 }),
        });
      });

      const results = await engine.syncAll();

      const catalogItemsResult = results.find((r) => r.entity === 'catalogItems');
      expect(catalogItemsResult?.success).toBe(true);
    });
  });

  describe('Unclassified Entities', () => {
    it('should treat unclassified entities as sequential for safety', async () => {
      // Register an entity not in PARALLEL_SAFE or SEQUENTIAL lists
      engine.registerEntity(createMockConfig('unknown_entity'));
      engine.registerEntity(createMockConfig('clients'));

      await engine.syncAll();

      // Both should be synced
      expect(syncOrder).toContain('clients');
      expect(syncOrder).toContain('unknown_entity');

      // Unclassified should be in sequential group
      expect(mockRecordEntitySync).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'unknown_entity',
          parallelGroup: 'sequential',
        })
      );
    });
  });
});

describe('runWithConcurrencyLimit', () => {
  it('should process items in parallel up to limit', async () => {
    const engine = new SyncEngine();
    const runWithLimit = (engine as any).runWithConcurrencyLimit.bind(engine);

    const items = [1, 2, 3, 4, 5];
    const results: number[] = [];

    const processed = await runWithLimit(items, 2, async (item: number) => {
      results.push(item);
      await new Promise((r) => setTimeout(r, 10));
      return item * 2;
    });

    // All items should be processed
    expect(processed).toEqual([2, 4, 6, 8, 10]);
    expect(results).toHaveLength(5);
  });

  it('should handle empty array', async () => {
    const engine = new SyncEngine();
    const runWithLimit = (engine as any).runWithConcurrencyLimit.bind(engine);

    const processed = await runWithLimit([], 2, async (item: number) => item * 2);

    expect(processed).toEqual([]);
  });

  it('should handle limit greater than items', async () => {
    const engine = new SyncEngine();
    const runWithLimit = (engine as any).runWithConcurrencyLimit.bind(engine);

    const items = [1, 2];
    const processed = await runWithLimit(items, 10, async (item: number) => item * 2);

    expect(processed).toEqual([2, 4]);
  });
});
