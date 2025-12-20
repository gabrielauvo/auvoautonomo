/**
 * WorkOrderSyncConfig
 *
 * Configuração de sincronização para Ordens de Serviço.
 * Implementa EntitySyncConfig para integração com SyncEngine.
 */

import { SyncEntityConfig } from '../../sync/types';
import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { workOrderRepository } from './WorkOrderRepository';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerWorkOrder {
  id: string;
  technicianId: string;
  clientId: string;
  quoteId?: string;
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
