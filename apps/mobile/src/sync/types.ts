/**
 * Sync Engine Types
 *
 * Tipos para o sistema de sincronização 2-vias.
 */

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export interface SyncEntityConfig<T> {
  /** Nome da entidade (ex: 'clients', 'workOrders') */
  name: string;

  /** Nome da tabela no SQLite */
  tableName: string;

  /** Endpoint da API para buscar dados */
  apiEndpoint: string;

  /** Endpoint da API para enviar mutações (opcional para entidades read-only) */
  apiMutationEndpoint?: string;

  /** Campo usado para delta sync (geralmente 'updatedAt') */
  cursorField: keyof T;

  /** Campos que identificam o registro (geralmente ['id']) */
  primaryKeys: (keyof T)[];

  /** Campos para incluir no escopo do técnico */
  scopeField: keyof T;

  /** Tamanho do lote para paginação */
  batchSize: number;

  /** Estratégia de resolução de conflitos */
  conflictResolution: 'server_wins' | 'client_wins' | 'last_write_wins';

  /** Transformar dados do servidor antes de salvar localmente */
  transformFromServer?: (data: unknown) => T;

  /** Transformar dados locais antes de enviar ao servidor */
  transformToServer?: (data: T) => unknown;

  /**
   * Handler customizado para salvar dados no banco local.
   * Se fornecido, substitui o comportamento padrão de save.
   * Útil para entidades com relacionamentos (ex: bundles)
   */
  customSave?: (data: T[], technicianId: string) => Promise<void>;
}

// =============================================================================
// SYNC STATE
// =============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: Date | null;
  error: string | null;
  progress: {
    current: number;
    total: number;
    entity: string;
  } | null;
}

// =============================================================================
// SYNC RESULTS
// =============================================================================

export interface SyncResult {
  success: boolean;
  entity: string;
  pulled: number;
  pushed: number;
  errors: SyncError[];
  duration: number;
}

export interface SyncError {
  entity: string;
  entityId?: string;
  operation: 'pull' | 'push';
  message: string;
  code?: string;
}

// =============================================================================
// API RESPONSE
// =============================================================================

export interface SyncPullResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface SyncPushResponse {
  success: boolean;
  entityId: string;
  serverId?: string;
  error?: string;
}

// =============================================================================
// MUTATION TYPES
// =============================================================================

export type MutationOperation = 'create' | 'update' | 'update_status' | 'delete';

export interface Mutation<T = unknown> {
  id: number;
  entity: string;
  entityId: string;
  operation: MutationOperation;
  payload: T;
  createdAt: Date;
  attempts: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

// =============================================================================
// SYNC EVENTS
// =============================================================================

export type SyncEventType =
  | 'sync_start'
  | 'sync_complete'
  | 'sync_error'
  | 'sync_retry'
  | 'sync_max_retries_exceeded'
  | 'entity_sync_start'
  | 'entity_sync_complete'
  | 'mutation_pushed'
  | 'mutation_failed'
  | 'mutations_batch_complete'
  | 'conflict_resolved'
  | 'offline_detected'
  | 'online_detected'
  // Item 7: Fast Push events
  | 'push_only_start'
  | 'push_only_complete'
  | 'push_only_error';

export interface SyncEvent {
  type: SyncEventType;
  entity?: string;
  data?: unknown;
  timestamp: Date;
}

export type SyncEventListener = (event: SyncEvent) => void;
