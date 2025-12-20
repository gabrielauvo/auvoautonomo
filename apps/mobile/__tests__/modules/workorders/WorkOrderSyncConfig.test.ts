/**
 * Tests for WorkOrderSyncConfig
 *
 * Validates sync configuration and status transition rules.
 */

import {
  WorkOrderSyncConfig,
  getWorkOrderSyncScope,
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  getAllowedNextStatuses,
  canEditWorkOrder,
  canDeleteWorkOrder,
} from '../../../src/modules/workorders/WorkOrderSyncConfig';
import { WorkOrder, WorkOrderStatus } from '../../../src/db/schema';

describe('WorkOrderSyncConfig', () => {
  describe('configuration', () => {
    it('should have correct entity name', () => {
      expect(WorkOrderSyncConfig.name).toBe('work_orders');
    });

    it('should have correct endpoints', () => {
      expect(WorkOrderSyncConfig.apiEndpoint).toBe('/work-orders/sync');
      expect(WorkOrderSyncConfig.apiMutationEndpoint).toBe('/work-orders/sync/mutations');
    });

    it('should have correct table name', () => {
      expect(WorkOrderSyncConfig.tableName).toBe('work_orders');
    });

    it('should have correct cursor field', () => {
      expect(WorkOrderSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary keys', () => {
      expect(WorkOrderSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should have correct scope field', () => {
      expect(WorkOrderSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have correct batch size', () => {
      expect(WorkOrderSyncConfig.batchSize).toBe(100);
    });

    it('should use last_write_wins conflict resolution', () => {
      expect(WorkOrderSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('getWorkOrderSyncScope', () => {
    it('should return date_range scope with dates', () => {
      const params = getWorkOrderSyncScope();

      expect(params).toBeDefined();
      expect(params.scope).toBe('date_range');
      expect(params.startDate).toBeDefined();
      expect(params.endDate).toBeDefined();
    });

    it('should return dates -30 to +60 days from now', () => {
      const params = getWorkOrderSyncScope();
      const now = new Date();

      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);

      // Start date should be approximately -30 days
      const expectedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(Math.abs(startDate.getTime() - expectedStart.getTime())).toBeLessThan(1000);

      // End date should be approximately +60 days
      const expectedEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      expect(Math.abs(endDate.getTime() - expectedEnd.getTime())).toBeLessThan(1000);
    });
  });

  describe('transformFromServer', () => {
    it('should transform server response to local format', () => {
      const serverItem = {
        id: 'test-id',
        technicianId: 'tech-id',
        clientId: 'client-id',
        quoteId: 'quote-id',
        title: 'Test Work Order',
        description: 'Test description',
        status: 'SCHEDULED' as WorkOrderStatus,
        scheduledDate: '2024-01-15',
        scheduledStartTime: '2024-01-15T09:00:00Z',
        scheduledEndTime: '2024-01-15T11:00:00Z',
        address: '123 Test St',
        notes: 'Test notes',
        totalValue: 150.00,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        clientName: 'Test Client',
        clientPhone: '11999999999',
        clientAddress: 'Client Address',
      };

      const result = WorkOrderSyncConfig.transformFromServer!(serverItem);

      expect(result.id).toBe('test-id');
      expect(result.technicianId).toBe('tech-id');
      expect(result.clientId).toBe('client-id');
      expect(result.quoteId).toBe('quote-id');
      expect(result.title).toBe('Test Work Order');
      expect(result.status).toBe('SCHEDULED');
      // isActive is converted to 1/0 for SQLite storage
      expect(result.isActive).toBe(1);
      expect(result.clientName).toBe('Test Client');
      expect(result.clientPhone).toBe('11999999999');
    });

    it('should handle missing optional fields', () => {
      const serverItem = {
        id: 'test-id',
        technicianId: 'tech-id',
        clientId: 'client-id',
        title: 'Test Work Order',
        status: 'SCHEDULED' as WorkOrderStatus,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = WorkOrderSyncConfig.transformFromServer!(serverItem);

      expect(result.quoteId).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.scheduledDate).toBeUndefined();
      expect(result.clientName).toBeUndefined();
    });
  });

  describe('transformToServer', () => {
    const mockWorkOrder: WorkOrder = {
      id: 'test-id',
      clientId: 'client-id',
      title: 'Test Work Order',
      description: 'Test description',
      status: 'SCHEDULED',
      scheduledDate: '2024-01-15',
      scheduledStartTime: '2024-01-15T09:00:00Z',
      address: '123 Test St',
      notes: 'Test notes',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
      technicianId: 'tech-id',
    };

    it('should transform work order to server format', () => {
      const result = WorkOrderSyncConfig.transformToServer!(mockWorkOrder) as Record<string, unknown>;

      expect(result.id).toBe('test-id');
      expect(result.clientId).toBe('client-id');
      expect(result.title).toBe('Test Work Order');
      expect(result.status).toBe('SCHEDULED');
      // technicianId is NOT sent to server (handled by backend from auth)
      expect(result.technicianId).toBeUndefined();
    });

    it('should include only mutation-allowed fields (not isActive, technicianId)', () => {
      const result = WorkOrderSyncConfig.transformToServer!(mockWorkOrder) as Record<string, unknown>;

      expect(result.description).toBe('Test description');
      expect(result.scheduledDate).toBe('2024-01-15');
      expect(result.scheduledStartTime).toBe('2024-01-15T09:00:00Z');
      expect(result.address).toBe('123 Test St');
      expect(result.notes).toBe('Test notes');
      // isActive is NOT sent to server (backend manages this)
      expect(result.isActive).toBeUndefined();
    });
  });
});

describe('Status Transition Rules', () => {
  describe('VALID_STATUS_TRANSITIONS', () => {
    it('should define valid transitions for SCHEDULED', () => {
      expect(VALID_STATUS_TRANSITIONS.SCHEDULED).toEqual(['IN_PROGRESS', 'CANCELED']);
    });

    it('should define valid transitions for IN_PROGRESS', () => {
      expect(VALID_STATUS_TRANSITIONS.IN_PROGRESS).toEqual(['DONE', 'CANCELED']);
    });

    it('should have no transitions for DONE (terminal state)', () => {
      expect(VALID_STATUS_TRANSITIONS.DONE).toEqual([]);
    });

    it('should have no transitions for CANCELED (terminal state)', () => {
      expect(VALID_STATUS_TRANSITIONS.CANCELED).toEqual([]);
    });
  });

  describe('isValidStatusTransition', () => {
    // Valid transitions
    it('should allow SCHEDULED -> IN_PROGRESS', () => {
      expect(isValidStatusTransition('SCHEDULED', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow SCHEDULED -> CANCELED', () => {
      expect(isValidStatusTransition('SCHEDULED', 'CANCELED')).toBe(true);
    });

    it('should allow IN_PROGRESS -> DONE', () => {
      expect(isValidStatusTransition('IN_PROGRESS', 'DONE')).toBe(true);
    });

    it('should allow IN_PROGRESS -> CANCELED', () => {
      expect(isValidStatusTransition('IN_PROGRESS', 'CANCELED')).toBe(true);
    });

    // Invalid transitions
    it('should NOT allow SCHEDULED -> DONE', () => {
      expect(isValidStatusTransition('SCHEDULED', 'DONE')).toBe(false);
    });

    it('should NOT allow DONE -> IN_PROGRESS', () => {
      expect(isValidStatusTransition('DONE', 'IN_PROGRESS')).toBe(false);
    });

    it('should NOT allow DONE -> SCHEDULED', () => {
      expect(isValidStatusTransition('DONE', 'SCHEDULED')).toBe(false);
    });

    it('should NOT allow CANCELED -> SCHEDULED', () => {
      expect(isValidStatusTransition('CANCELED', 'SCHEDULED')).toBe(false);
    });

    it('should NOT allow CANCELED -> IN_PROGRESS', () => {
      expect(isValidStatusTransition('CANCELED', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('getAllowedNextStatuses', () => {
    it('should return allowed statuses for SCHEDULED', () => {
      const allowed = getAllowedNextStatuses('SCHEDULED');
      expect(allowed).toContain('IN_PROGRESS');
      expect(allowed).toContain('CANCELED');
      expect(allowed).not.toContain('DONE');
    });

    it('should return allowed statuses for IN_PROGRESS', () => {
      const allowed = getAllowedNextStatuses('IN_PROGRESS');
      expect(allowed).toContain('DONE');
      expect(allowed).toContain('CANCELED');
      expect(allowed).not.toContain('SCHEDULED');
    });

    it('should return empty array for DONE', () => {
      const allowed = getAllowedNextStatuses('DONE');
      expect(allowed).toEqual([]);
    });

    it('should return empty array for CANCELED', () => {
      const allowed = getAllowedNextStatuses('CANCELED');
      expect(allowed).toEqual([]);
    });
  });

  describe('canEditWorkOrder', () => {
    it('should allow editing SCHEDULED work orders', () => {
      expect(canEditWorkOrder('SCHEDULED')).toBe(true);
    });

    it('should allow editing IN_PROGRESS work orders', () => {
      expect(canEditWorkOrder('IN_PROGRESS')).toBe(true);
    });

    it('should NOT allow editing DONE work orders', () => {
      expect(canEditWorkOrder('DONE')).toBe(false);
    });

    it('should NOT allow editing CANCELED work orders', () => {
      expect(canEditWorkOrder('CANCELED')).toBe(false);
    });
  });

  describe('canDeleteWorkOrder', () => {
    it('should allow deleting SCHEDULED work orders', () => {
      expect(canDeleteWorkOrder('SCHEDULED')).toBe(true);
    });

    it('should NOT allow deleting IN_PROGRESS work orders', () => {
      expect(canDeleteWorkOrder('IN_PROGRESS')).toBe(false);
    });

    it('should NOT allow deleting DONE work orders', () => {
      expect(canDeleteWorkOrder('DONE')).toBe(false);
    });

    it('should allow deleting CANCELED work orders', () => {
      expect(canDeleteWorkOrder('CANCELED')).toBe(true);
    });
  });
});
