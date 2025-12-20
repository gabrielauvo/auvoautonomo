/**
 * Mutation Queue
 *
 * Fila de mutações para operações offline.
 * As mutações são armazenadas localmente e sincronizadas quando online.
 *
 * OTIMIZAÇÃO (Item 5):
 * Emite eventos quando mutações são adicionadas/removidas para permitir
 * que o UI reaja sem polling. Ver SYNC_OPT_EVENT_PENDING_COUNT.
 */

import { getDatabase, rawQuery } from '../db';
import { MutationQueueItem } from '../db/schema';
import { MutationOperation } from '../sync/types';
import { syncEngine } from '../sync';
import { SYNC_FLAGS } from '../config/syncFlags';
import { FastPushService } from '../sync/FastPushService';

// Debounce para não disparar sync a cada mutação (fallback quando SYNC_OPT_FAST_PUSH_ONLY = false)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2000; // 2 segundos

// =============================================================================
// EVENT SYSTEM (Item 5)
// =============================================================================

export type MutationQueueEventType =
  | 'mutation_added'
  | 'mutation_completed'
  | 'mutation_failed'
  | 'mutation_removed'
  | 'mutations_reset'
  | 'mutations_cleanup';

export interface MutationQueueEvent {
  type: MutationQueueEventType;
  pendingCount: number;
  mutationId?: number;
  entity?: string;
  entityId?: string;
  timestamp: Date;
}

export type MutationQueueEventListener = (event: MutationQueueEvent) => void;

// Listeners para eventos de mutação
const listeners: Set<MutationQueueEventListener> = new Set();

/**
 * Emitir evento de mudança na fila
 */
async function emitEvent(
  type: MutationQueueEventType,
  mutationId?: number,
  entity?: string,
  entityId?: string
): Promise<void> {
  // Contar pendentes para incluir no evento
  const pendingCount = await MutationQueue.countPending();

  const event: MutationQueueEvent = {
    type,
    pendingCount,
    mutationId,
    entity,
    entityId,
    timestamp: new Date(),
  };

  // Notificar todos os listeners
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[MutationQueue] Event listener error:', error);
    }
  });
}

// =============================================================================
// MUTATION QUEUE
// =============================================================================

export const MutationQueue = {
  // ===========================================================================
  // EVENT SUBSCRIPTION (Item 5)
  // ===========================================================================

  /**
   * Assinar eventos de mudança na fila de mutações
   * Retorna função para cancelar assinatura
   */
  subscribe(listener: MutationQueueEventListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Obter número de listeners ativos (para debug/testes)
   */
  getListenerCount(): number {
    return listeners.size;
  },

  // ===========================================================================
  // QUEUE OPERATIONS
  // ===========================================================================

  /**
   * Adicionar mutação à fila
   */
  async enqueue<T>(
    entity: string,
    entityId: string,
    operation: MutationOperation,
    payload: T
  ): Promise<number> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const result = await db.runAsync(
      `INSERT INTO mutations_queue (entity, entityId, operation, payload, createdAt, attempts, status)
       VALUES (?, ?, ?, ?, ?, 0, 'pending')`,
      [entity, entityId, operation, JSON.stringify(payload), now]
    );

    console.log(`[MutationQueue] Enqueued ${operation} for ${entity}:${entityId}, insertId: ${result.lastInsertRowId}`);
    console.log(`[MutationQueue] SyncEngine configured: ${syncEngine.isConfigured()}, online: ${syncEngine.isNetworkOnline()}`);

    // Emitir evento de mutação adicionada (Item 5)
    emitEvent('mutation_added', result.lastInsertRowId, entity, entityId);

    // ==========================================================================
    // SYNC TRIGGER (Item 7: Fast Push Path)
    // ==========================================================================

    if (syncEngine.isConfigured() && syncEngine.isNetworkOnline()) {
      if (SYNC_FLAGS.SYNC_OPT_FAST_PUSH_ONLY) {
        // OTIMIZADO (Item 7): Usar FastPushService
        // - Notifica o service que uma mutação foi adicionada
        // - Service faz debounce/coalescing e dispara pushOnly()
        // - Sync completo é agendado separadamente (throttled)
        console.log('[MutationQueue] Using fast push path (Item 7)');
        FastPushService.notifyMutationAdded();
      } else {
        // FALLBACK: Comportamento original - syncAll após debounce
        console.log('[MutationQueue] Will trigger auto-sync in 2 seconds (fallback)...');
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        syncTimeout = setTimeout(() => {
          console.log('[MutationQueue] Auto-triggering sync after mutation enqueue');
          syncEngine.syncAll()
            .then((results) => {
              console.log('[MutationQueue] Auto-sync completed:', JSON.stringify(results.map(r => ({
                entity: r.entity,
                success: r.success,
                pushed: r.pushed,
                pulled: r.pulled,
                errors: r.errors,
              }))));
            })
            .catch((err) => {
              console.error('[MutationQueue] Auto-sync failed:', err);
            });
        }, SYNC_DEBOUNCE_MS);
      }
    } else {
      console.log('[MutationQueue] Sync not triggered - configured:', syncEngine.isConfigured(), 'online:', syncEngine.isNetworkOnline());
    }

    return result.lastInsertRowId;
  },

  /**
   * Buscar mutações pendentes
   * Inclui mutações falhas com menos de MAX_RETRY_COUNT tentativas
   */
  async getPending(limit: number = 50): Promise<MutationQueueItem[]> {
    const MAX_RETRY_COUNT = 5;
    return rawQuery<MutationQueueItem>(
      `SELECT * FROM mutations_queue
       WHERE status = 'pending' OR (status = 'failed' AND attempts < ?)
       ORDER BY createdAt ASC
       LIMIT ?`,
      [MAX_RETRY_COUNT, limit]
    );
  },

  /**
   * Buscar mutações por entidade
   */
  async getByEntity(entity: string, entityId: string): Promise<MutationQueueItem[]> {
    return rawQuery<MutationQueueItem>(
      `SELECT * FROM mutations_queue
       WHERE entity = ? AND entityId = ?
       ORDER BY createdAt ASC`,
      [entity, entityId]
    );
  },

  /**
   * Marcar como processando
   */
  async markProcessing(id: number): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE mutations_queue
       SET status = 'processing', lastAttempt = ?, attempts = attempts + 1
       WHERE id = ?`,
      [now, id]
    );
  },

  /**
   * Marcar como concluído
   */
  async markCompleted(id: number): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `UPDATE mutations_queue SET status = 'completed' WHERE id = ?`,
      [id]
    );

    console.log(`[MutationQueue] Mutation ${id} completed`);

    // Emitir evento de mutação completada (Item 5)
    emitEvent('mutation_completed', id);
  },

  /**
   * Marcar como falhou
   */
  async markFailed(id: number, errorMessage: string): Promise<void> {
    const db = await getDatabase();

    await db.runAsync(
      `UPDATE mutations_queue SET status = 'failed', errorMessage = ? WHERE id = ?`,
      [errorMessage, id]
    );

    console.log(`[MutationQueue] Mutation ${id} failed: ${errorMessage}`);

    // Emitir evento de mutação falha (Item 5)
    emitEvent('mutation_failed', id);
  },

  /**
   * Remover mutação da fila
   */
  async remove(id: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM mutations_queue WHERE id = ?`, [id]);

    // Emitir evento de mutação removida (Item 5)
    emitEvent('mutation_removed', id);
  },

  /**
   * Limpar mutações antigas completadas ou muito antigas com falhas
   */
  async cleanup(olderThanDays: number = 7): Promise<number> {
    const db = await getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.runAsync(
      `DELETE FROM mutations_queue
       WHERE (status = 'completed' AND createdAt < ?)
          OR (status = 'failed' AND createdAt < ?)
          OR (createdAt < ?)`,
      [cutoffDate.toISOString(), cutoffDate.toISOString(), cutoffDate.toISOString()]
    );

    console.log(`[MutationQueue] Cleaned up ${result.changes} old mutations`);

    // Emitir evento de cleanup se houve mudanças (Item 5)
    if (result.changes > 0) {
      emitEvent('mutations_cleanup');
    }

    return result.changes;
  },

  /**
   * Contar mutações pendentes
   */
  async countPending(): Promise<number> {
    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM mutations_queue WHERE status = 'pending'`
    );
    return results[0]?.count ?? 0;
  },

  /**
   * Verificar se há mutações pendentes para uma entidade
   */
  async hasPendingFor(entity: string, entityId: string): Promise<boolean> {
    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM mutations_queue
       WHERE entity = ? AND entityId = ? AND status IN ('pending', 'processing')`,
      [entity, entityId]
    );
    return (results[0]?.count ?? 0) > 0;
  },

  /**
   * Resetar mutações falhas para tentar novamente
   * Útil após correção de bugs no sync
   */
  async resetFailed(): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `UPDATE mutations_queue SET status = 'pending', attempts = 0, errorMessage = NULL
       WHERE status = 'failed'`
    );
    console.log(`[MutationQueue] Reset ${result.changes} failed mutations`);

    // Emitir evento de reset se houve mudanças (Item 5)
    if (result.changes > 0) {
      emitEvent('mutations_reset');
    }

    return result.changes;
  },

  /**
   * Deletar mutações falhas permanentemente
   */
  async deleteFailed(): Promise<number> {
    const db = await getDatabase();
    const result = await db.runAsync(
      `DELETE FROM mutations_queue WHERE status = 'failed'`
    );
    console.log(`[MutationQueue] Deleted ${result.changes} failed mutations`);
    return result.changes;
  },

  /**
   * Obter todas as mutações (para debug)
   */
  async getAll(): Promise<MutationQueueItem[]> {
    return rawQuery<MutationQueueItem>(
      `SELECT * FROM mutations_queue ORDER BY createdAt DESC LIMIT 100`
    );
  },
};

export default MutationQueue;
