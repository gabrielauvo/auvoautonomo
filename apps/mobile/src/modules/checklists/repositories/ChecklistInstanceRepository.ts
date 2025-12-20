// @ts-nocheck
/**
 * ChecklistInstanceRepository
 *
 * Repositório para instâncias de checklist.
 * Gerencia o cache local e sincronização com backend via REST.
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
import { ChecklistInstance, ChecklistInstanceStatus } from '../../../db/schema';

const TABLE = 'checklist_instances';

// Type helper for database operations
type InstanceRecord = Record<string, unknown>;

// =============================================================================
// REPOSITORY
// =============================================================================

export const ChecklistInstanceRepository = {
  /**
   * Criar nova instância
   */
  async create(
    data: Omit<ChecklistInstance, 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ChecklistInstance> {
    const now = new Date().toISOString();
    const instance: ChecklistInstance = {
      ...data,
      id: data.id || uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    await insert<InstanceRecord>(TABLE, instance as InstanceRecord);
    return instance;
  },

  /**
   * Buscar instância por ID
   */
  async getById(id: string): Promise<ChecklistInstance | null> {
    return findById<ChecklistInstance>(TABLE, id);
  },

  /**
   * Buscar todas as instâncias de uma OS
   */
  async getByWorkOrder(workOrderId: string): Promise<ChecklistInstance[]> {
    return findAll<ChecklistInstance>(TABLE, {
      where: { workOrderId },
      orderBy: 'createdAt',
      order: 'ASC',
    });
  },

  /**
   * Buscar instâncias por status
   */
  async getByStatus(
    technicianId: string,
    status: ChecklistInstanceStatus
  ): Promise<ChecklistInstance[]> {
    return findAll<ChecklistInstance>(TABLE, {
      where: { technicianId, status },
      orderBy: 'updatedAt',
      order: 'DESC',
    });
  },

  /**
   * Buscar instâncias pendentes de sync
   */
  async getUnsyncedInstances(technicianId: string): Promise<ChecklistInstance[]> {
    return rawQuery<ChecklistInstance>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND syncedAt IS NULL
       ORDER BY updatedAt ASC`,
      [technicianId]
    );
  },

  /**
   * Atualizar instância
   */
  async update(id: string, data: Partial<ChecklistInstance>): Promise<void> {
    await update<InstanceRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar status da instância
   */
  async updateStatus(
    id: string,
    status: ChecklistInstanceStatus,
    completedBy?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const updateData: Partial<ChecklistInstance> = {
      status,
      updatedAt: now,
    };

    if (status === 'IN_PROGRESS') {
      const instance = await this.getById(id);
      if (instance && !instance.startedAt) {
        updateData.startedAt = now;
      }
    }

    if (status === 'COMPLETED') {
      updateData.completedAt = now;
      updateData.completedBy = completedBy;
      updateData.progress = 100;
    }

    await this.update(id, updateData);
  },

  /**
   * Atualizar progresso
   */
  async updateProgress(id: string, progress: number): Promise<void> {
    await this.update(id, { progress: Math.min(100, Math.max(0, progress)) });
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string, serverId?: string): Promise<void> {
    const now = new Date().toISOString();

    if (serverId && serverId !== id) {
      // Atualizar para usar o ID do servidor
      const instance = await this.getById(id);
      if (instance) {
        // Criar com novo ID
        await insert<InstanceRecord>(TABLE, {
          ...instance,
          id: serverId,
          syncedAt: now,
          updatedAt: now,
        } as InstanceRecord);

        // Remover antigo
        await remove(TABLE, id);

        // Atualizar referências nas respostas (feito pelo ChecklistAnswerRepository)
      }
    } else {
      await this.update(id, { syncedAt: now });
    }
  },

  /**
   * Deletar instância
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Deletar todas as instâncias de uma OS
   */
  async deleteByWorkOrder(workOrderId: string): Promise<void> {
    await rawQuery(`DELETE FROM ${TABLE} WHERE workOrderId = ?`, [workOrderId]);
  },

  /**
   * Batch upsert para sync (INSERT OR REPLACE)
   */
  async batchUpsert(instances: ChecklistInstance[]): Promise<void> {
    if (instances.length === 0) return;

    const columns = [
      'id',
      'workOrderId',
      'templateId',
      'templateName',
      'templateVersionSnapshot',
      'status',
      'progress',
      'startedAt',
      'completedAt',
      'completedBy',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'technicianId',
    ];

    const placeholders = instances
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const values = instances.flatMap((instance) =>
      columns.map((col) => (instance as InstanceRecord)[col] ?? null)
    );

    await rawQuery(
      `INSERT OR REPLACE INTO ${TABLE} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
  },

  /**
   * Contar instâncias por status para uma OS
   */
  async countByStatus(workOrderId: string): Promise<Record<ChecklistInstanceStatus, number>> {
    const results = await rawQuery<{ status: ChecklistInstanceStatus; count: number }>(
      `SELECT status, COUNT(*) as count FROM ${TABLE}
       WHERE workOrderId = ?
       GROUP BY status`,
      [workOrderId]
    );

    const counts: Record<ChecklistInstanceStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const row of results) {
      counts[row.status] = row.count;
    }

    return counts;
  },

  /**
   * Verificar se todos os checklists de uma OS estão completos
   */
  async areAllCompleted(workOrderId: string): Promise<boolean> {
    const counts = await this.countByStatus(workOrderId);
    const total = counts.PENDING + counts.IN_PROGRESS + counts.COMPLETED + counts.CANCELLED;

    // Se não houver checklists, considera como completo
    if (total === 0) return true;

    // Todos devem estar COMPLETED ou CANCELLED
    return counts.PENDING === 0 && counts.IN_PROGRESS === 0;
  },
};

export default ChecklistInstanceRepository;
