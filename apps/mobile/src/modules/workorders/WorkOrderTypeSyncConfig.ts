/**
 * WorkOrderTypeSyncConfig
 *
 * Configuração de sincronização para Tipos de Ordem de Serviço.
 * Os tipos são sincronizados apenas do servidor (read-only no mobile).
 * Não suporta mutações locais - apenas pull do servidor.
 */

import { SyncEntityConfig } from '../../sync/types';
import { WorkOrderType } from '../../db/schema';
import { getDatabase } from '../../db/database';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerWorkOrderType {
  id: string;
  userId: string; // Maps to technicianId
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServerPullResponse {
  items: ServerWorkOrderType[];
  nextCursor: string | null;
  serverTime: string;
  hasMore: boolean;
  total: number;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const WorkOrderTypeSyncConfig: SyncEntityConfig<WorkOrderType> = {
  name: 'work_order_types',
  tableName: 'work_order_types',
  apiEndpoint: '/work-order-types/sync',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'server_wins', // Types are read-only on mobile

  /**
   * Transform server response to local format
   */
  transformFromServer: (data: unknown): WorkOrderType => {
    const serverItem = data as ServerWorkOrderType;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = serverItem.isActive !== false && (serverItem.isActive as unknown) !== 0;
    return {
      id: serverItem.id,
      name: serverItem.name,
      description: serverItem.description,
      color: serverItem.color,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      technicianId: serverItem.userId,
    } as unknown as WorkOrderType;
  },

  /**
   * Transform local item to server format
   * Note: WorkOrderTypes are read-only on mobile, this is just for completeness
   */
  transformToServer: (localItem: WorkOrderType): unknown => {
    return {
      id: localItem.id,
      name: localItem.name,
      description: localItem.description,
      color: localItem.color,
    };
  },

  /**
   * Custom save handler to store work order types
   */
  customSave: async (data: unknown[], technicianId: string): Promise<void> => {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const item of data) {
      const serverType = item as ServerWorkOrderType;
      const isActiveValue = serverType.isActive !== false && (serverType.isActive as unknown) !== 0;

      await db.runAsync(
        `INSERT OR REPLACE INTO work_order_types
         (id, name, description, color, isActive, createdAt, updatedAt, technicianId, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverType.id,
          serverType.name,
          serverType.description || null,
          serverType.color || null,
          isActiveValue ? 1 : 0,
          serverType.createdAt,
          serverType.updatedAt,
          serverType.userId, // Maps to technicianId
          now,
        ]
      );
    }

    console.log(`[WorkOrderTypeSync] Saved ${data.length} work order types`);
  },
};

// =============================================================================
// REPOSITORY FUNCTIONS
// =============================================================================

/**
 * Get all active work order types for the current technician
 */
export async function getActiveWorkOrderTypes(technicianId: string): Promise<WorkOrderType[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<WorkOrderType>(
    `SELECT * FROM work_order_types
     WHERE technicianId = ? AND isActive = 1
     ORDER BY name ASC`,
    [technicianId]
  );
  return result || [];
}

/**
 * Get a work order type by ID
 */
export async function getWorkOrderTypeById(id: string): Promise<WorkOrderType | null> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<WorkOrderType>(
    'SELECT * FROM work_order_types WHERE id = ?',
    [id]
  );
  return result || null;
}

/**
 * Get all work order types for the current technician (including inactive)
 */
export async function getAllWorkOrderTypes(technicianId: string): Promise<WorkOrderType[]> {
  const db = await getDatabase();
  const result = await db.getAllAsync<WorkOrderType>(
    `SELECT * FROM work_order_types
     WHERE technicianId = ?
     ORDER BY name ASC`,
    [technicianId]
  );
  return result || [];
}

// =============================================================================
// EXPORT
// =============================================================================

export default WorkOrderTypeSyncConfig;
