/**
 * WorkOrderService
 *
 * Serviço de alto nível para operações de Ordens de Serviço.
 * Gerencia lógica de negócio, validações e integração com sync.
 */

import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { workOrderRepository, WorkOrderFilter, PaginationOptions } from './WorkOrderRepository';
import {
  isValidStatusTransition,
  canEditWorkOrder,
  canDeleteWorkOrder,
  getAllowedNextStatuses,
} from './WorkOrderSyncConfig';
import { MutationQueue } from '../../queue/MutationQueue';
import { v4 as uuidv4 } from 'uuid';
import { getTodayLocalDate, extractDatePart } from '../../utils/dateUtils';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateWorkOrderInput {
  clientId: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  address?: string;
  notes?: string;
  // Denormalized client data for offline display
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  address?: string;
  notes?: string;
}

export interface WorkOrderServiceError extends Error {
  code: 'INVALID_TRANSITION' | 'CANNOT_EDIT' | 'CANNOT_DELETE' | 'NOT_FOUND' | 'VALIDATION_ERROR';
  currentStatus?: WorkOrderStatus;
  newStatus?: WorkOrderStatus;
}

// =============================================================================
// SERVICE
// =============================================================================

class WorkOrderService {
  private technicianId: string | null = null;

  /**
   * Set the current technician ID (from auth)
   */
  setTechnicianId(id: string) {
    this.technicianId = id;
  }

  /**
   * Get current technician ID
   */
  getTechnicianId(): string {
    if (!this.technicianId) {
      throw new Error('Technician ID not set. Call setTechnicianId first.');
    }
    return this.technicianId;
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  /**
   * Get work orders for a specific day (for agenda)
   */
  async getWorkOrdersForDay(date: string): Promise<WorkOrder[]> {
    return workOrderRepository.getByDay(this.getTechnicianId(), date);
  }

  /**
   * Get work orders for a date range (for week view)
   */
  async getWorkOrdersForDateRange(
    startDate: string,
    endDate: string,
  ): Promise<WorkOrder[]> {
    const result = await workOrderRepository.getByDateRange(
      this.getTechnicianId(),
      startDate,
      endDate,
    );
    return result.items;
  }

  /**
   * Get a single work order by ID
   */
  async getWorkOrderById(id: string): Promise<WorkOrder | null> {
    return workOrderRepository.getById(id);
  }

  /**
   * List work orders with filters
   */
  async listWorkOrders(
    filter?: WorkOrderFilter,
    pagination?: PaginationOptions,
  ) {
    return workOrderRepository.list(this.getTechnicianId(), filter, pagination);
  }

  /**
   * Get upcoming work orders
   */
  async getUpcomingWorkOrders(limit: number = 5): Promise<WorkOrder[]> {
    return workOrderRepository.getUpcoming(this.getTechnicianId(), limit);
  }

  /**
   * Get work order counts by status
   */
  async getStatusCounts(): Promise<Record<WorkOrderStatus, number>> {
    return workOrderRepository.countByStatus(this.getTechnicianId());
  }

  /**
   * Get overdue work orders (scheduled before today and not completed)
   */
  async getOverdueWorkOrders(pagination?: PaginationOptions): Promise<{ items: WorkOrder[]; total: number }> {
    // Usa timezone local para evitar problemas de UTC
    const todayStr = getTodayLocalDate();

    // Get all non-completed work orders scheduled before today
    const result = await workOrderRepository.list(this.getTechnicianId(), {
      status: ['SCHEDULED', 'IN_PROGRESS'],
      endDate: todayStr,
    }, pagination);

    // Filter only those scheduled before today (not today)
    const overdueItems = result.items.filter(wo => {
      const woDate = extractDatePart(wo.scheduledDate) || extractDatePart(wo.scheduledStartTime);
      return woDate && woDate < todayStr;
    });

    return {
      items: overdueItems,
      total: overdueItems.length,
    };
  }

  /**
   * Count overdue work orders
   */
  async countOverdue(): Promise<number> {
    const result = await this.getOverdueWorkOrders();
    return result.total;
  }

  // ===========================================================================
  // WRITE OPERATIONS (OFFLINE-FIRST)
  // ===========================================================================

  /**
   * Create a new work order (offline-first)
   */
  async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
    // Validate required fields
    if (!input.clientId || !input.title) {
      const error = new Error('clientId and title are required') as WorkOrderServiceError;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const workOrder = {
      id,
      clientId: input.clientId,
      title: input.title,
      description: input.description,
      status: 'SCHEDULED',
      scheduledDate: input.scheduledDate,
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      address: input.address,
      notes: input.notes,
      isActive: 1,  // Store as integer for SQLite
      createdAt: now,
      updatedAt: now,
      technicianId: this.getTechnicianId(),
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientAddress: input.clientAddress,
    } as unknown as WorkOrder;

    // Save to local database
    await workOrderRepository.insert(workOrder);

    // Queue mutation for sync
    await MutationQueue.enqueue('work_orders', id, 'create', workOrder);

    return workOrder;
  }

  /**
   * Update a work order (offline-first)
   */
  async updateWorkOrder(id: string, input: UpdateWorkOrderInput): Promise<WorkOrder> {
    const existing = await workOrderRepository.getById(id);

    if (!existing) {
      const error = new Error('Work order not found') as WorkOrderServiceError;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (!canEditWorkOrder(existing.status)) {
      const error = new Error(
        `Cannot edit work order with status ${existing.status}`,
      ) as WorkOrderServiceError;
      error.code = 'CANNOT_EDIT';
      error.currentStatus = existing.status;
      throw error;
    }

    // Update locally
    const updated = await workOrderRepository.update(id, input);

    if (!updated) {
      const error = new Error('Failed to update work order') as WorkOrderServiceError;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Queue mutation for sync
    await MutationQueue.enqueue('work_orders', id, 'update', updated);

    return updated;
  }

  /**
   * Update work order status (offline-first)
   * This is the main operation for field technicians
   */
  async updateStatus(id: string, newStatus: WorkOrderStatus): Promise<WorkOrder> {
    const existing = await workOrderRepository.getById(id);

    if (!existing) {
      const error = new Error('Work order not found') as WorkOrderServiceError;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Validate transition
    if (!isValidStatusTransition(existing.status, newStatus)) {
      const error = new Error(
        `Invalid status transition from ${existing.status} to ${newStatus}`,
      ) as WorkOrderServiceError;
      error.code = 'INVALID_TRANSITION';
      error.currentStatus = existing.status;
      error.newStatus = newStatus;
      throw error;
    }

    // Set execution times
    const executionTimes: { executionStart?: string; executionEnd?: string } = {};
    const now = new Date().toISOString();

    if (newStatus === 'IN_PROGRESS' && !existing.executionStart) {
      executionTimes.executionStart = now;
    }
    if (newStatus === 'DONE' && !existing.executionEnd) {
      executionTimes.executionEnd = now;
    }

    // Update locally
    const updated = await workOrderRepository.updateStatus(id, newStatus, executionTimes);

    if (!updated) {
      const error = new Error('Failed to update work order status') as WorkOrderServiceError;
      error.code = 'NOT_FOUND';
      throw error;
    }

    // Queue mutation for sync with 'update_status' action (not 'update')
    // Backend expects action: 'update_status' for status transitions
    await MutationQueue.enqueue('work_orders', id, 'update_status', updated);

    return updated;
  }

  /**
   * Start a work order (SCHEDULED -> IN_PROGRESS)
   */
  async startWorkOrder(id: string): Promise<WorkOrder> {
    return this.updateStatus(id, 'IN_PROGRESS');
  }

  /**
   * Complete a work order (IN_PROGRESS -> DONE)
   */
  async completeWorkOrder(id: string): Promise<WorkOrder> {
    return this.updateStatus(id, 'DONE');
  }

  /**
   * Cancel a work order (SCHEDULED or IN_PROGRESS -> CANCELED)
   */
  async cancelWorkOrder(id: string): Promise<WorkOrder> {
    return this.updateStatus(id, 'CANCELED');
  }

  /**
   * Delete a work order (soft delete, offline-first)
   */
  async deleteWorkOrder(id: string): Promise<boolean> {
    const existing = await workOrderRepository.getById(id);

    if (!existing) {
      const error = new Error('Work order not found') as WorkOrderServiceError;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (!canDeleteWorkOrder(existing.status)) {
      const error = new Error(
        `Cannot delete work order with status ${existing.status}`,
      ) as WorkOrderServiceError;
      error.code = 'CANNOT_DELETE';
      error.currentStatus = existing.status;
      throw error;
    }

    // Soft delete locally
    const deleted = await workOrderRepository.softDelete(id);

    if (deleted) {
      // Queue mutation for sync
      await MutationQueue.enqueue('work_orders', id, 'delete', { id });
    }

    return deleted;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Get allowed next statuses for a work order
   */
  getAllowedNextStatuses(currentStatus: WorkOrderStatus): WorkOrderStatus[] {
    return getAllowedNextStatuses(currentStatus);
  }

  /**
   * Check if a work order can be edited
   */
  canEdit(status: WorkOrderStatus): boolean {
    return canEditWorkOrder(status);
  }

  /**
   * Check if a work order can be deleted
   */
  canDelete(status: WorkOrderStatus): boolean {
    return canDeleteWorkOrder(status);
  }

  /**
   * Format scheduled time for display
   */
  formatScheduledTime(workOrder: WorkOrder): string {
    if (workOrder.scheduledStartTime) {
      const date = new Date(workOrder.scheduledStartTime);
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return 'Dia todo';
  }

  /**
   * Format date range for display
   */
  formatDateRange(workOrder: WorkOrder): string {
    if (workOrder.scheduledStartTime && workOrder.scheduledEndTime) {
      const start = new Date(workOrder.scheduledStartTime);
      const end = new Date(workOrder.scheduledEndTime);
      return `${start.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${end.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return this.formatScheduledTime(workOrder);
  }
}

// Singleton instance
export const workOrderService = new WorkOrderService();
