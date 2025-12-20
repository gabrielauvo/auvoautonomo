// @ts-nocheck
/**
 * ChecklistAnswerRepository
 *
 * Repositório para respostas de checklist.
 * Suporta operações offline com sync posterior via batch endpoint.
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
import { ChecklistAnswer, AnswerSyncStatus, ChecklistQuestionType } from '../../../db/schema';

const TABLE = 'checklist_answers';

// Type helper for database operations
type AnswerRecord = Record<string, unknown>;

// =============================================================================
// REPOSITORY
// =============================================================================

export const ChecklistAnswerRepository = {
  /**
   * Criar nova resposta
   */
  async create(
    data: Omit<ChecklistAnswer, 'id' | 'createdAt' | 'updatedAt' | 'localId'>
  ): Promise<ChecklistAnswer> {
    const now = new Date().toISOString();
    const localId = uuidv4();
    const answer: ChecklistAnswer = {
      id: uuidv4(),
      ...data,
      localId,
      createdAt: now,
      updatedAt: now,
    };

    await insert<AnswerRecord>(TABLE, answer as AnswerRecord);
    return answer;
  },

  /**
   * Buscar resposta por ID
   */
  async getById(id: string): Promise<ChecklistAnswer | null> {
    return findById<ChecklistAnswer>(TABLE, id);
  },

  /**
   * Buscar resposta por localId (para idempotência no sync)
   */
  async getByLocalId(localId: string): Promise<ChecklistAnswer | null> {
    return findOne<ChecklistAnswer>(TABLE, { localId });
  },

  /**
   * Buscar resposta de uma pergunta específica
   */
  async getByQuestion(
    instanceId: string,
    questionId: string
  ): Promise<ChecklistAnswer | null> {
    return findOne<ChecklistAnswer>(TABLE, { instanceId, questionId });
  },

  /**
   * Buscar todas as respostas de uma instância
   */
  async getByInstance(instanceId: string): Promise<ChecklistAnswer[]> {
    return findAll<ChecklistAnswer>(TABLE, {
      where: { instanceId },
      orderBy: 'createdAt',
      order: 'ASC',
    });
  },

  /**
   * Buscar respostas pendentes de sync
   */
  async getPendingSync(instanceId?: string): Promise<ChecklistAnswer[]> {
    const where = instanceId
      ? `instanceId = ? AND syncStatus IN ('PENDING', 'FAILED')`
      : `syncStatus IN ('PENDING', 'FAILED')`;

    const params = instanceId ? [instanceId] : [];

    return rawQuery<ChecklistAnswer>(
      `SELECT * FROM ${TABLE}
       WHERE ${where}
       ORDER BY answeredAt ASC`,
      params
    );
  },

  /**
   * Upsert (criar ou atualizar) resposta
   * Usa instanceId + questionId como chave única
   */
  async upsert(
    instanceId: string,
    questionId: string,
    type: ChecklistQuestionType,
    values: Partial<ChecklistAnswer>
  ): Promise<ChecklistAnswer> {
    const existing = await this.getByQuestion(instanceId, questionId);
    const now = new Date().toISOString();

    if (existing) {
      // Atualizar existente
      await this.update(existing.id, {
        ...values,
        type,
        answeredAt: now,
        syncStatus: 'PENDING', // Marcar para re-sync
      });
      return (await this.getById(existing.id))!;
    } else {
      // Criar nova
      return this.create({
        instanceId,
        questionId,
        type,
        ...values,
        answeredAt: now,
        syncStatus: 'PENDING',
      });
    }
  },

  /**
   * Atualizar resposta
   */
  async update(id: string, data: Partial<ChecklistAnswer>): Promise<void> {
    await update<AnswerRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar status de sync
   */
  async updateSyncStatus(id: string, status: AnswerSyncStatus): Promise<void> {
    const updates: Partial<ChecklistAnswer> = { syncStatus: status };

    if (status === 'SYNCED') {
      updates.syncedAt = new Date().toISOString();
    }

    await this.update(id, updates);
  },

  /**
   * Marcar múltiplas respostas como sincronizadas
   */
  async markManySynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(', ');

    await rawQuery(
      `UPDATE ${TABLE}
       SET syncStatus = 'SYNCED', syncedAt = ?, updatedAt = ?
       WHERE id IN (${placeholders})`,
      [now, now, ...ids]
    );
  },

  /**
   * Marcar como sincronizado e atualizar ID do servidor
   */
  async markSyncedWithServerId(localId: string, serverId: string): Promise<void> {
    const answer = await this.getByLocalId(localId);
    if (!answer) return;

    const now = new Date().toISOString();

    if (serverId !== answer.id) {
      // Criar com novo ID do servidor
      await insert<AnswerRecord>(TABLE, {
        ...answer,
        id: serverId,
        syncStatus: 'SYNCED',
        syncedAt: now,
        updatedAt: now,
      } as AnswerRecord);

      // Remover registro antigo
      await remove(TABLE, answer.id);
    } else {
      await this.update(answer.id, {
        syncStatus: 'SYNCED',
        syncedAt: now,
      });
    }
  },

  /**
   * Deletar resposta
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Deletar todas as respostas de uma instância
   */
  async deleteByInstance(instanceId: string): Promise<void> {
    await rawQuery(`DELETE FROM ${TABLE} WHERE instanceId = ?`, [instanceId]);
  },

  /**
   * Batch upsert para sync (INSERT OR REPLACE)
   */
  async batchUpsert(answers: ChecklistAnswer[]): Promise<void> {
    if (answers.length === 0) return;

    const columns = [
      'id',
      'instanceId',
      'questionId',
      'type',
      'valueText',
      'valueNumber',
      'valueBoolean',
      'valueDate',
      'valueJson',
      'answeredAt',
      'answeredBy',
      'deviceInfo',
      'localId',
      'syncStatus',
      'syncedAt',
      'createdAt',
      'updatedAt',
    ];

    const placeholders = answers
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const values = answers.flatMap((answer) =>
      columns.map((col) => (answer as AnswerRecord)[col] ?? null)
    );

    await rawQuery(
      `INSERT OR REPLACE INTO ${TABLE} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
  },

  /**
   * Contar respostas por status de sync
   */
  async countBySyncStatus(instanceId?: string): Promise<Record<AnswerSyncStatus, number>> {
    const where = instanceId ? `WHERE instanceId = ?` : '';
    const params = instanceId ? [instanceId] : [];

    const results = await rawQuery<{ syncStatus: AnswerSyncStatus; count: number }>(
      `SELECT syncStatus, COUNT(*) as count FROM ${TABLE}
       ${where}
       GROUP BY syncStatus`,
      params
    );

    const counts: Record<AnswerSyncStatus, number> = {
      PENDING: 0,
      SYNCING: 0,
      SYNCED: 0,
      FAILED: 0,
    };

    for (const row of results) {
      if (row.syncStatus in counts) {
        counts[row.syncStatus] = row.count;
      }
    }

    return counts;
  },

  /**
   * Contar respostas de uma instância
   */
  async countByInstance(instanceId: string): Promise<number> {
    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE} WHERE instanceId = ?`,
      [instanceId]
    );
    return results[0]?.count || 0;
  },

  /**
   * Obter IDs das perguntas respondidas
   */
  async getAnsweredQuestionIds(instanceId: string): Promise<string[]> {
    const answers = await rawQuery<{ questionId: string }>(
      `SELECT DISTINCT questionId FROM ${TABLE} WHERE instanceId = ?`,
      [instanceId]
    );
    return answers.map((a) => a.questionId);
  },
};

export default ChecklistAnswerRepository;
