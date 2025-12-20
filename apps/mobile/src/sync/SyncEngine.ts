/**
 * Sync Engine
 *
 * Motor de sincronização 2-vias entre o app mobile e o servidor.
 * Suporta:
 * - Delta sync com cursores
 * - Paginação para grandes volumes (100k+ registros)
 * - Fila de mutações offline
 * - Resolução de conflitos (last-write-wins)
 * - Escopo por técnico
 */

import NetInfo from '@react-native-community/netinfo';
import {
  SyncEntityConfig,
  SyncState,
  SyncResult,
  SyncError,
  SyncEvent,
  SyncEventListener,
  SyncPullResponse,
} from './types';
import { getDatabase, rawQuery, MutationQueueItem } from '../db';
import { MutationQueue } from '../queue/MutationQueue';
import type { SQLiteBindValue } from 'expo-sqlite';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';
import { SYNC_FLAGS } from '../config/syncFlags';
import {
  syncMetrics,
  estimateMemoryBytes,
  createTimer,
  type SaveToLocalDbMetrics,
  type ChunkMetrics,
  type EntitySyncMetrics,
  type ParallelSyncMetrics,
  type ChecklistBatchPullMetrics,
} from './SyncMetrics';
import { bulkInsert, type BulkInsertResult } from '../db/BulkInsertService';
import { FastPushService } from './FastPushService';

// =============================================================================
// SYNC ENGINE CLASS
// =============================================================================

export class SyncEngine {
  private configs: Map<string, SyncEntityConfig<unknown>> = new Map();
  private listeners: Set<SyncEventListener> = new Set();
  private state: SyncState = {
    status: 'idle',
    lastSyncAt: null,
    error: null,
    progress: null,
  };
  private technicianId: string | null = null;
  private authToken: string | null = null;
  private baseUrl: string = '';
  private isOnline: boolean = true;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private hasResetFailedMutations: boolean = false; // Reset once per session
  private syncLock: boolean = false; // Lock para evitar sincronizações simultâneas

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  constructor() {
    // Monitor network status
    NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (!wasOnline && this.isOnline) {
        this.emit({ type: 'online_detected', timestamp: new Date() });
        // Auto-sync when coming back online with retry support
        this.syncWithRetry().catch((error) => {
          console.error('[SyncEngine] Auto-sync failed after retries:', error);
          this.emit({
            type: 'sync_error',
            data: { error: error instanceof Error ? error.message : 'Sync failed' },
            timestamp: new Date(),
          });
        });
      } else if (wasOnline && !this.isOnline) {
        this.emit({ type: 'offline_detected', timestamp: new Date() });
        // Cancel any pending retry when going offline
        if (this.retryTimeoutId) {
          clearTimeout(this.retryTimeoutId);
          this.retryTimeoutId = null;
        }
      }
    });

    // Configure FastPushService (Item 7)
    this.initializeFastPushService();
  }

  /**
   * Inicializa o FastPushService com as callbacks necessárias
   */
  private initializeFastPushService(): void {
    FastPushService.configure(
      // pushOnly callback
      async () => this.pushOnly(),
      // fullSync callback
      async () => {
        await this.syncAll();
      }
    );
    console.log('[SyncEngine] FastPushService initialized');
  }

  /**
   * Configurar o engine com credenciais
   */
  configure(options: {
    baseUrl: string;
    authToken: string;
    technicianId: string;
  }): void {
    console.log('[SyncEngine] configure called with:', {
      baseUrl: options.baseUrl,
      authToken: options.authToken ? `${options.authToken.substring(0, 20)}...` : null,
      technicianId: options.technicianId,
    });
    this.baseUrl = options.baseUrl;
    this.authToken = options.authToken;
    this.technicianId = options.technicianId;
    console.log('[SyncEngine] After configure - isConfigured:', this.isConfigured());
  }

  /**
   * Verificar se o engine está configurado
   */
  isConfigured(): boolean {
    return !!(this.technicianId && this.authToken);
  }

  /**
   * Obter configuração atual (para uso por serviços externos)
   */
  getConfig(): { apiUrl: string; authToken: string } | null {
    if (!this.isConfigured()) {
      return null;
    }
    return {
      apiUrl: this.baseUrl,
      authToken: this.authToken!,
    };
  }

  /**
   * Registrar uma entidade para sincronização
   */
  registerEntity<T>(config: SyncEntityConfig<T>): void {
    this.configs.set(config.name, config as SyncEntityConfig<unknown>);
  }

  // =============================================================================
  // SYNC OPERATIONS
  // =============================================================================

  /**
   * Sincronizar todas as entidades registradas
   * Usa lock para evitar sincronizações simultâneas que podem causar race conditions
   */
  async syncAll(): Promise<SyncResult[]> {
    if (!this.isOnline) {
      console.log('[SyncEngine] Offline, skipping sync');
      return [];
    }

    if (!this.technicianId || !this.authToken) {
      console.log('[SyncEngine] Not configured (no auth), skipping sync');
      return [];
    }

    // Lock para evitar sincronizações simultâneas
    if (this.syncLock) {
      console.log('[SyncEngine] Sync locked, another sync is in progress');
      return [];
    }

    if (this.state.status === 'syncing') {
      console.log('[SyncEngine] Sync already in progress');
      return [];
    }

    // Adquirir lock
    this.syncLock = true;

    // Start metrics cycle
    const correlationId = syncMetrics.startCycle();

    console.log(`[SyncEngine] [${correlationId}] Starting syncAll for technicianId:`, this.technicianId);
    console.log(`[SyncEngine] [${correlationId}] Registered entities:`, Array.from(this.configs.keys()));

    this.setState({ status: 'syncing', error: null });
    this.emit({ type: 'sync_start', timestamp: new Date() });

    const results: SyncResult[] = [];

    try {
      // Reset failed mutations once per session (after bug fixes)
      if (!this.hasResetFailedMutations) {
        this.hasResetFailedMutations = true;
        const resetCount = await MutationQueue.resetFailed();
        if (resetCount > 0) {
          console.log(`[SyncEngine] Reset ${resetCount} previously failed mutations for retry`);
        }
      }

      // Primeiro, enviar mutações pendentes (push)
      await this.pushPendingMutations();

      // Depois, buscar dados do servidor (pull)
      // Usa paralelismo se a flag estiver ativada
      if (SYNC_FLAGS.SYNC_OPT_PARALLEL_ENTITIES) {
        const parallelResults = await this.syncEntitiesWithParallelism(correlationId);
        results.push(...parallelResults);
      } else {
        // Comportamento original: sequencial
        for (const [name, config] of Array.from(this.configs.entries())) {
          const result = await this.syncEntity(name, config);
          results.push(result);
        }
      }

      // Sincronizar templates de checklist para criar instâncias offline
      await this.syncChecklistTemplates();

      // Sincronizar checklists de todas as OSs locais para acesso offline
      await this.syncChecklistsForAllWorkOrders();

      // Sincronizar sessões de execução (pausas e trabalho) pendentes
      await this.syncExecutionSessionsForAllWorkOrders();

      // Sincronizar anexos de checklist (fotos, assinaturas) pendentes
      await this.syncChecklistAttachments();

      // Sincronizar assinaturas de orçamentos pendentes
      await this.syncQuoteSignatures();

      // Sincronizar assinaturas de OS pendentes
      await this.syncWorkOrderSignatures();

      this.setState({
        status: 'idle',
        lastSyncAt: new Date(),
        progress: null,
      });

      this.emit({ type: 'sync_complete', data: results, timestamp: new Date() });

      // End metrics cycle (success)
      syncMetrics.endCycle();

      // Notify FastPushService that a full sync completed (Item 7)
      // This updates the throttle timestamp
      FastPushService.notifyFullSyncCompleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.setState({ status: 'error', error: message });
      this.emit({ type: 'sync_error', data: { error: message }, timestamp: new Date() });

      // End metrics cycle (error)
      syncMetrics.endCycle(message);
    } finally {
      // Sempre liberar o lock, mesmo em caso de erro
      this.syncLock = false;
    }

    return results;
  }

  /**
   * Sincronizar com retry automático usando exponential backoff
   * - Tenta até maxRetries vezes
   * - Delay aumenta exponencialmente: 1s, 2s, 4s
   * - Emite eventos para feedback visual
   */
  async syncWithRetry(): Promise<SyncResult[]> {
    this.retryCount = 0;

    const attemptSync = async (): Promise<SyncResult[]> => {
      try {
        const results = await this.syncAll();

        // Check if any entity failed
        const hasErrors = results.some((r) => !r.success);

        if (hasErrors && this.retryCount < this.maxRetries) {
          this.retryCount++;
          const delayMs = Math.pow(2, this.retryCount - 1) * 1000; // 1s, 2s, 4s

          console.log(
            `[SyncEngine] Sync had errors, retrying in ${delayMs}ms (attempt ${this.retryCount}/${this.maxRetries})`
          );

          this.emit({
            type: 'sync_retry',
            data: {
              attempt: this.retryCount,
              maxRetries: this.maxRetries,
              delayMs,
              errors: results.filter((r) => !r.success).map((r) => r.errors),
            },
            timestamp: new Date(),
          });

          return new Promise((resolve, reject) => {
            this.retryTimeoutId = setTimeout(async () => {
              try {
                const retryResults = await attemptSync();
                resolve(retryResults);
              } catch (error) {
                reject(error);
              }
            }, delayMs);
          });
        }

        // Reset retry count on success
        if (!hasErrors) {
          this.retryCount = 0;
        }

        return results;
      } catch (error) {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const delayMs = Math.pow(2, this.retryCount - 1) * 1000;

          console.error(
            `[SyncEngine] Sync failed, retrying in ${delayMs}ms (attempt ${this.retryCount}/${this.maxRetries}):`,
            error
          );

          this.emit({
            type: 'sync_retry',
            data: {
              attempt: this.retryCount,
              maxRetries: this.maxRetries,
              delayMs,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date(),
          });

          return new Promise((resolve, reject) => {
            this.retryTimeoutId = setTimeout(async () => {
              try {
                const retryResults = await attemptSync();
                resolve(retryResults);
              } catch (retryError) {
                reject(retryError);
              }
            }, delayMs);
          });
        }

        // Max retries exceeded - emit final error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[SyncEngine] Max retries exceeded:', errorMessage);

        this.emit({
          type: 'sync_max_retries_exceeded',
          data: {
            attempts: this.retryCount,
            error: errorMessage,
          },
          timestamp: new Date(),
        });

        throw error;
      }
    };

    return attemptSync();
  }

  // ===========================================================================
  // PARALLEL ENTITY SYNC
  // ===========================================================================

  /**
   * Sincroniza entidades com paralelismo controlado
   *
   * Estratégia:
   * 1. Entidades independentes (clients, categories) rodam em paralelo
   * 2. Entidades dependentes (catalogItems, quotes, work_orders) rodam sequencialmente após
   * 3. Limite de concorrência para evitar race conditions no SQLite
   *
   * @param correlationId ID do ciclo de sync para métricas
   * @returns Array de resultados de todas as entidades
   */
  private async syncEntitiesWithParallelism(correlationId: string): Promise<SyncResult[]> {
    const parallelTimer = createTimer();
    const results: SyncResult[] = [];

    const parallelSafe = SYNC_FLAGS.PARALLEL_SAFE_ENTITIES;
    const sequential = SYNC_FLAGS.SEQUENTIAL_ENTITIES;
    const maxConcurrency = SYNC_FLAGS.MAX_PARALLEL_ENTITIES;

    // Separar entidades registradas em paralelas e sequenciais
    const registeredEntities = Array.from(this.configs.entries());
    const parallelEntities = registeredEntities.filter(([name]) =>
      parallelSafe.includes(name)
    );
    const sequentialEntities = registeredEntities.filter(([name]) =>
      sequential.includes(name)
    );
    // Entidades não classificadas rodam sequencialmente por segurança
    const unclassifiedEntities = registeredEntities.filter(
      ([name]) => !parallelSafe.includes(name) && !sequential.includes(name)
    );

    console.log(
      `[SyncEngine] [${correlationId}] Starting parallel sync:`,
      `parallel=${parallelEntities.map(([n]) => n).join(',')}`,
      `sequential=${sequentialEntities.map(([n]) => n).join(',')}`,
      `unclassified=${unclassifiedEntities.map(([n]) => n).join(',')}`
    );

    // FASE 1: Sincronizar entidades paralelas com pool de concorrência
    const parallelPhaseTimer = createTimer();
    if (parallelEntities.length > 0) {
      const parallelResults = await this.runWithConcurrencyLimit(
        parallelEntities,
        maxConcurrency,
        async ([name, config]) => {
          const entityTimer = createTimer();
          try {
            const result = await this.syncEntity(name, config);

            // Registrar métrica
            syncMetrics.recordEntitySync({
              entity: name,
              startTime: performance.now() - entityTimer.elapsed(),
              endTime: performance.now(),
              durationMs: entityTimer.elapsed(),
              itemsPulled: result.pulled,
              success: result.success,
              error: result.errors[0]?.message,
              retries: 0,
              parallelGroup: 'parallel',
            });

            return result;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[SyncEngine] [${correlationId}] Parallel sync failed for ${name}:`, error);

            syncMetrics.recordEntitySync({
              entity: name,
              startTime: performance.now() - entityTimer.elapsed(),
              endTime: performance.now(),
              durationMs: entityTimer.elapsed(),
              itemsPulled: 0,
              success: false,
              error: errorMsg,
              retries: 0,
              parallelGroup: 'parallel',
            });

            return {
              entity: name,
              success: false,
              pulled: 0,
              pushed: 0,
              errors: [{ entity: name, operation: 'pull' as const, message: errorMsg }],
              duration: entityTimer.elapsed(),
            };
          }
        }
      );
      results.push(...parallelResults);
    }
    const parallelDurationMs = parallelPhaseTimer.elapsed();

    // FASE 2: Sincronizar entidades sequenciais (dependem das paralelas)
    const sequentialPhaseTimer = createTimer();
    const allSequential = [...sequentialEntities, ...unclassifiedEntities];
    for (const [name, config] of allSequential) {
      const entityTimer = createTimer();
      try {
        const result = await this.syncEntity(name, config);

        syncMetrics.recordEntitySync({
          entity: name,
          startTime: performance.now() - entityTimer.elapsed(),
          endTime: performance.now(),
          durationMs: entityTimer.elapsed(),
          itemsPulled: result.pulled,
          success: result.success,
          error: result.errors[0]?.message,
          retries: 0,
          parallelGroup: 'sequential',
        });

        results.push(result);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SyncEngine] [${correlationId}] Sequential sync failed for ${name}:`, error);

        syncMetrics.recordEntitySync({
          entity: name,
          startTime: performance.now() - entityTimer.elapsed(),
          endTime: performance.now(),
          durationMs: entityTimer.elapsed(),
          itemsPulled: 0,
          success: false,
          error: errorMsg,
          retries: 0,
          parallelGroup: 'sequential',
        });

        results.push({
          entity: name,
          success: false,
          pulled: 0,
          pushed: 0,
          errors: [{ entity: name, operation: 'pull' as const, message: errorMsg }],
          duration: entityTimer.elapsed(),
        });
      }
    }
    const sequentialDurationMs = sequentialPhaseTimer.elapsed();

    // Registrar métricas de paralelismo
    syncMetrics.recordParallelSync({
      parallelEntities: parallelEntities.map(([n]) => n),
      sequentialEntities: allSequential.map(([n]) => n),
      parallelDurationMs,
      sequentialDurationMs,
      totalDurationMs: parallelTimer.elapsed(),
      maxConcurrency,
      usedParallelSync: true,
    });

    return results;
  }

  /**
   * Executa um array de tarefas com limite de concorrência
   * Similar ao p-limit mas sem dependência externa
   *
   * @param items Array de itens para processar
   * @param limit Número máximo de tarefas simultâneas
   * @param fn Função assíncrona para processar cada item
   * @returns Array de resultados na mesma ordem dos itens
   */
  private async runWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    const runNext = async (): Promise<void> => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = items[index];
        results[index] = await fn(item);
      }
    };

    // Iniciar `limit` workers em paralelo
    const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
    await Promise.all(workers);

    return results;
  }

  /**
   * Sincronizar uma entidade específica
   */
  async syncEntity(
    name: string,
    config?: SyncEntityConfig<unknown>
  ): Promise<SyncResult> {
    const entityConfig = config ?? this.configs.get(name);
    if (!entityConfig) {
      throw new Error(`Entity ${name} not registered`);
    }

    const startTime = Date.now();
    const errors: SyncError[] = [];
    let pulled = 0;
    let pushed = 0;

    this.emit({ type: 'entity_sync_start', entity: name, timestamp: new Date() });

    try {
      // Get last sync metadata
      const syncMeta = await this.getSyncMeta(name);
      let cursor: string | null = null; // Start fresh on each sync
      const since = syncMeta?.lastSyncAt ?? null; // Use lastSyncAt for delta sync
      let hasMore = true;

      // Pull data from server with pagination
      while (hasMore) {
        const response = await this.pullFromServer<unknown>(
          entityConfig,
          cursor,
          since,
          'all' // Default scope - backend accepts: all, assigned, date_range
        );

        if (response.data.length > 0) {
          await this.saveToLocalDb(entityConfig, response.data);
          pulled += response.data.length;
        }

        cursor = response.cursor;
        hasMore = response.hasMore;

        this.setState({
          progress: {
            current: pulled,
            total: response.total,
            entity: name,
          },
        });
      }

      // Update sync metadata with last cursor (for resumption if needed)
      await this.updateSyncMeta(name, cursor);

      this.emit({
        type: 'entity_sync_complete',
        entity: name,
        data: { pulled, pushed },
        timestamp: new Date(),
      });
    } catch (error) {
      errors.push({
        entity: name,
        operation: 'pull',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      success: errors.length === 0,
      entity: name,
      pulled,
      pushed,
      errors,
      duration: Date.now() - startTime,
    };
  }

  // =============================================================================
  // PULL OPERATIONS
  // =============================================================================

  private async pullFromServer<T>(
    config: SyncEntityConfig<T>,
    cursor: string | null,
    since?: string | null,
    scope: string = 'recent'
  ): Promise<SyncPullResponse<T>> {
    const url = new URL(`${this.baseUrl}${config.apiEndpoint}`);
    url.searchParams.set('limit', String(config.batchSize));
    url.searchParams.set('scope', scope);

    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    if (since) {
      url.searchParams.set('since', since);
    }

    console.log('[SyncEngine] Fetching:', url.toString());

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000, // 45s timeout para sync (pode ter muitos dados)
      retries: 3, // Retry importante para sync
    });

    console.log('[SyncEngine] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SyncEngine] Pull error:', errorText);
      throw new Error(`Pull failed: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('[SyncEngine] Pull response:', JSON.stringify(responseData).substring(0, 200));

    // API returns items/nextCursor format
    const items = responseData.items || responseData.data || [];

    // Transform data if needed
    const transformedData = config.transformFromServer
      ? items.map(config.transformFromServer)
      : items;

    return {
      data: transformedData,
      cursor: responseData.nextCursor || responseData.cursor || null,
      hasMore: responseData.hasMore ?? false,
      total: responseData.total ?? items.length,
    };
  }

  private async saveToLocalDb<T>(
    config: SyncEntityConfig<T>,
    data: T[]
  ): Promise<void> {
    if (data.length === 0) return;

    const correlationId = syncMetrics.getCurrentCorrelationId() || 'no-cycle';
    const totalTimer = createTimer();

    const db = await getDatabase();
    const now = new Date().toISOString();

    // CRITICAL: Get IDs of records with pending mutations - we must NOT overwrite these
    const pendingIds = new Set<string>();
    const pendingMutations = await rawQuery<{ entityId: string }>(
      `SELECT DISTINCT entityId FROM mutations_queue
       WHERE entity = ? AND status IN ('pending', 'processing', 'failed')`,
      [config.name]
    );
    for (const m of pendingMutations) {
      pendingIds.add(m.entityId);
    }

    // Filter out records that have pending local mutations
    const safeData = data.filter((item) => {
      const record = item as Record<string, unknown>;
      const id = record.id as string;
      if (pendingIds.has(id)) {
        console.log(`[SyncEngine] Skipping overwrite of ${id} - has pending mutations`);
        return false;
      }
      return true;
    });

    if (safeData.length === 0) {
      console.log('[SyncEngine] All records have pending mutations, skipping save');
      return;
    }

    // Use custom save handler if provided (for entities with relationships like bundles)
    if (config.customSave) {
      await config.customSave(safeData, this.technicianId!);
      return;
    }

    // Default save behavior - simple INSERT OR REPLACE
    const firstRecord = safeData[0] as Record<string, unknown>;
    const columns = Object.keys(firstRecord);
    const columnsWithSync = [...columns, 'syncedAt'];

    // Determine if we should use chunk processing
    const useChunkProcessing = SYNC_FLAGS.SYNC_OPT_CHUNK_PROCESSING && safeData.length > SYNC_FLAGS.CHUNK_SIZE;
    const chunkSize = SYNC_FLAGS.CHUNK_SIZE;
    const chunkMetrics: ChunkMetrics[] = [];

    // OPTIMIZATION (Item 6): Use bulk insert with chunked transactions and error isolation
    if (SYNC_FLAGS.SYNC_OPT_BULK_INSERT) {
      // Prepare data with syncedAt column
      const dataWithSyncedAt = safeData.map((item) => {
        const record = item as Record<string, unknown>;
        const prepared: Record<string, unknown> = {};
        for (const col of columns) {
          prepared[col] = record[col];
        }
        prepared.syncedAt = now;
        return prepared;
      });

      const bulkResult = await bulkInsert(db, dataWithSyncedAt, {
        tableName: config.tableName,
        columns: columnsWithSync,
        chunkSize: SYNC_FLAGS.BULK_INSERT_CHUNK_SIZE,
        continueOnError: SYNC_FLAGS.BULK_INSERT_CONTINUE_ON_ERROR,
        bisectMinSize: SYNC_FLAGS.BULK_INSERT_BISECT_MIN_SIZE,
        onProgress: (progress) => {
          console.log(
            `[SyncEngine] [${correlationId}] Bulk insert progress: ` +
            `chunk ${progress.currentChunk + 1}/${progress.totalChunks} ` +
            `(${progress.percentComplete}%)`
          );
        },
        onInvalidRecord: (record, error, index) => {
          const recordId = (record as Record<string, unknown>).id as string || `index-${index}`;
          console.error(
            `[SyncEngine] [${correlationId}] Invalid record ${recordId} in ${config.name}:`,
            error.message
          );
        },
      });

      // Convert bulk insert metrics to chunk metrics format for compatibility
      for (const detail of bulkResult.metrics.chunkDetails) {
        chunkMetrics.push({
          chunkIndex: detail.index,
          itemCount: detail.size,
          durationMs: detail.durationMs,
          startTime: 0, // Not tracked in bulk insert
          endTime: detail.durationMs,
        });
      }

      // Log bulk insert summary
      if (bulkResult.failedRecords > 0) {
        console.warn(
          `[SyncEngine] [${correlationId}] Bulk insert for ${config.name}: ` +
          `${bulkResult.insertedRecords}/${bulkResult.totalRecords} inserted, ` +
          `${bulkResult.failedRecords} failed (${bulkResult.failedIds.join(', ')})`
        );
      }

      // Record metrics - use bulk insert metrics
      const totalDurationMs = bulkResult.metrics.totalDurationMs;
      const metrics: SaveToLocalDbMetrics = {
        correlationId,
        entity: config.name,
        totalItems: data.length,
        safeDataItems: safeData.length,
        skippedItems: data.length - safeData.length,
        chunkSize: SYNC_FLAGS.BULK_INSERT_CHUNK_SIZE,
        chunkCount: bulkResult.metrics.chunksProcessed,
        chunks: chunkMetrics,
        totalDurationMs,
        avgChunkDurationMs: bulkResult.metrics.avgChunkDurationMs,
        maxChunkDurationMs: bulkResult.metrics.maxChunkDurationMs,
        usedChunkProcessing: true,
        usedBulkInsert: true,
        bulkInsertMetrics: {
          insertedRecords: bulkResult.insertedRecords,
          failedRecords: bulkResult.failedRecords,
          chunksSucceeded: bulkResult.metrics.chunksSucceeded,
          chunksBisected: bulkResult.metrics.chunksBisected,
          rowsPerSecond: bulkResult.metrics.rowsPerSecond,
        },
        estimatedMemoryBytes: estimateMemoryBytes(safeData),
        startTime: performance.now() - totalDurationMs,
        endTime: performance.now(),
      };

      syncMetrics.recordSaveToLocalDb(metrics);
      return;
    }

    // ORIGINAL PATH: Single large INSERT (fallback when flag is off)
    let values: SQLiteBindValue[];

    if (useChunkProcessing) {
      // OPTIMIZED PATH: Process in chunks with yield to prevent UI blocking
      values = await this.buildValuesInChunks(
        safeData,
        columns,
        now,
        chunkSize,
        chunkMetrics,
        correlationId
      );
    } else {
      // ORIGINAL PATH: Process all at once (for small datasets or when flag is off)
      values = this.buildValuesSync(safeData, columns, now);
    }

    // Build batch insert statement
    const placeholders = safeData
      .map(() => `(${columnsWithSync.map(() => '?').join(', ')})`)
      .join(', ');

    // Use INSERT OR REPLACE for efficient upsert
    // This handles both insert and update in a single batch operation
    await db.runAsync(
      `INSERT OR REPLACE INTO ${config.tableName} (${columnsWithSync.join(', ')}) VALUES ${placeholders}`,
      values
    );

    // Record metrics
    const totalDurationMs = totalTimer.elapsed();
    const avgChunkDurationMs = chunkMetrics.length > 0
      ? chunkMetrics.reduce((sum, c) => sum + c.durationMs, 0) / chunkMetrics.length
      : totalDurationMs;
    const maxChunkDurationMs = chunkMetrics.length > 0
      ? Math.max(...chunkMetrics.map(c => c.durationMs))
      : totalDurationMs;

    const metrics: SaveToLocalDbMetrics = {
      correlationId,
      entity: config.name,
      totalItems: data.length,
      safeDataItems: safeData.length,
      skippedItems: data.length - safeData.length,
      chunkSize,
      chunkCount: chunkMetrics.length || 1,
      chunks: chunkMetrics,
      totalDurationMs,
      avgChunkDurationMs,
      maxChunkDurationMs,
      usedChunkProcessing: useChunkProcessing,
      estimatedMemoryBytes: estimateMemoryBytes(safeData),
      startTime: performance.now() - totalDurationMs,
      endTime: performance.now(),
    };

    syncMetrics.recordSaveToLocalDb(metrics);
  }

  /**
   * Build values array synchronously (original behavior)
   * Used when chunk processing is disabled or for small datasets
   */
  private buildValuesSync<T>(
    safeData: T[],
    columns: string[],
    syncedAt: string
  ): SQLiteBindValue[] {
    const values: SQLiteBindValue[] = [];

    for (const item of safeData) {
      const record = item as Record<string, unknown>;
      for (const col of columns) {
        const value = record[col];
        // Convert to SQLiteBindValue compatible type
        if (value === undefined) {
          values.push(null);
        } else if (typeof value === 'boolean') {
          values.push(value ? 1 : 0);
        } else {
          values.push(value as SQLiteBindValue);
        }
      }
      values.push(syncedAt); // syncedAt
    }

    return values;
  }

  /**
   * Build values array in chunks with yield between chunks
   * Prevents UI blocking on large datasets (1000+ records)
   */
  private async buildValuesInChunks<T>(
    safeData: T[],
    columns: string[],
    syncedAt: string,
    chunkSize: number,
    chunkMetrics: ChunkMetrics[],
    correlationId: string
  ): Promise<SQLiteBindValue[]> {
    const values: SQLiteBindValue[] = [];
    const totalChunks = Math.ceil(safeData.length / chunkSize);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkStart = chunkIndex * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize, safeData.length);
      const chunk = safeData.slice(chunkStart, chunkEnd);

      const chunkTimer = createTimer();
      const startTime = performance.now();

      // Process chunk items
      for (const item of chunk) {
        const record = item as Record<string, unknown>;
        for (const col of columns) {
          const value = record[col];
          // Convert to SQLiteBindValue compatible type
          if (value === undefined) {
            values.push(null);
          } else if (typeof value === 'boolean') {
            values.push(value ? 1 : 0);
          } else {
            values.push(value as SQLiteBindValue);
          }
        }
        values.push(syncedAt); // syncedAt
      }

      const durationMs = chunkTimer.elapsed();

      // Record chunk metrics
      chunkMetrics.push({
        chunkIndex,
        itemCount: chunk.length,
        durationMs,
        startTime,
        endTime: performance.now(),
      });

      // Yield to event loop between chunks (except for last chunk)
      if (chunkIndex < totalChunks - 1) {
        await this.yieldToEventLoop();
      }
    }

    console.log(
      `[SyncEngine] [${correlationId}] Chunk processing complete: ` +
        `${totalChunks} chunks, ${safeData.length} items`
    );

    return values;
  }

  /**
   * Yield control to the event loop to prevent UI blocking
   * Uses setTimeout(0) which is the standard way to yield in JS
   */
  private yieldToEventLoop(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, SYNC_FLAGS.CHUNK_YIELD_DELAY_MS);
    });
  }

  // =============================================================================
  // PUSH OPERATIONS
  // =============================================================================

  private async pushPendingMutations(): Promise<void> {
    // Use a larger batch size to process more mutations at once
    const BATCH_SIZE = 100;
    let totalProcessed = 0;
    let batchNumber = 0;

    // Continue processing until all mutations are done
    while (true) {
      batchNumber++;
      const mutations = await MutationQueue.getPending(BATCH_SIZE);
      console.log(`[SyncEngine] Batch ${batchNumber}: ${mutations.length} pending mutations`);

      if (mutations.length === 0) {
        console.log(`[SyncEngine] All mutations processed. Total: ${totalProcessed}`);
        break;
      }

      console.log('[SyncEngine] Processing mutations:', JSON.stringify(mutations.map(m => ({
        id: m.id,
        entity: m.entity,
        entityId: m.entityId,
        operation: m.operation,
        status: m.status,
        attempts: m.attempts,
      }))));

      // Group mutations by entity for batch processing
      const byEntity = new Map<string, typeof mutations>();
      for (const mutation of mutations) {
        const list = byEntity.get(mutation.entity) || [];
        list.push(mutation);
        byEntity.set(mutation.entity, list);
      }

      // Define entity processing order to ensure dependencies are met
      // Clients must be synced before quotes (quotes reference clients)
      const entityOrder = ['clients', 'quotes', 'workOrders', 'quoteSignatures'];

      // Sort entities by priority order
      const sortedEntities = Array.from(byEntity.keys()).sort((a, b) => {
        const orderA = entityOrder.indexOf(a);
        const orderB = entityOrder.indexOf(b);
        // Unknown entities go last
        const priorityA = orderA === -1 ? 999 : orderA;
        const priorityB = orderB === -1 ? 999 : orderB;
        return priorityA - priorityB;
      });

      console.log('[SyncEngine] Processing entities in order:', sortedEntities);

      // Process each entity's mutations in batch (in priority order)
      for (const entity of sortedEntities) {
        const entityMutations = byEntity.get(entity);
        if (!entityMutations || entityMutations.length === 0) continue;
        try {
          // Mark all as processing
          for (const mutation of entityMutations) {
            await MutationQueue.markProcessing(mutation.id);
          }

          // Send batch
          const results = await this.pushMutationBatch(entity, entityMutations);

          console.log('[SyncEngine] Got results:', results.length, 'for', entityMutations.length, 'mutations');
          console.log('[SyncEngine] Results detail:', JSON.stringify(results));

          // Create a map of results by mutationId for reliable lookup
          const resultsMap = new Map<string, { mutationId: string; status: string; error?: string }>();
          for (const result of results) {
            if (result?.mutationId) {
              resultsMap.set(result.mutationId, result);
              console.log(`[SyncEngine] Mapped result: mutationId=${result.mutationId}, status=${result.status}`);
            }
          }
          console.log('[SyncEngine] ResultsMap keys:', Array.from(resultsMap.keys()));

          // Process results - match by the unique mutationId we generated
          for (const mutation of entityMutations) {
            // The mutationId format is: {entityId}-{operation}-{localMutationId}
            const mutationId = `${mutation.entityId}-${mutation.operation}-${mutation.id}`;
            const result = resultsMap.get(mutationId);

            console.log(`[SyncEngine] Processing result for mutation ${mutation.id} (mutationId: ${mutationId}):`, result);

            if (result?.status === 'applied') {
              await MutationQueue.markCompleted(mutation.id);
              totalProcessed++;
              this.emit({
                type: 'mutation_pushed',
                entity: mutation.entity,
                data: { entityId: mutation.entityId },
                timestamp: new Date(),
              });
            } else {
              const errorMsg = result?.error || 'No result returned for mutation';
              await MutationQueue.markFailed(mutation.id, errorMsg);
              this.emit({
                type: 'mutation_failed',
                entity: mutation.entity,
                data: { entityId: mutation.entityId, error: errorMsg },
                timestamp: new Date(),
              });
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          for (const mutation of entityMutations) {
            await MutationQueue.markFailed(mutation.id, message);
            this.emit({
              type: 'mutation_failed',
              entity: mutation.entity,
              data: { entityId: mutation.entityId, error: message },
              timestamp: new Date(),
            });
          }
        }
      }

      // Emit progress event for UI feedback
      this.emit({
        type: 'mutations_batch_complete',
        data: { batchNumber, processedInBatch: mutations.length, totalProcessed },
        timestamp: new Date(),
      });
    }
  }

  private async pushMutationBatch(
    entity: string,
    mutations: MutationQueueItem[]
  ): Promise<Array<{ mutationId: string; status: string; error?: string }>> {
    const config = this.configs.get(entity);
    if (!config) {
      throw new Error(`Entity ${entity} not registered`);
    }

    const url = `${this.baseUrl}${config.apiMutationEndpoint}`;
    console.log('[SyncEngine] Push URL:', url);

    // Build mutations array for batch API
    const mutationsPayload = mutations.map((mutation) => {
      // Parse payload from JSON string (stored as string in SQLite)
      let payload: Record<string, unknown>;
      if (typeof mutation.payload === 'string') {
        payload = JSON.parse(mutation.payload);
      } else {
        payload = mutation.payload as Record<string, unknown>;
      }

      const record = config.transformToServer
        ? config.transformToServer(payload as never)
        : payload;

      // Generate a unique mutationId that includes the operation type
      // This prevents idempotency cache collisions between CREATE/UPDATE/DELETE
      // of the same entity. Format: {entityId}-{operation}-{localMutationId}
      const entityId = (payload.id as string) || mutation.entityId;
      const mutationId = `${entityId}-${mutation.operation}-${mutation.id}`;

      return {
        mutationId,
        action: mutation.operation,
        record,
        clientUpdatedAt: new Date().toISOString(),
      };
    });

    console.log('[SyncEngine] Push payload:', JSON.stringify(mutationsPayload, null, 2));

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mutations: mutationsPayload }),
      timeout: 60000, // 60s timeout para push (pode ter muitas mutações)
      retries: 3,
    });

    console.log('[SyncEngine] Push response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SyncEngine] Push error:', errorText);
      throw new Error(`Push failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[SyncEngine] Push result:', JSON.stringify(data));
    return data.results || [];
  }

  // =============================================================================
  // FAST PUSH (Item 7)
  // =============================================================================

  /**
   * Executa apenas o push de mutações pendentes, sem o pull de dados
   *
   * Usado pelo FastPushService para enviar mutações rapidamente sem
   * bloquear com o pull completo de todas as entidades.
   *
   * Diferenças de syncAll():
   * - Não faz pull de entidades
   * - Não sincroniza checklists
   * - Não sincroniza attachments
   * - Usa lock separado (pushLock vs syncLock)
   *
   * @returns Contagem de mutações pushed e failed
   */
  async pushOnly(): Promise<{ pushed: number; failed: number }> {
    if (!this.isOnline) {
      console.log('[SyncEngine] pushOnly: Offline, skipping');
      return { pushed: 0, failed: 0 };
    }

    if (!this.technicianId || !this.authToken) {
      console.log('[SyncEngine] pushOnly: Not configured, skipping');
      return { pushed: 0, failed: 0 };
    }

    // Usar syncLock para evitar conflitos com syncAll
    if (this.syncLock) {
      console.log('[SyncEngine] pushOnly: syncLock active, waiting for full sync');
      return { pushed: 0, failed: 0 };
    }

    console.log('[SyncEngine] pushOnly: Starting push-only sync');
    this.emit({ type: 'push_only_start', timestamp: new Date() });

    let pushed = 0;
    let failed = 0;

    try {
      // Processar mutações em batches (mesma lógica de pushPendingMutations)
      const BATCH_SIZE = 100;

      while (true) {
        const mutations = await MutationQueue.getPending(BATCH_SIZE);

        if (mutations.length === 0) {
          break;
        }

        console.log(`[SyncEngine] pushOnly: Processing ${mutations.length} mutations`);

        // Group by entity
        const byEntity = new Map<string, typeof mutations>();
        for (const mutation of mutations) {
          const list = byEntity.get(mutation.entity) || [];
          list.push(mutation);
          byEntity.set(mutation.entity, list);
        }

        // Sort by dependency order
        const entityOrder = ['clients', 'quotes', 'workOrders', 'quoteSignatures'];
        const sortedEntities = Array.from(byEntity.keys()).sort((a, b) => {
          const orderA = entityOrder.indexOf(a);
          const orderB = entityOrder.indexOf(b);
          return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
        });

        // Process each entity's mutations
        for (const entity of sortedEntities) {
          const entityMutations = byEntity.get(entity);
          if (!entityMutations || entityMutations.length === 0) continue;

          try {
            // Mark as processing
            for (const mutation of entityMutations) {
              await MutationQueue.markProcessing(mutation.id);
            }

            // Send batch
            const results = await this.pushMutationBatch(entity, entityMutations);

            // Create results map
            const resultsMap = new Map<string, { mutationId: string; status: string; error?: string }>();
            for (const result of results) {
              if (result?.mutationId) {
                resultsMap.set(result.mutationId, result);
              }
            }

            // Process results
            for (const mutation of entityMutations) {
              const mutationId = `${mutation.entityId}-${mutation.operation}-${mutation.id}`;
              const result = resultsMap.get(mutationId);

              if (result?.status === 'applied') {
                await MutationQueue.markCompleted(mutation.id);
                pushed++;
                this.emit({
                  type: 'mutation_pushed',
                  entity: mutation.entity,
                  data: { entityId: mutation.entityId },
                  timestamp: new Date(),
                });
              } else {
                const errorMsg = result?.error || 'No result returned';
                await MutationQueue.markFailed(mutation.id, errorMsg);
                failed++;
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            for (const mutation of entityMutations) {
              await MutationQueue.markFailed(mutation.id, message);
              failed++;
            }
          }
        }
      }

      console.log(`[SyncEngine] pushOnly: Complete - pushed: ${pushed}, failed: ${failed}`);
      this.emit({
        type: 'push_only_complete',
        data: { pushed, failed },
        timestamp: new Date(),
      });

      return { pushed, failed };
    } catch (error) {
      console.error('[SyncEngine] pushOnly: Error', error);
      this.emit({
        type: 'push_only_error',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
      });
      return { pushed, failed };
    }
  }

  // =============================================================================
  // SYNC METADATA
  // =============================================================================

  private async getSyncMeta(entity: string) {
    const results = await rawQuery<{ lastCursor: string; lastSyncAt: string }>(
      'SELECT lastCursor, lastSyncAt FROM sync_meta WHERE entity = ?',
      [entity]
    );
    return results[0] ?? null;
  }

  private async updateSyncMeta(entity: string, cursor: string | null) {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_meta SET lastSyncAt = ?, lastCursor = ?, syncStatus = 'idle' WHERE entity = ?`,
      [new Date().toISOString(), cursor, entity]
    );
  }

  // =============================================================================
  // STATE & EVENTS
  // =============================================================================

  private setState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
  }

  getState(): SyncState {
    return { ...this.state };
  }

  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  // =============================================================================
  // CHECKLIST SYNC
  // =============================================================================

  /**
   * Sincronizar templates de checklist do servidor para o banco local
   * Isso permite criar novas instâncias de checklist mesmo offline
   */
  private async syncChecklistTemplates(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    console.log('[SyncEngine] Syncing checklist templates...');

    try {
      const url = `${this.baseUrl}/checklist-templates?includeDetails=true`;

      const response = await fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30s timeout
        retries: 2,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }

      const templates = await response.json();
      console.log(`[SyncEngine] Fetched ${templates.length} checklist templates`);

      if (templates.length === 0) {
        return;
      }

      // Save templates to local database
      const db = await getDatabase();
      const now = new Date().toISOString();

      for (const template of templates) {
        // Convert sections and questions to JSON strings for SQLite storage
        const sectionsJson = JSON.stringify(template.sections || []);
        const questionsJson = JSON.stringify(template.questions || []);
        const isActiveValue = template.isActive !== false && (template.isActive as unknown) !== 0 ? 1 : 0;

        await db.runAsync(
          `INSERT OR REPLACE INTO checklist_templates
           (id, name, description, version, isActive, sections, questions, createdAt, updatedAt, technicianId, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            template.id,
            template.name,
            template.description || null,
            template.version || 1,
            isActiveValue,
            sectionsJson,
            questionsJson,
            template.createdAt,
            template.updatedAt,
            template.technicianId || this.technicianId,
            now,
          ]
        );
      }

      console.log(`[SyncEngine] Saved ${templates.length} checklist templates to local DB`);
    } catch (error) {
      console.error('[SyncEngine] Failed to sync checklist templates:', error);
      // Don't propagate - this is secondary to main sync
    }
  }

  /**
   * Sincronizar checklists de todas as OSs locais para acesso offline
   * Isso garante que os checklists estarão disponíveis mesmo sem internet
   * IMPORTANTE: Só sincroniza OSs que já existem no servidor (syncedAt IS NOT NULL)
   *
   * OTIMIZAÇÃO (SYNC_OPT_CHECKLIST_BATCH_PULL):
   * - Verifica conectividade UMA vez antes de começar
   * - Push pending answers UMA vez antes de começar
   * - Concorrência limitada (3 por padrão em vez de 5)
   * - Retry individual com backoff exponencial
   * - Cancelamento se offline detectado
   * - Métricas detalhadas
   */
  private async syncChecklistsForAllWorkOrders(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    const correlationId = syncMetrics.getCurrentCorrelationId() || 'no-cycle';
    console.log(`[SyncEngine] [${correlationId}] Syncing checklists for all work orders...`);

    try {
      // Importar dinamicamente para evitar dependência circular
      const { rawQuery } = await import('../db/database');
      const { ChecklistSyncService } = await import(
        '../modules/checklists/services/ChecklistSyncService'
      );

      // Configurar o serviço de checklist
      ChecklistSyncService.configure(this.technicianId);

      // Buscar apenas OSs que JÁ FORAM SINCRONIZADAS com o servidor (syncedAt IS NOT NULL)
      // OSs criadas offline ainda não existem no servidor e causariam erro 404
      const workOrders = await rawQuery<{ id: string; status: string; syncedAt: string }>(
        `SELECT id, status, syncedAt FROM work_orders
         WHERE isActive = 1 AND syncedAt IS NOT NULL
         ORDER BY updatedAt DESC
         LIMIT 50`
      );

      console.log(`[SyncEngine] [${correlationId}] Found ${workOrders.length} synced work orders to sync checklists`);

      if (workOrders.length === 0) {
        return;
      }

      // Usar abordagem otimizada ou original baseado na flag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = ChecklistSyncService as any;
      if (SYNC_FLAGS.SYNC_OPT_CHECKLIST_BATCH_PULL) {
        await this.syncChecklistsOptimized(workOrders, service, correlationId);
      } else {
        // Comportamento original: 5 paralelos sem retry/métricas
        await this.syncChecklistsOriginal(workOrders, service);
      }

      console.log(`[SyncEngine] [${correlationId}] Checklists sync complete`);
    } catch (error) {
      console.error(`[SyncEngine] [${correlationId}] Failed to sync checklists:`, error);
      // Não propagar erro - é secundário ao sync principal
    }
  }

  /**
   * Abordagem original de sync de checklists (para rollback/comparação)
   */
  private async syncChecklistsOriginal(
    workOrders: Array<{ id: string; status: string; syncedAt: string }>,
    ChecklistSyncService: { pullChecklistsForWorkOrder: (id: string) => Promise<void> }
  ): Promise<void> {
    const batchSize = 5;
    for (let i = 0; i < workOrders.length; i += batchSize) {
      const batch = workOrders.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (wo) => {
          try {
            await ChecklistSyncService.pullChecklistsForWorkOrder(wo.id);
          } catch (error) {
            console.warn(`[SyncEngine] Failed to sync checklists for WO ${wo.id}:`, error);
          }
        })
      );
    }
  }

  /**
   * Abordagem otimizada de sync de checklists
   *
   * Melhorias sobre a original:
   * 1. Verificação de conectividade única antes de iniciar
   * 2. Concorrência reduzida (3 em vez de 5) para redes ruins
   * 3. Retry individual com backoff exponencial
   * 4. Cancelamento se offline detectado durante o processo
   * 5. Métricas detalhadas por OS
   */
  private async syncChecklistsOptimized(
    workOrders: Array<{ id: string; status: string; syncedAt: string }>,
    ChecklistSyncService: { pullChecklistsForWorkOrder: (id: string) => Promise<void> },
    correlationId: string
  ): Promise<void> {
    const totalTimer = createTimer();
    const concurrency = SYNC_FLAGS.CHECKLIST_PULL_CONCURRENCY;
    const maxRetries = SYNC_FLAGS.CHECKLIST_PULL_MAX_RETRIES;
    const retryDelayMs = SYNC_FLAGS.CHECKLIST_PULL_RETRY_DELAY_MS;

    console.log(`[SyncEngine] [${correlationId}] Using optimized checklist pull:`, {
      totalWorkOrders: workOrders.length,
      concurrency,
      maxRetries,
      retryDelayMs,
    });

    // Métricas para cada OS
    const woResults: ChecklistBatchPullMetrics['workOrderResults'] = [];
    let totalRequests = 0;
    let retriedRequests = 0;

    // Função para processar uma OS com retry
    const processWorkOrder = async (wo: { id: string }): Promise<void> => {
      const woTimer = createTimer();
      let retries = 0;
      let success = false;
      let lastError: string | undefined;
      let checklistCount = 0;

      while (retries <= maxRetries && !success) {
        // Verificar se ainda está online antes de cada tentativa
        if (!this.isOnline) {
          lastError = 'Device went offline';
          console.warn(`[SyncEngine] [${correlationId}] Skipping WO ${wo.id}: offline`);
          break;
        }

        totalRequests++;
        if (retries > 0) {
          retriedRequests++;
          const backoffDelay = retryDelayMs * retries;
          console.log(`[SyncEngine] [${correlationId}] Retry ${retries}/${maxRetries} for WO ${wo.id} after ${backoffDelay}ms`);
          await this.delay(backoffDelay);
        }

        try {
          await ChecklistSyncService.pullChecklistsForWorkOrder(wo.id);
          success = true;
          // TODO: O service poderia retornar o count de checklists sincronizados
          checklistCount = 0; // Não temos essa info do service atual
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          retries++;

          // Se for erro 404 (OS não existe no servidor), não fazer retry
          if (lastError.includes('404') || lastError.includes('not found')) {
            console.warn(`[SyncEngine] [${correlationId}] WO ${wo.id} not found on server, skipping`);
            break;
          }
        }
      }

      woResults.push({
        workOrderId: wo.id,
        success,
        durationMs: woTimer.elapsed(),
        retries,
        error: success ? undefined : lastError,
        checklistCount,
      });
    };

    // Processar com concorrência limitada usando o pool existente
    await this.runWithConcurrencyLimit(workOrders, concurrency, processWorkOrder);

    // Calcular métricas
    const successfulPulls = woResults.filter((r) => r.success).length;
    const failedPulls = woResults.filter((r) => !r.success && !r.error?.includes('offline')).length;
    const skippedPulls = woResults.filter((r) => r.error?.includes('offline') || r.error?.includes('not found')).length;
    const durations = woResults.map((r) => r.durationMs);
    const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
    const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const metrics: ChecklistBatchPullMetrics = {
      correlationId,
      totalWorkOrders: workOrders.length,
      successfulPulls,
      failedPulls,
      skippedPulls,
      totalRequests,
      retriedRequests,
      totalDurationMs: totalTimer.elapsed(),
      avgDurationPerWoMs: avgDurationMs,
      maxDurationPerWoMs: maxDurationMs,
      concurrency,
      usedOptimizedPull: true,
      workOrderResults: woResults,
    };

    syncMetrics.recordChecklistBatchPull(metrics);
  }

  /**
   * Helper para delay com Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sincronizar sessões de execução pendentes de todas as OSs
   * Isso garante que pausas e sessões de trabalho sejam enviadas ao servidor
   */
  private async syncExecutionSessionsForAllWorkOrders(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    console.log('[SyncEngine] Syncing execution sessions...');

    try {
      // Importar dinamicamente para evitar dependência circular
      const { ExecutionSessionSyncService } = await import(
        '../modules/workorders/execution/ExecutionSessionSyncService'
      );

      const result = await ExecutionSessionSyncService.pushAllPendingSessions();
      console.log('[SyncEngine] Execution sessions sync complete:', result);
    } catch (error) {
      console.error('[SyncEngine] Failed to sync execution sessions:', error);
      // Não propagar erro - é secundário ao sync principal
    }
  }

  /**
   * Sincronizar anexos de checklist pendentes
   * Isso garante que fotos e assinaturas offline sejam enviadas ao servidor
   */
  private async syncChecklistAttachments(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    console.log('[SyncEngine] Syncing checklist attachments...');

    try {
      // Limpar anexos antigos sem dados válidos primeiro (evita erros em loop)
      await this.cleanupInvalidAttachments();

      // Importar dinamicamente para evitar dependência circular
      const { AttachmentUploadService } = await import(
        '../modules/checklists/services/AttachmentUploadService'
      );

      // Configurar o serviço com technicianId
      AttachmentUploadService.configure(this.technicianId);

      // Processar fila de uploads pendentes
      const result = await AttachmentUploadService.processQueue();
      console.log('[SyncEngine] Checklist attachments sync complete:', {
        uploaded: result.uploaded,
        failed: result.failed,
      });
    } catch (error) {
      console.error('[SyncEngine] Failed to sync checklist attachments:', error);
      // Não propagar erro - é secundário ao sync principal
    }
  }

  /**
   * Limpar anexos inválidos do banco de dados
   * Remove anexos que ficaram pendentes mas não têm dados para upload
   */
  private async cleanupInvalidAttachments(): Promise<void> {
    try {
      // IMPORTANTE: getDatabase() é async, precisa de await
      const db = await getDatabase();
      // Marcar como FAILED anexos que não têm base64Data nem localPath válido
      // e já falharam muitas vezes
      const result = await db.runAsync(
        `UPDATE checklist_attachments
         SET syncStatus = 'FAILED', lastUploadError = 'Dados inválidos - limpeza automática'
         WHERE syncStatus IN ('PENDING', 'UPLOADING')
         AND (base64Data IS NULL OR base64Data = '')
         AND (localPath IS NULL OR localPath = '')
         AND uploadAttempts >= 3`
      );
      if (result.changes > 0) {
        console.log(`[SyncEngine] Cleaned up ${result.changes} invalid attachments`);
      }
    } catch (error) {
      console.error('[SyncEngine] Failed to cleanup invalid attachments:', error);
    }
  }

  // =============================================================================
  // QUOTE SIGNATURES SYNC
  // =============================================================================

  /**
   * Sincronizar assinaturas de orçamentos pendentes
   * Isso garante que assinaturas coletadas offline sejam enviadas ao servidor
   */
  private async syncQuoteSignatures(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    console.log('[SyncEngine] Syncing quote signatures...');

    try {
      // Importar dinamicamente para evitar dependência circular
      const { QuoteSignatureService } = await import(
        '../modules/quotes/QuoteSignatureService'
      );

      // Processar uploads pendentes
      const result = await QuoteSignatureService.processAllPendingUploads();
      console.log('[SyncEngine] Quote signatures sync complete:', {
        success: result.success,
        failed: result.failed,
      });
    } catch (error) {
      console.error('[SyncEngine] Failed to sync quote signatures:', error);
      // Não propagar erro - é secundário ao sync principal
    }
  }

  // =============================================================================
  // WORK ORDER SIGNATURES SYNC
  // =============================================================================

  /**
   * Sincronizar assinaturas de OS pendentes
   * Isso garante que assinaturas coletadas offline sejam enviadas ao servidor
   */
  private async syncWorkOrderSignatures(): Promise<void> {
    if (!this.isOnline || !this.technicianId || !this.authToken) {
      return;
    }

    console.log('[SyncEngine] Syncing work order signatures...');

    try {
      // Importar dinamicamente para evitar dependência circular
      const { WorkOrderSignatureService } = await import(
        '../modules/workorders/services/WorkOrderSignatureService'
      );

      // Processar uploads pendentes
      const result = await WorkOrderSignatureService.syncAllPending();
      console.log('[SyncEngine] Work order signatures sync complete:', {
        synced: result.synced,
        failed: result.failed,
      });
    } catch (error) {
      console.error('[SyncEngine] Failed to sync work order signatures:', error);
      // Não propagar erro - é secundário ao sync principal
    }
  }

  // =============================================================================
  // UTILITIES
  // =============================================================================

  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const syncEngine = new SyncEngine();

export default syncEngine;
