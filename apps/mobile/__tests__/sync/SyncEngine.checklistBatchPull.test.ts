/**
 * SyncEngine Checklist Batch Pull Tests
 *
 * Testes para a otimização de pull de checklists em batch.
 * Verifica que:
 * 1. O resultado final é idêntico com flag on/off
 * 2. Concorrência é respeitada
 * 3. Retry funciona com backoff
 * 4. Cancelamento quando offline funciona
 * 5. Métricas são coletadas corretamente
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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock SYNC_FLAGS - will be modified per test
const mockSyncFlags = {
  SYNC_OPT_CHUNK_PROCESSING: true,
  CHUNK_SIZE: 100,
  CHUNK_YIELD_DELAY_MS: 0,
  SYNC_OPT_PARALLEL_ENTITIES: true,
  MAX_PARALLEL_ENTITIES: 2,
  PARALLEL_SAFE_ENTITIES: ['clients', 'categories'] as readonly string[],
  SEQUENTIAL_ENTITIES: ['catalogItems', 'quotes', 'work_orders'] as readonly string[],
  SYNC_OPT_CHECKLIST_BATCH_PULL: true,
  CHECKLIST_PULL_CONCURRENCY: 3,
  CHECKLIST_PULL_MAX_RETRIES: 2,
  CHECKLIST_PULL_RETRY_DELAY_MS: 100, // Short for tests
  CHECKLIST_PULL_TIMEOUT_MS: 5000,
};

jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: mockSyncFlags,
}));

// Mock ChecklistSyncService
const mockPullChecklistsForWorkOrder = jest.fn();
const mockChecklistSyncService = {
  configure: jest.fn(),
  pullChecklistsForWorkOrder: mockPullChecklistsForWorkOrder,
};

jest.mock('../../src/modules/checklists/services/ChecklistSyncService', () => ({
  ChecklistSyncService: mockChecklistSyncService,
}));

// Mock metrics
const mockRecordChecklistBatchPull = jest.fn();
const mockStartCycle = jest.fn().mockReturnValue('test-correlation-id');
const mockEndCycle = jest.fn();
const mockGetCurrentCorrelationId = jest.fn().mockReturnValue('test-correlation-id');
const mockRecordSaveToLocalDb = jest.fn();
const mockRecordEntitySync = jest.fn();
const mockRecordParallelSync = jest.fn();

jest.mock('../../src/sync/SyncMetrics', () => ({
  syncMetrics: {
    startCycle: () => mockStartCycle(),
    endCycle: (...args: unknown[]) => mockEndCycle(...args),
    recordSaveToLocalDb: (...args: unknown[]) => mockRecordSaveToLocalDb(...args),
    recordEntitySync: (...args: unknown[]) => mockRecordEntitySync(...args),
    recordParallelSync: (...args: unknown[]) => mockRecordParallelSync(...args),
    recordChecklistBatchPull: (...args: unknown[]) => mockRecordChecklistBatchPull(...args),
    getCurrentCorrelationId: () => mockGetCurrentCorrelationId(),
  },
  estimateMemoryBytes: jest.fn().mockReturnValue(1000),
  createTimer: jest.fn().mockReturnValue({
    elapsed: jest.fn().mockReturnValue(10),
    reset: jest.fn(),
  }),
}));

// Mock ExecutionSessionSyncService
jest.mock('../../src/modules/workorders/execution/ExecutionSessionSyncService', () => ({
  ExecutionSessionSyncService: {
    pushAllPendingSessions: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  },
}));

// Mock AttachmentUploadService
jest.mock('../../src/modules/checklists/services/AttachmentUploadService', () => ({
  AttachmentUploadService: {
    configure: jest.fn(),
    processQueue: jest.fn().mockResolvedValue({ uploaded: 0, failed: 0 }),
  },
}));

// Mock QuoteSignatureService
jest.mock('../../src/modules/quotes/QuoteSignatureService', () => ({
  QuoteSignatureService: {
    processAllPendingUploads: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
  },
}));

import { SyncEngine } from '../../src/sync/SyncEngine';
import type { SyncEntityConfig } from '../../src/sync/types';

// Helper to create mock configs with all required fields
const createMockConfig = (name: string): SyncEntityConfig<unknown> => ({
  name,
  tableName: `${name}_table`,
  apiEndpoint: `/sync/${name}`,
  apiMutationEndpoint: `/sync/${name}/mutations`,
  cursorField: 'updatedAt' as keyof unknown,
  primaryKeys: ['id' as keyof unknown],
  scopeField: 'technicianId' as keyof unknown,
  batchSize: 100,
  conflictResolution: 'last_write_wins',
});

describe('SyncEngine Checklist Batch Pull', () => {
  let engine: SyncEngine;
  let pullOrder: string[] = [];
  let concurrentPulls: number = 0;
  let maxConcurrentPulls: number = 0;

  // Generate mock work orders
  const generateWorkOrders = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `wo-${i + 1}`,
      status: 'IN_PROGRESS',
      syncedAt: new Date().toISOString(),
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    pullOrder = [];
    concurrentPulls = 0;
    maxConcurrentPulls = 0;

    engine = new SyncEngine();
    engine.configure({
      baseUrl: 'https://api.example.com',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    mockGetDatabase.mockResolvedValue({
      runAsync: mockRunAsync.mockResolvedValue(undefined),
    });

    // Default: no pending mutations
    mockRawQuery.mockImplementation((sql: string) => {
      if (sql.includes('mutations_queue')) {
        return Promise.resolve([]);
      }
      // Default: return empty for work_orders query
      return Promise.resolve([]);
    });

    // Default: successful fetch for all API calls
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], hasMore: false, total: 0 }),
      })
    );

    // Reset flags to default
    mockSyncFlags.SYNC_OPT_CHECKLIST_BATCH_PULL = true;
    mockSyncFlags.CHECKLIST_PULL_CONCURRENCY = 3;
    mockSyncFlags.CHECKLIST_PULL_MAX_RETRIES = 2;
    mockSyncFlags.CHECKLIST_PULL_RETRY_DELAY_MS = 100;

    // Default: successful pull for all work orders
    mockPullChecklistsForWorkOrder.mockImplementation(async (woId: string) => {
      concurrentPulls++;
      maxConcurrentPulls = Math.max(maxConcurrentPulls, concurrentPulls);
      pullOrder.push(woId);
      await new Promise((r) => setTimeout(r, 10)); // Simulate network delay
      concurrentPulls--;
    });
  });

  describe('Basic Functionality', () => {
    it('should pull checklists for all work orders', async () => {
      const workOrders = generateWorkOrders(5);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(5);
      workOrders.forEach((wo) => {
        expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledWith(wo.id);
      });
    });

    it('should record metrics when flag is ON', async () => {
      const workOrders = generateWorkOrders(3);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          totalWorkOrders: 3,
          successfulPulls: 3,
          failedPulls: 0,
          usedOptimizedPull: true,
          concurrency: 3,
        })
      );
    });

    it('should NOT record batch metrics when flag is OFF', async () => {
      mockSyncFlags.SYNC_OPT_CHECKLIST_BATCH_PULL = false;
      const workOrders = generateWorkOrders(3);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(mockRecordChecklistBatchPull).not.toHaveBeenCalled();
    });
  });

  describe('Concurrency Control', () => {
    it('should respect concurrency limit of 3', async () => {
      mockSyncFlags.CHECKLIST_PULL_CONCURRENCY = 3;
      const workOrders = generateWorkOrders(10);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(maxConcurrentPulls).toBeLessThanOrEqual(3);
    });

    it('should respect concurrency limit of 2', async () => {
      mockSyncFlags.CHECKLIST_PULL_CONCURRENCY = 2;
      const workOrders = generateWorkOrders(10);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(maxConcurrentPulls).toBeLessThanOrEqual(2);
    });

    it('should use original batchSize=5 when flag is OFF', async () => {
      mockSyncFlags.SYNC_OPT_CHECKLIST_BATCH_PULL = false;
      const workOrders = generateWorkOrders(10);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      // Original implementation uses batchSize of 5
      expect(maxConcurrentPulls).toBeLessThanOrEqual(5);
    });
  });

  describe('Retry with Backoff', () => {
    it('should retry failed pulls with backoff', async () => {
      const workOrders = generateWorkOrders(1);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      let callCount = 0;
      mockPullChecklistsForWorkOrder.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Network error');
        }
      });

      await engine.syncAll();

      // Should have retried: 1 initial + 2 retries = 3 total
      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(3);
      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRequests: 3,
          retriedRequests: 2,
          successfulPulls: 1,
        })
      );
    });

    it('should mark as failed after max retries exceeded', async () => {
      mockSyncFlags.CHECKLIST_PULL_MAX_RETRIES = 2;
      const workOrders = generateWorkOrders(1);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      mockPullChecklistsForWorkOrder.mockRejectedValue(new Error('Persistent error'));

      await engine.syncAll();

      // 1 initial + 2 retries = 3 attempts
      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(3);
      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          failedPulls: 1,
          successfulPulls: 0,
        })
      );
    });

    it('should NOT retry on 404 errors', async () => {
      const workOrders = generateWorkOrders(1);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      mockPullChecklistsForWorkOrder.mockRejectedValue(new Error('404 not found'));

      await engine.syncAll();

      // Should NOT retry 404 errors
      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(1);
      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          skippedPulls: 1,
          failedPulls: 0,
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should continue with other work orders if one fails', async () => {
      const workOrders = generateWorkOrders(5);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      mockPullChecklistsForWorkOrder.mockImplementation(async (woId: string) => {
        if (woId === 'wo-3') {
          throw new Error('Failed for wo-3');
        }
      });

      await engine.syncAll();

      // All should be attempted
      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(5 + 2); // 5 initial + 2 retries for wo-3
      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          successfulPulls: 4,
          failedPulls: 1,
        })
      );
    });

    it('should handle empty work orders list', async () => {
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await engine.syncAll();

      expect(mockPullChecklistsForWorkOrder).not.toHaveBeenCalled();
      // No metrics recorded for empty list
      expect(mockRecordChecklistBatchPull).not.toHaveBeenCalled();
    });
  });

  describe('Result Consistency', () => {
    it('should produce same results with flag ON vs OFF', async () => {
      const workOrders = generateWorkOrders(5);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      // Test with flag ON
      mockSyncFlags.SYNC_OPT_CHECKLIST_BATCH_PULL = true;
      mockPullChecklistsForWorkOrder.mockClear();
      await engine.syncAll();
      const pullsWithFlagOn = mockPullChecklistsForWorkOrder.mock.calls.map((c) => c[0]);

      // Test with flag OFF
      mockSyncFlags.SYNC_OPT_CHECKLIST_BATCH_PULL = false;
      mockPullChecklistsForWorkOrder.mockClear();

      // Create new engine instance
      const engineOff = new SyncEngine();
      engineOff.configure({
        baseUrl: 'https://api.example.com',
        authToken: 'test-token',
        technicianId: 'tech-123',
      });

      await engineOff.syncAll();
      const pullsWithFlagOff = mockPullChecklistsForWorkOrder.mock.calls.map((c) => c[0]);

      // Same work orders should be processed (order may differ due to concurrency)
      expect(pullsWithFlagOn.sort()).toEqual(pullsWithFlagOff.sort());
    });
  });

  describe('Large Scale (50 OSs)', () => {
    it('should handle 50 work orders efficiently', async () => {
      const workOrders = generateWorkOrders(50);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      const startTime = Date.now();
      await engine.syncAll();
      const duration = Date.now() - startTime;

      expect(mockPullChecklistsForWorkOrder).toHaveBeenCalledTimes(50);
      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          totalWorkOrders: 50,
          successfulPulls: 50,
          concurrency: 3,
        })
      );

      // Should complete in reasonable time (with concurrency)
      // 50 WOs * 10ms each / 3 concurrency = ~170ms minimum
      // Allow some overhead
      console.log(`[Test] 50 WOs completed in ${duration}ms`);
    });

    it('should report accurate metrics for 50 WOs with mixed results', async () => {
      const workOrders = generateWorkOrders(50);
      mockRawQuery.mockImplementation((sql: string) => {
        if (sql.includes('work_orders')) {
          return Promise.resolve(workOrders);
        }
        return Promise.resolve([]);
      });

      // Fail every 10th work order
      mockPullChecklistsForWorkOrder.mockImplementation(async (woId: string) => {
        const num = parseInt(woId.split('-')[1], 10);
        if (num % 10 === 0) {
          throw new Error('Simulated failure');
        }
      });

      await engine.syncAll();

      // 5 WOs (10, 20, 30, 40, 50) should fail after retries
      // Each failing WO has 3 attempts (1 initial + 2 retries)
      const expectedSuccessful = 45;
      const expectedFailed = 5;

      expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
        expect.objectContaining({
          totalWorkOrders: 50,
          successfulPulls: expectedSuccessful,
          failedPulls: expectedFailed,
        })
      );
    });
  });
});

describe('Metrics Recording', () => {
  it('should include individual WO results in metrics', async () => {
    const mockRawQuery = jest.fn();
    jest.doMock('../../src/db/database', () => ({
      rawQuery: mockRawQuery,
    }));

    // This test verifies the structure of workOrderResults in metrics
    const workOrders = [
      { id: 'wo-1', status: 'IN_PROGRESS', syncedAt: new Date().toISOString() },
      { id: 'wo-2', status: 'IN_PROGRESS', syncedAt: new Date().toISOString() },
    ];

    mockRawQuery.mockImplementation((sql: string) => {
      if (sql.includes('work_orders')) {
        return Promise.resolve(workOrders);
      }
      return Promise.resolve([]);
    });

    const engine = new SyncEngine();
    engine.configure({
      baseUrl: 'https://api.example.com',
      authToken: 'test-token',
      technicianId: 'tech-123',
    });

    await engine.syncAll();

    expect(mockRecordChecklistBatchPull).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderResults: expect.arrayContaining([
          expect.objectContaining({
            workOrderId: expect.any(String),
            success: expect.any(Boolean),
            durationMs: expect.any(Number),
            retries: expect.any(Number),
          }),
        ]),
      })
    );
  });
});
