// @ts-nocheck
/**
 * Category Sync Configuration
 *
 * Configuração da entidade ProductCategory para sincronização bidirecional.
 * Categories podem ser criadas no web ou no mobile e sincronizadas entre ambos.
 */

import { SyncEntityConfig } from '../types';

// =============================================================================
// CATEGORY TYPES
// =============================================================================

export interface SyncCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  // Local fields
  syncedAt?: string;
  technicianId: string;
}

// =============================================================================
// SYNC CONFIGURATION
// =============================================================================

export const CategorySyncConfig: SyncEntityConfig<SyncCategory> = {
  name: 'categories',
  tableName: 'product_categories',
  apiEndpoint: '/sync/categories',
  apiMutationEndpoint: '/sync/categories', // Bidirectional sync - mobile can create/update/delete
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'server_wins', // Server is authoritative for catalog

  /**
   * Transform server data to local format
   */
  transformFromServer: (data: unknown): SyncCategory => {
    const record = data as Record<string, unknown>;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = record.isActive !== false && record.isActive !== 0;
    return {
      id: record.id as string,
      name: record.name as string,
      description: record.description as string | undefined,
      color: record.color as string | undefined,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      itemCount: record.itemCount as number | undefined,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      technicianId: record.technicianId as string,
    } as unknown as SyncCategory;
  },

  /**
   * Transform local data to server format for mutations
   */
  transformToServer: (data: SyncCategory): unknown => {
    return {
      id: data.id,
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      isActive: data.isActive === 1 || data.isActive === true,
    };
  },
};

export default CategorySyncConfig;
