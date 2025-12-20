// @ts-nocheck
/**
 * Category Repository
 *
 * Acesso ao banco de dados para categorias de produtos/serviços.
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
import { ProductCategory } from '../schema';
import { MutationQueue } from '../../queue/MutationQueue';

// Type helper for database operations
type CategoryRecord = Record<string, unknown>;

const TABLE = 'product_categories';

// =============================================================================
// REPOSITORY
// =============================================================================

export const CategoryRepository = {
  /**
   * Buscar todas as categorias do técnico
   */
  async getAll(technicianId: string, options: Omit<QueryOptions, 'where'> = {}): Promise<ProductCategory[]> {
    return findAll<ProductCategory>(TABLE, {
      where: { technicianId, isActive: 1 },
      orderBy: 'name',
      order: 'ASC',
      ...options,
    });
  },

  /**
   * Buscar todas as categorias (incluindo inativas)
   */
  async getAllIncludingInactive(technicianId: string): Promise<ProductCategory[]> {
    return findAll<ProductCategory>(TABLE, {
      where: { technicianId },
      orderBy: 'name',
      order: 'ASC',
    });
  },

  /**
   * Buscar categoria por ID
   */
  async getById(id: string): Promise<ProductCategory | null> {
    return findById<ProductCategory>(TABLE, id);
  },

  /**
   * Buscar categoria por nome
   */
  async getByName(name: string, technicianId: string): Promise<ProductCategory | null> {
    return findOne<ProductCategory>(TABLE, { name, technicianId });
  },

  /**
   * Buscar categorias por texto (nome, descrição)
   */
  async search(
    technicianId: string,
    query: string,
    limit: number = 50
  ): Promise<ProductCategory[]> {
    const searchQuery = `%${query}%`;

    return rawQuery<ProductCategory>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND isActive = 1
       AND (name LIKE ? OR description LIKE ?)
       ORDER BY name ASC
       LIMIT ?`,
      [technicianId, searchQuery, searchQuery, limit]
    );
  },

  /**
   * Contar categorias do técnico
   */
  async count(technicianId: string): Promise<number> {
    return count(TABLE, { technicianId, isActive: 1 });
  },

  /**
   * Buscar categorias modificadas após uma data (para sync)
   */
  async getModifiedAfter(
    technicianId: string,
    afterDate: string,
    limit: number = 100
  ): Promise<ProductCategory[]> {
    return rawQuery<ProductCategory>(
      `SELECT * FROM ${TABLE}
       WHERE technicianId = ? AND updatedAt > ?
       ORDER BY updatedAt ASC
       LIMIT ?`,
      [technicianId, afterDate, limit]
    );
  },

  // =============================================================================
  // SYNC METHODS (usado pelo sync engine)
  // =============================================================================

  /**
   * Upsert categoria (insert or update)
   */
  async upsert(category: ProductCategory): Promise<void> {
    const existing = await findById<ProductCategory>(TABLE, category.id);
    const now = new Date().toISOString();

    if (existing) {
      await update<CategoryRecord>(TABLE, category.id, {
        ...category,
        isActive: category.isActive ? 1 : 0,
        syncedAt: now,
      });
    } else {
      await insert<CategoryRecord>(TABLE, {
        ...category,
        isActive: category.isActive ? 1 : 0,
        syncedAt: now,
      });
    }
  },

  /**
   * Batch upsert para sync
   */
  async batchUpsert(categories: ProductCategory[]): Promise<void> {
    if (categories.length === 0) return;

    const now = new Date().toISOString();

    for (const category of categories) {
      const existing = await findById<ProductCategory>(TABLE, category.id);

      if (existing) {
        await update<CategoryRecord>(TABLE, category.id, {
          ...category,
          isActive: category.isActive ? 1 : 0,
          syncedAt: now,
        });
      } else {
        await insert<CategoryRecord>(TABLE, {
          ...category,
          isActive: category.isActive ? 1 : 0,
          syncedAt: now,
        });
      }
    }
  },

  /**
   * Deletar todas as categorias do técnico (para reset de sync)
   */
  async deleteAll(technicianId: string): Promise<void> {
    await rawQuery(`DELETE FROM ${TABLE} WHERE technicianId = ?`, [technicianId]);
  },

  /**
   * Marcar como sincronizado
   */
  async markSynced(id: string): Promise<void> {
    await update<CategoryRecord>(TABLE, id, {
      syncedAt: new Date().toISOString(),
    });
  },

  // =============================================================================
  // CRUD OPERATIONS (com enfileiramento de mutações para sync)
  // =============================================================================

  /**
   * Criar nova categoria (offline-first)
   */
  async create(
    technicianId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
    }
  ): Promise<ProductCategory> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    const category: ProductCategory = {
      id,
      technicianId,
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      isActive: 1,
      itemCount: 0,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };

    await db.runAsync(
      `INSERT INTO ${TABLE} (
        id, technicianId, name, description, color, isActive, createdAt, updatedAt, syncedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.id, technicianId, category.name, category.description,
        category.color, category.isActive, category.createdAt,
        category.updatedAt, category.syncedAt,
      ]
    );

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('categories', id, 'create', {
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      isActive: true,
    });

    return category;
  },

  /**
   * Atualizar categoria existente (offline-first)
   */
  async updateCategory(
    id: string,
    technicianId: string,
    data: Partial<{
      name: string;
      description: string | null;
      color: string | null;
      isActive: boolean;
    }>
  ): Promise<ProductCategory | null> {
    const existing = await findById<ProductCategory>(TABLE, id);
    if (!existing || existing.technicianId !== technicianId) {
      return null;
    }

    const db = await getDatabase();
    const now = new Date().toISOString();

    const updatedCategory = {
      ...existing,
      ...data,
      isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : existing.isActive,
      updatedAt: now,
    };

    await db.runAsync(
      `UPDATE ${TABLE} SET name = ?, description = ?, color = ?, isActive = ?, updatedAt = ? WHERE id = ?`,
      [
        updatedCategory.name, updatedCategory.description, updatedCategory.color,
        updatedCategory.isActive, updatedCategory.updatedAt, id,
      ]
    );

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('categories', id, 'update', {
      id,
      name: updatedCategory.name,
      description: updatedCategory.description,
      color: updatedCategory.color,
      isActive: updatedCategory.isActive === 1,
    });

    return updatedCategory;
  },

  /**
   * Deletar categoria (soft delete se tiver itens, hard delete se não)
   */
  async deleteCategory(id: string, technicianId: string): Promise<boolean> {
    const existing = await findById<ProductCategory>(TABLE, id);
    if (!existing || existing.technicianId !== technicianId) {
      return false;
    }

    const db = await getDatabase();
    const now = new Date().toISOString();

    // Verificar se tem itens
    const itemCountResult = await rawQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM catalog_items WHERE categoryId = ? AND isActive = 1',
      [id]
    );
    const hasItems = (itemCountResult[0]?.count || 0) > 0;

    if (hasItems) {
      // Soft delete
      await db.runAsync(
        `UPDATE ${TABLE} SET isActive = 0, updatedAt = ? WHERE id = ?`,
        [now, id]
      );
    } else {
      // Hard delete
      await db.runAsync(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
    }

    // Enfileirar mutação para sync
    await MutationQueue.enqueue('categories', id, 'delete', { id });

    return true;
  },
};

export default CategoryRepository;
