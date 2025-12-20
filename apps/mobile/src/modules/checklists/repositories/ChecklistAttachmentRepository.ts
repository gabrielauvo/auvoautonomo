// @ts-nocheck
/**
 * ChecklistAttachmentRepository
 *
 * Repositório para anexos de checklist (fotos, assinaturas, arquivos).
 * Gerencia fila de upload e status de sincronização.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  findAll,
  findById,
  insert,
  update,
  remove,
  rawQuery,
} from '../../../db/database';
import {
  ChecklistAttachment,
  ChecklistAttachmentType,
  AttachmentSyncStatus,
} from '../../../db/schema';

const TABLE = 'checklist_attachments';

// Type helper for database operations
type AttachmentRecord = Record<string, unknown>;

// =============================================================================
// REPOSITORY
// =============================================================================

export const ChecklistAttachmentRepository = {
  /**
   * Criar novo anexo
   */
  async create(
    data: Omit<ChecklistAttachment, 'id' | 'createdAt' | 'updatedAt' | 'localId' | 'uploadAttempts' | 'syncStatus'>
  ): Promise<ChecklistAttachment> {
    const now = new Date().toISOString();
    const localId = uuidv4();
    const attachment: ChecklistAttachment = {
      id: uuidv4(),
      ...data,
      localId,
      syncStatus: 'PENDING',
      uploadAttempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    await insert<AttachmentRecord>(TABLE, attachment as AttachmentRecord);
    return attachment;
  },

  /**
   * Buscar anexo por ID
   */
  async getById(id: string): Promise<ChecklistAttachment | null> {
    return findById<ChecklistAttachment>(TABLE, id);
  },

  /**
   * Buscar anexo por localId
   */
  async getByLocalId(localId: string): Promise<ChecklistAttachment | null> {
    const results = await rawQuery<ChecklistAttachment>(
      `SELECT * FROM ${TABLE} WHERE localId = ? LIMIT 1`,
      [localId]
    );
    return results[0] || null;
  },

  /**
   * Buscar anexos de uma resposta
   */
  async getByAnswer(answerId: string): Promise<ChecklistAttachment[]> {
    return findAll<ChecklistAttachment>(TABLE, {
      where: { answerId },
      orderBy: 'createdAt',
      order: 'ASC',
    });
  },

  /**
   * Buscar anexos de uma OS
   */
  async getByWorkOrder(workOrderId: string): Promise<ChecklistAttachment[]> {
    return findAll<ChecklistAttachment>(TABLE, {
      where: { workOrderId },
      orderBy: 'createdAt',
      order: 'ASC',
    });
  },

  /**
   * Buscar anexos pendentes de upload
   * Inclui: PENDING, FAILED e UPLOADING (caso tenha falhado durante upload offline)
   */
  async getPendingUpload(limit: number = 10): Promise<ChecklistAttachment[]> {
    return rawQuery<ChecklistAttachment>(
      `SELECT * FROM ${TABLE}
       WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING')
       AND uploadAttempts < 5
       ORDER BY uploadAttempts ASC, createdAt ASC
       LIMIT ?`,
      [limit]
    );
  },

  /**
   * Buscar anexos por status de sync
   */
  async getBySyncStatus(
    status: AttachmentSyncStatus,
    technicianId?: string
  ): Promise<ChecklistAttachment[]> {
    const where = technicianId
      ? `syncStatus = ? AND technicianId = ?`
      : `syncStatus = ?`;
    const params = technicianId ? [status, technicianId] : [status];

    return rawQuery<ChecklistAttachment>(
      `SELECT * FROM ${TABLE}
       WHERE ${where}
       ORDER BY createdAt ASC`,
      params
    );
  },

  /**
   * Atualizar anexo
   */
  async update(id: string, data: Partial<ChecklistAttachment>): Promise<void> {
    await update<AttachmentRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar status de sync
   */
  async updateSyncStatus(
    id: string,
    status: AttachmentSyncStatus,
    error?: string
  ): Promise<void> {
    const updates: Partial<ChecklistAttachment> = { syncStatus: status };

    if (status === 'FAILED') {
      updates.lastUploadError = error;
    }

    if (status === 'SYNCED') {
      updates.syncedAt = new Date().toISOString();
      updates.lastUploadError = undefined;
    }

    await this.update(id, updates);
  },

  /**
   * Incrementar tentativas de upload
   */
  async incrementUploadAttempts(id: string, error?: string): Promise<void> {
    const attachment = await this.getById(id);
    if (!attachment) return;

    await this.update(id, {
      uploadAttempts: attachment.uploadAttempts + 1,
      lastUploadError: error,
      syncStatus: 'FAILED',
    });
  },

  /**
   * Marcar como em upload
   */
  async markUploading(id: string): Promise<void> {
    await this.updateSyncStatus(id, 'UPLOADING');
  },

  /**
   * Marcar como sincronizado com URL remota
   */
  async markSynced(id: string, remotePath: string): Promise<void> {
    await this.update(id, {
      remotePath,
      syncStatus: 'SYNCED',
      syncedAt: new Date().toISOString(),
      base64Data: undefined, // Limpar dados base64 após upload
    });
  },

  /**
   * Deletar anexo
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Deletar anexos de uma resposta
   */
  async deleteByAnswer(answerId: string): Promise<void> {
    await rawQuery(`DELETE FROM ${TABLE} WHERE answerId = ?`, [answerId]);
  },

  /**
   * Deletar anexos de uma OS
   */
  async deleteByWorkOrder(workOrderId: string): Promise<void> {
    await rawQuery(`DELETE FROM ${TABLE} WHERE workOrderId = ?`, [workOrderId]);
  },

  /**
   * Batch insert para sync (INSERT OR REPLACE)
   */
  async batchUpsert(attachments: ChecklistAttachment[]): Promise<void> {
    if (attachments.length === 0) return;

    const columns = [
      'id',
      'answerId',
      'workOrderId',
      'type',
      'fileName',
      'fileSize',
      'mimeType',
      'localPath',
      'remotePath',
      'thumbnailPath',
      'base64Data',
      'syncStatus',
      'uploadAttempts',
      'lastUploadError',
      'localId',
      'createdAt',
      'updatedAt',
      'technicianId',
    ];

    const placeholders = attachments
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const values = attachments.flatMap((attachment) =>
      columns.map((col) => (attachment as AttachmentRecord)[col] ?? null)
    );

    await rawQuery(
      `INSERT OR REPLACE INTO ${TABLE} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
  },

  /**
   * Contar anexos por status de sync
   */
  async countBySyncStatus(workOrderId?: string): Promise<Record<AttachmentSyncStatus, number>> {
    const where = workOrderId ? `WHERE workOrderId = ?` : '';
    const params = workOrderId ? [workOrderId] : [];

    const results = await rawQuery<{ syncStatus: AttachmentSyncStatus; count: number }>(
      `SELECT syncStatus, COUNT(*) as count FROM ${TABLE}
       ${where}
       GROUP BY syncStatus`,
      params
    );

    const counts: Record<AttachmentSyncStatus, number> = {
      PENDING: 0,
      UPLOADING: 0,
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
   * Contar anexos pendentes de upload
   */
  async countPendingUpload(technicianId?: string): Promise<number> {
    const where = technicianId
      ? `WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING') AND technicianId = ?`
      : `WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING')`;
    const params = technicianId ? [technicianId] : [];

    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE} ${where}`,
      params
    );

    return results[0]?.count || 0;
  },

  /**
   * Contar anexos pendentes de upload por workOrderId
   */
  async countPendingUploadByWorkOrder(workOrderId: string): Promise<number> {
    const results = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE}
       WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING') AND workOrderId = ?`,
      [workOrderId]
    );

    return results[0]?.count || 0;
  },

  /**
   * Obter tamanho total de anexos pendentes (em bytes)
   */
  async getPendingUploadSize(technicianId?: string): Promise<number> {
    const where = technicianId
      ? `WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING') AND technicianId = ?`
      : `WHERE syncStatus IN ('PENDING', 'FAILED', 'UPLOADING')`;
    const params = technicianId ? [technicianId] : [];

    const results = await rawQuery<{ total: number }>(
      `SELECT COALESCE(SUM(fileSize), 0) as total FROM ${TABLE} ${where}`,
      params
    );

    return results[0]?.total || 0;
  },

  /**
   * Limpar dados base64 de anexos já sincronizados (economia de espaço)
   */
  async clearSyncedBase64(): Promise<number> {
    const result = await rawQuery(
      `UPDATE ${TABLE}
       SET base64Data = NULL, updatedAt = ?
       WHERE syncStatus = 'SYNCED' AND base64Data IS NOT NULL`,
      [new Date().toISOString()]
    );

    // Retorna número de registros atualizados (aproximado)
    const affected = await rawQuery<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${TABLE}
       WHERE syncStatus = 'SYNCED' AND base64Data IS NULL`
    );

    return affected[0]?.count || 0;
  },
};

export default ChecklistAttachmentRepository;
