/**
 * SyncMetrics Tests
 *
 * Testes para o sistema de métricas de sincronização.
 */

import {
  syncMetrics,
  estimateMemoryBytes,
  createTimer,
  type SaveToLocalDbMetrics,
} from '../../src/sync/SyncMetrics';

describe('SyncMetrics', () => {
  beforeEach(() => {
    syncMetrics.clearHistory();
  });

  describe('generateCorrelationId', () => {
    it('should generate unique IDs', () => {
      const id1 = (syncMetrics as any).generateCorrelationId();
      const id2 = (syncMetrics as any).generateCorrelationId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^sync-[a-z0-9]+-[a-z0-9]+$/);
    });
  });

  describe('startCycle / endCycle', () => {
    it('should track a sync cycle', () => {
      const correlationId = syncMetrics.startCycle();

      expect(correlationId).toBeDefined();
      expect(syncMetrics.getCurrentCorrelationId()).toBe(correlationId);

      const cycle = syncMetrics.endCycle();

      expect(cycle).not.toBeNull();
      expect(cycle!.correlationId).toBe(correlationId);
      expect(cycle!.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(syncMetrics.getCurrentCorrelationId()).toBeNull();
    });

    it('should record error on cycle end', () => {
      syncMetrics.startCycle();
      const cycle = syncMetrics.endCycle('Test error');

      expect(cycle!.error).toBe('Test error');
    });

    it('should return null if no cycle is active', () => {
      const cycle = syncMetrics.endCycle();
      expect(cycle).toBeNull();
    });
  });

  describe('recordSaveToLocalDb', () => {
    it('should record metrics for entity save', () => {
      const correlationId = syncMetrics.startCycle();

      const metrics: SaveToLocalDbMetrics = {
        correlationId,
        entity: 'clients',
        totalItems: 100,
        safeDataItems: 95,
        skippedItems: 5,
        chunkSize: 100,
        chunkCount: 1,
        chunks: [],
        totalDurationMs: 50,
        avgChunkDurationMs: 50,
        maxChunkDurationMs: 50,
        usedChunkProcessing: false,
        estimatedMemoryBytes: 10000,
        startTime: 0,
        endTime: 50,
      };

      syncMetrics.recordSaveToLocalDb(metrics);

      const cycle = syncMetrics.endCycle();
      expect(cycle!.entities.get('clients')).toEqual(metrics);
    });

    it('should warn on slow chunks', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const correlationId = syncMetrics.startCycle();

      const metrics: SaveToLocalDbMetrics = {
        correlationId,
        entity: 'clients',
        totalItems: 1000,
        safeDataItems: 1000,
        skippedItems: 0,
        chunkSize: 100,
        chunkCount: 10,
        chunks: [],
        totalDurationMs: 500,
        avgChunkDurationMs: 50,
        maxChunkDurationMs: 100, // Above 50ms threshold
        usedChunkProcessing: true,
        estimatedMemoryBytes: 100000,
        startTime: 0,
        endTime: 500,
      };

      syncMetrics.recordSaveToLocalDb(metrics);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow chunk detected')
      );

      consoleSpy.mockRestore();
      syncMetrics.endCycle();
    });
  });

  describe('recordPush', () => {
    it('should record push metrics', () => {
      const correlationId = syncMetrics.startCycle();

      syncMetrics.recordPush(correlationId, 10, 100);

      const cycle = syncMetrics.endCycle();
      expect(cycle!.pushMetrics).toEqual({
        mutationsCount: 10,
        durationMs: 100,
      });
    });
  });

  describe('getHistory', () => {
    it('should keep history of cycles', () => {
      // Create 3 cycles
      for (let i = 0; i < 3; i++) {
        syncMetrics.startCycle();
        syncMetrics.endCycle();
      }

      const history = syncMetrics.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should limit history to MAX_HISTORY', () => {
      // Create 15 cycles (MAX_HISTORY is 10)
      for (let i = 0; i < 15; i++) {
        syncMetrics.startCycle();
        syncMetrics.endCycle();
      }

      const history = syncMetrics.getHistory();
      expect(history).toHaveLength(10);
    });

    it('should return a copy of history', () => {
      syncMetrics.startCycle();
      syncMetrics.endCycle();

      const history1 = syncMetrics.getHistory();
      const history2 = syncMetrics.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      syncMetrics.startCycle();
      syncMetrics.endCycle();

      syncMetrics.clearHistory();

      expect(syncMetrics.getHistory()).toHaveLength(0);
    });
  });
});

describe('estimateMemoryBytes', () => {
  it('should return 0 for empty array', () => {
    expect(estimateMemoryBytes([])).toBe(0);
  });

  it('should estimate memory for simple objects', () => {
    const data = [
      { id: '1', name: 'Test' },
      { id: '2', name: 'Test 2' },
    ];

    const estimate = estimateMemoryBytes(data);

    // Should be positive and reasonable
    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBeLessThan(10000); // Small objects shouldn't be huge
  });

  it('should scale with array size', () => {
    const smallData = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `Name ${i}` }));
    const largeData = Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, name: `Name ${i}` }));

    const smallEstimate = estimateMemoryBytes(smallData);
    const largeEstimate = estimateMemoryBytes(largeData);

    // Large should be roughly 10x small
    expect(largeEstimate).toBeGreaterThan(smallEstimate * 5);
    expect(largeEstimate).toBeLessThan(smallEstimate * 15);
  });

  it('should handle objects with various types', () => {
    const data = [
      {
        id: '1',
        name: 'Test',
        count: 42,
        active: true,
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      },
    ];

    const estimate = estimateMemoryBytes(data);
    expect(estimate).toBeGreaterThan(0);
  });
});

describe('createTimer', () => {
  it('should measure elapsed time', async () => {
    const timer = createTimer();

    // Wait a bit
    await new Promise((r) => setTimeout(r, 10));

    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(5); // At least 5ms (allowing for timer imprecision)
  });

  it('should reset timer', async () => {
    const timer = createTimer();

    await new Promise((r) => setTimeout(r, 20));
    const firstElapsed = timer.elapsed();

    timer.reset();

    const afterReset = timer.elapsed();
    expect(afterReset).toBeLessThan(firstElapsed);
  });

  it('should track time independently', () => {
    const timer1 = createTimer();
    const timer2 = createTimer();

    // They should be very close but independent
    const elapsed1 = timer1.elapsed();
    const elapsed2 = timer2.elapsed();

    expect(Math.abs(elapsed1 - elapsed2)).toBeLessThan(5);
  });
});
