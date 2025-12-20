// @ts-nocheck
/**
 * Quote Repository
 *
 * Acesso ao banco de dados para orçamentos (quotes).
 * Inclui operações para quote_items.
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
import { Quote, QuoteItem, QuoteStatus } from '../../db/schema';

// Type helper for database operations
type QuoteRecord = Record<string, unknown>;
type QuoteItemRecord = Record<string, unknown>;

const TABLE = 'quotes';
const ITEMS_TABLE = 'quote_items';

// =============================================================================
// QUOTE REPOSITORY
// =============================================================================

export const QuoteRepository = {
  /**
   * Buscar todos os orçamentos do técnico
   */
  async getAll(technicianId: string, options: Omit<QueryOptions, 'where'> = {}): Promise<Quote[]> {
    return findAll<Quote>(TABLE, {
      where: { technicianId },
      orderBy: 'updatedAt',
      order: 'DESC',
      ...options,
    });
  },

  /**
   * Buscar orçamento por ID (sem itens)
   */
  async getById(id: string): Promise<Quote | null> {
    return findById<Quote>(TABLE, id);
  },

  /**
   * Buscar orçamento por ID com itens
   */
  async getByIdWithItems(id: string): Promise<(Quote & { items: QuoteItem[] }) | null> {
    const quote = await findById<Quote>(TABLE, id);
    if (!quote) return null;

    const items = await findAll<QuoteItem>(ITEMS_TABLE, {
      where: { quoteId: id },
      orderBy: 'createdAt',
      order: 'ASC',
    });

    return { ...quote, items };
  },

  /**
   * Buscar orçamentos por cliente
   */
  async getByClient(clientId: string, technicianId: string): Promise<Quote[]> {
    return findAll<Quote>(TABLE, {
      where: { clientId, technicianId },
      orderBy: 'updatedAt',
      order: 'DESC',
    });
  },

  /**
   * Buscar orçamentos por status
   */
  async getByStatus(technicianId: string, status: QuoteStatus): Promise<Quote[]> {
    return findAll<Quote>(TABLE, {
      where: { technicianId, status },
      orderBy: 'updatedAt',
      order: 'DESC',
    });
  },

  /**
   * Buscar orçamentos com paginação
   * Nota: Orçamentos EXPIRED são excluídos por padrão (a menos que explicitamente filtrado)
   */
  async getPaginated(
    technicianId: string,
    page: number = 1,
    pageSize: number = 50,
    status?: QuoteStatus
  ): Promise<{ data: Quote[]; total: number; pages: number }> {
    const offset = (page - 1) * pageSize;

    // Se um status específico foi solicitado, use-o
    // Caso contrário, exclua EXPIRED da listagem padrão
    if (status) {
      const where: Record<string, unknown> = { technicianId, status };
      const [data, total] = await Promise.all([
        findAll<Quote>(TABLE, {
          where,
          orderBy: 'updatedAt',
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
    }

    // Sem filtro de status: excluir EXPIRED
    const data = await rawQuery<Quote>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND status != 'EXPIRED'
       ORDER BY updatedAt DESC
       LIMIT ? OFFSET ?`,
      [technicianId, pageSize, offset]
    );

    const totalResult = await rawQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM ${TABLE}
       WHERE technicianId = ? AND status != 'EXPIRED'`,
      [technicianId]
    );
    const total = totalResult[0]?.total || 0;

    return {
      data,
      total,
      pages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Buscar orçamentos por texto (clientName, notes)
   * Nota: Orçamentos EXPIRED são excluídos da busca
   */
  async search(
    technicianId: string,
    query: string,
    limit: number = 50
  ): Promise<Quote[]> {
    const searchQuery = `%${query}%`;

    return rawQuery<Quote>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ?
       AND status != 'EXPIRED'
       AND (clientName LIKE ? OR notes LIKE ?)
       ORDER BY updatedAt DESC
       LIMIT ?`,
      [technicianId, searchQuery, searchQuery, limit]
    );
  },

  /**
   * Criar novo orçamento
   */
  async create(data: Omit<Quote, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    await insert<QuoteRecord>(TABLE, {
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Criar orçamento com itens (transação)
   */
  async createWithItems(
    quote: Omit<Quote, 'createdAt' | 'updatedAt'>,
    items: Omit<QuoteItem, 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    const now = new Date().toISOString();

    // Insert quote
    await insert<QuoteRecord>(TABLE, {
      ...quote,
      createdAt: now,
      updatedAt: now,
    });

    // Insert items
    for (const item of items) {
      await insert<QuoteItemRecord>(ITEMS_TABLE, {
        ...item,
        quoteId: quote.id,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Atualizar orçamento
   */
  async update(id: string, data: Partial<Quote>): Promise<void> {
    await update<QuoteRecord>(TABLE, id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Atualizar orçamento e substituir itens
   */
  async updateWithItems(
    id: string,
    quote: Partial<Quote>,
    items: Omit<QuoteItem, 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update quote
    await update<QuoteRecord>(TABLE, id, {
      ...quote,
      updatedAt: now,
    });

    // Delete existing items
    await rawQuery(`DELETE FROM ${ITEMS_TABLE} WHERE quoteId = ?`, [id]);

    // Insert new items
    for (const item of items) {
      await insert<QuoteItemRecord>(ITEMS_TABLE, {
        ...item,
        quoteId: id,
        createdAt: now,
        updatedAt: now,
      });
    }
  },

  /**
   * Atualizar status do orçamento
   */
  async updateStatus(id: string, status: QuoteStatus): Promise<void> {
    const updateData: Partial<Quote> = { status, updatedAt: new Date().toISOString() };
    if (status === 'SENT') {
      updateData.sentAt = new Date().toISOString();
    }
    await update<QuoteRecord>(TABLE, id, updateData);
  },

  /**
   * Deletar orçamento (e itens via CASCADE)
   */
  async delete(id: string): Promise<void> {
    // Delete items first (se CASCADE não funcionar)
    await rawQuery(`DELETE FROM ${ITEMS_TABLE} WHERE quoteId = ?`, [id]);
    await remove(TABLE, id);
  },

  /**
   * Contar orçamentos do técnico
   * Nota: Orçamentos EXPIRED são excluídos da contagem por padrão
   */
  async count(technicianId: string, status?: QuoteStatus): Promise<number> {
    if (status) {
      const where: Record<string, unknown> = { technicianId, status };
      return count(TABLE, where);
    }

    // Sem filtro de status: excluir EXPIRED
    const result = await rawQuery<{ total: number }>(
      `SELECT COUNT(*) as total FROM ${TABLE}
       WHERE technicianId = ? AND status != 'EXPIRED'`,
      [technicianId]
    );
    return result[0]?.total || 0;
  },

  /**
   * Buscar orçamentos modificados após uma data (para sync)
   */
  async getModifiedAfter(
    technicianId: string,
    afterDate: string,
    limit: number = 100
  ): Promise<Quote[]> {
    return rawQuery<Quote>(
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
  async batchUpsert(quotes: Quote[]): Promise<void> {
    if (quotes.length === 0) return;

    for (const quote of quotes) {
      const existing = await findById<Quote>(TABLE, quote.id);
      if (existing) {
        await update<QuoteRecord>(TABLE, quote.id, {
          ...quote,
          syncedAt: new Date().toISOString(),
        });
      } else {
        await insert<QuoteRecord>(TABLE, {
          ...quote,
          syncedAt: new Date().toISOString(),
        });
      }
    }
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string): Promise<void> {
    await update<QuoteRecord>(TABLE, id, {
      syncedAt: new Date().toISOString(),
    });
  },

  // =============================================================================
  // QUOTE ITEMS
  // =============================================================================

  /**
   * Buscar itens de um orçamento
   */
  async getItems(quoteId: string): Promise<QuoteItem[]> {
    return findAll<QuoteItem>(ITEMS_TABLE, {
      where: { quoteId },
      orderBy: 'createdAt',
      order: 'ASC',
    });
  },

  /**
   * Adicionar item ao orçamento
   */
  async addItem(item: Omit<QuoteItem, 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = new Date().toISOString();
    await insert<QuoteItemRecord>(ITEMS_TABLE, {
      ...item,
      createdAt: now,
      updatedAt: now,
    });
  },

  /**
   * Atualizar item do orçamento
   */
  async updateItem(itemId: string, data: Partial<QuoteItem>): Promise<void> {
    await update<QuoteItemRecord>(ITEMS_TABLE, itemId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Remover item do orçamento
   */
  async removeItem(itemId: string): Promise<void> {
    await remove(ITEMS_TABLE, itemId);
  },

  /**
   * Batch insert items para sync
   */
  async batchUpsertItems(items: QuoteItem[]): Promise<void> {
    if (items.length === 0) return;

    for (const item of items) {
      const existing = await findById<QuoteItem>(ITEMS_TABLE, item.id);
      if (existing) {
        await update<QuoteItemRecord>(ITEMS_TABLE, item.id, item);
      } else {
        await insert<QuoteItemRecord>(ITEMS_TABLE, item);
      }
    }
  },

  /**
   * Recalcular total do orçamento baseado nos itens
   */
  async recalculateTotal(quoteId: string): Promise<number> {
    const items = await this.getItems(quoteId);
    const itemsTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

    const quote = await this.getById(quoteId);
    if (!quote) return 0;

    const totalValue = itemsTotal - quote.discountValue;
    await this.update(quoteId, { totalValue });

    return totalValue;
  },
};

export default QuoteRepository;
