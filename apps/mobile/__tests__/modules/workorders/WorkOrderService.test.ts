/**
 * WorkOrderService Tests
 *
 * Testes para o serviço de ordens de serviço.
 */

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

// Mock date utils
jest.mock('../../../src/utils/dateUtils', () => ({
  getTodayLocalDate: jest.fn(() => '2024-01-15'),
  extractDatePart: jest.fn((date: string) => date?.split('T')[0]),
}));

// Mock repository
const mockGetByDay = jest.fn();
const mockGetByDateRange = jest.fn();
const mockGetById = jest.fn();
const mockList = jest.fn();
const mockGetUpcoming = jest.fn();
const mockCountByStatus = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateStatus = jest.fn();
const mockSoftDelete = jest.fn();

jest.mock('../../../src/modules/workorders/WorkOrderRepository', () => ({
  workOrderRepository: {
    getByDay: (...args: unknown[]) => mockGetByDay(...args),
    getByDateRange: (...args: unknown[]) => mockGetByDateRange(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    list: (...args: unknown[]) => mockList(...args),
    getUpcoming: (...args: unknown[]) => mockGetUpcoming(...args),
    countByStatus: (...args: unknown[]) => mockCountByStatus(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    softDelete: (...args: unknown[]) => mockSoftDelete(...args),
  },
}));

// Mock MutationQueue
const mockEnqueue = jest.fn();
jest.mock('../../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
  },
}));

// Mock WorkOrderSyncConfig
jest.mock('../../../src/modules/workorders/WorkOrderSyncConfig', () => ({
  isValidStatusTransition: jest.fn((from: string, to: string) => {
    const validTransitions: Record<string, string[]> = {
      'SCHEDULED': ['IN_PROGRESS', 'CANCELED'],
      'IN_PROGRESS': ['DONE', 'CANCELED'],
      'DONE': [],
      'CANCELED': [],
    };
    return validTransitions[from]?.includes(to) ?? false;
  }),
  canEditWorkOrder: jest.fn((status: string) => {
    return ['SCHEDULED', 'IN_PROGRESS'].includes(status);
  }),
  canDeleteWorkOrder: jest.fn((status: string) => {
    return status === 'SCHEDULED';
  }),
  getAllowedNextStatuses: jest.fn((status: string) => {
    const transitions: Record<string, string[]> = {
      'SCHEDULED': ['IN_PROGRESS', 'CANCELED'],
      'IN_PROGRESS': ['DONE', 'CANCELED'],
      'DONE': [],
      'CANCELED': [],
    };
    return transitions[status] || [];
  }),
}));

import { workOrderService, WorkOrderServiceError } from '../../../src/modules/workorders/WorkOrderService';
import { WorkOrder, WorkOrderStatus } from '../../../src/db/schema';

describe('WorkOrderService', () => {
  const technicianId = 'tech-123';

  const mockWorkOrder: WorkOrder = {
    id: 'wo-1',
    clientId: 'client-1',
    title: 'Test Work Order',
    description: 'Test description',
    status: 'SCHEDULED' as WorkOrderStatus,
    scheduledDate: '2024-01-15',
    scheduledStartTime: '2024-01-15T09:00:00.000Z',
    scheduledEndTime: '2024-01-15T11:00:00.000Z',
    address: '123 Main St',
    notes: 'Test notes',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
    clientName: 'John Doe',
    clientPhone: '1234567890',
    clientAddress: '123 Main St',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    workOrderService.setTechnicianId(technicianId);
  });

  describe('setTechnicianId / getTechnicianId', () => {
    it('should set and get technician ID', () => {
      workOrderService.setTechnicianId('new-tech');
      expect(workOrderService.getTechnicianId()).toBe('new-tech');
    });

    it('should throw if technician ID not set', () => {
      const service = Object.create(workOrderService);
      service.technicianId = null;

      expect(() => {
        service.getTechnicianId();
      }).toThrow('Technician ID not set');
    });
  });

  describe('READ Operations', () => {
    describe('getWorkOrdersForDay', () => {
      it('should return work orders for a specific day', async () => {
        mockGetByDay.mockResolvedValue([mockWorkOrder]);

        const result = await workOrderService.getWorkOrdersForDay('2024-01-15');

        expect(mockGetByDay).toHaveBeenCalledWith(technicianId, '2024-01-15');
        expect(result).toEqual([mockWorkOrder]);
      });
    });

    describe('getWorkOrdersForDateRange', () => {
      it('should return work orders for a date range', async () => {
        mockGetByDateRange.mockResolvedValue({ items: [mockWorkOrder] });

        const result = await workOrderService.getWorkOrdersForDateRange('2024-01-01', '2024-01-31');

        expect(mockGetByDateRange).toHaveBeenCalledWith(
          technicianId,
          '2024-01-01',
          '2024-01-31'
        );
        expect(result).toEqual([mockWorkOrder]);
      });
    });

    describe('getWorkOrderById', () => {
      it('should return work order by ID', async () => {
        mockGetById.mockResolvedValue(mockWorkOrder);

        const result = await workOrderService.getWorkOrderById('wo-1');

        expect(mockGetById).toHaveBeenCalledWith('wo-1');
        expect(result).toEqual(mockWorkOrder);
      });

      it('should return null if not found', async () => {
        mockGetById.mockResolvedValue(null);

        const result = await workOrderService.getWorkOrderById('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('listWorkOrders', () => {
      it('should list work orders with filters', async () => {
        mockList.mockResolvedValue({ items: [mockWorkOrder], total: 1 });

        const result = await workOrderService.listWorkOrders(
          { status: ['SCHEDULED'] },
          { page: 1, pageSize: 10 }
        );

        expect(mockList).toHaveBeenCalledWith(
          technicianId,
          { status: ['SCHEDULED'] },
          { page: 1, pageSize: 10 }
        );
        expect(result).toEqual({ items: [mockWorkOrder], total: 1 });
      });
    });

    describe('getUpcomingWorkOrders', () => {
      it('should return upcoming work orders', async () => {
        mockGetUpcoming.mockResolvedValue([mockWorkOrder]);

        const result = await workOrderService.getUpcomingWorkOrders(5);

        expect(mockGetUpcoming).toHaveBeenCalledWith(technicianId, 5);
        expect(result).toEqual([mockWorkOrder]);
      });

      it('should use default limit of 5', async () => {
        mockGetUpcoming.mockResolvedValue([]);

        await workOrderService.getUpcomingWorkOrders();

        expect(mockGetUpcoming).toHaveBeenCalledWith(technicianId, 5);
      });
    });

    describe('getStatusCounts', () => {
      it('should return status counts', async () => {
        const counts = { SCHEDULED: 5, IN_PROGRESS: 2, DONE: 10, CANCELED: 1 };
        mockCountByStatus.mockResolvedValue(counts);

        const result = await workOrderService.getStatusCounts();

        expect(mockCountByStatus).toHaveBeenCalledWith(technicianId);
        expect(result).toEqual(counts);
      });
    });

    describe('getOverdueWorkOrders', () => {
      it('should return overdue work orders', async () => {
        const overdueWO = { ...mockWorkOrder, scheduledDate: '2024-01-10' };
        mockList.mockResolvedValue({ items: [overdueWO], total: 1 });

        const result = await workOrderService.getOverdueWorkOrders();

        expect(mockList).toHaveBeenCalledWith(
          technicianId,
          { status: ['SCHEDULED', 'IN_PROGRESS'], endDate: '2024-01-15' },
          undefined
        );
        expect(result.items).toEqual([overdueWO]);
      });

      it('should filter out work orders scheduled for today', async () => {
        const todayWO = { ...mockWorkOrder, scheduledDate: '2024-01-15' };
        mockList.mockResolvedValue({ items: [todayWO], total: 1 });

        const result = await workOrderService.getOverdueWorkOrders();

        expect(result.items).toEqual([]);
      });
    });

    describe('countOverdue', () => {
      it('should return count of overdue work orders', async () => {
        const overdueWO = { ...mockWorkOrder, scheduledDate: '2024-01-10' };
        mockList.mockResolvedValue({ items: [overdueWO], total: 1 });

        const result = await workOrderService.countOverdue();

        expect(result).toBe(1);
      });
    });
  });

  describe('WRITE Operations', () => {
    describe('createWorkOrder', () => {
      it('should create a new work order', async () => {
        mockInsert.mockResolvedValue(undefined);

        const input = {
          clientId: 'client-1',
          title: 'New Work Order',
          description: 'Description',
          scheduledDate: '2024-01-20',
        };

        const result = await workOrderService.createWorkOrder(input);

        expect(mockInsert).toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledWith(
          'work_orders',
          'mock-uuid-123',
          'create',
          expect.objectContaining({
            id: 'mock-uuid-123',
            clientId: 'client-1',
            title: 'New Work Order',
            status: 'SCHEDULED',
          })
        );
        expect(result.id).toBe('mock-uuid-123');
        expect(result.status).toBe('SCHEDULED');
      });

      it('should throw validation error if clientId missing', async () => {
        await expect(
          workOrderService.createWorkOrder({ clientId: '', title: 'Test' })
        ).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
          message: 'clientId and title are required',
        });
      });

      it('should throw validation error if title missing', async () => {
        await expect(
          workOrderService.createWorkOrder({ clientId: 'client-1', title: '' })
        ).rejects.toMatchObject({
          code: 'VALIDATION_ERROR',
        });
      });
    });

    describe('updateWorkOrder', () => {
      it('should update a work order', async () => {
        const updatedWO = { ...mockWorkOrder, title: 'Updated Title' };
        mockGetById.mockResolvedValue(mockWorkOrder);
        mockUpdate.mockResolvedValue(updatedWO);

        const result = await workOrderService.updateWorkOrder('wo-1', {
          title: 'Updated Title',
        });

        expect(mockUpdate).toHaveBeenCalledWith('wo-1', {
          title: 'Updated Title',
        });
        expect(mockEnqueue).toHaveBeenCalledWith(
          'work_orders',
          'wo-1',
          'update',
          updatedWO
        );
        expect(result.title).toBe('Updated Title');
      });

      it('should throw NOT_FOUND if work order does not exist', async () => {
        mockGetById.mockResolvedValue(null);

        await expect(
          workOrderService.updateWorkOrder('non-existent', { title: 'Test' })
        ).rejects.toMatchObject({
          code: 'NOT_FOUND',
        });
      });

      it('should throw CANNOT_EDIT if work order status does not allow editing', async () => {
        const doneWO = { ...mockWorkOrder, status: 'DONE' as WorkOrderStatus };
        mockGetById.mockResolvedValue(doneWO);

        await expect(
          workOrderService.updateWorkOrder('wo-1', { title: 'Test' })
        ).rejects.toMatchObject({
          code: 'CANNOT_EDIT',
          currentStatus: 'DONE',
        });
      });
    });

    describe('updateStatus', () => {
      it('should update work order status', async () => {
        const inProgressWO = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
        mockGetById.mockResolvedValue(mockWorkOrder);
        mockUpdateStatus.mockResolvedValue(inProgressWO);

        const result = await workOrderService.updateStatus('wo-1', 'IN_PROGRESS');

        expect(mockUpdateStatus).toHaveBeenCalledWith(
          'wo-1',
          'IN_PROGRESS',
          expect.objectContaining({ executionStart: expect.any(String) })
        );
        expect(mockEnqueue).toHaveBeenCalled();
        expect(result.status).toBe('IN_PROGRESS');
      });

      it('should throw INVALID_TRANSITION for invalid status change', async () => {
        mockGetById.mockResolvedValue(mockWorkOrder);

        await expect(
          workOrderService.updateStatus('wo-1', 'DONE')
        ).rejects.toMatchObject({
          code: 'INVALID_TRANSITION',
          currentStatus: 'SCHEDULED',
          newStatus: 'DONE',
        });
      });

      it('should set executionEnd when completing work order', async () => {
        const inProgressWO = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
        const doneWO = { ...inProgressWO, status: 'DONE' as WorkOrderStatus };
        mockGetById.mockResolvedValue(inProgressWO);
        mockUpdateStatus.mockResolvedValue(doneWO);

        await workOrderService.updateStatus('wo-1', 'DONE');

        expect(mockUpdateStatus).toHaveBeenCalledWith(
          'wo-1',
          'DONE',
          expect.objectContaining({ executionEnd: expect.any(String) })
        );
      });
    });

    describe('startWorkOrder', () => {
      it('should start a work order', async () => {
        const inProgressWO = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
        mockGetById.mockResolvedValue(mockWorkOrder);
        mockUpdateStatus.mockResolvedValue(inProgressWO);

        const result = await workOrderService.startWorkOrder('wo-1');

        expect(result.status).toBe('IN_PROGRESS');
      });
    });

    describe('completeWorkOrder', () => {
      it('should complete a work order', async () => {
        const inProgressWO = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
        const doneWO = { ...inProgressWO, status: 'DONE' as WorkOrderStatus };
        mockGetById.mockResolvedValue(inProgressWO);
        mockUpdateStatus.mockResolvedValue(doneWO);

        const result = await workOrderService.completeWorkOrder('wo-1');

        expect(result.status).toBe('DONE');
      });
    });

    describe('cancelWorkOrder', () => {
      it('should cancel a work order', async () => {
        const canceledWO = { ...mockWorkOrder, status: 'CANCELED' as WorkOrderStatus };
        mockGetById.mockResolvedValue(mockWorkOrder);
        mockUpdateStatus.mockResolvedValue(canceledWO);

        const result = await workOrderService.cancelWorkOrder('wo-1');

        expect(result.status).toBe('CANCELED');
      });
    });

    describe('deleteWorkOrder', () => {
      it('should soft delete a work order', async () => {
        mockGetById.mockResolvedValue(mockWorkOrder);
        mockSoftDelete.mockResolvedValue(true);

        const result = await workOrderService.deleteWorkOrder('wo-1');

        expect(mockSoftDelete).toHaveBeenCalledWith('wo-1');
        expect(mockEnqueue).toHaveBeenCalledWith(
          'work_orders',
          'wo-1',
          'delete',
          { id: 'wo-1' }
        );
        expect(result).toBe(true);
      });

      it('should throw CANNOT_DELETE for non-scheduled work orders', async () => {
        const inProgressWO = { ...mockWorkOrder, status: 'IN_PROGRESS' as WorkOrderStatus };
        mockGetById.mockResolvedValue(inProgressWO);

        await expect(
          workOrderService.deleteWorkOrder('wo-1')
        ).rejects.toMatchObject({
          code: 'CANNOT_DELETE',
          currentStatus: 'IN_PROGRESS',
        });
      });
    });
  });

  describe('Helper Methods', () => {
    describe('getAllowedNextStatuses', () => {
      it('should return allowed next statuses', () => {
        const result = workOrderService.getAllowedNextStatuses('SCHEDULED');

        expect(result).toEqual(['IN_PROGRESS', 'CANCELED']);
      });
    });

    describe('canEdit', () => {
      it('should return true for editable statuses', () => {
        expect(workOrderService.canEdit('SCHEDULED')).toBe(true);
        expect(workOrderService.canEdit('IN_PROGRESS')).toBe(true);
      });

      it('should return false for non-editable statuses', () => {
        expect(workOrderService.canEdit('DONE')).toBe(false);
        expect(workOrderService.canEdit('CANCELED')).toBe(false);
      });
    });

    describe('canDelete', () => {
      it('should return true for deletable statuses', () => {
        expect(workOrderService.canDelete('SCHEDULED')).toBe(true);
      });

      it('should return false for non-deletable statuses', () => {
        expect(workOrderService.canDelete('IN_PROGRESS')).toBe(false);
        expect(workOrderService.canDelete('DONE')).toBe(false);
      });
    });

    describe('formatScheduledTime', () => {
      it('should format scheduled time', () => {
        const result = workOrderService.formatScheduledTime(mockWorkOrder);

        expect(result).toMatch(/\d{2}:\d{2}/);
      });

      it('should return "Dia todo" if no scheduled time', () => {
        const woWithoutTime = { ...mockWorkOrder, scheduledStartTime: undefined };
        const result = workOrderService.formatScheduledTime(woWithoutTime);

        expect(result).toBe('Dia todo');
      });
    });

    describe('formatDateRange', () => {
      it('should format date range', () => {
        const result = workOrderService.formatDateRange(mockWorkOrder);

        expect(result).toMatch(/\d{2}:\d{2} - \d{2}:\d{2}/);
      });

      it('should use formatScheduledTime if no end time', () => {
        const woWithoutEnd = { ...mockWorkOrder, scheduledEndTime: undefined };
        const result = workOrderService.formatDateRange(woWithoutEnd);

        expect(result).toMatch(/\d{2}:\d{2}/);
      });
    });
  });
});
