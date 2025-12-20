/**
 * ChecklistInstanceSyncConfig
 *
 * Configuração de sincronização para Instâncias de Checklist.
 * Instâncias são criadas no mobile a partir de templates e sincronizadas com o servidor.
 */

import { SyncEntityConfig } from '../../sync/types';
import { ChecklistInstance, ChecklistInstanceStatus } from '../../db/schema';

// =============================================================================
// SERVER RESPONSE TYPES
// =============================================================================

interface ServerChecklistInstance {
  id: string;
  technicianId: string;
  workOrderId: string;
  templateId: string;
  templateVersionSnapshot: string | object;
  status: ChecklistInstanceStatus;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  localId?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SYNC CONFIG
// =============================================================================

export const ChecklistInstanceSyncConfig: SyncEntityConfig<ChecklistInstance> = {
  name: 'checklist_instances',
  tableName: 'checklist_instances',
  apiEndpoint: '/checklist-instances/sync',
  apiMutationEndpoint: '/checklist-instances/sync/mutations',
  cursorField: 'updatedAt',
  primaryKeys: ['id'],
  scopeField: 'technicianId',
  batchSize: 50,
  conflictResolution: 'last_write_wins',

  /**
   * Transform server response to local format
   */
  transformFromServer: (data: unknown): ChecklistInstance => {
    const serverItem = data as ServerChecklistInstance;

    // templateVersionSnapshot pode vir como string JSON ou objeto
    const snapshot = typeof serverItem.templateVersionSnapshot === 'string'
      ? serverItem.templateVersionSnapshot
      : JSON.stringify(serverItem.templateVersionSnapshot);

    return {
      id: serverItem.id,
      workOrderId: serverItem.workOrderId,
      templateId: serverItem.templateId,
      templateVersionSnapshot: snapshot,
      status: serverItem.status,
      progress: serverItem.progress || 0,
      startedAt: serverItem.startedAt,
      completedAt: serverItem.completedAt,
      completedBy: serverItem.completedBy,
      createdAt: serverItem.createdAt,
      updatedAt: serverItem.updatedAt,
      technicianId: serverItem.technicianId,
    };
  },

  /**
   * Transform local item to server mutation format
   */
  transformToServer: (localItem: ChecklistInstance): unknown => {
    return {
      id: localItem.id,
      workOrderId: localItem.workOrderId,
      templateId: localItem.templateId,
      templateVersionSnapshot: localItem.templateVersionSnapshot,
      status: localItem.status,
      progress: localItem.progress,
      startedAt: localItem.startedAt,
      completedAt: localItem.completedAt,
      completedBy: localItem.completedBy,
      createdAt: localItem.createdAt,
      updatedAt: localItem.updatedAt,
      technicianId: localItem.technicianId,
    };
  },
};

// =============================================================================
// STATUS TRANSITION RULES
// =============================================================================

export const VALID_INSTANCE_STATUS_TRANSITIONS: Record<ChecklistInstanceStatus, ChecklistInstanceStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function isValidInstanceStatusTransition(
  currentStatus: ChecklistInstanceStatus,
  newStatus: ChecklistInstanceStatus,
): boolean {
  const validTransitions = VALID_INSTANCE_STATUS_TRANSITIONS[currentStatus] || [];
  return validTransitions.includes(newStatus);
}

/**
 * Get allowed next statuses for an instance
 */
export function getAllowedNextInstanceStatuses(
  currentStatus: ChecklistInstanceStatus,
): ChecklistInstanceStatus[] {
  return VALID_INSTANCE_STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if an instance can be edited
 */
export function canEditInstance(status: ChecklistInstanceStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/**
 * Check if an instance is completed
 */
export function isInstanceCompleted(status: ChecklistInstanceStatus): boolean {
  return status === 'COMPLETED';
}

export default ChecklistInstanceSyncConfig;
