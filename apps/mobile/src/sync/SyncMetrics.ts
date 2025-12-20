/**
 * Sync Metrics
 *
 * Sistema de métricas para observabilidade do sync.
 * Coleta tempos, contagens e tamanhos para debugging e otimização.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ChunkMetrics {
  chunkIndex: number;
  itemCount: number;
  durationMs: number;
  startTime: number;
  endTime: number;
}

export interface SaveToLocalDbMetrics {
  correlationId: string;
  entity: string;
  totalItems: number;
  safeDataItems: number;
  skippedItems: number;
  chunkSize: number;
  chunkCount: number;
  chunks: ChunkMetrics[];
  totalDurationMs: number;
  avgChunkDurationMs: number;
  maxChunkDurationMs: number;
  usedChunkProcessing: boolean;
  estimatedMemoryBytes: number;
  startTime: number;
  endTime: number;
  // Item 6: Bulk Insert metrics
  usedBulkInsert?: boolean;
  bulkInsertMetrics?: {
    insertedRecords: number;
    failedRecords: number;
    chunksSucceeded: number;
    chunksBisected: number;
    rowsPerSecond: number;
  };
}

export interface EntitySyncMetrics {
  entity: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  itemsPulled: number;
  success: boolean;
  error?: string;
  retries: number;
  parallelGroup?: 'parallel' | 'sequential';
}

export interface ParallelSyncMetrics {
  parallelEntities: string[];
  sequentialEntities: string[];
  parallelDurationMs: number;
  sequentialDurationMs: number;
  totalDurationMs: number;
  maxConcurrency: number;
  usedParallelSync: boolean;
}

export interface ChecklistBatchPullMetrics {
  correlationId: string;
  totalWorkOrders: number;
  successfulPulls: number;
  failedPulls: number;
  skippedPulls: number;
  totalRequests: number;
  retriedRequests: number;
  totalDurationMs: number;
  avgDurationPerWoMs: number;
  maxDurationPerWoMs: number;
  concurrency: number;
  usedOptimizedPull: boolean;
  workOrderResults: Array<{
    workOrderId: string;
    success: boolean;
    durationMs: number;
    retries: number;
    error?: string;
    checklistCount: number;
  }>;
}

export interface SyncCycleMetrics {
  correlationId: string;
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  entities: Map<string, SaveToLocalDbMetrics>;
  entitySyncMetrics: Map<string, EntitySyncMetrics>;
  parallelMetrics?: ParallelSyncMetrics;
  checklistBatchMetrics?: ChecklistBatchPullMetrics;
  pushMetrics?: {
    mutationsCount: number;
    durationMs: number;
  };
  error?: string;
}

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

class SyncMetricsCollector {
  private currentCycle: SyncCycleMetrics | null = null;
  private readonly MAX_HISTORY = 10;
  private history: SyncCycleMetrics[] = [];

  /**
   * Gera um correlationId único para o ciclo de sync
   */
  generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `sync-${timestamp}-${random}`;
  }

  /**
   * Inicia um novo ciclo de sync
   */
  startCycle(): string {
    const correlationId = this.generateCorrelationId();
    this.currentCycle = {
      correlationId,
      startTime: performance.now(),
      entities: new Map(),
      entitySyncMetrics: new Map(),
    };
    console.log(`[SyncMetrics] [${correlationId}] Cycle started`);
    return correlationId;
  }

  /**
   * Finaliza o ciclo de sync atual
   */
  endCycle(error?: string): SyncCycleMetrics | null {
    if (!this.currentCycle) return null;

    this.currentCycle.endTime = performance.now();
    this.currentCycle.totalDurationMs = this.currentCycle.endTime - this.currentCycle.startTime;
    this.currentCycle.error = error;

    const cycle = this.currentCycle;

    // Log summary
    console.log(`[SyncMetrics] [${cycle.correlationId}] Cycle completed`, {
      totalDurationMs: Math.round(cycle.totalDurationMs),
      entitiesProcessed: cycle.entities.size,
      error: error || 'none',
    });

    // Add to history
    this.history.push(cycle);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }

    this.currentCycle = null;
    return cycle;
  }

  /**
   * Registra métricas de saveToLocalDb
   */
  recordSaveToLocalDb(metrics: SaveToLocalDbMetrics): void {
    if (this.currentCycle) {
      this.currentCycle.entities.set(metrics.entity, metrics);
    }

    // Log detalhado
    console.log(`[SyncMetrics] [${metrics.correlationId}] saveToLocalDb completed`, {
      entity: metrics.entity,
      totalItems: metrics.totalItems,
      safeDataItems: metrics.safeDataItems,
      skippedItems: metrics.skippedItems,
      chunkCount: metrics.chunkCount,
      totalDurationMs: Math.round(metrics.totalDurationMs),
      avgChunkDurationMs: Math.round(metrics.avgChunkDurationMs),
      maxChunkDurationMs: Math.round(metrics.maxChunkDurationMs),
      usedChunkProcessing: metrics.usedChunkProcessing,
      estimatedMemoryKB: Math.round(metrics.estimatedMemoryBytes / 1024),
    });

    // Warn if any chunk took too long (>50ms blocks UI noticeably)
    if (metrics.maxChunkDurationMs > 50) {
      console.warn(
        `[SyncMetrics] [${metrics.correlationId}] ⚠️ Slow chunk detected for ${metrics.entity}: ` +
          `${Math.round(metrics.maxChunkDurationMs)}ms (threshold: 50ms)`
      );
    }
  }

  /**
   * Registra métricas de push
   */
  recordPush(correlationId: string, mutationsCount: number, durationMs: number): void {
    if (this.currentCycle && this.currentCycle.correlationId === correlationId) {
      this.currentCycle.pushMetrics = { mutationsCount, durationMs };
    }
    console.log(`[SyncMetrics] [${correlationId}] Push completed`, {
      mutationsCount,
      durationMs: Math.round(durationMs),
    });
  }

  /**
   * Registra métricas de sincronização de uma entidade
   */
  recordEntitySync(metrics: EntitySyncMetrics): void {
    if (this.currentCycle) {
      this.currentCycle.entitySyncMetrics.set(metrics.entity, metrics);
    }

    const status = metrics.success ? '✓' : '✗';
    console.log(
      `[SyncMetrics] [${this.currentCycle?.correlationId || 'no-cycle'}] ` +
        `Entity ${status} ${metrics.entity}`,
      {
        durationMs: Math.round(metrics.durationMs),
        itemsPulled: metrics.itemsPulled,
        retries: metrics.retries,
        group: metrics.parallelGroup || 'unknown',
        error: metrics.error || 'none',
      }
    );
  }

  /**
   * Registra métricas de sincronização paralela
   */
  recordParallelSync(metrics: ParallelSyncMetrics): void {
    if (this.currentCycle) {
      this.currentCycle.parallelMetrics = metrics;
    }

    const speedup = metrics.usedParallelSync
      ? `${Math.round((metrics.sequentialDurationMs + metrics.parallelDurationMs) / metrics.totalDurationMs * 100 - 100)}% faster`
      : 'disabled';

    console.log(
      `[SyncMetrics] [${this.currentCycle?.correlationId || 'no-cycle'}] ` +
        `Parallel sync summary`,
      {
        parallelEntities: metrics.parallelEntities.join(', '),
        sequentialEntities: metrics.sequentialEntities.join(', '),
        parallelDurationMs: Math.round(metrics.parallelDurationMs),
        sequentialDurationMs: Math.round(metrics.sequentialDurationMs),
        totalDurationMs: Math.round(metrics.totalDurationMs),
        maxConcurrency: metrics.maxConcurrency,
        usedParallelSync: metrics.usedParallelSync,
        speedup,
      }
    );
  }

  /**
   * Registra métricas de batch pull de checklists
   */
  recordChecklistBatchPull(metrics: ChecklistBatchPullMetrics): void {
    if (this.currentCycle) {
      this.currentCycle.checklistBatchMetrics = metrics;
    }

    const successRate = metrics.totalWorkOrders > 0
      ? Math.round((metrics.successfulPulls / metrics.totalWorkOrders) * 100)
      : 0;

    const avgPerWo = metrics.totalWorkOrders > 0
      ? Math.round(metrics.totalDurationMs / metrics.totalWorkOrders)
      : 0;

    console.log(
      `[SyncMetrics] [${metrics.correlationId}] Checklist batch pull summary`,
      {
        totalWorkOrders: metrics.totalWorkOrders,
        successfulPulls: metrics.successfulPulls,
        failedPulls: metrics.failedPulls,
        skippedPulls: metrics.skippedPulls,
        successRate: `${successRate}%`,
        totalDurationMs: Math.round(metrics.totalDurationMs),
        avgDurationPerWoMs: avgPerWo,
        maxDurationPerWoMs: Math.round(metrics.maxDurationPerWoMs),
        totalRequests: metrics.totalRequests,
        retriedRequests: metrics.retriedRequests,
        concurrency: metrics.concurrency,
        usedOptimizedPull: metrics.usedOptimizedPull,
      }
    );

    // Warn if too many failures
    if (metrics.failedPulls > 0 && successRate < 80) {
      console.warn(
        `[SyncMetrics] [${metrics.correlationId}] ⚠️ High checklist pull failure rate: ` +
          `${metrics.failedPulls}/${metrics.totalWorkOrders} failed (${100 - successRate}%)`
      );
    }

    // Warn if individual WOs are taking too long (>10s)
    if (metrics.maxDurationPerWoMs > 10000) {
      console.warn(
        `[SyncMetrics] [${metrics.correlationId}] ⚠️ Slow checklist pull detected: ` +
          `${Math.round(metrics.maxDurationPerWoMs / 1000)}s max (threshold: 10s)`
      );
    }
  }

  /**
   * Obtém o correlationId do ciclo atual
   */
  getCurrentCorrelationId(): string | null {
    return this.currentCycle?.correlationId ?? null;
  }

  /**
   * Obtém histórico de ciclos para debugging
   */
  getHistory(): SyncCycleMetrics[] {
    return [...this.history];
  }

  /**
   * Limpa o histórico
   */
  clearHistory(): void {
    this.history = [];
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const syncMetrics = new SyncMetricsCollector();

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Estima o tamanho em bytes de um array de objetos
 * Estimativa rápida baseada em JSON.stringify
 */
export function estimateMemoryBytes(data: unknown[]): number {
  if (data.length === 0) return 0;

  // Sample first 10 items for estimation
  const sampleSize = Math.min(10, data.length);
  const sample = data.slice(0, sampleSize);

  try {
    const sampleJson = JSON.stringify(sample);
    const avgItemSize = sampleJson.length / sampleSize;
    // Multiply by 2 for UTF-16 encoding in JS strings
    return Math.round(avgItemSize * data.length * 2);
  } catch {
    // Fallback: assume 500 bytes per item
    return data.length * 500;
  }
}

/**
 * Cria um timer para medir duração
 */
export function createTimer(): { elapsed: () => number; reset: () => void } {
  let start = performance.now();
  return {
    elapsed: () => performance.now() - start,
    reset: () => {
      start = performance.now();
    },
  };
}

export default syncMetrics;
