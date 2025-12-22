// @ts-nocheck
/**
 * Inventory Repository
 *
 * Acesso ao banco SQLite para dados de estoque.
 * Operações assíncronas usando expo-sqlite.
 */

import { getDatabase, rawQuery } from '../../db/database';

// =============================================================================
// TYPES
// =============================================================================

export interface InventorySettings {
  id: string;
  userId: string;
  isEnabled: number; // SQLite boolean
  deductOnStatus: string;
  allowNegativeStock: number;
  deductOnlyOncePerWorkOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBalance {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  // Denormalized from item for display
  itemName?: string;
  itemSku?: string;
  itemUnit?: string;
  itemType?: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'WORK_ORDER_OUT' | 'INITIAL';
  source: 'MANUAL' | 'WORK_ORDER' | 'IMPORT' | 'SYSTEM';
  quantity: number;
  balanceAfter: number;
  sourceId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  syncStatus?: string;
  // Denormalized
  itemName?: string;
  itemSku?: string;
}

export interface InventoryMovementOutbox {
  id: string;
  movementId: string;
  itemId: string;
  type: string;
  source: string;
  quantity: number;
  balanceAfter: number;
  sourceId?: string;
  notes?: string;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  syncAttempts: number;
  lastSyncAttempt?: string;
}

// =============================================================================
// REPOSITORY
// =============================================================================

class InventoryRepositoryClass {
  // ===========================================================================
  // SETTINGS
  // ===========================================================================

  async getSettings(userId: string): Promise<InventorySettings | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<InventorySettings>(
      'SELECT * FROM inventory_settings WHERE userId = ?',
      [userId]
    );
    return result || null;
  }

  async upsertSettings(settings: InventorySettings): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO inventory_settings
       (id, userId, isEnabled, deductOnStatus, allowNegativeStock, deductOnlyOncePerWorkOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        settings.id,
        settings.userId,
        settings.isEnabled,
        settings.deductOnStatus,
        settings.allowNegativeStock,
        settings.deductOnlyOncePerWorkOrder,
        settings.createdAt,
        settings.updatedAt,
      ]
    );
  }

  // ===========================================================================
  // BALANCES
  // ===========================================================================

  async getBalances(userId: string): Promise<InventoryBalance[]> {
    const db = await getDatabase();
    // Join with catalog_items to get denormalized data
    const results = await db.getAllAsync<InventoryBalance>(
      `SELECT
        ib.*,
        i.name as itemName,
        i.sku as itemSku,
        i.unit as itemUnit,
        i.type as itemType
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE i.technicianId = ? AND i.isActive = 1
       ORDER BY i.name ASC`,
      [userId]
    );
    return results;
  }

  async getBalanceByItemId(itemId: string): Promise<InventoryBalance | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<InventoryBalance>(
      `SELECT
        ib.*,
        i.name as itemName,
        i.sku as itemSku,
        i.unit as itemUnit,
        i.type as itemType
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE ib.itemId = ?`,
      [itemId]
    );
    return result || null;
  }

  async upsertBalance(balance: InventoryBalance): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO inventory_balances
       (id, itemId, quantity, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        balance.id,
        balance.itemId,
        balance.quantity,
        balance.createdAt,
        balance.updatedAt,
      ]
    );
  }

  async updateBalanceQuantity(itemId: string, newQuantity: number): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE inventory_balances SET quantity = ?, updatedAt = ? WHERE itemId = ?`,
      [newQuantity, now, itemId]
    );
  }

  async searchBalances(
    userId: string,
    query: string,
    limit: number = 50
  ): Promise<InventoryBalance[]> {
    const db = await getDatabase();
    const searchPattern = `%${query}%`;
    const results = await db.getAllAsync<InventoryBalance>(
      `SELECT
        ib.*,
        i.name as itemName,
        i.sku as itemSku,
        i.unit as itemUnit,
        i.type as itemType
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE i.technicianId = ?
         AND i.isActive = 1
         AND (i.name LIKE ? OR i.sku LIKE ?)
       ORDER BY i.name ASC
       LIMIT ?`,
      [userId, searchPattern, searchPattern, limit]
    );
    return results;
  }

  async getLowStockBalances(
    userId: string,
    threshold: number = 5
  ): Promise<InventoryBalance[]> {
    const db = await getDatabase();
    const results = await db.getAllAsync<InventoryBalance>(
      `SELECT
        ib.*,
        i.name as itemName,
        i.sku as itemSku,
        i.unit as itemUnit,
        i.type as itemType
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE i.technicianId = ?
         AND i.isActive = 1
         AND i.type = 'PRODUCT'
         AND ib.quantity <= ?
       ORDER BY ib.quantity ASC`,
      [userId, threshold]
    );
    return results;
  }

  async countBalances(userId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE i.technicianId = ? AND i.isActive = 1 AND i.type = 'PRODUCT'`,
      [userId]
    );
    return result?.count || 0;
  }

  async getTotalQuantity(userId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(ib.quantity), 0) as total
       FROM inventory_balances ib
       LEFT JOIN catalog_items i ON ib.itemId = i.id
       WHERE i.technicianId = ? AND i.isActive = 1 AND i.type = 'PRODUCT'`,
      [userId]
    );
    return result?.total || 0;
  }

  // ===========================================================================
  // MOVEMENTS
  // ===========================================================================

  async getMovements(
    userId: string,
    options: {
      itemId?: string;
      type?: string;
      source?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<InventoryMovement[]> {
    const db = await getDatabase();
    const { itemId, type, source, limit = 50, offset = 0 } = options;

    let sql = `
      SELECT
        im.*,
        i.name as itemName,
        i.sku as itemSku
      FROM inventory_movements im
      LEFT JOIN catalog_items i ON im.itemId = i.id
      WHERE i.technicianId = ?
    `;
    const params: any[] = [userId];

    if (itemId) {
      sql += ' AND im.itemId = ?';
      params.push(itemId);
    }
    if (type) {
      sql += ' AND im.type = ?';
      params.push(type);
    }
    if (source) {
      sql += ' AND im.source = ?';
      params.push(source);
    }

    sql += ' ORDER BY im.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.getAllAsync<InventoryMovement>(sql, params);
  }

  async insertMovement(movement: InventoryMovement): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO inventory_movements
       (id, itemId, type, source, quantity, balanceAfter, sourceId, notes, createdBy, createdAt, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movement.id,
        movement.itemId,
        movement.type,
        movement.source,
        movement.quantity,
        movement.balanceAfter,
        movement.sourceId || null,
        movement.notes || null,
        movement.createdBy || null,
        movement.createdAt,
        movement.syncStatus || 'pending',
      ]
    );
  }

  async getRecentMovements(
    userId: string,
    limit: number = 10
  ): Promise<InventoryMovement[]> {
    return this.getMovements(userId, { limit });
  }

  // ===========================================================================
  // OUTBOX (for offline mutations)
  // ===========================================================================

  async addToOutbox(movement: InventoryMovementOutbox): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO inventory_movements_outbox
       (id, movementId, itemId, type, source, quantity, balanceAfter, sourceId, notes, createdAt, syncStatus, syncAttempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movement.id,
        movement.movementId,
        movement.itemId,
        movement.type,
        movement.source,
        movement.quantity,
        movement.balanceAfter,
        movement.sourceId || null,
        movement.notes || null,
        movement.createdAt,
        movement.syncStatus,
        movement.syncAttempts,
      ]
    );
  }

  async getPendingOutbox(): Promise<InventoryMovementOutbox[]> {
    const db = await getDatabase();
    return db.getAllAsync<InventoryMovementOutbox>(
      `SELECT * FROM inventory_movements_outbox
       WHERE syncStatus IN ('pending', 'error')
       ORDER BY createdAt ASC`
    );
  }

  async updateOutboxStatus(
    id: string,
    status: 'pending' | 'syncing' | 'synced' | 'error',
    error?: string
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE inventory_movements_outbox
       SET syncStatus = ?, syncError = ?, lastSyncAttempt = ?, syncAttempts = syncAttempts + 1
       WHERE id = ?`,
      [status, error || null, now, id]
    );
  }

  async removeFromOutbox(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM inventory_movements_outbox WHERE id = ?', [id]);
  }

  async clearSyncedOutbox(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM inventory_movements_outbox WHERE syncStatus = 'synced'`);
  }

  // ===========================================================================
  // BULK OPERATIONS (for sync)
  // ===========================================================================

  async replaceAllBalances(balances: InventoryBalance[]): Promise<void> {
    const db = await getDatabase();

    await db.runAsync('DELETE FROM inventory_balances');

    for (const balance of balances) {
      await this.upsertBalance(balance);
    }
  }

  async replaceAllMovements(userId: string, movements: InventoryMovement[]): Promise<void> {
    const db = await getDatabase();

    // Only delete synced movements, keep pending ones
    await db.runAsync(
      `DELETE FROM inventory_movements
       WHERE itemId IN (SELECT id FROM catalog_items WHERE technicianId = ?)
       AND (syncStatus IS NULL OR syncStatus = 'synced')`,
      [userId]
    );

    for (const movement of movements) {
      await this.insertMovement({ ...movement, syncStatus: 'synced' });
    }
  }
}

export const InventoryRepository = new InventoryRepositoryClass();
