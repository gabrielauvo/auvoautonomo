/**
 * Sync Optimizer
 *
 * Otimizações para o SyncEngine:
 * - Debouncing de requests
 * - Coalescing de operações similares
 * - Controle de concorrência
 * - Fast path por ID
 */

import { logger } from '../observability/Logger';
import { perf } from '../observability/perf';

// =============================================================================
// TYPES
// =============================================================================

export type SyncEntity = 'clients' | 'workOrders' | 'quotes' | 'invoices' | 'checklistTemplates';

export interface SyncRequest {
  entity: SyncEntity;
  type: 'single' | 'list' | 'full';
  id?: string;
  timestamp: number;
}

export interface DebouncedSync {
  requests: SyncRequest[];
  timeoutId: ReturnType<typeof setTimeout> | null;
  promise: Promise<void> | null;
  resolve: (() => void) | null;
  reject: ((error: Error) => void) | null;
}

export interface SyncOptimizerConfig {
  debounceMs: number;
  maxWaitMs: number;
  maxConcurrent: number;
  coalescingWindow: number;
}

// =============================================================================
// SYNC OPTIMIZER CLASS
// =============================================================================

class SyncOptimizerManager {
  private config: SyncOptimizerConfig = {
    debounceMs: 500, // Wait 500ms before executing
    maxWaitMs: 5000, // Max wait time before forced execution
    maxConcurrent: 3, // Max concurrent sync operations
    coalescingWindow: 2000, // Window for coalescing similar requests
  };

  private pendingSyncs: Map<SyncEntity, DebouncedSync> = new Map();
  private activeSyncs: Set<string> = new Set();
  private syncQueue: Array<() => Promise<void>> = [];
  private recentRequests: Map<string, number> = new Map();

  // =============================================================================
  // CONFIGURATION
  // =============================================================================

  configure(config: Partial<SyncOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SyncOptimizerConfig {
    return { ...this.config };
  }

  // =============================================================================
  // DEBOUNCING
  // =============================================================================

  /**
   * Schedule a debounced sync operation
   */
  scheduleSync(
    entity: SyncEntity,
    type: 'single' | 'list' | 'full',
    id?: string,
    executor?: () => Promise<void>
  ): Promise<void> {
    const request: SyncRequest = {
      entity,
      type,
      id,
      timestamp: Date.now(),
    };

    // Check for duplicate request within coalescing window
    const requestKey = this.getRequestKey(request);
    const lastRequest = this.recentRequests.get(requestKey);
    if (lastRequest && Date.now() - lastRequest < this.config.coalescingWindow) {
      logger.debug('SyncOptimizer: Coalescing duplicate request', { entity, type, id });
      // Return existing promise if available
      const pending = this.pendingSyncs.get(entity);
      if (pending?.promise) {
        return pending.promise;
      }
    }

    // Track this request
    this.recentRequests.set(requestKey, Date.now());

    // Get or create pending sync for this entity
    let pending = this.pendingSyncs.get(entity);

    if (!pending) {
      pending = {
        requests: [],
        timeoutId: null,
        promise: null,
        resolve: null,
        reject: null,
      };
      this.pendingSyncs.set(entity, pending);
    }

    // Add request to pending list
    pending.requests.push(request);

    // Create promise if not exists
    if (!pending.promise) {
      pending.promise = new Promise((resolve, reject) => {
        pending!.resolve = resolve;
        pending!.reject = reject;
      });
    }

    // Clear existing timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Check if we've waited too long
    const oldestRequest = pending.requests[0];
    const waitTime = Date.now() - oldestRequest.timestamp;

    if (waitTime >= this.config.maxWaitMs) {
      // Force immediate execution
      this.executeSync(entity, executor);
    } else {
      // Schedule debounced execution
      const delay = Math.min(
        this.config.debounceMs,
        this.config.maxWaitMs - waitTime
      );

      pending.timeoutId = setTimeout(() => {
        this.executeSync(entity, executor);
      }, delay);
    }

    return pending.promise;
  }

  private async executeSync(entity: SyncEntity, executor?: () => Promise<void>): Promise<void> {
    const pending = this.pendingSyncs.get(entity);
    if (!pending) return;

    // Clear pending state
    this.pendingSyncs.delete(entity);
    const { requests, resolve, reject } = pending;

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Coalesce requests
    const coalescedRequest = this.coalesceRequests(requests);
    logger.info('SyncOptimizer: Executing coalesced sync', {
      entity,
      originalCount: requests.length,
      coalescedType: coalescedRequest.type,
      coalescedId: coalescedRequest.id,
    });

    // Queue execution with concurrency control
    const execute = async () => {
      const syncKey = `${entity}-${coalescedRequest.type}-${coalescedRequest.id || 'all'}`;

      // Check if this exact sync is already running
      if (this.activeSyncs.has(syncKey)) {
        logger.debug('SyncOptimizer: Sync already in progress, skipping', { syncKey });
        resolve?.();
        return;
      }

      this.activeSyncs.add(syncKey);
      const timer = perf.startTimer(`sync_${entity}`);

      try {
        if (executor) {
          await executor();
        }
        timer.stop();
        resolve?.();
      } catch (error) {
        timer.stop();
        logger.error('SyncOptimizer: Sync failed', { entity, error: String(error) });
        reject?.(error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.activeSyncs.delete(syncKey);
        this.processQueue();
      }
    };

    // Check concurrency limit
    if (this.activeSyncs.size >= this.config.maxConcurrent) {
      this.syncQueue.push(execute);
    } else {
      execute();
    }
  }

  private processQueue(): void {
    while (this.syncQueue.length > 0 && this.activeSyncs.size < this.config.maxConcurrent) {
      const next = this.syncQueue.shift();
      if (next) {
        next();
      }
    }
  }

  // =============================================================================
  // COALESCING
  // =============================================================================

  /**
   * Coalesce multiple requests into a single optimized request
   */
  private coalesceRequests(requests: SyncRequest[]): SyncRequest {
    if (requests.length === 0) {
      throw new Error('No requests to coalesce');
    }

    if (requests.length === 1) {
      return requests[0];
    }

    // Check if any request is a full sync
    const fullSync = requests.find((r) => r.type === 'full');
    if (fullSync) {
      return fullSync;
    }

    // Check if multiple different IDs - promote to list sync
    const uniqueIds = new Set(requests.filter((r) => r.id).map((r) => r.id));
    if (uniqueIds.size > 5) {
      // More than 5 different IDs - do a full sync
      return {
        entity: requests[0].entity,
        type: 'list',
        timestamp: requests[0].timestamp,
      };
    }

    // If all requests have the same ID, use single sync
    if (uniqueIds.size === 1) {
      const id = [...uniqueIds][0];
      return {
        entity: requests[0].entity,
        type: 'single',
        id,
        timestamp: requests[0].timestamp,
      };
    }

    // Multiple IDs but not too many - keep as list
    return {
      entity: requests[0].entity,
      type: 'list',
      timestamp: requests[0].timestamp,
    };
  }

  private getRequestKey(request: SyncRequest): string {
    return `${request.entity}:${request.type}:${request.id || 'all'}`;
  }

  // =============================================================================
  // FAST PATH
  // =============================================================================

  /**
   * Check if we should use fast path (single record sync by ID)
   */
  shouldUseFastPath(entity: SyncEntity, id?: string): boolean {
    if (!id) return false;

    // Check if there's no pending full sync for this entity
    const pending = this.pendingSyncs.get(entity);
    if (pending?.requests.some((r) => r.type === 'full')) {
      return false;
    }

    // Check if there are not too many pending single requests
    const singleRequests = pending?.requests.filter((r) => r.type === 'single').length ?? 0;
    return singleRequests < 3;
  }

  /**
   * Execute a fast path sync immediately (bypass debouncing)
   */
  async executeFastPath(
    entity: SyncEntity,
    id: string,
    executor: () => Promise<void>
  ): Promise<void> {
    const syncKey = `${entity}-single-${id}`;

    // Check if already running
    if (this.activeSyncs.has(syncKey)) {
      logger.debug('SyncOptimizer: Fast path already in progress', { entity, id });
      return;
    }

    // Check concurrency
    if (this.activeSyncs.size >= this.config.maxConcurrent) {
      // Fall back to debounced sync
      return this.scheduleSync(entity, 'single', id, executor);
    }

    this.activeSyncs.add(syncKey);
    const timer = perf.startTimer(`sync_fast_${entity}`);

    try {
      await executor();
      logger.debug('SyncOptimizer: Fast path completed', { entity, id });
    } catch (error) {
      logger.error('SyncOptimizer: Fast path failed', { entity, id, error: String(error) });
      throw error;
    } finally {
      timer.stop();
      this.activeSyncs.delete(syncKey);
      this.processQueue();
    }
  }

  // =============================================================================
  // STATUS
  // =============================================================================

  /**
   * Get current sync status
   */
  getStatus(): {
    activeSyncs: number;
    queuedSyncs: number;
    pendingEntities: SyncEntity[];
  } {
    return {
      activeSyncs: this.activeSyncs.size,
      queuedSyncs: this.syncQueue.length,
      pendingEntities: Array.from(this.pendingSyncs.keys()),
    };
  }

  /**
   * Check if a specific entity is syncing
   */
  isSyncing(entity: SyncEntity): boolean {
    return (
      this.pendingSyncs.has(entity) ||
      Array.from(this.activeSyncs).some((key) => key.startsWith(entity))
    );
  }

  /**
   * Cancel all pending syncs for an entity
   */
  cancelPending(entity: SyncEntity): void {
    const pending = this.pendingSyncs.get(entity);
    if (pending) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.resolve?.();
      this.pendingSyncs.delete(entity);
    }
  }

  /**
   * Cancel all pending syncs
   */
  cancelAll(): void {
    for (const entity of this.pendingSyncs.keys()) {
      this.cancelPending(entity);
    }
    this.syncQueue.length = 0;
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  /**
   * Clean up old recent requests to prevent memory leak
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.coalescingWindow * 2;

    for (const [key, timestamp] of this.recentRequests.entries()) {
      if (now - timestamp > maxAge) {
        this.recentRequests.delete(key);
      }
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

export const syncOptimizer = new SyncOptimizerManager();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const scheduleSync = syncOptimizer.scheduleSync.bind(syncOptimizer);
export const executeFastPath = syncOptimizer.executeFastPath.bind(syncOptimizer);
export const shouldUseFastPath = syncOptimizer.shouldUseFastPath.bind(syncOptimizer);
export const getSyncStatus = syncOptimizer.getStatus.bind(syncOptimizer);
export const isSyncing = syncOptimizer.isSyncing.bind(syncOptimizer);
export const cancelPendingSync = syncOptimizer.cancelPending.bind(syncOptimizer);
export const cancelAllSyncs = syncOptimizer.cancelAll.bind(syncOptimizer);

// =============================================================================
// DEBOUNCE UTILITY
// =============================================================================

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
        timeoutId = null;
      }, limit - (now - lastCall));
    }
  };
}

export default syncOptimizer;
