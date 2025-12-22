/**
 * WorkOrderSyncConfig
 *
 * Configuração de sincronização para Ordens de Serviço.
 * Implementa EntitySyncConfig para integração com SyncEngine.
 */

import { SyncEntityConfig } from '../../sync/types';
import { WorkOrder, WorkOrderStatus, WorkOrderItem } from '../../db/schema';
import { workOrderRepository } from './WorkOrderRepository';
import { getDatabase } from '../../db/database';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerWorkOrderItem {
  id: string;
  workOrderId: string;
  itemId?: string;
  quoteItemId?: string;
  name: string;
  type: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface ServerWorkOrder {
  id: string;
  technicianId: string;
  clientId: string;
  quoteId?: string;
  workOrderTypeId?: string;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  executionStart?: string;
  executionEnd?: string;
  address?: string;
  notes?: string;
  totalValue?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  // Denormalized client data
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  // Denormalized work order type data
  workOrderTypeName?: string;
  workOrderTypeColor?: string;
  // Work order items (catalog items)
  items?: ServerWorkOrderItem[];
}

interface ServerPullResponse {
  items: ServerWorkOrder[];
  nextCursor: string | null;
  serverTime: string;
  hasMore: boolean;
  total: number;
}

interface MutationRecord {
  id?: string;
  clientId?: string;
  workOrderTypeId?: string | null;
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  executionStart?: string;
  executionEnd?: string;
  address?: string;
  notes?: string;
}

interface ServerMutation {
  mutationId: string;
  action: 'create' | 'update' | 'delete' | 'update_status';
  record: MutationRecord;
  clientUpdatedAt: string;
}

interface MutationResult {
  mutationId: string;
  status: 'applied' | 'rejected';
  record?: ServerWorkOrder;
  error?: string;
}

interface ServerPushResponse {
  results: MutationResult[];
  serverTime: string;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const WorkOrderSyncConfig: SyncEntityConfig<WorkOrder> = {
  name: 'work_orders',
  tableName: 'work_orders',
  apiEndpoint: '/work-orders/sync',
  apiMutationEndpoint: '/work-orders/sync/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 100,
  conflictResolution: 'last_write_wins',

  /**
   * Transform server response to local format
   */
  transformFromServer: (data: unknown): WorkOrder => {
    const serverItem = data as ServerWorkOrder;
    // Convert isActive to integer (1/0) for SQLite storage
    const isActiveValue = serverItem.isActive !== false && (serverItem.isActive as unknown) !== 0;
    return {
      id: serverItem.id,
      clientId: serverItem.clientId,
      quoteId: serverItem.quoteId,
      workOrderTypeId: serverItem.workOrderTypeId,
      title: serverItem.title,
      description: serverItem.description,
      status: serverItem.status,
      scheduledDate: serverItem.scheduledDate,
      scheduledStartTime: serverItem.scheduledStartTime,
      scheduledEndTime: serverItem.scheduledEndTime,
      executionStart: serverItem.executionStart,
      executionEnd: serverItem.executionEnd,
      address: serverItem.address,
      notes: serverItem.notes,
      totalValue: serverItem.totalValue,
      isActive: isActiveValue ? 1 : 0, // Store as integer for SQLite
      deletedAt: serverItem.deletedAt,
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      technicianId: serverItem.technicianId,
      clientName: serverItem.clientName,
      clientPhone: serverItem.clientPhone,
      clientAddress: serverItem.clientAddress,
      workOrderTypeName: serverItem.workOrderTypeName,
      workOrderTypeColor: serverItem.workOrderTypeColor,
    } as unknown as WorkOrder;
  },

  /**
   * Transform local item to server mutation format
   * IMPORTANTE: Só enviar campos que o backend aceita no MutationRecord
   * NÃO enviar: isActive, createdAt, updatedAt, technicianId, deletedAt
   */
  transformToServer: (localItem: WorkOrder): unknown => {
    return {
      id: localItem.id,
      clientId: localItem.clientId,
      workOrderTypeId: localItem.workOrderTypeId || null,
      title: localItem.title,
      description: localItem.description,
      status: localItem.status,
      scheduledDate: localItem.scheduledDate,
      scheduledStartTime: localItem.scheduledStartTime,
      scheduledEndTime: localItem.scheduledEndTime,
      executionStart: localItem.executionStart,
      executionEnd: localItem.executionEnd,
      address: localItem.address,
      notes: localItem.notes,
    };
  },

  /**
   * Custom save handler to store work orders and their items
   * The server returns items[] array with each work order
   */
  customSave: async (data: unknown[], technicianId: string): Promise<void> => {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Process each work order with its items
    for (const item of data) {
      const serverWO = item as ServerWorkOrder;
      const isActiveValue = serverWO.isActive !== false && (serverWO.isActive as unknown) !== 0;

      // Insert/update work order
      await db.runAsync(
        `INSERT OR REPLACE INTO work_orders
         (id, clientId, quoteId, workOrderTypeId, title, description, status,
          scheduledDate, scheduledStartTime, scheduledEndTime,
          executionStart, executionEnd, address, notes, totalValue,
          isActive, deletedAt, createdAt, updatedAt, technicianId,
          clientName, clientPhone, clientAddress,
          workOrderTypeName, workOrderTypeColor, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverWO.id,
          serverWO.clientId,
          serverWO.quoteId || null,
          serverWO.workOrderTypeId || null,
          serverWO.title,
          serverWO.description || null,
          serverWO.status,
          serverWO.scheduledDate || null,
          serverWO.scheduledStartTime || null,
          serverWO.scheduledEndTime || null,
          serverWO.executionStart || null,
          serverWO.executionEnd || null,
          serverWO.address || null,
          serverWO.notes || null,
          serverWO.totalValue || null,
          isActiveValue ? 1 : 0,
          serverWO.deletedAt || null,
          serverWO.createdAt,
          serverWO.updatedAt,
          serverWO.technicianId,
          serverWO.clientName || null,
          serverWO.clientPhone || null,
          serverWO.clientAddress || null,
          serverWO.workOrderTypeName || null,
          serverWO.workOrderTypeColor || null,
          now,
        ]
      );

      // Process work order items if present
      if (serverWO.items && serverWO.items.length > 0) {
        // Delete existing items for this work order (full replace strategy)
        await db.runAsync(
          'DELETE FROM work_order_items WHERE workOrderId = ?',
          [serverWO.id]
        );

        // Insert new items
        for (const woItem of serverWO.items) {
          await db.runAsync(
            `INSERT INTO work_order_items
             (id, workOrderId, itemId, quoteItemId, name, type, unit,
              quantity, unitPrice, discountValue, totalPrice,
              createdAt, updatedAt, syncedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              woItem.id,
              woItem.workOrderId,
              woItem.itemId || null,
              woItem.quoteItemId || null,
              woItem.name,
              woItem.type,
              woItem.unit,
              woItem.quantity,
              woItem.unitPrice,
              woItem.discountValue || 0,
              woItem.totalPrice,
              woItem.createdAt,
              woItem.updatedAt,
              now,
            ]
          );
        }

        console.log(`[WorkOrderSync] Saved ${serverWO.items.length} items for WO ${serverWO.id}`);
      }
    }
  },
};

/**
 * Scope Strategy:
 * - Default: date_range (-30 to +60 days)
 * - Includes recently updated even if outside date range
 */
export function getWorkOrderSyncScope(): {
  scope: string;
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // -30 days
  const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // +60 days

  return {
    scope: 'date_range',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

// =============================================================================
// STATUS TRANSITION RULES (ALIGNED WITH WEB/BACKEND)
// =============================================================================

export const VALID_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['DONE', 'CANCELED'],
  DONE: ['IN_PROGRESS'], // Permite reabrir OS concluída
  CANCELED: [], // Terminal state - cannot transition
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(
  currentStatus: WorkOrderStatus,
  newStatus: WorkOrderStatus,
): boolean {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

/**
 * Get allowed next statuses for a work order
 */
export function getAllowedNextStatuses(currentStatus: WorkOrderStatus): WorkOrderStatus[] {
  return VALID_STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a work order can be edited (not in terminal state)
 */
export function canEditWorkOrder(status: WorkOrderStatus): boolean {
  return status !== 'DONE' && status !== 'CANCELED';
}

/**
 * Check if a work order can be deleted
 */
export function canDeleteWorkOrder(status: WorkOrderStatus): boolean {
  return status !== 'IN_PROGRESS' && status !== 'DONE';
}

// =============================================================================
// EXPORT
// =============================================================================

export default WorkOrderSyncConfig;
