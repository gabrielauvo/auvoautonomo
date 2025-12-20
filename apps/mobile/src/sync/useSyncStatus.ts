/**
 * useSyncStatus Hook
 *
 * Hook React para monitorar o status de sincronização.
 *
 * OTIMIZAÇÃO (Item 5):
 * Quando SYNC_OPT_EVENT_PENDING_COUNT está ativado, usa eventos do MutationQueue
 * em vez de polling para atualizar a contagem de mutações pendentes.
 * Isso reduz consultas ao SQLite e economiza bateria.
 */

import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from './SyncEngine';
import { SyncState, SyncEvent } from './types';
import { MutationQueue } from '../queue/MutationQueue';
import { SYNC_FLAGS } from '../config/syncFlags';

// =============================================================================
// HOOK
// =============================================================================

export function useSyncStatus() {
  const [state, setState] = useState<SyncState>(syncEngine.getState());
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(syncEngine.isNetworkOnline());

  useEffect(() => {
    // Subscribe to sync events
    const unsubscribeSyncEngine = syncEngine.subscribe((event: SyncEvent) => {
      setState(syncEngine.getState());

      if (event.type === 'online_detected') {
        setIsOnline(true);
      } else if (event.type === 'offline_detected') {
        setIsOnline(false);
      }
    });

    // ==========================================================================
    // PENDING COUNT UPDATE (Item 5)
    // ==========================================================================

    // Query inicial - sempre necessária para cold start
    const fetchInitialCount = async () => {
      const count = await MutationQueue.countPending();
      setPendingCount(count);
    };
    fetchInitialCount();

    let unsubscribeMutationQueue: (() => void) | undefined;
    let pollingInterval: ReturnType<typeof setInterval> | undefined;

    if (SYNC_FLAGS.SYNC_OPT_EVENT_PENDING_COUNT) {
      // OTIMIZADO: Usar eventos do MutationQueue
      unsubscribeMutationQueue = MutationQueue.subscribe((event) => {
        // O evento já inclui a contagem atualizada
        setPendingCount(event.pendingCount);
      });
    } else {
      // FALLBACK: Usar polling (comportamento original)
      const updatePendingCount = async () => {
        const count = await MutationQueue.countPending();
        setPendingCount(count);
      };

      pollingInterval = setInterval(
        updatePendingCount,
        SYNC_FLAGS.PENDING_COUNT_POLL_INTERVAL_MS
      );
    }

    return () => {
      unsubscribeSyncEngine();
      if (unsubscribeMutationQueue) {
        unsubscribeMutationQueue();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const sync = useCallback(async () => {
    console.log('[useSyncStatus] Manual sync triggered');
    console.log('[useSyncStatus] SyncEngine state:', {
      isConfigured: syncEngine.isConfigured(),
      isOnline: syncEngine.isNetworkOnline(),
    });
    await syncEngine.syncAll();
  }, []);

  const syncEntity = useCallback(async (entity: string) => {
    await syncEngine.syncEntity(entity);
  }, []);

  return {
    ...state,
    pendingCount,
    isOnline,
    isSyncing: state.status === 'syncing',
    hasError: state.status === 'error',
    sync,
    syncEntity,
  };
}

export default useSyncStatus;
