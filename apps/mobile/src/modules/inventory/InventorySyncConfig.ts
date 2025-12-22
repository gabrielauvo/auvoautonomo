// @ts-nocheck
/**
 * Inventory Sync Configuration
 *
 * Configuração de sincronização para dados de estoque:
 * - Settings: Pull-only (configuração vem do servidor)
 * - Balances: Pull-only (saldo oficial vem do servidor)
 * - Movements: Bidirectional (criados offline, synced para servidor)
 */

import { SyncEntityConfig } from '../../sync/types';
import { getDatabase } from '../../db';
import {
  InventoryRepository,
  InventorySettings,
  InventoryBalance,
  InventoryMovement,
} from './InventoryRepository';

// =============================================================================
// SETTINGS SYNC (Pull-only)
// =============================================================================

export const InventorySettingsSyncConfig: SyncEntityConfig<InventorySettings> = {
  name: 'inventorySettings',
  tableName: 'inventory_settings',
  apiEndpoint: '/sync/inventory/settings',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'userId',
  batchSize: 1, // Only one settings record per user
  conflictResolution: 'server_wins',

  transformFromServer: (data: unknown): InventorySettings => {
    const record = data as Record<string, unknown>;
    return {
      id: record.id as string,
      userId: record.userId as string,
      isEnabled: record.isEnabled ? 1 : 0,
      deductOnStatus: record.deductOnStatus as string || 'DONE',
      allowNegativeStock: record.allowNegativeStock ? 1 : 0,
      deductOnlyOncePerWorkOrder: record.deductOnlyOncePerWorkOrder !== false ? 1 : 0,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
    };
  },

  customSave: async (data: InventorySettings[], technicianId: string): Promise<void> => {
    for (const settings of data) {
      await InventoryRepository.upsertSettings(settings);
    }
  },
};

// =============================================================================
// BALANCES SYNC (Pull-only, server is source of truth)
// =============================================================================

export const InventoryBalancesSyncConfig: SyncEntityConfig<InventoryBalance> = {
  name: 'inventoryBalances',
  tableName: 'inventory_balances',
  apiEndpoint: '/sync/inventory/balances',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'itemId', // Scoped by item, which is scoped by user
  batchSize: 200,
  conflictResolution: 'server_wins',

  transformFromServer: (data: unknown): InventoryBalance => {
    const record = data as Record<string, unknown>;
    return {
      id: record.id as string,
      itemId: record.itemId as string,
      quantity: Number(record.quantity) || 0,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
      // Denormalized fields from server
      itemName: record.itemName as string | undefined,
      itemSku: record.itemSku as string | undefined,
      itemUnit: record.itemUnit as string | undefined,
      itemType: record.itemType as string | undefined,
    };
  },

  customSave: async (data: InventoryBalance[], technicianId: string): Promise<void> => {
    // Replace all balances with server data
    // This ensures local cache matches server
    if (data.length > 0) {
      await InventoryRepository.replaceAllBalances(data);
    }
  },
};

// =============================================================================
// MOVEMENTS SYNC (Bidirectional)
// =============================================================================

export const InventoryMovementsSyncConfig: SyncEntityConfig<InventoryMovement> = {
  name: 'inventoryMovements',
  tableName: 'inventory_movements',
  apiEndpoint: '/sync/inventory/movements',
  apiMutationEndpoint: '/sync/inventory/movements',
  cursorField: 'createdAt',
  primaryKeys: ['id'],
  scopeField: 'itemId',
  batchSize: 100,
  conflictResolution: 'server_wins',

  transformFromServer: (data: unknown): InventoryMovement => {
    const record = data as Record<string, unknown>;
    return {
      id: record.id as string,
      itemId: record.itemId as string,
      type: record.type as InventoryMovement['type'],
      source: record.source as InventoryMovement['source'],
      quantity: Number(record.quantity) || 0,
      balanceAfter: Number(record.balanceAfter) || 0,
      sourceId: record.sourceId as string | undefined,
      notes: record.notes as string | undefined,
      createdBy: record.createdBy as string | undefined,
      createdAt: record.createdAt as string,
      syncStatus: 'synced',
      // Denormalized
      itemName: record.itemName as string | undefined,
      itemSku: record.itemSku as string | undefined,
    };
  },

  transformToServer: (data: InventoryMovement): unknown => {
    return {
      id: data.id,
      itemId: data.itemId,
      type: data.type,
      source: data.source,
      quantity: data.quantity,
      balanceAfter: data.balanceAfter,
      sourceId: data.sourceId || null,
      notes: data.notes || null,
      createdAt: data.createdAt,
    };
  },

  customSave: async (data: InventoryMovement[], technicianId: string): Promise<void> => {
    const db = getDatabase();

    for (const movement of data) {
      // Check if this movement already exists (synced or pending)
      const existing = db.getFirstSync<{ id: string }>(
        'SELECT id FROM inventory_movements WHERE id = ?',
        [movement.id]
      );

      if (!existing) {
        await InventoryRepository.insertMovement(movement);
      }
    }
  },
};

// =============================================================================
// SYNC SERVICE
// =============================================================================

export class InventorySyncService {
  private baseUrl: string = '';
  private authToken: string = '';

  configure(baseUrl: string, authToken: string): void {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  /**
   * Push pending movements to server
   */
  async pushPendingMovements(): Promise<{ success: number; failed: number }> {
    const pending = await InventoryRepository.getPendingOutbox();

    if (pending.length === 0) {
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        await InventoryRepository.updateOutboxStatus(item.id, 'syncing');

        const response = await fetch(`${this.baseUrl}/inventory/movements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.authToken}`,
          },
          body: JSON.stringify({
            id: item.movementId,
            itemId: item.itemId,
            type: item.type,
            source: item.source,
            quantity: item.quantity,
            balanceAfter: item.balanceAfter,
            sourceId: item.sourceId,
            notes: item.notes,
            createdAt: item.createdAt,
          }),
        });

        if (response.ok) {
          await InventoryRepository.removeFromOutbox(item.id);
          success++;
        } else {
          const errorText = await response.text();
          await InventoryRepository.updateOutboxStatus(item.id, 'error', errorText);
          failed++;
        }
      } catch (error: any) {
        await InventoryRepository.updateOutboxStatus(
          item.id,
          'error',
          error.message || 'Network error'
        );
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Pull latest balances from server
   */
  async pullBalances(): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/inventory/balances`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.status}`);
      }

      const data = await response.json();
      const balances: InventoryBalance[] = (data.items || []).map((item: any) => ({
        id: item.id,
        itemId: item.itemId,
        quantity: Number(item.quantity) || 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        itemName: item.itemName,
        itemSku: item.itemSku,
        itemUnit: item.itemUnit,
        itemType: item.itemType,
      }));

      await InventoryRepository.replaceAllBalances(balances);
      return balances.length;
    } catch (error) {
      console.error('[InventorySyncService] Failed to pull balances:', error);
      throw error;
    }
  }

  /**
   * Pull latest settings from server
   */
  async pullSettings(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/inventory/settings`, {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (response.status === 404) {
        // No settings yet - feature not enabled
        return false;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.status}`);
      }

      const data = await response.json();
      const settings: InventorySettings = {
        id: data.id,
        userId: data.userId,
        isEnabled: data.isEnabled ? 1 : 0,
        deductOnStatus: data.deductOnStatus || 'DONE',
        allowNegativeStock: data.allowNegativeStock ? 1 : 0,
        deductOnlyOncePerWorkOrder: data.deductOnlyOncePerWorkOrder !== false ? 1 : 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      await InventoryRepository.upsertSettings(settings);
      return true;
    } catch (error) {
      console.error('[InventorySyncService] Failed to pull settings:', error);
      throw error;
    }
  }

  /**
   * Full sync: push pending, then pull latest
   */
  async fullSync(): Promise<void> {
    // 1. Push pending movements first
    const pushResult = await this.pushPendingMovements();
    console.log(`[InventorySyncService] Push result: ${pushResult.success} success, ${pushResult.failed} failed`);

    // 2. Pull latest data
    await this.pullSettings();
    await this.pullBalances();

    console.log('[InventorySyncService] Full sync completed');
  }
}

// Singleton instance
export const inventorySyncService = new InventorySyncService();

export default inventorySyncService;
