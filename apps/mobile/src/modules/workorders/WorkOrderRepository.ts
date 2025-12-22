/**
 * WorkOrderRepository
 *
 * Repositório para operações de banco de dados de Ordens de Serviço.
 * Otimizado para consultas por data (agenda) e performance com grande volume.
 */

import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { getDatabase } from '../../db/database';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkOrderFilter {
  status?: WorkOrderStatus | WorkOrderStatus[];
  clientId?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  searchQuery?: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface WorkOrderListResult {
  items: WorkOrder[];
  total: number;
  hasMore: boolean;
}

export interface DateRangeResult {
  items: WorkOrder[];
  total: number;
}

// =============================================================================
// REPOSITORY
// =============================================================================

export class WorkOrderRepository {
  /**
   * Busca OS por intervalo de datas (para agenda)
   * Otimizado com índices em scheduledDate e scheduledStartTime
   */
  async getByDateRange(
    technicianId: string,
    startDate: string,
    endDate: string,
    pagination?: PaginationOptions,
  ): Promise<DateRangeResult> {
    const db = await getDatabase();

    // Usa substr para comparar apenas a parte da data (YYYY-MM-DD) pois
    // scheduledDate pode ter timestamp completo (2025-12-17T21:00:00.000Z)
    // Query para contar total
    const countResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_orders
       WHERE technicianId = ?
       AND isActive = 1
       AND (
         (substr(scheduledDate, 1, 10) >= ? AND substr(scheduledDate, 1, 10) <= ?)
         OR (scheduledStartTime >= ? AND scheduledStartTime <= ?)
       )`,
      [technicianId, startDate, endDate, startDate + 'T00:00:00', endDate + 'T23:59:59'],
    );

    const total = countResult?.count || 0;

    // Query principal com paginação
    let query = `
      SELECT * FROM work_orders
      WHERE technicianId = ?
      AND isActive = 1
      AND (
        (substr(scheduledDate, 1, 10) >= ? AND substr(scheduledDate, 1, 10) <= ?)
        OR (scheduledStartTime >= ? AND scheduledStartTime <= ?)
      )
      ORDER BY COALESCE(scheduledStartTime, scheduledDate) ASC
    `;

    const params: any[] = [technicianId, startDate, endDate, startDate + 'T00:00:00', endDate + 'T23:59:59'];

    if (pagination) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(pagination.limit, pagination.offset);
    }

    const items = await db.getAllAsync<WorkOrder>(query, params);

    return {
      items: items.map(this.mapRowToWorkOrder),
      total,
    };
  }

  /**
   * Busca OS por dia específico (otimizado para agenda diária)
   */
  async getByDay(technicianId: string, date: string): Promise<WorkOrder[]> {
    const db = await getDatabase();

    // Busca por scheduledDate OU scheduledStartTime que comece neste dia
    // Usa substr para comparar apenas a parte da data (YYYY-MM-DD) pois
    // scheduledDate pode ter timestamp completo (2025-12-17T21:00:00.000Z)
    const items = await db.getAllAsync<WorkOrder>(
      `SELECT * FROM work_orders
       WHERE technicianId = ?
       AND isActive = 1
       AND (
         substr(scheduledDate, 1, 10) = ?
         OR (scheduledStartTime >= ? AND scheduledStartTime < ?)
       )
       ORDER BY COALESCE(scheduledStartTime, scheduledDate) ASC`,
      [
        technicianId,
        date,
        date + 'T00:00:00',
        date + 'T23:59:59',
      ],
    );

    return items.map(this.mapRowToWorkOrder);
  }

  /**
   * Busca uma OS pelo ID
   */
  async getById(id: string): Promise<WorkOrder | null> {
    const db = await getDatabase();

    const row = await db.getFirstAsync<WorkOrder>(
      `SELECT * FROM work_orders WHERE id = ?`,
      [id],
    );

    return row ? this.mapRowToWorkOrder(row) : null;
  }

  /**
   * Lista OS com filtros e paginação
   */
  async list(
    technicianId: string,
    filter?: WorkOrderFilter,
    pagination?: PaginationOptions,
  ): Promise<WorkOrderListResult> {
    const db = await getDatabase();

    let whereClause = 'WHERE technicianId = ?';
    const params: any[] = [technicianId];

    // Filtros
    if (filter?.isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(filter.isActive ? 1 : 0);
    } else {
      // Por padrão, só mostra ativos
      whereClause += ' AND isActive = 1';
    }

    if (filter?.status) {
      if (Array.isArray(filter.status)) {
        const placeholders = filter.status.map(() => '?').join(', ');
        whereClause += ` AND status IN (${placeholders})`;
        params.push(...filter.status);
      } else {
        whereClause += ' AND status = ?';
        params.push(filter.status);
      }
    }

    if (filter?.clientId) {
      whereClause += ' AND clientId = ?';
      params.push(filter.clientId);
    }

    if (filter?.startDate) {
      whereClause += ' AND COALESCE(scheduledDate, scheduledStartTime) >= ?';
      params.push(filter.startDate);
    }

    if (filter?.endDate) {
      whereClause += ' AND COALESCE(scheduledDate, scheduledStartTime) <= ?';
      params.push(filter.endDate);
    }

    if (filter?.searchQuery) {
      whereClause += ' AND (title LIKE ? OR clientName LIKE ? OR description LIKE ?)';
      const searchPattern = `%${filter.searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Count total
    const countResult = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM work_orders ${whereClause}`,
      params,
    );

    const total = countResult?.count || 0;

    // Query principal
    let query = `
      SELECT * FROM work_orders
      ${whereClause}
      ORDER BY COALESCE(scheduledStartTime, scheduledDate) DESC
    `;

    const queryParams = [...params];

    if (pagination) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(pagination.limit, pagination.offset);
    }

    const items = await db.getAllAsync<WorkOrder>(query, queryParams);

    return {
      items: items.map(this.mapRowToWorkOrder),
      total,
      hasMore: pagination
        ? pagination.offset + items.length < total
        : false,
    };
  }

  /**
   * Upsert em batch (para sync)
   */
  async upsertBatch(workOrders: WorkOrder[]): Promise<void> {
    if (workOrders.length === 0) return;

    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      for (const wo of workOrders) {
        await db.runAsync(
          `INSERT OR REPLACE INTO work_orders (
            id, clientId, quoteId, workOrderTypeId, title, description, status,
            scheduledDate, scheduledStartTime, scheduledEndTime,
            executionStart, executionEnd, address, notes, totalValue,
            isActive, deletedAt, createdAt, updatedAt, syncedAt,
            technicianId, clientName, clientPhone, clientAddress,
            workOrderTypeName, workOrderTypeColor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            wo.id,
            wo.clientId,
            wo.quoteId || null,
            wo.workOrderTypeId || null,
            wo.title,
            wo.description || null,
            wo.status,
            wo.scheduledDate || null,
            wo.scheduledStartTime || null,
            wo.scheduledEndTime || null,
            wo.executionStart || null,
            wo.executionEnd || null,
            wo.address || null,
            wo.notes || null,
            wo.totalValue || null,
            wo.isActive ? 1 : 0,
            wo.deletedAt || null,
            wo.createdAt,
            wo.updatedAt,
            wo.syncedAt || null,
            wo.technicianId,
            wo.clientName || null,
            wo.clientPhone || null,
            wo.clientAddress || null,
            wo.workOrderTypeName || null,
            wo.workOrderTypeColor || null,
          ],
        );
      }
    });
  }

  /**
   * Insere uma nova OS
   */
  async insert(workOrder: Omit<WorkOrder, 'createdAt' | 'updatedAt'>): Promise<WorkOrder> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const wo = {
      ...workOrder,
      createdAt: now,
      updatedAt: now,
      isActive: workOrder.isActive ?? 1,  // Default to 1 (integer) for SQLite
    } as unknown as WorkOrder;

    await db.runAsync(
      `INSERT INTO work_orders (
        id, clientId, quoteId, workOrderTypeId, title, description, status,
        scheduledDate, scheduledStartTime, scheduledEndTime,
        executionStart, executionEnd, address, notes, totalValue,
        isActive, deletedAt, createdAt, updatedAt, syncedAt,
        technicianId, clientName, clientPhone, clientAddress,
        workOrderTypeName, workOrderTypeColor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wo.id,
        wo.clientId,
        wo.quoteId || null,
        wo.workOrderTypeId || null,
        wo.title,
        wo.description || null,
        wo.status,
        wo.scheduledDate || null,
        wo.scheduledStartTime || null,
        wo.scheduledEndTime || null,
        wo.executionStart || null,
        wo.executionEnd || null,
        wo.address || null,
        wo.notes || null,
        wo.totalValue || null,
        wo.isActive ? 1 : 0,
        wo.deletedAt || null,
        wo.createdAt,
        wo.updatedAt,
        wo.syncedAt || null,
        wo.technicianId,
        wo.clientName || null,
        wo.clientPhone || null,
        wo.clientAddress || null,
        wo.workOrderTypeName || null,
        wo.workOrderTypeColor || null,
      ],
    );

    return wo;
  }

  /**
   * Atualiza uma OS
   */
  async update(
    id: string,
    updates: Partial<Omit<WorkOrder, 'id' | 'createdAt'>>,
  ): Promise<WorkOrder | null> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Busca OS atual
    const existing = await this.getById(id);
    if (!existing) return null;

    // Monta campos para atualizar
    const fields: string[] = ['updatedAt = ?'];
    const values: any[] = [now];

    const updatableFields: (keyof typeof updates)[] = [
      'clientId', 'quoteId', 'workOrderTypeId', 'title', 'description', 'status',
      'scheduledDate', 'scheduledStartTime', 'scheduledEndTime',
      'executionStart', 'executionEnd', 'address', 'notes', 'totalValue',
      'isActive', 'deletedAt', 'syncedAt', 'technicianId',
      'clientName', 'clientPhone', 'clientAddress',
      'workOrderTypeName', 'workOrderTypeColor',
    ];

    for (const field of updatableFields) {
      if (updates[field] !== undefined) {
        if (field === 'isActive') {
          fields.push(`${field} = ?`);
          values.push(updates[field] ? 1 : 0);
        } else {
          fields.push(`${field} = ?`);
          values.push(updates[field]);
        }
      }
    }

    values.push(id);

    await db.runAsync(
      `UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );

    return this.getById(id);
  }

  /**
   * Atualiza status de uma OS
   */
  async updateStatus(
    id: string,
    status: WorkOrderStatus,
    executionTimes?: { executionStart?: string; executionEnd?: string },
  ): Promise<WorkOrder | null> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const updates: any = { status, updatedAt: now };

    // Define tempos de execução baseado no status
    if (status === 'IN_PROGRESS' && executionTimes?.executionStart) {
      updates.executionStart = executionTimes.executionStart;
    } else if (status === 'IN_PROGRESS') {
      updates.executionStart = now;
    }

    if (status === 'DONE' && executionTimes?.executionEnd) {
      updates.executionEnd = executionTimes.executionEnd;
    } else if (status === 'DONE') {
      updates.executionEnd = now;
    }

    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id);

    await db.runAsync(
      `UPDATE work_orders SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );

    return this.getById(id);
  }

  /**
   * Soft delete de uma OS
   */
  async softDelete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const result = await db.runAsync(
      `UPDATE work_orders SET deletedAt = ?, isActive = 0, updatedAt = ? WHERE id = ?`,
      [now, now, id],
    );

    return result.changes > 0;
  }

  /**
   * Busca OS pendentes de sync
   */
  async getPendingSync(technicianId: string): Promise<WorkOrder[]> {
    const db = await getDatabase();

    const items = await db.getAllAsync<WorkOrder>(
      `SELECT * FROM work_orders
       WHERE technicianId = ?
       AND (syncedAt IS NULL OR updatedAt > syncedAt)
       ORDER BY updatedAt ASC`,
      [technicianId],
    );

    return items.map(this.mapRowToWorkOrder);
  }

  /**
   * Marca OS como sincronizada
   */
  async markAsSynced(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = await getDatabase();
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(', ');

    await db.runAsync(
      `UPDATE work_orders SET syncedAt = ? WHERE id IN (${placeholders})`,
      [now, ...ids],
    );
  }

  /**
   * Conta OS por status (para dashboard)
   */
  async countByStatus(technicianId: string): Promise<Record<WorkOrderStatus, number>> {
    const db = await getDatabase();

    const results = await db.getAllAsync<{ status: WorkOrderStatus; count: number }>(
      `SELECT status, COUNT(*) as count FROM work_orders
       WHERE technicianId = ? AND isActive = 1
       GROUP BY status`,
      [technicianId],
    );

    const counts: Record<WorkOrderStatus, number> = {
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      CANCELED: 0,
    };

    for (const row of results) {
      counts[row.status] = row.count;
    }

    return counts;
  }

  /**
   * Busca próximas OS agendadas
   */
  async getUpcoming(
    technicianId: string,
    limit: number = 5,
  ): Promise<WorkOrder[]> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    const items = await db.getAllAsync<WorkOrder>(
      `SELECT * FROM work_orders
       WHERE technicianId = ?
       AND isActive = 1
       AND status IN ('SCHEDULED', 'IN_PROGRESS')
       AND COALESCE(scheduledStartTime, scheduledDate) >= ?
       ORDER BY COALESCE(scheduledStartTime, scheduledDate) ASC
       LIMIT ?`,
      [technicianId, now.split('T')[0], limit],
    );

    return items.map(this.mapRowToWorkOrder);
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private mapRowToWorkOrder(row: any): WorkOrder {
    // Handle isActive as both integer (1/0) and string ('true'/'false') or boolean
    const isActiveValue = row.isActive === 1 || row.isActive === '1' || row.isActive === true || row.isActive === 'true';
    return {
      id: row.id,
      clientId: row.clientId,
      quoteId: row.quoteId || undefined,
      workOrderTypeId: row.workOrderTypeId || undefined,
      title: row.title,
      description: row.description || undefined,
      status: row.status as WorkOrderStatus,
      scheduledDate: row.scheduledDate || undefined,
      scheduledStartTime: row.scheduledStartTime || undefined,
      scheduledEndTime: row.scheduledEndTime || undefined,
      executionStart: row.executionStart || undefined,
      executionEnd: row.executionEnd || undefined,
      address: row.address || undefined,
      notes: row.notes || undefined,
      totalValue: row.totalValue || undefined,
      isActive: isActiveValue,
      deletedAt: row.deletedAt || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      syncedAt: row.syncedAt || undefined,
      technicianId: row.technicianId,
      clientName: row.clientName || undefined,
      clientPhone: row.clientPhone || undefined,
      clientAddress: row.clientAddress || undefined,
      workOrderTypeName: row.workOrderTypeName || undefined,
      workOrderTypeColor: row.workOrderTypeColor || undefined,
    };
  }
}

// Singleton instance
export const workOrderRepository = new WorkOrderRepository();
