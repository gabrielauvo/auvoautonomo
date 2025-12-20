/**
 * Sync Module
 *
 * Exportação centralizada do módulo de sincronização.
 */

export { SyncEngine, syncEngine } from './SyncEngine';
export { useSyncStatus } from './useSyncStatus';
export { useSyncInit } from './useSyncInit';
export { ClientSyncConfig } from './entities/ClientSyncConfig';
export { CategorySyncConfig } from './entities/CategorySyncConfig';
export { CatalogItemSyncConfig } from './entities/CatalogItemSyncConfig';
export { syncMetrics, estimateMemoryBytes, createTimer } from './SyncMetrics';
export { FastPushService } from './FastPushService';
export type {
  SyncEntityConfig,
  SyncState,
  SyncStatus,
  SyncResult,
  SyncError,
  SyncEvent,
  SyncEventType,
  SyncEventListener,
  SyncPullResponse,
  SyncPushResponse,
  Mutation,
  MutationOperation,
} from './types';
export type {
  ChunkMetrics,
  SaveToLocalDbMetrics,
  SyncCycleMetrics,
  EntitySyncMetrics,
  ParallelSyncMetrics,
  ChecklistBatchPullMetrics,
} from './SyncMetrics';
export type { FastPushMetrics, FastPushResult } from './FastPushService';
