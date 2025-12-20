// @ts-nocheck
/**
 * useChecklistSync
 *
 * Hook para gerenciar sincronização de checklists.
 * - Monitora status de sync
 * - Trigger manual de sync
 * - Estatísticas de pendentes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChecklistSyncService } from '../services/ChecklistSyncService';
import { AttachmentUploadService } from '../services/AttachmentUploadService';

// =============================================================================
// TYPES
// =============================================================================

export interface ChecklistSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingAnswers: number;
  pendingUploads: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

export interface UseChecklistSyncReturn {
  status: ChecklistSyncStatus;
  syncAll: () => Promise<void>;
  syncInstance: (instanceId: string) => Promise<void>;
  uploadPending: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface UseChecklistSyncOptions {
  technicianId: string;
  autoSync?: boolean;
  syncIntervalMs?: number;
}

// =============================================================================
// HOOK
// =============================================================================

export function useChecklistSync(options: UseChecklistSyncOptions): UseChecklistSyncReturn {
  const { technicianId, autoSync = true, syncIntervalMs = 60000 } = options;

  // State
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Refs
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // REFRESH STATS
  // =============================================================================

  const refreshStats = useCallback(async () => {
    try {
      const answers = await ChecklistSyncService.countPendingSync();
      const uploads = await ChecklistSyncService.countPendingUploads(technicianId);

      setPendingAnswers(answers);
      setPendingUploads(uploads);
      setIsOnline(ChecklistSyncService.isOnline());
    } catch (err) {
      console.error('[useChecklistSync] refreshStats error:', err);
    }
  }, [technicianId]);

  // =============================================================================
  // SYNC ALL
  // =============================================================================

  const syncAll = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setLastError(null);

    try {
      // Configurar services
      ChecklistSyncService.configure(technicianId);
      AttachmentUploadService.configure(technicianId);

      // Sync respostas
      const answerResult = await ChecklistSyncService.pushAllPendingAnswers();

      if (!answerResult.success && answerResult.results.length > 0) {
        const errors = answerResult.results.flatMap((r) => r.errors);
        if (errors.length > 0) {
          setLastError(errors[0]);
        }
      }

      // Process upload queue
      const uploadResult = await AttachmentUploadService.processQueue();

      if (!uploadResult.success && uploadResult.results.length > 0) {
        const failedUpload = uploadResult.results.find((r) => !r.success);
        if (failedUpload?.error) {
          setLastError(failedUpload.error);
        }
      }

      setLastSyncAt(new Date());
      await refreshStats();
    } catch (err) {
      console.error('[useChecklistSync] syncAll error:', err);
      setLastError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setIsSyncing(false);
    }
  }, [technicianId, isSyncing, refreshStats]);

  // =============================================================================
  // SYNC INSTANCE
  // =============================================================================

  const syncInstance = useCallback(
    async (instanceId: string) => {
      if (isSyncing) return;

      setIsSyncing(true);
      setLastError(null);

      try {
        ChecklistSyncService.configure(technicianId);

        const result = await ChecklistSyncService.pushPendingAnswers(instanceId);

        if (!result.success && result.errors.length > 0) {
          setLastError(result.errors[0]);
        }

        setLastSyncAt(new Date());
        await refreshStats();
      } catch (err) {
        console.error('[useChecklistSync] syncInstance error:', err);
        setLastError(err instanceof Error ? err.message : 'Erro ao sincronizar');
      } finally {
        setIsSyncing(false);
      }
    },
    [technicianId, isSyncing, refreshStats]
  );

  // =============================================================================
  // UPLOAD PENDING
  // =============================================================================

  const uploadPending = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setLastError(null);

    try {
      AttachmentUploadService.configure(technicianId);

      const result = await AttachmentUploadService.processQueue();

      if (!result.success && result.results.length > 0) {
        const failedUpload = result.results.find((r) => !r.success);
        if (failedUpload?.error) {
          setLastError(failedUpload.error);
        }
      }

      setLastSyncAt(new Date());
      await refreshStats();
    } catch (err) {
      console.error('[useChecklistSync] uploadPending error:', err);
      setLastError(err instanceof Error ? err.message : 'Erro ao fazer upload');
    } finally {
      setIsSyncing(false);
    }
  }, [technicianId, isSyncing, refreshStats]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Configure services
  useEffect(() => {
    ChecklistSyncService.configure(technicianId);
    AttachmentUploadService.configure(technicianId);
  }, [technicianId]);

  // Initial stats
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Auto-sync
  useEffect(() => {
    if (!autoSync) return;

    syncIntervalRef.current = setInterval(() => {
      if (!isSyncing) {
        syncAll();
      }
    }, syncIntervalMs);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [autoSync, syncIntervalMs, syncAll, isSyncing]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    status: {
      isOnline,
      isSyncing,
      pendingAnswers,
      pendingUploads,
      lastSyncAt,
      lastError,
    },
    syncAll,
    syncInstance,
    uploadPending,
    refresh: refreshStats,
  };
}

export default useChecklistSync;
