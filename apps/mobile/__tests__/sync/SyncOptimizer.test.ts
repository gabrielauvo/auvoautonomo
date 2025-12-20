/**
 * Sync Optimizer Tests
 */

import {
  syncOptimizer,
  scheduleSync,
  shouldUseFastPath,
  getSyncStatus,
  isSyncing,
  cancelPendingSync,
  cancelAllSyncs,
  debounce,
  throttle,
} from '../../src/sync/SyncOptimizer';

describe('SyncOptimizer', () => {
  beforeEach(() => {
    cancelAllSyncs();
    syncOptimizer.configure({
      debounceMs: 50,
      maxWaitMs: 200,
      maxConcurrent: 3,
      coalescingWindow: 100,
    });
  });

  afterEach(() => {
    cancelAllSyncs();
  });

  describe('scheduleSync', () => {
    it('should debounce multiple sync requests', async () => {
      const executor = jest.fn().mockResolvedValue(undefined);

      // Schedule multiple syncs rapidly
      const promise1 = scheduleSync('clients', 'list', undefined, executor);
      const promise2 = scheduleSync('clients', 'list', undefined, executor);
      const promise3 = scheduleSync('clients', 'list', undefined, executor);

      await Promise.all([promise1, promise2, promise3]);

      // Should only execute once due to debouncing
      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should execute after debounce delay', async () => {
      const executor = jest.fn().mockResolvedValue(undefined);

      scheduleSync('clients', 'list', undefined, executor);

      // Immediately after scheduling, executor should not be called
      expect(executor).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executor).toHaveBeenCalledTimes(1);
    });

    it('should handle different entities independently', async () => {
      const clientExecutor = jest.fn().mockResolvedValue(undefined);
      const orderExecutor = jest.fn().mockResolvedValue(undefined);

      scheduleSync('clients', 'list', undefined, clientExecutor);
      scheduleSync('workOrders', 'list', undefined, orderExecutor);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(clientExecutor).toHaveBeenCalledTimes(1);
      expect(orderExecutor).toHaveBeenCalledTimes(1);
    });
  });

  describe('coalescing', () => {
    it('should coalesce requests within window', async () => {
      const executor = jest.fn().mockResolvedValue(undefined);

      // Schedule same request twice within coalescing window
      const promise1 = scheduleSync('clients', 'single', 'client-1', executor);

      // Second request should be coalesced
      const promise2 = scheduleSync('clients', 'single', 'client-1', executor);

      await Promise.all([promise1, promise2]);

      // Both should resolve but executor called once
      expect(executor).toHaveBeenCalledTimes(1);
    });
  });

  describe('fast path', () => {
    it('should recommend fast path for single ID sync', () => {
      expect(shouldUseFastPath('clients', 'client-123')).toBe(true);
    });

    it('should not recommend fast path without ID', () => {
      expect(shouldUseFastPath('clients')).toBe(false);
    });
  });

  describe('status', () => {
    it('should report sync status', async () => {
      const executor = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 50))
      );

      scheduleSync('clients', 'list', undefined, executor);

      // While pending
      const status = getSyncStatus();
      expect(status.pendingEntities).toContain('clients');

      await new Promise((resolve) => setTimeout(resolve, 150));

      // After completion
      const finalStatus = getSyncStatus();
      expect(finalStatus.pendingEntities).not.toContain('clients');
    });

    it('should report if entity is syncing', () => {
      scheduleSync('clients', 'list');

      expect(isSyncing('clients')).toBe(true);
      expect(isSyncing('workOrders')).toBe(false);
    });
  });

  describe('cancellation', () => {
    it('should cancel pending sync for entity', () => {
      scheduleSync('clients', 'list');

      expect(isSyncing('clients')).toBe(true);

      cancelPendingSync('clients');

      expect(isSyncing('clients')).toBe(false);
    });

    it('should cancel all pending syncs', () => {
      scheduleSync('clients', 'list');
      scheduleSync('workOrders', 'list');

      cancelAllSyncs();

      const status = getSyncStatus();
      expect(status.pendingEntities).toHaveLength(0);
    });
  });
});

describe('Utility Functions', () => {
  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce function calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on each call', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should throttle function calls', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn(); // Immediate call
      throttledFn(); // Throttled
      throttledFn(); // Throttled

      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);

      // One more call after cooldown
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should allow calls after limit passes', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
