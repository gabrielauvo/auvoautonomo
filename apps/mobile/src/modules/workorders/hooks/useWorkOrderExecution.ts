// @ts-nocheck
/**
 * useWorkOrderExecution Hook
 *
 * Hook para gerenciar a execução de uma Ordem de Serviço.
 * Fornece:
 * - Estado atual de execução
 * - Ações (start, pause, resume, complete)
 * - Carregamento de dados
 * - Sincronização
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkOrder } from '../../../db/schema';
import { workOrderRepository } from '../WorkOrderRepository';
import {
  WorkOrderExecutionService,
  ExecutionState,
  ExecutionSummary,
  PauseReasonValue,
  StartExecutionOptions,
  CompleteExecutionOptions,
} from '../execution';

// =============================================================================
// TYPES
// =============================================================================

export interface UseWorkOrderExecutionReturn {
  /** Dados da OS */
  workOrder: WorkOrder | null;
  /** Estado de execução */
  executionState: ExecutionState | null;
  /** Resumo de execução */
  executionSummary: ExecutionSummary | null;
  /** Se está carregando */
  isLoading: boolean;
  /** Se há erro */
  error: string | null;
  /** Se há dados pendentes de sync */
  hasPendingSync: boolean;
  /** Ações */
  actions: {
    /** Iniciar execução */
    start: (options?: StartExecutionOptions) => Promise<boolean>;
    /** Pausar execução */
    pause: (reason?: PauseReasonValue, notes?: string) => Promise<boolean>;
    /** Retomar execução */
    resume: () => Promise<boolean>;
    /** Completar execução */
    complete: (options?: CompleteExecutionOptions) => Promise<{ success: boolean; error?: string }>;
    /** Cancelar execução */
    cancel: () => Promise<boolean>;
    /** Sincronizar dados pendentes */
    sync: () => Promise<void>;
    /** Recarregar dados */
    refresh: () => Promise<void>;
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useWorkOrderExecution(workOrderId: string): UseWorkOrderExecutionReturn {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const mountedRef = useRef(true);

  // ===========================================================================
  // LOAD DATA
  // ===========================================================================

  const loadData = useCallback(async () => {
    if (!workOrderId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Carregar OS
      const wo = await workOrderRepository.getById(workOrderId);
      if (!mountedRef.current) return;

      if (!wo) {
        setError('Ordem de serviço não encontrada');
        setWorkOrder(null);
        setExecutionState(null);
        setExecutionSummary(null);
        return;
      }

      setWorkOrder(wo);

      // Carregar estado de execução
      const state = await WorkOrderExecutionService.getExecutionState(workOrderId);
      if (!mountedRef.current) return;
      setExecutionState(state);

      // Carregar resumo
      const summary = await WorkOrderExecutionService.getExecutionSummary(workOrderId);
      if (!mountedRef.current) return;
      setExecutionSummary(summary);

      // Verificar pendentes
      const pending = await WorkOrderExecutionService.hasPendingSync(workOrderId);
      if (!mountedRef.current) return;
      setHasPendingSync(pending);
    } catch (err) {
      console.error('[useWorkOrderExecution] loadData error:', err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [workOrderId]);

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  const start = useCallback(
    async (options?: StartExecutionOptions): Promise<boolean> => {
      const result = await WorkOrderExecutionService.startExecution(workOrderId, options);
      if (result.success) {
        await loadData();
      } else if (result.error) {
        setError(result.error);
      }
      return result.success;
    },
    [workOrderId, loadData]
  );

  const pause = useCallback(
    async (reason?: PauseReasonValue, notes?: string): Promise<boolean> => {
      const result = await WorkOrderExecutionService.pauseExecution(workOrderId, reason, notes);
      if (result.success) {
        await loadData();
      } else if (result.error) {
        setError(result.error);
      }
      return result.success;
    },
    [workOrderId, loadData]
  );

  const resume = useCallback(async (): Promise<boolean> => {
    const result = await WorkOrderExecutionService.resumeExecution(workOrderId);
    if (result.success) {
      await loadData();
    } else if (result.error) {
      setError(result.error);
    }
    return result.success;
  }, [workOrderId, loadData]);

  const complete = useCallback(
    async (options?: CompleteExecutionOptions): Promise<{ success: boolean; error?: string }> => {
      const result = await WorkOrderExecutionService.completeExecution(workOrderId, options);
      if (result.success) {
        await loadData();
      } else if (result.error) {
        setError(result.error);
      }
      return { success: result.success, error: result.error };
    },
    [workOrderId, loadData]
  );

  const cancel = useCallback(async (): Promise<boolean> => {
    const result = await WorkOrderExecutionService.cancelExecution(workOrderId);
    if (result.success) {
      await loadData();
    } else if (result.error) {
      setError(result.error);
    }
    return result.success;
  }, [workOrderId, loadData]);

  const sync = useCallback(async (): Promise<void> => {
    try {
      await WorkOrderExecutionService.syncPendingAnswers(workOrderId);
      await loadData();
    } catch (err) {
      console.error('[useWorkOrderExecution] sync error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar');
    }
  }, [workOrderId, loadData]);

  const refresh = useCallback(async (): Promise<void> => {
    await loadData();
  }, [loadData]);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Load inicial
  useEffect(() => {
    mountedRef.current = true;
    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  // Subscribe to execution events
  useEffect(() => {
    const unsubscribe = WorkOrderExecutionService.subscribe((event) => {
      if (event.workOrderId === workOrderId) {
        // Recarregar dados quando houver mudanças
        loadData();
      }
    });

    return unsubscribe;
  }, [workOrderId, loadData]);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    workOrder,
    executionState,
    executionSummary,
    isLoading,
    error,
    hasPendingSync,
    actions: {
      start,
      pause,
      resume,
      complete,
      cancel,
      sync,
      refresh,
    },
  };
}

export default useWorkOrderExecution;
