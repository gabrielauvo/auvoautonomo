// @ts-nocheck
/**
 * Catalog Item Repository
 *
 * Acesso ao banco de dados para itens do catálogo (produtos, serviços, bundles).
 * Suporta operações CRUD com sincronização offline-first.
 */

import type { SQLiteBindValue } from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';
import {
  findAll,
  findById,
  findOne,
  insert,
  update,
  remove,
  count,
  rawQuery,
  getDatabase,
  QueryOptions,
} from '../database';
import { CatalogItem, BundleItem, ItemType } from '../schema';
import { MutationQueue } from '../../queue/MutationQueue';

// Type helper for database operations
type ItemRecord = Record<string, unknown>;
type BundleItemRecord = Record<string, unknown>;

const ITEMS_TABLE = 'catalog_items';
const BUNDLE_ITEMS_TABLE = 'bundle_items';

// =============================================================================
// CATALOG ITEM REPOSITORY
// =============================================================================

export const CatalogItemRepository = {
  /**
   * Buscar todos os itens do técnico
   */
  async getAll(technicianId: string, options: Omit<QueryOptions, 'where'> = {}): Promise<CatalogItem[]> {
    return findAll<CatalogItem>(ITEMS_TABLE, {
      where: { technicianId, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
      ...options,
    });
  },

  /**
   * Buscar todos os itens (incluindo inativos)
   */
  async getAllIncludingInactive(technicianId: string): Promise<CatalogItem[]> {
    return findAll<CatalogItem>(ITEMS_TABLE, {
      where: { technicianId },
      orderBy: 'name',
      order: 'ASC',
    });
  },

  /**
   * Buscar item por ID
   */
  async getById(id: string): Promise<CatalogItem | null> {
    return findById<CatalogItem>(ITEMS_TABLE, id);
  },

  /**
   * Buscar item por ID com bundle items (se for BUNDLE)
   */
  async getByIdWithBundleItems(id: string): Promise<(CatalogItem & { bundleItems?: BundleItem[] }) | null> {
    const item = await findById<CatalogItem>(ITEMS_TABLE, id);
    if (!item) return null;

    if (item.type === 'BUNDLE') {
      const bundleItems = await this.getBundleItems(id);
      return { ...item, bundleItems };
    }

    return item;
  },

  /**
   * Buscar itens por categoria
   */
  async getByCategory(technicianId: string, categoryId: string): Promise<CatalogItem[]> {
    return findAll<CatalogItem>(ITEMS_TABLE, {
      where: { technicianId, categoryId, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
    });
  },

  /**
   * Buscar itens por tipo
   */
  async getByType(technicianId: string, type: ItemType): Promise<CatalogItem[]> {
    return findAll<CatalogItem>(ITEMS_TABLE, {
      where: { technicianId, type, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
    });
  },

  /**
   * Buscar itens por tipo e categoria
   */
  async getByTypeAndCategory(
    technicianId: string,
    type: ItemType,
    categoryId: string
  ): Promise<CatalogItem[]> {
    return findAll<CatalogItem>(ITEMS_TABLE, {
      where: { technicianId, type, categoryId, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
    });
  },

  /**
   * Buscar itens com paginação
   */
  async getPaginated(
    technicianId: string,
    page: number = 1,
    pageSize: number = 50,
    filters?: {
      type?: ItemType;
      categoryId?: string;
      search?: string;
    }
  ): Promise<{ data: CatalogItem[]; total: number; pages: number }> {
    const offset = (page - 1) * pageSize;

    let whereClause = 'technicianId = ? AND isActive = 1';
    const params: SQLiteBindValue[] = [technicianId];

    if (filters?.type) {
      whereClause += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters?.categoryId) {
      whereClause += ' AND categoryId = ?';
      params.push(filters.categoryId);
    }

    if (filters?.search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)';
      const searchQuery = `%${filters.search}%`;
      params.push(searchQuery, searchQuery, searchQuery);
    }

    const [data, totalResult] = await Promise.all([
      rawQuery<CatalogItem>(
        `SELECT * FROM ${ITEMS_TABLE}
         WHERE ${whereClause}
         ORDER BY name ASC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      rawQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${ITEMS_TABLE} WHERE ${whereClause}`,
        params
      ),
    ]);

    const total = totalResult[0]?.count || 0;

    return {
      data,
      total,
      pages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Buscar itens por texto (nome, descrição, SKU)
   */
  async search(
    technicianId: string,
    query: string,
    options?: {
      limit?: number;
      type?: ItemType;
      categoryId?: string;
    }
  ): Promise<CatalogItem[]> {
    const limit = options?.limit || 50;
    const searchQuery = `%${query}%`;

    let whereClause = 'technicianId = ? AND isActive = 1 AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)';
    const params: SQLiteBindValue[] = [technicianId, searchQuery, searchQuery, searchQuery];

    if (options?.type) {
      whereClause += ' AND type = ?';
      params.push(options.type);
    }

    if (options?.categoryId) {
      whereClause += ' AND categoryId = ?';
      params.push(options.categoryId);
    }

    return rawQuery<CatalogItem>(
      `SELECT * FROM ${ITEMS_TABLE}
       WHERE ${whereClause}
       ORDER BY name ASC
       LIMIT ?`,
      [...params, limit]
    );
  },

  /**
   * Contar itens do técnico
   */
  async count(technicianId: string, filters?: { type?: ItemType; categoryId?: string }): Promise<number> {
    const where: Record<string, unknown> = { technicianId, isActive: 1 };
    if (filters?.type) where.type = filters.type;
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    return count(ITEMS_TABLE, where);
  },

  /**
   * Buscar itens modificados após uma data (para sync)
   */
  async getModifiedAfter(
    technicianId: string,
    afterDate: string,
    limit: number = 100
  ): Promise<CatalogItem[]> {
    return rawQuery<CatalogItem>(
      `SELECT * FROM ${ITEMS_TABLE}
       WHERE technicianId = ? AND updatedAt > ?
       ORDER BY updatedAt ASC
       LIMIT ?`,
      [technicianId, afterDate, limit]
    );
  },

  // =============================================================================
  // BUNDLE ITEMS
  // =============================================================================

  /**
   * Buscar itens de um bundle
   */
  async getBundleItems(bundleId: string): Promise<BundleItem[]> {
    return findAll<BundleItem>(BUNDLE_ITEMS_TABLE, {
      where: { bundleId },
    });
  },

  /**
   * Calcular preço total do bundle
   */
  async calculateBundlePrice(bundleId: string): Promise<number> {
    const bundleItems = await this.getBundleItems(bundleId);

    return bundleItems.reduce((total, bi) => {
      const itemPrice = bi.itemBasePrice || 0;
      return total + (itemPrice * bi.quantity);
    }, 0);
  },

  // =============================================================================
  // SYNC METHODS (usado pelo sync engine)
  // =============================================================================

  /**
   * Upsert item (insert or update)
   */
  async upsert(item: CatalogItem): Promise<void> {
    const existing = await findById<CatalogItem>(ITEMS_TABLE, item.id);
    const now = new Date().toISOString();

    if (existing) {
      await update<ItemRecord>(ITEMS_TABLE, item.id, {
        ...item,
        isActive: item.isActive ? 1 : 0,
        syncedAt: now,
      });
    } else {
      await insert<ItemRecord>(ITEMS_TABLE, {
        ...item,
        isActive: item.isActive ? 1 : 0,
        syncedAt: now,
      });
    }
  },

  /**
   * Batch upsert para sync (inclui bundle items)
   */
  async batchUpsert(items: (CatalogItem & { bundleItems?: any[] })[]): Promise<void> {
    if (items.length === 0) return;

    const now = new Date().toISOString();

    for (const item of items) {
      const existing = await findById<CatalogItem>(ITEMS_TABLE, item.id);

      // Separar bundleItems do item principal
      const { bundleItems, ...itemData } = item;

      if (existing) {
        await update<ItemRecord>(ITEMS_TABLE, item.id, {
          ...itemData,
          isActive: item.isActive ? 1 : 0,
          syncedAt: now,
        });
      } else {
        await insert<ItemRecord>(ITEMS_TABLE, {
          ...itemData,
          isActive: item.isActive ? 1 : 0,
          syncedAt: now,
        });
      }

      // Processar bundle items se for um BUNDLE
      if (item.type === 'BUNDLE' && bundleItems && bundleItems.length > 0) {
        // Deletar bundle items existentes
        await rawQuery(`DELETE FROM ${BUNDLE_ITEMS_TABLE} WHERE bundleId = ?`, [item.id]);

        // Inserir novos bundle items
        for (const bi of bundleItems) {
          await insert<BundleItemRecord>(BUNDLE_ITEMS_TABLE, {
            id: bi.id,
            bundleId: item.id,
            itemId: bi.itemId,
            itemName: bi.itemName,
            itemType: bi.itemType,
            itemUnit: bi.itemUnit,
            itemBasePrice: bi.itemBasePrice,
            quantity: bi.quantity,
            createdAt: now,
            technicianId: item.technicianId,
          });
        }
      }
    }
  },

  /**
   * Deletar todos os itens do técnico (para reset de sync)
   */
  async deleteAll(technicianId: string): Promise<void> {
    // Deletar bundle items primeiro
    await rawQuery(
      `DELETE FROM ${BUNDLE_ITEMS_TABLE} WHERE technicianId = ?`,
      [technicianId]
    );
    // Depois deletar items
    await rawQuery(`DELETE FROM ${ITEMS_TABLE} WHERE technicianId = ?`, [technicianId]);
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string): Promise<void> {
    await update<ItemRecord>(ITEMS_TABLE, id, {
      syncedAt: new Date().toISOString(),
    });
  },

  // =============================================================================
  // CRUD OPERATIONS (com enfileiramento de mutações para sync)
  // =============================================================================

  /**
   * Criar novo item (offline-first)
   * Salva localmente e enfileira mutação para sync
   */
  async create(
    technicianId: string,
    data: {
      name: string;
      type: ItemType;
      unit: string;
      basePrice: number;
      categoryId?: string;
      categoryName?: string;
      categoryColor?: string;
      description?: string;
      sku?: string;
      costPrice?: number;
      defaultDurationMinutes?: number;
      bundleItems?: Array<{
        itemId: string;
        quantity: number;
      }>;
    }
  ): Promise<CatalogItem> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    const item: CatalogItem = {
      id,
      technicianId,
      categoryId: data.categoryId || null,
      categoryName: data.categoryName || null,
      categoryColor: data.categoryColor || null,
      name: data.name,
      description: data.description || null,
      type: data.type,
      sku: data.sku || null,
      unit: data.unit,
      basePrice: data.basePrice,
      costPrice: data.costPrice || null,
      defaultDurationMinutes: data.defaultDurationMinutes || null,
      isActive: 1,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };

    // Inserir item no banco
    await db.runAsync(
      `INSERT INTO ${ITEMS_TABLE} (
        id, technicianId, categoryId, categoryName, categoryColor, name, description,
        type, sku, unit, basePrice, costPrice, defaultDurationMinutes,
        isActive, createdAt, updatedAt, syncedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id, technicianId, item.categoryId, item.categoryName, item.categoryColor,
        item.name, item.description, item.type, item.sku, item.unit,
        item.basePrice, item.costPrice, item.defaultDurationMinutes,
        item.isActive, item.createdAt, item.updatedAt, item.syncedAt,
      ]
    );

    // Processar bundle items se for BUNDLE
    const bundleItemsForSync: Array<{ id: string; itemId: string; quantity: number }> = [];
    if (data.type === 'BUNDLE' && data.bundleItems && data.bundleItems.length > 0) {
      for (const bi of data.bundleItems) {
        const bundleItemId = uuidv4();
        bundleItemsForSync.push({
          id: bundleItemId,
          itemId: bi.itemId,
          quantity: bi.quantity,
        });

        // Buscar info do item filho
        const childItem = await findById<CatalogItem>(ITEMS_TABLE, bi.itemId);

        await db.runAsync(
          `INSERT INTO ${BUNDLE_ITEMS_TABLE} (
            id, bundleId, itemId, itemName, itemType, itemUnit, itemBasePrice,
            quantity, createdAt, technicianId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bundleItemId, id, bi.itemId,
            childItem?.name || '', childItem?.type || 'PRODUCT',
            childItem?.unit || 'un', childItem?.basePrice || 0,
            bi.quantity, now, technicianId,
          ]
        );
      }
    }

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('catalogItems', id, 'create', {
      ...item,
      isActive: true,
      bundleItems: bundleItemsForSync,
    });

    return item;
  },

  /**
   * Atualizar item existente (offline-first)
   */
  async updateItem(
    id: string,
    technicianId: string,
    data: Partial<{
      name: string;
      categoryId: string | null;
      categoryName: string | null;
      categoryColor: string | null;
      description: string | null;
      sku: string | null;
      unit: string;
      basePrice: number;
      costPrice: number | null;
      defaultDurationMinutes: number | null;
      isActive: boolean;
      bundleItems?: Array<{ itemId: string; quantity: number }>;
    }>
  ): Promise<CatalogItem | null> {
    const existing = await findById<CatalogItem>(ITEMS_TABLE, id);
    if (!existing || existing.technicianId !== technicianId) {
      return null;
    }

    const db = await getDatabase();
    const now = new Date().toISOString();

    const updatedItem = {
      ...existing,
      ...data,
      isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.isActive,
      updatedAt: now,
    };

    // Atualizar item no banco
    await db.runAsync(
      `UPDATE ${ITEMS_TABLE} SET
        categoryId = ?, categoryName = ?, categoryColor = ?, name = ?, description = ?,
        sku = ?, unit = ?, basePrice = ?, costPrice = ?, defaultDurationMinutes = ?,
        isActive = ?, updatedAt = ?
       WHERE id = ?`,
      [
        updatedItem.categoryId, updatedItem.categoryName, updatedItem.categoryColor,
        updatedItem.name, updatedItem.description, updatedItem.sku, updatedItem.unit,
        updatedItem.basePrice, updatedItem.costPrice, updatedItem.defaultDurationMinutes,
        updatedItem.isActive, updatedItem.updatedAt, id,
      ]
    );

    // Atualizar bundle items se for BUNDLE
    const bundleItemsForSync: Array<{ id: string; itemId: string; quantity: number }> = [];
    if (existing.type === 'BUNDLE' && data.bundleItems) {
      // Deletar bundle items existentes
      await db.runAsync(`DELETE FROM ${BUNDLE_ITEMS_TABLE} WHERE bundleId = ?`, [id]);

      // Inserir novos bundle items
      for (const bi of data.bundleItems) {
        const bundleItemId = uuidv4();
        bundleItemsForSync.push({
          id: bundleItemId,
          itemId: bi.itemId,
          quantity: bi.quantity,
        });

        const childItem = await findById<CatalogItem>(ITEMS_TABLE, bi.itemId);

        await db.runAsync(
          `INSERT INTO ${BUNDLE_ITEMS_TABLE} (
            id, bundleId, itemId, itemName, itemType, itemUnit, itemBasePrice,
            quantity, createdAt, technicianId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bundleItemId, id, bi.itemId,
            childItem?.name || '', childItem?.type || 'PRODUCT',
            childItem?.unit || 'un', childItem?.basePrice || 0,
            bi.quantity, now, technicianId,
          ]
        );
      }
    }

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('catalogItems', id, 'update', {
      ...updatedItem,
      isActive: updatedItem.isActive === 1,
      bundleItems: bundleItemsForSync.length > 0 ? bundleItemsForSync : undefined,
    });

    return updatedItem;
  },

  /**
   * Deletar item (soft delete se em uso, hard delete se não)
   */
  async deleteItem(id: string, technicianId: string): Promise<boolean> {
    const existing = await findById<CatalogItem>(ITEMS_TABLE, id);
    if (!existing || existing.technicianId !== technicianId) {
      return false;
    }

    const db = await getDatabase();
    const now = new Date().toISOString();

    // Soft delete (apenas marcar como inativo)
    await db.runAsync(
      `UPDATE ${ITEMS_TABLE} SET isActive = 0, updatedAt = ? WHERE id = ?`,
      [now, id]
    );

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('catalogItems', id, 'delete', {
      id,
    });

    return true;
  },

  /**
   * Buscar itens disponíveis para adicionar a um bundle
   * (exclui bundles e o próprio item)
   */
  async getAvailableForBundle(
    technicianId: string,
    excludeId?: string,
    search?: string
  ): Promise<CatalogItem[]> {
    let whereClause = "technicianId = ? AND isActive = 1 AND type != 'BUNDLE'";
    const params: SQLiteBindValue[] = [technicianId];

    if (excludeId) {
      whereClause += ' AND id != ?';
      params.push(excludeId);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR sku LIKE ?)';
      const searchQuery = `%${search}%`;
      params.push(searchQuery, searchQuery);
    }

    return rawQuery<CatalogItem>(
      `SELECT * FROM ${ITEMS_TABLE}
       WHERE ${whereClause}
       ORDER BY name ASC
       LIMIT 50`,
      params
    );
  },
};

export default CatalogItemRepository;
