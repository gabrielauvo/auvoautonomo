// @ts-nocheck
/**
 * WorkOrderExecutionService
 *
 * Serviço que orquestra a execução completa de uma Ordem de Serviço.
 * Gerencia:
 * - Estados da OS (SCHEDULED → IN_PROGRESS → DONE)
 * - Sessões de trabalho/pausa
 * - Sincronização de checklists
 * - Upload de anexos
 * - Timestamps de execução
 */

import { WorkOrder, WorkOrderStatus, ExecutionSession } from '../../../db/schema';
import { workOrderRepository } from '../WorkOrderRepository';
import { workOrderService } from '../WorkOrderService';
import { ExecutionSessionRepository } from './ExecutionSessionRepository';
import { ExecutionSessionSyncService } from './ExecutionSessionSyncService';
import { ChecklistSyncService } from '../../checklists/services/ChecklistSyncService';
import { AttachmentUploadService } from '../../checklists/services/AttachmentUploadService';
import { ChecklistInstanceRepository } from '../../checklists/repositories/ChecklistInstanceRepository';
import { MutationQueue } from '../../../queue/MutationQueue';
import { syncEngine } from '../../../sync';
import {
  ExecutionState,
  ExecutionAction,
  ExecutionActionResult,
  ExecutionSummary,
  formatTime,
  PauseReasonValue,
} from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface StartExecutionOptions {
  syncChecklistsFirst?: boolean;
}

export interface CompleteExecutionOptions {
  syncPendingFirst?: boolean;
  requireAllChecklistsComplete?: boolean;
}

export type ExecutionEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'status_changed'
  | 'error';

export type ExecutionEventListener = (event: {
  type: ExecutionEventType;
  workOrderId: string;
  data?: unknown;
}) => void;

// =============================================================================
// WORK ORDER EXECUTION SERVICE
// =============================================================================

class WorkOrderExecutionServiceClass {
  private technicianId: string | null = null;
  private listeners: Set<ExecutionEventListener> = new Set();

  /**
   * Configurar o serviço
   */
  configure(technicianId: string): void {
    this.technicianId = technicianId;
    ChecklistSyncService.configure(technicianId);
    AttachmentUploadService.configure(technicianId);
  }

  /**
   * Verificar se está online
   */
  private isOnline(): boolean {
    return syncEngine.isNetworkOnline();
  }

  // =============================================================================
  // EXECUTION STATE
  // =============================================================================

  /**
   * Obter estado atual de execução de uma OS
   */
  async getExecutionState(workOrderId: string): Promise<ExecutionState> {
    const workOrder = await workOrderRepository.getById(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    let activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
    const timeSummary = await ExecutionSessionRepository.getTimeSummary(workOrderId);

    // IMPORTANTE: Se o status é IN_PROGRESS mas não há sessão ativa, criar uma sessão
    // Isso pode acontecer se o sync sobrescreveu o status mas a sessão local foi perdida
    if (workOrder.status === 'IN_PROGRESS' && !activeSession) {
      console.log('[WorkOrderExecutionService] Status is IN_PROGRESS but no active session found. Creating recovery session...');
      try {
        activeSession = await ExecutionSessionRepository.startWorkSession(workOrderId, this.technicianId || '');
        console.log('[WorkOrderExecutionService] Recovery session created:', activeSession?.id);
      } catch (err) {
        console.error('[WorkOrderExecutionService] Failed to create recovery session:', err);
      }
    }

    const isExecuting =
      workOrder.status === 'IN_PROGRESS' &&
      activeSession?.sessionType === 'WORK';

    const isPaused =
      workOrder.status === 'IN_PROGRESS' &&
      activeSession?.sessionType === 'PAUSE';

    let currentSessionTime = 0;
    if (activeSession && activeSession.startedAt) {
      const startTime = new Date(activeSession.startedAt).getTime();
      currentSessionTime = Math.floor((Date.now() - startTime) / 1000);
    }

    return {
      isExecuting,
      isPaused,
      activeSession,
      totalWorkTime: timeSummary.totalWorkTime || 0,
      totalPauseTime: timeSummary.totalPauseTime || 0,
      currentSessionTime,
      pauseReason: isPaused ? activeSession?.pauseReason : undefined,
    };
  }

  /**
   * Obter resumo de execução da OS
   */
  async getExecutionSummary(workOrderId: string): Promise<ExecutionSummary> {
    const workOrder = await workOrderRepository.getById(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    const timeSummary = await ExecutionSessionRepository.getTimeSummary(workOrderId);

    return {
      status: workOrder.status,
      firstStartedAt: workOrder.executionStart || undefined,
      lastEndedAt: workOrder.executionEnd || undefined,
      totalWorkTimeFormatted: formatTime(timeSummary.totalWorkTime || 0).formatted,
      totalPauseTimeFormatted: formatTime(timeSummary.totalPauseTime || 0).formatted,
      sessionCount: timeSummary.sessionCount || 0,
      pauseCount: 0, // Será calculado separadamente se necessário
    };
  }

  // =============================================================================
  // EXECUTION ACTIONS
  // =============================================================================

  /**
   * Iniciar execução da OS
   */
  async startExecution(
    workOrderId: string,
    options: StartExecutionOptions = {}
  ): Promise<ExecutionActionResult> {
    try {
      console.log('[WorkOrderExecutionService] startExecution started for:', workOrderId);

      const workOrder = await workOrderRepository.getById(workOrderId);
      if (!workOrder) {
        console.log('[WorkOrderExecutionService] Work order not found');
        return { success: false, error: 'Ordem de serviço não encontrada' };
      }

      console.log('[WorkOrderExecutionService] Current status:', workOrder.status);

      // Verificar se pode iniciar (SCHEDULED, IN_PROGRESS ou DONE para reabrir)
      if (workOrder.status !== 'SCHEDULED' && workOrder.status !== 'IN_PROGRESS' && workOrder.status !== 'DONE') {
        return {
          success: false,
          error: `Não é possível iniciar uma OS com status ${workOrder.status}`,
        };
      }

      // Se já está IN_PROGRESS, verificar se está pausada
      if (workOrder.status === 'IN_PROGRESS') {
        const activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
        if (activeSession?.sessionType === 'WORK') {
          return { success: false, error: 'OS já está em execução' };
        }
        // Se está pausada, deve usar resumeExecution
        if (activeSession?.sessionType === 'PAUSE') {
          return { success: false, error: 'Use resumeExecution para retomar após pausa' };
        }
      }

      // Sincronizar checklists se solicitado e online
      if (options.syncChecklistsFirst && this.isOnline()) {
        console.log('[WorkOrderExecutionService] Syncing checklists...');
        await ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);
      }

      // Atualizar status da OS se necessário (SCHEDULED ou DONE -> IN_PROGRESS)
      if (workOrder.status === 'SCHEDULED' || workOrder.status === 'DONE') {
        console.log(`[WorkOrderExecutionService] Updating status from ${workOrder.status} to IN_PROGRESS...`);
        await workOrderService.updateStatus(workOrderId, 'IN_PROGRESS');

        // Verificar se o status foi atualizado corretamente
        const updatedWO = await workOrderRepository.getById(workOrderId);
        console.log('[WorkOrderExecutionService] Status after update:', updatedWO?.status);
      }

      // Criar sessão de trabalho
      console.log('[WorkOrderExecutionService] Creating work session...');
      const newSession = await ExecutionSessionRepository.startWorkSession(workOrderId, this.technicianId || '');
      console.log('[WorkOrderExecutionService] Work session created:', JSON.stringify(newSession));

      // Verificar se a sessão foi criada corretamente
      const verifySession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      console.log('[WorkOrderExecutionService] Verified active session after creation:', JSON.stringify(verifySession));

      // Verificar status final
      const finalWO = await workOrderRepository.getById(workOrderId);
      console.log('[WorkOrderExecutionService] Final WO status:', finalWO?.status);

      this.emit('started', workOrderId);
      console.log('[WorkOrderExecutionService] startExecution completed successfully');

      return { success: true, newStatus: 'IN_PROGRESS' };
    } catch (error) {
      console.error('[WorkOrderExecutionService] startExecution error:', error);
      this.emit('error', workOrderId, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao iniciar execução',
      };
    }
  }

  /**
   * Pausar execução da OS
   */
  async pauseExecution(
    workOrderId: string,
    reason?: PauseReasonValue,
    notes?: string
  ): Promise<ExecutionActionResult> {
    try {
      const workOrder = await workOrderRepository.getById(workOrderId);
      if (!workOrder) {
        return { success: false, error: 'Ordem de serviço não encontrada' };
      }

      if (workOrder.status !== 'IN_PROGRESS') {
        return {
          success: false,
          error: 'Só é possível pausar uma OS em execução',
        };
      }

      // Verificar se já está pausada
      const activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      if (activeSession?.sessionType === 'PAUSE') {
        return { success: false, error: 'OS já está pausada' };
      }

      // Encerrar sessão de trabalho atual (se houver)
      if (activeSession?.sessionType === 'WORK') {
        await ExecutionSessionRepository.endSession(activeSession.id);
      }

      // Criar sessão de pausa
      await ExecutionSessionRepository.startPauseSession(
        workOrderId,
        this.technicianId || '',
        reason,
        notes
      );

      this.emit('paused', workOrderId, { reason, notes });

      return { success: true, newStatus: 'IN_PROGRESS' };
    } catch (error) {
      console.error('[WorkOrderExecutionService] pauseExecution error:', error);
      this.emit('error', workOrderId, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao pausar execução',
      };
    }
  }

  /**
   * Retomar execução após pausa
   */
  async resumeExecution(workOrderId: string): Promise<ExecutionActionResult> {
    try {
      const workOrder = await workOrderRepository.getById(workOrderId);
      if (!workOrder) {
        return { success: false, error: 'Ordem de serviço não encontrada' };
      }

      if (workOrder.status !== 'IN_PROGRESS') {
        return {
          success: false,
          error: 'Só é possível retomar uma OS em execução',
        };
      }

      // Verificar se está pausada
      const activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      if (!activeSession || activeSession.sessionType !== 'PAUSE') {
        return { success: false, error: 'OS não está pausada' };
      }

      // Encerrar sessão de pausa
      await ExecutionSessionRepository.endSession(activeSession.id);

      // Criar nova sessão de trabalho
      await ExecutionSessionRepository.startWorkSession(workOrderId, this.technicianId || '');

      this.emit('resumed', workOrderId);

      return { success: true, newStatus: 'IN_PROGRESS' };
    } catch (error) {
      console.error('[WorkOrderExecutionService] resumeExecution error:', error);
      this.emit('error', workOrderId, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao retomar execução',
      };
    }
  }

  /**
   * Completar execução da OS
   */
  async completeExecution(
    workOrderId: string,
    options: CompleteExecutionOptions = {}
  ): Promise<ExecutionActionResult> {
    try {
      console.log('[WorkOrderExecutionService] completeExecution started for:', workOrderId);

      const workOrder = await workOrderRepository.getById(workOrderId);
      if (!workOrder) {
        console.log('[WorkOrderExecutionService] Work order not found:', workOrderId);
        return { success: false, error: 'Ordem de serviço não encontrada' };
      }

      console.log('[WorkOrderExecutionService] Work order from DB:', JSON.stringify({
        id: workOrder.id,
        status: workOrder.status,
        executionStart: workOrder.executionStart,
        executionEnd: workOrder.executionEnd,
      }));

      // Verificar se há sessão ativa
      const activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      console.log('[WorkOrderExecutionService] Active session:', JSON.stringify(activeSession));

      // Buscar todas as sessões para debug
      const allSessions = await ExecutionSessionRepository.getByWorkOrder(workOrderId);
      console.log('[WorkOrderExecutionService] All sessions for WO:', JSON.stringify(allSessions));

      // Se o status não é IN_PROGRESS, verificar se podemos recuperar
      if (workOrder.status !== 'IN_PROGRESS') {
        console.log('[WorkOrderExecutionService] Status is not IN_PROGRESS, checking for recovery options...');

        // Se há uma sessão ativa de trabalho, o status deveria ser IN_PROGRESS - vamos corrigir
        if (activeSession && activeSession.sessionType === 'WORK') {
          console.log('[WorkOrderExecutionService] Found active work session but status is not IN_PROGRESS. Fixing...');
          await workOrderRepository.updateStatus(workOrderId, 'IN_PROGRESS');
        }
        // Se o status é SCHEDULED mas já começou execução antes, pode ter sido resetado pelo sync
        else if (workOrder.status === 'SCHEDULED' && workOrder.executionStart) {
          console.log('[WorkOrderExecutionService] Status is SCHEDULED but has executionStart. Recovering to IN_PROGRESS...');
          await workOrderRepository.updateStatus(workOrderId, 'IN_PROGRESS');
        }
        // Se há sessões anteriores (mesmo sem ativa), significa que já executou - recuperar
        else if (allSessions.length > 0) {
          console.log('[WorkOrderExecutionService] Found previous sessions. Recovering status to IN_PROGRESS...');
          await workOrderRepository.updateStatus(workOrderId, 'IN_PROGRESS');
        }
        else {
          return {
            success: false,
            error: `Só é possível completar uma OS em execução. Status atual: ${workOrder.status}`,
          };
        }
      }

      // Verificar se todos os checklists estão completos (se necessário)
      if (options.requireAllChecklistsComplete) {
        console.log('[WorkOrderExecutionService] Checking if all checklists are complete...');
        const allComplete = await ChecklistInstanceRepository.areAllCompleted(workOrderId);
        if (!allComplete) {
          return {
            success: false,
            error: 'Todos os checklists devem ser completados antes de finalizar a OS',
          };
        }
      }

      // Sincronizar dados pendentes se solicitado e online
      if (options.syncPendingFirst && this.isOnline()) {
        console.log('[WorkOrderExecutionService] Syncing pending data...');
        try {
          await ChecklistSyncService.pushPendingAnswers(workOrderId);
          await AttachmentUploadService.processQueue();
          // Também sincronizar sessões de execução (trabalho e pausas)
          await ExecutionSessionSyncService.pushPendingSessions(workOrderId);
        } catch (syncError) {
          console.warn('[WorkOrderExecutionService] Sync failed but continuing:', syncError);
          // Continue mesmo se o sync falhar - não impede conclusão
        }
      }

      // Encerrar sessão ativa (se houver)
      console.log('[WorkOrderExecutionService] Ending active session...');
      const currentActiveSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      if (currentActiveSession) {
        await ExecutionSessionRepository.endSession(currentActiveSession.id);
      }

      // Atualizar status da OS para DONE
      console.log('[WorkOrderExecutionService] Updating work order status to DONE...');
      await workOrderService.completeWorkOrder(workOrderId);

      this.emit('completed', workOrderId);
      console.log('[WorkOrderExecutionService] completeExecution finished successfully');

      return { success: true, newStatus: 'DONE' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[WorkOrderExecutionService] completeExecution error:', errorMessage, error);
      this.emit('error', workOrderId, { error });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cancelar execução da OS
   */
  async cancelExecution(workOrderId: string): Promise<ExecutionActionResult> {
    try {
      const workOrder = await workOrderRepository.getById(workOrderId);
      if (!workOrder) {
        return { success: false, error: 'Ordem de serviço não encontrada' };
      }

      // Encerrar sessão ativa (se houver)
      const activeSession = await ExecutionSessionRepository.getActiveSession(workOrderId);
      if (activeSession) {
        await ExecutionSessionRepository.endSession(activeSession.id);
      }

      // Atualizar status da OS para CANCELED
      await workOrderService.cancelWorkOrder(workOrderId);

      this.emit('status_changed', workOrderId, { newStatus: 'CANCELED' });

      return { success: true, newStatus: 'CANCELED' };
    } catch (error) {
      console.error('[WorkOrderExecutionService] cancelExecution error:', error);
      this.emit('error', workOrderId, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao cancelar execução',
      };
    }
  }

  // =============================================================================
  // CHECKLIST INTEGRATION
  // =============================================================================

  /**
   * Carregar checklists da OS (com sync se online)
   */
  async loadChecklists(workOrderId: string) {
    return ChecklistSyncService.pullChecklistsForWorkOrder(workOrderId);
  }

  /**
   * Sincronizar respostas pendentes
   */
  async syncPendingAnswers(workOrderId: string) {
    return ChecklistSyncService.pushPendingAnswers(workOrderId);
  }

  /**
   * Verificar se há dados pendentes de sync para uma OS específica
   */
  async hasPendingSync(workOrderId: string): Promise<boolean> {
    const pendingAnswers = await ChecklistSyncService.countPendingSyncByWorkOrder(workOrderId);
    const pendingUploads = await ChecklistSyncService.countPendingUploadsByWorkOrder(workOrderId);
    return pendingAnswers > 0 || pendingUploads > 0;
  }

  // =============================================================================
  // SESSION HISTORY
  // =============================================================================

  /**
   * Obter histórico de sessões da OS
   */
  async getSessionHistory(workOrderId: string): Promise<ExecutionSession[]> {
    return ExecutionSessionRepository.getByWorkOrder(workOrderId);
  }

  // =============================================================================
  // EVENT HANDLING
  // =============================================================================

  /**
   * Registrar listener de eventos
   */
  subscribe(listener: ExecutionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emitir evento
   */
  private emit(type: ExecutionEventType, workOrderId: string, data?: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener({ type, workOrderId, data });
      } catch (error) {
        console.error('[WorkOrderExecutionService] Event listener error:', error);
      }
    }
  }

  // =============================================================================
  // STATISTICS
  // =============================================================================

  /**
   * Obter estatísticas de execução
   */
  async getExecutionStats(workOrderId: string): Promise<{
    totalWorkTime: number;
    totalPauseTime: number;
    sessionCount: number;
    pauseCount: number;
    checklistProgress: number;
    pendingSyncCount: number;
  }> {
    const timeSummary = await ExecutionSessionRepository.getTimeSummary(workOrderId);

    // Calcular progresso dos checklists
    const checklists = await ChecklistInstanceRepository.getByWorkOrder(workOrderId);
    const totalProgress = checklists.reduce((sum, c) => sum + (c.progress || 0), 0);
    const checklistProgress =
      checklists.length > 0 ? Math.round(totalProgress / checklists.length) : 0;

    // Contar pendentes
    const pendingAnswers = await ChecklistSyncService.countPendingSync(workOrderId);
    const pendingUploads = await AttachmentUploadService.countPending();

    return {
      totalWorkTime: timeSummary.totalWorkTime || 0,
      totalPauseTime: timeSummary.totalPauseTime || 0,
      sessionCount: timeSummary.sessionCount || 0,
      pauseCount: 0, // Será calculado separadamente se necessário
      checklistProgress,
      pendingSyncCount: pendingAnswers + pendingUploads,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const WorkOrderExecutionService = new WorkOrderExecutionServiceClass();

export default WorkOrderExecutionService;
