import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { WorkOrderStatus } from './dto/update-work-order-status.dto';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;
  let prisma: PrismaService;

  const mockNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockDomainEventsService = {
    createEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    createEventsForUsers: jest.fn().mockResolvedValue([]),
  };

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
    },
    quote: {
      findFirst: jest.fn(),
    },
    equipment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    workOrder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workOrderEquipment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    workOrderChecklist: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PlanLimitsService,
          useValue: mockPlanLimitsService,
        },
        {
          provide: DomainEventsService,
          useValue: mockDomainEventsService,
        },
      ],
    }).compile();

    service = module.get<WorkOrdersService>(WorkOrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create work order successfully', async () => {
      const userId = 'user-1';
      const clientId = 'client-1';
      const mockClient = { id: clientId, userId, name: 'Test Client' };
      const mockWorkOrder = {
        id: 'wo-1',
        userId,
        clientId,
        title: 'Test WO',
        status: 'SCHEDULED',
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.workOrder.create.mockResolvedValue(mockWorkOrder);

      const result = await service.create(userId, {
        clientId,
        title: 'Test WO',
      });

      expect(result).toEqual(mockWorkOrder);
      expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
    });

    it('should throw ForbiddenException when client does not belong to user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-1', { clientId: 'client-1', title: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when quote is not approved', async () => {
      const mockClient = { id: 'client-1', userId: 'user-1' };
      const mockQuote = { id: 'quote-1', status: 'DRAFT' };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          quoteId: 'quote-1',
          title: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when quote already has work order', async () => {
      const mockClient = { id: 'client-1', userId: 'user-1' };
      const mockQuote = { id: 'quote-1', status: 'APPROVED' };
      const existingWO = { id: 'wo-1' };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.workOrder.findFirst.mockResolvedValue(existingWO);

      await expect(
        service.create('user-1', {
          clientId: 'client-1',
          quoteId: 'quote-1',
          title: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create work order with equipments', async () => {
      const mockClient = { id: 'client-1', userId: 'user-1' };
      const mockEquipments = [
        { id: 'eq-1', userId: 'user-1', clientId: 'client-1' },
        { id: 'eq-2', userId: 'user-1', clientId: 'client-1' },
      ];
      const mockWorkOrder = { id: 'wo-1', equipments: [] };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipments);
      mockPrismaService.workOrder.create.mockResolvedValue(mockWorkOrder);

      const result = await service.create('user-1', {
        clientId: 'client-1',
        title: 'Test',
        equipmentIds: ['eq-1', 'eq-2'],
      });

      expect(result).toEqual(mockWorkOrder);
      expect(mockPrismaService.equipment.findMany).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all work orders for user', async () => {
      const mockWorkOrders = [
        { id: 'wo-1', userId: 'user-1' },
        { id: 'wo-2', userId: 'user-1' },
      ];

      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);

      const result = await service.findAll('user-1');

      expect(result).toEqual(mockWorkOrders);
      expect(mockPrismaService.workOrder.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });

    it('should filter by clientId', async () => {
      const mockClient = { id: 'client-1', userId: 'user-1' };
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);

      await service.findAll('user-1', 'client-1');

      expect(mockPrismaService.workOrder.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', clientId: 'client-1' },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);

      await service.findAll('user-1', undefined, WorkOrderStatus.IN_PROGRESS);

      expect(mockPrismaService.workOrder.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: WorkOrderStatus.IN_PROGRESS },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);

      await service.findAll('user-1', undefined, undefined, '2025-12-01', '2025-12-31');

      expect(mockPrismaService.workOrder.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          scheduledDate: {
            gte: new Date('2025-12-01'),
            lte: new Date('2025-12-31'),
          },
        },
        include: expect.any(Object),
        orderBy: { scheduledDate: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return work order with details', async () => {
      const mockWorkOrder = { id: 'wo-1', userId: 'user-1', title: 'Test' };
      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);

      const result = await service.findOne('user-1', 'wo-1');

      expect(result).toEqual(mockWorkOrder);
    });

    it('should throw NotFoundException when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'wo-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update work order successfully', async () => {
      const mockWorkOrder = { id: 'wo-1', userId: 'user-1', status: 'SCHEDULED' };
      const updatedWorkOrder = { ...mockWorkOrder, title: 'Updated' };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrder.update.mockResolvedValue(updatedWorkOrder);

      const result = await service.update('user-1', 'wo-1', { title: 'Updated' });

      expect(result).toEqual(updatedWorkOrder);
    });

    it('should throw BadRequestException when status is DONE', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'DONE' };
      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);

      await expect(service.update('user-1', 'wo-1', { title: 'Test' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should transition from SCHEDULED to IN_PROGRESS', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'SCHEDULED', executionStart: null };
      const updated = { ...mockWorkOrder, status: 'IN_PROGRESS', executionStart: expect.any(Date) };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrder.update.mockResolvedValue(updated);

      const result = await service.updateStatus('user-1', 'wo-1', WorkOrderStatus.IN_PROGRESS);

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockPrismaService.workOrder.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: expect.objectContaining({
          status: WorkOrderStatus.IN_PROGRESS,
          executionStart: expect.any(Date),
        }),
        include: expect.any(Object),
      });
    });

    it('should transition from IN_PROGRESS to DONE', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'IN_PROGRESS', executionEnd: null };
      const updated = { ...mockWorkOrder, status: 'DONE', executionEnd: expect.any(Date) };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrderChecklist.findMany.mockResolvedValue([]); // No checklists
      mockPrismaService.workOrder.update.mockResolvedValue(updated);

      const result = await service.updateStatus('user-1', 'wo-1', WorkOrderStatus.DONE);

      expect(result.status).toBe('DONE');
    });

    it('should throw BadRequestException when checklists have unanswered required items', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'IN_PROGRESS', executionEnd: null };

      const mockChecklists = [
        {
          id: 'cl-1',
          title: 'Test Checklist',
          template: {
            items: [
              { id: 'item-1', isRequired: true },
              { id: 'item-2', isRequired: true },
            ],
          },
          answers: [{ templateItemId: 'item-1' }], // Only one item answered
        },
      ];

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrderChecklist.findMany.mockResolvedValue(mockChecklists);

      await expect(
        service.updateStatus('user-1', 'wo-1', WorkOrderStatus.DONE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'DONE' };
      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);

      await expect(
        service.updateStatus('user-1', 'wo-1', WorkOrderStatus.SCHEDULED),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addEquipment', () => {
    it('should add equipment to work order', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'SCHEDULED', clientId: 'client-1' };
      const mockEquipment = { id: 'eq-1', userId: 'user-1', clientId: 'client-1' };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.equipment.findFirst.mockResolvedValue(mockEquipment);
      mockPrismaService.workOrderEquipment.findFirst.mockResolvedValue(null);
      mockPrismaService.workOrderEquipment.create.mockResolvedValue({ id: 'link-1' });

      await service.addEquipment('user-1', 'wo-1', { equipmentId: 'eq-1' });

      expect(mockPrismaService.workOrderEquipment.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if equipment already linked', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'SCHEDULED', clientId: 'client-1' };
      const mockEquipment = { id: 'eq-1' };
      const existingLink = { id: 'link-1' };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.equipment.findFirst.mockResolvedValue(mockEquipment);
      mockPrismaService.workOrderEquipment.findFirst.mockResolvedValue(existingLink);

      await expect(
        service.addEquipment('user-1', 'wo-1', { equipmentId: 'eq-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeEquipment', () => {
    it('should remove equipment from work order', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'SCHEDULED' };
      const mockLink = { id: 'link-1' };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrderEquipment.findFirst.mockResolvedValue(mockLink);
      mockPrismaService.workOrderEquipment.delete.mockResolvedValue(mockLink);

      await service.removeEquipment('user-1', 'wo-1', 'eq-1');

      expect(mockPrismaService.workOrderEquipment.delete).toHaveBeenCalledWith({
        where: { id: 'link-1' },
      });
    });

    it('should throw NotFoundException when equipment not linked', async () => {
      const mockWorkOrder = { id: 'wo-1', status: 'SCHEDULED' };
      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrderEquipment.findFirst.mockResolvedValue(null);

      await expect(service.removeEquipment('user-1', 'wo-1', 'eq-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
