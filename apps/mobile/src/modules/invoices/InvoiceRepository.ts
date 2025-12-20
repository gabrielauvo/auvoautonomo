// @ts-nocheck
/**
 * Invoice Repository
 *
 * Acesso ao banco de dados para faturas (invoices).
 */

import type { SQLiteBindValue } from 'expo-sqlite';
import {
  findAll,
  findById,
  findOne,
  insert,
  update,
  remove,
  count,
  rawQuery,
  QueryOptions,
} from '../../db/database';
import { Invoice, InvoiceStatus } from '../../db/schema';

// Type helper for database operations
type InvoiceRecord = Record<string, unknown>;

const TABLE = 'invoices';

// =============================================================================
// INVOICE REPOSITORY
// =============================================================================

export const InvoiceRepository = {
  /**
   * Buscar todas as faturas do técnico
   */
  async getAll(technicianId: string, options: Omit<QueryOptions, 'where'> = {}): Promise<Invoice[]> {
    return findAll<Invoice>(TABLE, {
      where: { technicianId },
      orderBy: 'updatedAt',
      order: 'DESC',
      ...options,
    });
  },

  /**
   * Buscar fatura por ID
   */
  async getById(id: string): Promise<Invoice | null> {
    return findById<Invoice>(TABLE, id);
  },

  /**
   * Buscar fatura por número
   */
  async getByNumber(invoiceNumber: string, technicianId: string): Promise<Invoice | null> {
    return findOne<Invoice>(TABLE, { invoiceNumber, technicianId });
  },

  /**
   * Buscar faturas por cliente
   */
  async getByClient(clientId: string, technicianId: string): Promise<Invoice[]> {
    return findAll<Invoice>(TABLE, {
      where: { clientId, technicianId },
      orderBy: 'dueDate',
      order: 'DESC',
    });
  },

  /**
   * Buscar faturas por ordem de serviço
   */
  async getByWorkOrder(workOrderId: string): Promise<Invoice | null> {
    return findOne<Invoice>(TABLE, { workOrderId });
  },

  /**
   * Buscar faturas por status
   */
  async getByStatus(technicianId: string, status: InvoiceStatus): Promise<Invoice[]> {
    return findAll<Invoice>(TABLE, {
      where: { technicianId, status },
      orderBy: 'dueDate',
      order: 'ASC',
    });
  },

  /**
   * Buscar faturas vencidas
   */
  async getOverdue(technicianId: string): Promise<Invoice[]> {
    const today = new Date().toISOString().split('T')[0];

    return rawQuery<Invoice>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ?
       AND status = 'PENDING'
       AND dueDate < ?
       ORDER BY dueDate ASC`,
      [technicianId, today]
    );
  },

  /**
   * Buscar faturas com vencimento próximo (7 dias)
   */
  async getDueSoon(technicianId: string, daysAhead: number = 7): Promise<Invoice[]> {
    const today = new Date();
    const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return rawQuery<Invoice>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ?
       AND status = 'PENDING'
       AND dueDate >= ? AND dueDate <= ?
       ORDER BY dueDate ASC`,
      [
        technicianId,
        today.toISOString().split('T')[0],
        futureDate.toISOString().split('T')[0],
      ]
    );
  },

  /**
   * Buscar faturas com paginação
   */
  async getPaginated(
    technicianId: string,
    page: number = 1,
    pageSize: number = 50,
    status?: InvoiceStatus
  ): Promise<{ data: Invoice[]; total: number; pages: number }> {
    const offset = (page - 1) * pageSize;
    const where: Record<string, unknown> = { technicianId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      findAll<Invoice>(TABLE, {
        where,
        orderBy: 'dueDate',
        order: 'DESC',
        limit: pageSize,
        offset,
      }),
      count(TABLE, where),
    ]);

    return {
      data,
      total,
      pages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Buscar faturas por texto (invoiceNumber, clientName, notes)
   */
  async search(
    technicianId: string,
    query: string,
    limit: number = 50
  ): Promise<Invoice[]> {
    const searchQuery = `%${query}%`;

    return rawQuery<Invoice>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ?
       AND (invoiceNumber LIKE ? OR clientName LIKE ? OR notes LIKE ?)
       ORDER BY updatedAt DESC
       LIMIT ?`,
      [technicianId, searchQuery, searchQuery, searchQuery, limit]
    );
  },

  /**
   * Criar nova fatura
   */
  async create(data: Omit<Invoice, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    await insert<InvoiceRecord>(TABLE, {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Atualizar fatura
   */
  async update(id: string, data: Partial<Invoice>): Promise<void> {
    await update<InvoiceRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar status da fatura
   */
  async updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    const updateData: Partial<Invoice> = { status, updatedAt: new Date().toISOString() };
    if (status === 'PAID') {
      updateData.paidDate = new Date().toISOString();
    }
    await update<InvoiceRecord>(TABLE, id, updateData);
  },

  /**
   * Marcar como paga
   */
  async markAsPaid(id: string, paidDate?: string): Promise<void> {
    await update<InvoiceRecord>(TABLE, id, {
      status: 'PAID',
      paidDate: paidDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Deletar fatura
   */
  async delete(id: string): Promise<void> {
    await remove(TABLE, id);
  },

  /**
   * Contar faturas do técnico
   */
  async count(technicianId: string, status?: InvoiceStatus): Promise<number> {
    const where: Record<string, unknown> = { technicianId };
    if (status) where.status = status;
    return count(TABLE, where);
  },

  /**
   * Obter resumo financeiro
   */
  async getFinancialSummary(technicianId: string): Promise<{
    totalPending: number;
    totalPaid: number;
    totalOverdue: number;
    countPending: number;
    countPaid: number;
    countOverdue: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [pending, paid, overdue] = await Promise.all([
      rawQuery<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
         FROM ${TABLE}
         WHERE technicianId = ? AND status = 'PENDING' AND dueDate >= ?`,
        [technicianId, today]
      ),
      rawQuery<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
         FROM ${TABLE}
         WHERE technicianId = ? AND status = 'PAID'`,
        [technicianId]
      ),
      rawQuery<{ total: number; count: number }>(
        `SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as count
         FROM ${TABLE}
         WHERE technicianId = ? AND status = 'PENDING' AND dueDate < ?`,
        [technicianId, today]
      ),
    ]);

    return {
      totalPending: pending[0]?.total || 0,
      totalPaid: paid[0]?.total || 0,
      totalOverdue: overdue[0]?.total || 0,
      countPending: pending[0]?.count || 0,
      countPaid: paid[0]?.count || 0,
      countOverdue: overdue[0]?.count || 0,
    };
  },

  /**
   * Gerar próximo número de fatura
   */
  async generateInvoiceNumber(technicianId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}`;

    const lastInvoice = await rawQuery<Invoice>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND invoiceNumber LIKE ?
       ORDER BY invoiceNumber DESC
       LIMIT 1`,
      [technicianId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = parseInt(lastInvoice[0].invoiceNumber.split('-')[2] || '0', 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  },

  /**
   * Buscar faturas modificadas após uma data (para sync)
   */
  async getModifiedAfter(
    technicianId: string,
    afterDate: string,
    limit: number = 100
  ): Promise<Invoice[]> {
    return rawQuery<Invoice>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND updatedAt > ?
       ORDER BY updatedAt ASC
       LIMIT ?`,
      [technicianId, afterDate, limit]
    );
  },

  /**
   * Batch insert/update para sync
   */
  async batchUpsert(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;

    for (const invoice of invoices) {
      const existing = await findById<Invoice>(TABLE, invoice.id);
      if (existing) {
        await update<InvoiceRecord>(TABLE, invoice.id, {
          ...invoice,
          syncedAt: new Date().toISOString(),
        });
      } else {
        await insert<InvoiceRecord>(TABLE, {
          ...invoice,
          syncedAt: new Date().toISOString(),
        });
      }
    }
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string): Promise<void> {
    await update<InvoiceRecord>(TABLE, id, {
      syncedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar status de faturas vencidas
   */
  async updateOverdueStatus(technicianId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const result = await rawQuery(
      `UPDATE ${TABLE}
       SET status = 'OVERDUE', updatedAt = ?
       WHERE technicianId = ? AND status = 'PENDING' AND dueDate < ?`,
      [new Date().toISOString(), technicianId, today]
    );

    return result.length; // Approximate count
  },
};

export default InvoiceRepository;
