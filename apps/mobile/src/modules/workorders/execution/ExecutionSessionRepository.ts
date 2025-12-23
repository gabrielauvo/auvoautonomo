// @ts-nocheck
/**
 * ExecutionSessionRepository
 *
 * Repositório para sessões de execução de ordens de serviço.
 * Armazena apenas localmente para UI do timer (não sincroniza com backend).
 *
 * O backend usa WorkOrder.executionStart/executionEnd para tracking de tempo.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  findAll,
  findById,
  findOne,
  insert,
  update,
  remove,
  rawQuery,
} from '../../../db/database';
import { ExecutionSession, ExecutionSessionType } from '../../../db/schema';

const TABLE = 'work_order_execution_sessions';

// Type helper for database operations
type SessionRecord = Record<string, unknown>;

// =============================================================================
// REPOSITORY
// =============================================================================

export const ExecutionSessionRepository = {
  /**
   * Criar nova sessão de execução
   */
  async create(data: Omit<ExecutionSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutionSession> {
    const now = new Date().toISOString();
    const session: ExecutionSession = {
      id: uuidv4(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    console.log('[ExecutionSessionRepository] Creating session:', JSON.stringify(session));
    try {
      await insert<SessionRecord>(TABLE, session as SessionRecord);
      console.log('[ExecutionSessionRepository] Insert completed for session:', session.id);
    } catch (err) {
      console.error('[ExecutionSessionRepository] Insert failed:', err);
      throw err;
    }
    return session;
  },

  /**
   * Buscar sessão por ID
   */
  async getById(id: string): Promise<ExecutionSession | null> {
    return findById<ExecutionSession>(TABLE, id);
  },

  /**
   * Buscar todas as sessões de uma OS
   */
  async getByWorkOrder(workOrderId: string): Promise<ExecutionSession[]> {
    return findAll<ExecutionSession>(TABLE, {
      where: { workOrderId },
      orderBy: 'startedAt',
      order: 'ASC',
    });
  },

  /**
   * Buscar sessão ativa (não finalizada) de uma OS
   */
  async getActiveSession(workOrderId: string): Promise<ExecutionSession | null> {
    console.log('[ExecutionSessionRepository] getActiveSession for:', workOrderId);
    const sessions = await rawQuery<ExecutionSession>(
      `SELECT * FROM ${TABLE}
       WHERE workOrderId = ? AND endedAt IS NULL
       ORDER BY startedAt DESC
       LIMIT 1`,
      [workOrderId]
    );
    console.log('[ExecutionSessionRepository] Found active sessions:', sessions.length, sessions[0]?.id);
    return sessions[0] || null;
  },

  /**
   * Buscar última sessão de trabalho (WORK) de uma OS
   */
  async getLastWorkSession(workOrderId: string): Promise<ExecutionSession | null> {
    const sessions = await rawQuery<ExecutionSession>(
      `SELECT * FROM ${TABLE}
       WHERE workOrderId = ? AND sessionType = 'WORK'
       ORDER BY startedAt DESC
       LIMIT 1`,
      [workOrderId]
    );
    return sessions[0] || null;
  },

  /**
   * Atualizar sessão
   */
  async update(id: string, data: Partial<ExecutionSession>): Promise<void> {
    await update<SessionRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Finalizar sessão ativa
   */
  async endSession(id: string, notes?: string): Promise<ExecutionSession | null> {
    const session = await this.getById(id);
    if (!session || session.endedAt) return null;

    const now = new Date().toISOString();
    const startTime = new Date(session.startedAt).getTime();
    const endTime = new Date(now).getTime();
    const duration = Math.floor((endTime - startTime) / 1000); // Em segundos

    await this.update(id, {
      endedAt: now,
      duration,
      notes: notes || session.notes,
    });

    return this.getById(id);
  },

  /**
   * Finalizar todas as sessões ativas de uma OS
   */
  async endAllActiveSessions(workOrderId: string): Promise<void> {
    const now = new Date().toISOString();

    // Buscar sessões ativas
    const activeSessions = await rawQuery<ExecutionSession>(
      `SELECT * FROM ${TABLE}
       WHERE workOrderId = ? AND endedAt IS NULL`,
      [workOrderId]
    );

    // Finalizar cada uma calculando a duração
    for (const session of activeSessions) {
      const startTime = new Date(session.startedAt).getTime();
      const endTime = new Date(now).getTime();
      const duration = Math.floor((endTime - startTime) / 1000);

      await this.update(session.id, {
        endedAt: now,
        duration,
      });
    }
  },

  /**
   * Calcular tempo total trabalhado (em segundos)
   */
  async getTotalWorkTime(workOrderId: string): Promise<number> {
    const sessions = await rawQuery<{ total: number }>(
      `SELECT COALESCE(SUM(duration), 0) as total FROM ${TABLE}
       WHERE workOrderId = ? AND sessionType = 'WORK' AND duration IS NOT NULL`,
      [workOrderId]
    );
    return sessions[0]?.total || 0;
  },

  /**
   * Calcular tempo total em pausa (em segundos)
   */
  async getTotalPauseTime(workOrderId: string): Promise<number> {
    const sessions = await rawQuery<{ total: number }>(
      `SELECT COALESCE(SUM(duration), 0) as total FROM ${TABLE}
       WHERE workOrderId = ? AND sessionType = 'PAUSE' AND duration IS NOT NULL`,
      [workOrderId]
    );
    return sessions[0]?.total || 0;
  },

  /**
   * Obter resumo de tempo de uma OS
   */
  async getTimeSummary(workOrderId: string): Promise<{
    totalWorkTime: number;
    totalPauseTime: number;
    sessionCount: number;
    isActive: boolean;
  }> {
    const [workTime, pauseTime, activeSession, sessions] = await Promise.all([
      this.getTotalWorkTime(workOrderId),
      this.getTotalPauseTime(workOrderId),
      this.getActiveSession(workOrderId),
      this.getByWorkOrder(workOrderId),
    ]);

    return {
      totalWorkTime: workTime,
      totalPauseTime: pauseTime,
      sessionCount: sessions.length,
      isActive: activeSession !== null,
    };
  },

  /**
   * Deletar sessão
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Deletar todas as sessões de uma OS
   */
  async deleteByWorkOrder(workOrderId: string): Promise<void> {
    await rawQuery(
      `DELETE FROM ${TABLE} WHERE workOrderId = ?`,
      [workOrderId]
    );
  },

  /**
   * Iniciar nova sessão de trabalho
   * IMPORTANTE: Valida que a sessão foi realmente persistida no banco
   */
  async startWorkSession(
    workOrderId: string,
    technicianId: string
  ): Promise<ExecutionSession> {
    console.log('[ExecutionSessionRepository] startWorkSession called:', { workOrderId, technicianId });

    // Finalizar qualquer sessão ativa primeiro
    await this.endAllActiveSessions(workOrderId);
    console.log('[ExecutionSessionRepository] Ended all active sessions');

    const session = await this.create({
      workOrderId,
      technicianId,
      sessionType: 'WORK',
      startedAt: new Date().toISOString(),
    });
    console.log('[ExecutionSessionRepository] Session created:', JSON.stringify(session));

    // VALIDAÇÃO CRÍTICA: Verificar se foi realmente salvo no banco
    const verify = await this.getById(session.id);
    console.log('[ExecutionSessionRepository] Verified session from DB:', JSON.stringify(verify));

    if (!verify) {
      throw new Error(
        `[ExecutionSessionRepository] CRITICAL: Failed to persist session ${session.id} to database. ` +
        `Insert succeeded in memory but not in DB. Check disk space or FK constraints.`
      );
    }

    // Validar que os dados estão corretos
    if (verify.startedAt !== session.startedAt || verify.workOrderId !== session.workOrderId) {
      throw new Error(
        `[ExecutionSessionRepository] CRITICAL: Session data mismatch after insert. ` +
        `Expected startedAt=${session.startedAt}, got ${verify.startedAt}`
      );
    }

    // Retornar do banco, não da memória, para garantir consistência
    return verify;
  },

  /**
   * Iniciar nova sessão de pausa
   */
  async startPauseSession(
    workOrderId: string,
    technicianId: string,
    pauseReason?: string
  ): Promise<ExecutionSession> {
    // Finalizar qualquer sessão ativa primeiro
    await this.endAllActiveSessions(workOrderId);

    return this.create({
      workOrderId,
      technicianId,
      sessionType: 'PAUSE',
      startedAt: new Date().toISOString(),
      pauseReason,
    });
  },

  // =============================================================================
  // SYNC METHODS
  // =============================================================================

  /**
   * Buscar sessões pendentes de sync (não sincronizadas)
   */
  async getPendingSync(workOrderId?: string): Promise<ExecutionSession[]> {
    const whereClause = workOrderId
      ? `WHERE syncedAt IS NULL AND workOrderId = ?`
      : `WHERE syncedAt IS NULL`;
    const params = workOrderId ? [workOrderId] : [];

    return rawQuery<ExecutionSession>(
      `SELECT * FROM ${TABLE} ${whereClause} ORDER BY startedAt ASC`,
      params
    );
  },

  /**
   * Marcar sessão como sincronizada
   */
  async markSynced(id: string, serverId: string): Promise<void> {
    await update<SessionRecord>(TABLE, id, {
      syncedAt: new Date().toISOString(),
      serverId,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Contar sessões pendentes de sync
   */
  async countPendingSync(workOrderId?: string): Promise<number> {
    const whereClause = workOrderId
      ? `WHERE syncedAt IS NULL AND workOrderId = ?`
      : `WHERE syncedAt IS NULL`;
    const params = workOrderId ? [workOrderId] : [];

    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE} ${whereClause}`,
      params
    );
    return results[0]?.count || 0;
  },

  /**
   * Buscar IDs das work orders que estão pausadas (têm sessão ativa do tipo PAUSE)
   */
  async getPausedWorkOrderIds(): Promise<string[]> {
    const results = await rawQuery<{ workOrderId: string }>(
      `SELECT DISTINCT workOrderId FROM ${TABLE}
       WHERE endedAt IS NULL AND sessionType = 'PAUSE'`,
      []
    );
    return results.map(r => r.workOrderId);
  },
};

export default ExecutionSessionRepository;
