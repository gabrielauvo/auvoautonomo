// @ts-nocheck
/**
 * Quote Sync Configuration
 *
 * Configuração da entidade Quote para sincronização 2-vias.
 * Alinhado com backend: GET /sync/quotes, POST /sync/quotes/mutations
 */

import { SyncEntityConfig } from '../../sync/types';
import { QuoteStatus } from '../../db/schema';
import { getDatabase } from '../../db/database';

// =============================================================================
// QUOTE TYPES
// =============================================================================

/**
 * SyncQuoteItem - Item do orçamento para sync
 */
export interface SyncQuoteItem {
  id: string;
  quoteId: string;
  itemId?: string;      // ID do item do catálogo (null para itens manuais)
  name: string;
  type: string;         // SERVICE | PRODUCT
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * SyncQuote - Interface para sync
 *
 * Alinhado com backend SyncQuoteDto
 */
export interface SyncQuote {
  id: string;
  clientId: string;
  status: QuoteStatus;
  discountValue: number;
  totalValue: number;
  notes?: string;
  sentAt?: string;
  visitScheduledAt?: string;
  items: SyncQuoteItem[];
  createdAt: string;
  updatedAt: string;
  // Local fields
  syncedAt?: string;
  technicianId: string;
  clientName?: string;
}

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export const QuoteSyncConfig: SyncEntityConfig<SyncQuote> = {
  name: 'quotes',
  tableName: 'quotes',
  apiEndpoint: '/sync/quotes',
  apiMutationEndpoint: '/sync/quotes/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'last_write_wins',

  /**
   * Transform server data to local format
   */
  transformFromServer: (data: unknown): SyncQuote => {
    const record = data as Record<string, unknown>;
    const items = (record.items as any[]) || [];

    console.log('[QuoteSyncConfig] transformFromServer - raw data:', JSON.stringify(record).substring(0, 200));

    return {
      id: record.id as string,
      clientId: record.clientId as string,
      status: (record.status as string).toUpperCase() as QuoteStatus,
      discountValue: Number(record.discountValue) || 0,
      totalValue: Number(record.totalValue) || 0,
      notes: record.notes as string | undefined,
      sentAt: record.sentAt as string | undefined,
      visitScheduledAt: record.visitScheduledAt as string | undefined,
      items: items.map((item) => ({
        id: item.id,
        quoteId: item.quoteId,
        itemId: item.itemId || undefined,
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountValue: Number(item.discountValue) || 0,
        totalPrice: Number(item.totalPrice),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      technicianId: record.technicianId as string,
      clientName: record.clientName as string | undefined,
    };
  },

  /**
   * Transform local data to server format
   *
   * Note: This receives the payload from MutationQueue which is already
   * formatted for the server by QuoteService. We just need to ensure
   * the data is properly structured.
   *
   * IMPORTANTE: Para updates parciais (ex: só status), não enviamos items
   * se não estiverem no payload, para não sobrescrever os itens existentes.
   */
  transformToServer: (data: SyncQuote | Record<string, unknown>): unknown => {
    const record = data as Record<string, unknown>;

    console.log('[QuoteSyncConfig] transformToServer - input:', JSON.stringify(record).substring(0, 300));

    // Build result object with only defined fields
    const result: Record<string, unknown> = {
      id: record.id,
      clientId: record.clientId,
    };

    // Adicionar campos opcionais apenas se estiverem definidos
    if (record.status !== undefined) {
      result.status = record.status;
    }

    if (record.discountValue !== undefined) {
      result.discountValue = record.discountValue;
    }

    if (record.notes !== undefined) {
      result.notes = record.notes || null;
    }

    if (record.visitScheduledAt !== undefined) {
      result.visitScheduledAt = record.visitScheduledAt || null;
    }

    // Só incluir items se estiverem explicitamente no payload
    // Isso evita sobrescrever itens existentes em updates parciais (ex: só status)
    if (record.items !== undefined && Array.isArray(record.items)) {
      const items = record.items as Array<Record<string, unknown>>;
      result.items = items.map((item) => ({
        id: item.id,
        itemId: item.itemId || null,
        name: item.name,
        type: item.type || 'SERVICE',
        unit: item.unit || 'un',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountValue: item.discountValue || 0,
      }));
    }

    console.log('[QuoteSyncConfig] transformToServer - output:', JSON.stringify(result).substring(0, 300));

    return result;
  },

  /**
   * Custom save handler for quotes with items
   * Saves quotes to quotes table and items to quote_items table
   */
  customSave: async (data: SyncQuote[], technicianId: string): Promise<void> => {
    console.log(`[QuoteSyncConfig] customSave called with ${data.length} quotes, technicianId: ${technicianId}`);
    if (data.length === 0) return;

    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const quote of data) {
      // 1. Save quote to quotes table
      await db.runAsync(
        `INSERT OR REPLACE INTO quotes (
          id, clientId, status, discountValue, totalValue, notes, sentAt, visitScheduledAt,
          createdAt, updatedAt, syncedAt, technicianId, clientName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quote.id,
          quote.clientId,
          quote.status,
          quote.discountValue,
          quote.totalValue,
          quote.notes || null,
          quote.sentAt || null,
          quote.visitScheduledAt || null,
          quote.createdAt,
          quote.updatedAt,
          now,
          technicianId,
          quote.clientName || null,
        ]
      );

      // 2. Delete existing items for this quote
      await db.runAsync('DELETE FROM quote_items WHERE quoteId = ?', [quote.id]);

      // 3. Insert new items
      if (quote.items && quote.items.length > 0) {
        for (const item of quote.items) {
          await db.runAsync(
            `INSERT INTO quote_items (
              id, quoteId, itemId, name, type, unit, quantity, unitPrice, discountValue, totalPrice, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              quote.id,
              item.itemId || null,
              item.name,
              item.type,
              item.unit,
              item.quantity,
              item.unitPrice,
              item.discountValue,
              item.totalPrice,
              item.createdAt,
              item.updatedAt,
            ]
          );
        }
      }

      console.log(`[QuoteSyncConfig] Saved quote ${quote.id} with ${quote.items?.length || 0} items`);
    }
  },
};

export default QuoteSyncConfig;
