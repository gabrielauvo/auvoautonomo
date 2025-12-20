// @ts-nocheck
/**
 * Catalog Item Sync Configuration
 *
 * Configuração da entidade CatalogItem para sincronização bidirecional.
 * Items podem ser criados no web ou no mobile e sincronizados entre ambos.
 * Inclui produtos, serviços e bundles.
 */

import { SyncEntityConfig } from '../types';
import { rawQuery, getDatabase } from '../../db';

// =============================================================================
// CATALOG ITEM TYPES
// =============================================================================

export type ItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

export interface SyncBundleItem {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string;
  itemUnit: string;
  itemBasePrice: number;
  quantity: number;
}

export interface SyncCatalogItem {
  id: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  name: string;
  description?: string;
  type: ItemType;
  sku?: string;
  unit: string;
  basePrice: number;
  costPrice?: number;
  defaultDurationMinutes?: number;
  isActive: boolean;
  bundleItems?: SyncBundleItem[];
  createdAt: string;
  updatedAt: string;
  // Local fields
  syncedAt?: string;
  technicianId: string;
}

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export const CatalogItemSyncConfig: SyncEntityConfig<SyncCatalogItem> = {
  name: 'catalogItems',
  tableName: 'catalog_items',
  apiEndpoint: '/sync/items',
  apiMutationEndpoint: '/sync/items', // Bidirectional sync - mobile can create/update/delete
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'server_wins', // Server is authoritative for catalog

  /**
   * Transform server data to local format
   *
   * Handles:
   * - isActive boolean → integer conversion
   * - bundleItems denormalization
   */
  transformFromServer: (data: unknown): SyncCatalogItem => {
    const record = data as Record<string, unknown>;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = record.isActive !== false && record.isActive !== 0;
    return {
      id: record.id as string,
      categoryId: record.categoryId as string | undefined,
      categoryName: record.categoryName as string | undefined,
      categoryColor: record.categoryColor as string | undefined,
      name: record.name as string,
      description: record.description as string | undefined,
      type: record.type as ItemType,
      sku: record.sku as string | undefined,
      unit: record.unit as string,
      basePrice: record.basePrice as number,
      costPrice: record.costPrice as number | undefined,
      defaultDurationMinutes: record.defaultDurationMinutes as number | undefined,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      bundleItems: record.bundleItems as SyncBundleItem[] | undefined,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      technicianId: record.technicianId as string,
    } as unknown as SyncCatalogItem;
  },

  /**
   * Transform local data to server format for mutations
   */
  transformToServer: (data: SyncCatalogItem): unknown => {
    return {
      id: data.id,
      categoryId: data.categoryId || null,
      name: data.name,
      description: data.description || null,
      type: data.type,
      sku: data.sku || null,
      unit: data.unit,
      basePrice: data.basePrice,
      costPrice: data.costPrice || null,
      defaultDurationMinutes: data.defaultDurationMinutes || null,
      isActive: data.isActive === 1 || data.isActive === true,
      bundleItems: data.bundleItems || [],
    };
  },

  /**
   * Custom save handler for items with bundle items
   * Override the default save to handle bundle items separately
   */
  customSave: async (data: SyncCatalogItem[], technicianId: string): Promise<void> => {
    if (data.length === 0) return;

    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const item of data) {
      // Extract bundleItems for separate processing
      const { bundleItems, ...itemData } = item;

      // Insert/update the catalog item
      const columns = [
        'id', 'categoryId', 'categoryName', 'categoryColor', 'name', 'description',
        'type', 'sku', 'unit', 'basePrice', 'costPrice', 'defaultDurationMinutes',
        'isActive', 'createdAt', 'updatedAt', 'syncedAt', 'technicianId',
      ];

      const values = [
        itemData.id,
        itemData.categoryId || null,
        itemData.categoryName || null,
        itemData.categoryColor || null,
        itemData.name,
        itemData.description || null,
        itemData.type,
        itemData.sku || null,
        itemData.unit,
        itemData.basePrice,
        itemData.costPrice || null,
        itemData.defaultDurationMinutes || null,
        itemData.isActive,
        itemData.createdAt,
        itemData.updatedAt,
        now,
        technicianId,
      ];

      const placeholders = columns.map(() => '?').join(', ');
      await db.runAsync(
        `INSERT OR REPLACE INTO catalog_items (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );

      // Process bundle items for BUNDLE type
      if (item.type === 'BUNDLE' && bundleItems && bundleItems.length > 0) {
        // Delete existing bundle items for this bundle
        await db.runAsync('DELETE FROM bundle_items WHERE bundleId = ?', [item.id]);

        // Insert new bundle items
        for (const bi of bundleItems) {
          const bundleItemColumns = [
            'id', 'bundleId', 'itemId', 'itemName', 'itemType', 'itemUnit',
            'itemBasePrice', 'quantity', 'createdAt', 'technicianId',
          ];

          const bundleItemValues = [
            bi.id,
            item.id,
            bi.itemId,
            bi.itemName,
            bi.itemType,
            bi.itemUnit,
            bi.itemBasePrice,
            bi.quantity,
            now,
            technicianId,
          ];

          const biPlaceholders = bundleItemColumns.map(() => '?').join(', ');
          await db.runAsync(
            `INSERT OR REPLACE INTO bundle_items (${bundleItemColumns.join(', ')}) VALUES (${biPlaceholders})`,
            bundleItemValues
          );
        }
      }
    }
  },
};

export default CatalogItemSyncConfig;
