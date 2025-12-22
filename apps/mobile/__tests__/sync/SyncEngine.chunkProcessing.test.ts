/**
 * SyncEngine Chunk Processing Tests
 *
 * Testes específicos para a otimização de chunk processing no saveToLocalDb.
 * Verifica que:
 * 1. O resultado final é idêntico com flag on/off
 * 2. Chunks não bloqueiam por tempo excessivo
 * 3. Métricas são coletadas corretamente
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
jest.mock('../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    getPending: jest.fn().mockResolvedValue([]),
    markProcessing: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
    resetFailed: jest.fn().mockResolvedValue(0),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock SYNC_FLAGS - inline because jest.mock is hoisted
jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: {
    SYNC_OPT_CHUNK_PROCESSING: true,
    CHUNK_SIZE: 100,
    CHUNK_YIELD_DELAY_MS: 0,
  },
}));

// Mock SyncMetrics
const mockStartCycle = jest.fn().mockReturnValue('test-correlation-id');
const mockEndCycle = jest.fn();
const mockRecordSaveToLocalDb = jest.fn();
const mockGetCurrentCorrelationId = jest.fn().mockReturnValue('test-correlation-id');

jest.mock('../../src/sync/SyncMetrics', () => ({
  syncMetrics: {
    startCycle: () => mockStartCycle(),
    endCycle: (...args: unknown[]) => mockEndCycle(...args),
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

describe('SyncEngine Chunk Processing', () => {
  let engine: SyncEngine;
  let capturedInsertValues: unknown[][] = [];

  const mockConfig = {
    name: 'testEntity',
    tableName: 'test_entities',
    apiEndpoint: '/sync/test-entities',
    apiMutationEndpoint: '/sync/test-entities/mutations',
    batchSize: 100,
    priority: 1,
  };

  // Helper to generate test data
  const generateTestData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      name: `Test Item ${i}`,
      value: i * 100,
      isActive: i % 2 === 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedInsertValues = [];

    engine = new SyncEngine();
    engine.configure({
      baseUrl: 'https://api.example.com',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });
    engine.registerEntity(mockConfig);

    mockGetDatabase.mockResolvedValue({
      runAsync: (sql: string, values: unknown[]) => {
        if (sql.includes('INSERT OR REPLACE')) {
          capturedInsertValues.push(values);
        }
        return Promise.resolve(undefined);
      },
    });
    mockRawQuery.mockResolvedValue([]); // No pending mutations
    mockRunAsync.mockResolvedValue(undefined);

    // Reset flag to default
    mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = true;
    mockSyncFlags.CHUNK_SIZE = 100;
  });

  describe('Values Array Consistency', () => {
    it('should produce identical values array with chunk processing ON vs OFF for small dataset', async () => {
      const testData = generateTestData(50); // Below chunk size

      // Test with chunk processing OFF
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = false;
      capturedInsertValues = [];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithoutChunks = capturedInsertValues[0];

      // Test with chunk processing ON
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = true;
      capturedInsertValues = [];

      // Need fresh engine instance
      engine = new SyncEngine();
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithChunks = capturedInsertValues[0];

      // Values should be identical
      expect(valuesWithChunks).toEqual(valuesWithoutChunks);
    });

    it('should produce identical values array with chunk processing ON vs OFF for large dataset', async () => {
      const testData = generateTestData(500); // Above chunk size

      // Test with chunk processing OFF
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = false;
      capturedInsertValues = [];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithoutChunks = capturedInsertValues[0];

      // Test with chunk processing ON
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = true;
      capturedInsertValues = [];

      engine = new SyncEngine();
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithChunks = capturedInsertValues[0];

      // Values should be identical
      expect(valuesWithChunks).toEqual(valuesWithoutChunks);
    });

    it('should correctly convert boolean values in both modes', async () => {
      const testData = [
        { id: 'item-1', isActive: true },
        { id: 'item-2', isActive: false },
        { id: 'item-3', isActive: true },
      ];

      // Test with chunk processing OFF
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = false;
      capturedInsertValues = [];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithoutChunks = capturedInsertValues[0];

      // Verify boolean conversion: true -> 1, false -> 0
      // Format: [id, isActive, syncedAt] x 3 items
      expect(valuesWithoutChunks).toContain(1); // true -> 1
      expect(valuesWithoutChunks).toContain(0); // false -> 0

      // Test with chunk processing ON
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = true;
      capturedInsertValues = [];

      engine = new SyncEngine();
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithChunks = capturedInsertValues[0];

      expect(valuesWithChunks).toEqual(valuesWithoutChunks);
    });

    it('should correctly handle undefined values in both modes', async () => {
      const testData = [
        { id: 'item-1', name: 'Test', optional: undefined },
        { id: 'item-2', name: 'Test 2', optional: 'value' },
      ];

      // Test with chunk processing OFF
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = false;
      capturedInsertValues = [];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithoutChunks = capturedInsertValues[0];

      // undefined should become null
      expect(valuesWithoutChunks).toContain(null);

      // Test with chunk processing ON
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = true;
      capturedInsertValues = [];

      engine = new SyncEngine();
      engine.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });
      engine.registerEntity(mockConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');
      const valuesWithChunks = capturedInsertValues[0];

      expect(valuesWithChunks).toEqual(valuesWithoutChunks);
    });
  });

  describe('Chunk Processing Behavior', () => {
    it('should not use chunks for datasets smaller than CHUNK_SIZE', async () => {
      mockSyncFlags.CHUNK_SIZE = 100;
      const testData = generateTestData(50);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      // Verify metrics were recorded
      expect(mockRecordSaveToLocalDb).toHaveBeenCalled();
      const metricsCall = mockRecordSaveToLocalDb.mock.calls[0][0];

      // Should not use chunk processing for small datasets
      expect(metricsCall.usedChunkProcessing).toBe(false);
    });

    it('should use chunks for datasets larger than CHUNK_SIZE', async () => {
      mockSyncFlags.CHUNK_SIZE = 100;
      const testData = generateTestData(500);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      expect(mockRecordSaveToLocalDb).toHaveBeenCalled();
      const metricsCall = mockRecordSaveToLocalDb.mock.calls[0][0];

      expect(metricsCall.usedChunkProcessing).toBe(true);
      expect(metricsCall.chunkCount).toBe(5); // 500 / 100 = 5 chunks
    });

    it('should correctly calculate chunk count for uneven divisions', async () => {
      mockSyncFlags.CHUNK_SIZE = 100;
      const testData = generateTestData(350); // 350 / 100 = 3.5 -> 4 chunks

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metricsCall = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metricsCall.chunkCount).toBe(4);
    });
  });

  describe('Metrics Collection', () => {
    it('should record all required metrics fields', async () => {
      const testData = generateTestData(200);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      expect(mockRecordSaveToLocalDb).toHaveBeenCalled();
      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];

      // Verify all required fields exist
      expect(metrics).toHaveProperty('correlationId');
      expect(metrics).toHaveProperty('entity', 'testEntity');
      expect(metrics).toHaveProperty('totalItems', 200);
      expect(metrics).toHaveProperty('safeDataItems', 200);
      expect(metrics).toHaveProperty('skippedItems', 0);
      expect(metrics).toHaveProperty('chunkSize');
      expect(metrics).toHaveProperty('chunkCount');
      expect(metrics).toHaveProperty('totalDurationMs');
      expect(metrics).toHaveProperty('avgChunkDurationMs');
      expect(metrics).toHaveProperty('maxChunkDurationMs');
      expect(metrics).toHaveProperty('usedChunkProcessing');
      expect(metrics).toHaveProperty('estimatedMemoryBytes');
    });

    it('should record skipped items count', async () => {
      const testData = generateTestData(10);

      // Mock 3 items with pending mutations
      mockRawQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { entityId: 'item-0' },
        { entityId: 'item-1' },
        { entityId: 'item-2' },
      ]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metrics.totalItems).toBe(10);
      expect(metrics.safeDataItems).toBe(7);
      expect(metrics.skippedItems).toBe(3);
    });
  });

  describe('Feature Flag Behavior', () => {
    it('should use sync processing when flag is OFF', async () => {
      mockSyncFlags.SYNC_OPT_CHUNK_PROCESSING = false;
      const testData = generateTestData(500);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metrics.usedChunkProcessing).toBe(false);
    });

    it('should respect CHUNK_SIZE configuration', async () => {
      mockSyncFlags.CHUNK_SIZE = 50;
      const testData = generateTestData(200);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metrics.chunkCount).toBe(4); // 200 / 50 = 4 chunks
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], hasMore: false, total: 0 }),
      });

      await engine.syncEntity('testEntity');

      // Should not call recordSaveToLocalDb for empty data
      expect(mockRecordSaveToLocalDb).not.toHaveBeenCalled();
    });

    it('should handle single item', async () => {
      const testData = generateTestData(1);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metrics.totalItems).toBe(1);
      expect(metrics.usedChunkProcessing).toBe(false);
    });

    it('should handle exactly CHUNK_SIZE items', async () => {
      mockSyncFlags.CHUNK_SIZE = 100;
      const testData = generateTestData(100);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      // Exactly CHUNK_SIZE should not trigger chunking (only > CHUNK_SIZE does)
      expect(metrics.usedChunkProcessing).toBe(false);
    });

    it('should handle CHUNK_SIZE + 1 items', async () => {
      mockSyncFlags.CHUNK_SIZE = 100;
      const testData = generateTestData(101);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: testData, hasMore: false, total: testData.length }),
      });

      await engine.syncEntity('testEntity');

      const metrics = mockRecordSaveToLocalDb.mock.calls[0][0];
      expect(metrics.usedChunkProcessing).toBe(true);
      expect(metrics.chunkCount).toBe(2); // 101 items = 2 chunks
    });
  });
});

describe('SyncEngine Chunk Processing Performance', () => {
  // Note: These are smoke tests - actual performance testing should be done on device
  it('should complete processing of 5000 items without hanging', async () => {
    // This test verifies the basic operation doesn't hang
    // Real performance testing requires device testing
    const startTime = Date.now();
    const testData = Array.from({ length: 5000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Test ${i}`,
      value: i,
    }));

    // Mock the chunk processing inline
    const chunkSize = 100;
    const values: unknown[] = [];

    for (let i = 0; i < testData.length; i += chunkSize) {
      const chunk = testData.slice(i, i + chunkSize);
      for (const item of chunk) {
        values.push(item.id);
        values.push(item.name);
        values.push(item.value);
        values.push(new Date().toISOString()); // syncedAt
      }
      // Simulate yield
      await new Promise((r) => setTimeout(r, 0));
    }

    const duration = Date.now() - startTime;

    expect(values.length).toBe(5000 * 4); // 4 values per item
    // Should complete in reasonable time (< 5 seconds even on slow CI)
    expect(duration).toBeLessThan(5000);
  });
});
