// @ts-nocheck
/**
 * ExecutionSessionSyncService
 *
 * Serviço para sincronizar sessões de execução (trabalho e pausa) com o backend.
 * Implementa push de sessões pendentes quando volta online.
 */

import { ExecutionSessionRepository } from './ExecutionSessionRepository';
import { syncEngine } from '../../../sync';
import { ExecutionSession } from '../../../db/schema';


interface SyncResult {
  totalSynced: number;
  totalFailed: number;
  errors: string[];
}

interface SessionSyncPayload {
  localId: string;
  workOrderId: string;
  sessionType: 'WORK' | 'PAUSE';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  pauseReason?: string;
  notes?: string;
}

interface SyncResponse {
  results: Array<{
    localId: string;
    serverId?: string;
    status: 'created' | 'updated' | 'exists' | 'error';
    error?: string;
  }>;
  serverTime: string;
}

class ExecutionSessionSyncServiceClass {
  /**
   * Verificar se está online e configurado
   */
  private isConfigured(): boolean {
    const engine = syncEngine as any;
    return !!(engine.baseUrl && engine.authToken && syncEngine.isNetworkOnline());
  }

  /**
   * Obter configuração da API
   */
  private getApiConfig(): { baseUrl: string; authToken: string } {
    const engine = syncEngine as any;
    return {
      baseUrl: engine.baseUrl || '',
      authToken: engine.authToken || '',
    };
  }

  /**
   * Sincronizar sessões pendentes de uma OS específica
   */
  async pushPendingSessions(workOrderId: string): Promise<SyncResult> {
    const result: SyncResult = {
      totalSynced: 0,
      totalFailed: 0,
      errors: [],
    };

    if (!this.isConfigured()) {
      console.log('[ExecutionSessionSyncService] Not configured or offline, skipping sync');
      return result;
    }

    try {
      const pendingSessions = await ExecutionSessionRepository.getPendingSync(workOrderId);

      if (pendingSessions.length === 0) {
        console.log('[ExecutionSessionSyncService] No pending sessions to sync for:', workOrderId);
        return result;
      }

      console.log('[ExecutionSessionSyncService] Syncing', pendingSessions.length, 'sessions for:', workOrderId);

      const { baseUrl, authToken } = this.getApiConfig();
      const url = `${baseUrl}/work-orders/${workOrderId}/execution-sessions/sync`;

      // Preparar payload
      const sessions: SessionSyncPayload[] = pendingSessions.map((session) => ({
        localId: session.id,
        workOrderId: session.workOrderId,
        sessionType: session.sessionType,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        duration: session.duration,
        pauseReason: session.pauseReason,
        notes: session.notes,
      }));

      // Enviar para o servidor
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId,
          sessions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // Use warn instead of error to avoid LogBox in dev
        console.warn('[ExecutionSessionSyncService] Sync failed:', response.status, errorText);
        result.errors.push(`HTTP ${response.status}: ${errorText}`);
        result.totalFailed = pendingSessions.length;
        return result;
      }

      const syncResponse: SyncResponse = await response.json();
      console.log('[ExecutionSessionSyncService] Sync response:', JSON.stringify(syncResponse));

      // Processar resultados
      for (const syncResult of syncResponse.results) {
        if (syncResult.status === 'created' || syncResult.status === 'updated' || syncResult.status === 'exists') {
          // Marcar como sincronizado
          const serverId = syncResult.serverId || syncResult.localId;
          await ExecutionSessionRepository.markSynced(syncResult.localId, serverId);
          result.totalSynced++;
          console.log('[ExecutionSessionSyncService] Session synced:', syncResult.localId, '->', serverId);
        } else {
          result.totalFailed++;
          result.errors.push(`Session ${syncResult.localId}: ${syncResult.error || 'Unknown error'}`);
          console.warn('[ExecutionSessionSyncService] Session sync failed:', syncResult.localId, syncResult.error);
        }
      }

      console.log('[ExecutionSessionSyncService] Sync complete:', result);
      return result;
    } catch (error: any) {
      // Use warn for network errors to avoid LogBox spam in dev
      // These are expected when offline or server unreachable
      console.warn('[ExecutionSessionSyncService] Sync skipped (network issue):', error.message);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Verificar se uma OS já foi sincronizada com o servidor
   * OSs criadas offline têm syncedAt = NULL
   */
  private async isWorkOrderSynced(workOrderId: string): Promise<boolean> {
    try {
      const { rawQuery } = await import('../../../db/database');
      const result = await rawQuery<{ syncedAt: string | null }>(
        'SELECT syncedAt FROM work_orders WHERE id = ? LIMIT 1',
        [workOrderId]
      );
      return result.length > 0 && result[0].syncedAt !== null;
    } catch {
      return false;
    }
  }

  /**
   * Sincronizar todas as sessões pendentes (para todas as OSs)
   * IMPORTANTE: Só sincroniza sessões de OSs que já existem no servidor
   */
  async pushAllPendingSessions(): Promise<SyncResult> {
    const totalResult: SyncResult = {
      totalSynced: 0,
      totalFailed: 0,
      errors: [],
    };

    if (!this.isConfigured()) {
      return totalResult;
    }

    try {
      const allPending = await ExecutionSessionRepository.getPendingSync();

      // Agrupar por workOrderId
      const byWorkOrder = new Map<string, ExecutionSession[]>();
      for (const session of allPending) {
        const existing = byWorkOrder.get(session.workOrderId) || [];
        existing.push(session);
        byWorkOrder.set(session.workOrderId, existing);
      }

      console.log('[ExecutionSessionSyncService] Found', allPending.length, 'pending sessions across', byWorkOrder.size, 'work orders');

      // Sincronizar por OS, mas só se a OS já foi sincronizada com o servidor
      for (const [workOrderId] of byWorkOrder) {
        const isSynced = await this.isWorkOrderSynced(workOrderId);
        if (!isSynced) {
          console.log('[ExecutionSessionSyncService] Skipping WO', workOrderId, '- not synced to server yet');
          continue;
        }

        const result = await this.pushPendingSessions(workOrderId);
        totalResult.totalSynced += result.totalSynced;
        totalResult.totalFailed += result.totalFailed;
        totalResult.errors.push(...result.errors);
      }

      return totalResult;
    } catch (error: any) {
      // Use warn for expected errors (network, no data)
      console.warn('[ExecutionSessionSyncService] pushAllPendingSessions skipped:', error.message);
      totalResult.errors.push(error.message);
      return totalResult;
    }
  }

  /**
   * Contar sessões pendentes de sync
   */
  async countPendingSync(workOrderId?: string): Promise<number> {
    return ExecutionSessionRepository.countPendingSync(workOrderId);
  }
}

export const ExecutionSessionSyncService = new ExecutionSessionSyncServiceClass();
export default ExecutionSessionSyncService;
