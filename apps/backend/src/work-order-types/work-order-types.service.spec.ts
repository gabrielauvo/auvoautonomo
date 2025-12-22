import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkOrderTypesService } from './work-order-types.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';

describe('WorkOrderTypesService', () => {
  let service: WorkOrderTypesService;
  let prisma: PrismaService;

  const mockPlanLimitsService = {
    checkFeatureEnabled: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    workOrderType: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockUserId = 'user-123';
  const mockTypeId = 'type-123';

  const mockWorkOrderType = {
    id: mockTypeId,
    userId: mockUserId,
    name: 'Instalação',
    description: 'Instalação de equipamentos',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrderTypesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlanLimitsService,
          useValue: mockPlanLimitsService,
        },
      ],
    }).compile();

    service = module.get<WorkOrderTypesService>(WorkOrderTypesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkFeatureEnabled', () => {
    it('should return true when feature is enabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });

      const result = await service.checkFeatureEnabled(mockUserId);

      expect(result).toBe(true);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        select: {
          plan: {
            select: {
              usageLimits: {
                select: {
                  enableWorkOrderTypes: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return false when feature is disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: false,
          },
        },
      });

      const result = await service.checkFeatureEnabled(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false when user has no plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: null,
      });

      const result = await service.checkFeatureEnabled(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.checkFeatureEnabled(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('ensureFeatureEnabled', () => {
    it('should not throw when feature is enabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });

      await expect(service.ensureFeatureEnabled(mockUserId)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when feature is disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: false,
          },
        },
      });

      await expect(service.ensureFeatureEnabled(mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      // Enable feature for create tests
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });
    });

    it('should create a work order type successfully', async () => {
      mockPrismaService.workOrderType.findUnique.mockResolvedValue(null);
      mockPrismaService.workOrderType.create.mockResolvedValue(mockWorkOrderType);

      const createDto = {
        name: 'Instalação',
        description: 'Instalação de equipamentos',
        color: '#3B82F6',
      };

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockWorkOrderType);
      expect(mockPrismaService.workOrderType.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: createDto.name,
          description: createDto.description,
          color: createDto.color,
        },
      });
    });

    it('should throw ConflictException when name already exists', async () => {
      mockPrismaService.workOrderType.findUnique.mockResolvedValue(mockWorkOrderType);

      const createDto = {
        name: 'Instalação',
        description: 'Outra descrição',
        color: '#FF0000',
      };

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ForbiddenException when feature is disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: false,
          },
        },
      });

      const createDto = {
        name: 'Instalação',
      };

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all work order types for user', async () => {
      const mockTypes = [mockWorkOrderType];
      mockPrismaService.workOrderType.findMany.mockResolvedValue(mockTypes);
      mockPrismaService.workOrderType.count.mockResolvedValue(1);

      const result = await service.findAll(mockUserId);

      expect(result.items).toEqual(mockTypes);
      expect(result.total).toBe(1);
      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { name: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by isActive', async () => {
      mockPrismaService.workOrderType.findMany.mockResolvedValue([mockWorkOrderType]);
      mockPrismaService.workOrderType.count.mockResolvedValue(1);

      await service.findAll(mockUserId, { isActive: true });

      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, isActive: true },
        orderBy: { name: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by search term', async () => {
      mockPrismaService.workOrderType.findMany.mockResolvedValue([]);
      mockPrismaService.workOrderType.count.mockResolvedValue(0);

      await service.findAll(mockUserId, { search: 'Instal' });

      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          OR: [
            { name: { contains: 'Instal', mode: 'insensitive' } },
            { description: { contains: 'Instal', mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('should filter by updatedSince for sync', async () => {
      const updatedSince = '2025-01-01T00:00:00.000Z';
      mockPrismaService.workOrderType.findMany.mockResolvedValue([]);
      mockPrismaService.workOrderType.count.mockResolvedValue(0);

      await service.findAll(mockUserId, { updatedSince });

      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          updatedAt: { gte: new Date(updatedSince) },
        },
        orderBy: { name: 'asc' },
        take: 100,
        skip: 0,
      });
    });

    it('should apply pagination with limit and offset', async () => {
      mockPrismaService.workOrderType.findMany.mockResolvedValue([]);
      mockPrismaService.workOrderType.count.mockResolvedValue(50);

      const result = await service.findAll(mockUserId, { limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { name: 'asc' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('findOne', () => {
    it('should return a work order type', async () => {
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(mockWorkOrderType);

      const result = await service.findOne(mockUserId, mockTypeId);

      expect(result).toEqual(mockWorkOrderType);
      expect(mockPrismaService.workOrderType.findFirst).toHaveBeenCalledWith({
        where: { id: mockTypeId, userId: mockUserId },
      });
    });

    it('should throw NotFoundException when type not found', async () => {
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, mockTypeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });
    });

    it('should update a work order type', async () => {
      const updatedType = { ...mockWorkOrderType, name: 'Manutenção' };
      mockPrismaService.workOrderType.findFirst
        .mockResolvedValueOnce(mockWorkOrderType) // findOne
        .mockResolvedValueOnce(null); // duplicate check
      mockPrismaService.workOrderType.update.mockResolvedValue(updatedType);

      const result = await service.update(mockUserId, mockTypeId, {
        name: 'Manutenção',
      });

      expect(result).toEqual(updatedType);
      expect(mockPrismaService.workOrderType.update).toHaveBeenCalledWith({
        where: { id: mockTypeId },
        data: {
          name: 'Manutenção',
          description: undefined,
          color: undefined,
          isActive: undefined,
        },
      });
    });

    it('should throw ConflictException when updating to duplicate name', async () => {
      const existingWithSameName = { id: 'other-id', name: 'Manutenção' };
      mockPrismaService.workOrderType.findFirst
        .mockResolvedValueOnce(mockWorkOrderType) // findOne
        .mockResolvedValueOnce(existingWithSameName); // duplicate check

      await expect(
        service.update(mockUserId, mockTypeId, { name: 'Manutenção' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when type not found', async () => {
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, mockTypeId, { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when feature is disabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: false,
          },
        },
      });

      await expect(
        service.update(mockUserId, mockTypeId, { name: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivate', () => {
    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });
    });

    it('should deactivate a work order type', async () => {
      const deactivatedType = { ...mockWorkOrderType, isActive: false };
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(mockWorkOrderType);
      mockPrismaService.workOrderType.update.mockResolvedValue(deactivatedType);

      const result = await service.deactivate(mockUserId, mockTypeId);

      expect(result.isActive).toBe(false);
      expect(mockPrismaService.workOrderType.update).toHaveBeenCalledWith({
        where: { id: mockTypeId },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when type not found', async () => {
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(null);

      await expect(service.deactivate(mockUserId, mockTypeId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivate', () => {
    beforeEach(() => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        plan: {
          usageLimits: {
            enableWorkOrderTypes: true,
          },
        },
      });
    });

    it('should reactivate a work order type', async () => {
      const inactiveType = { ...mockWorkOrderType, isActive: false };
      const reactivatedType = { ...mockWorkOrderType, isActive: true };
      mockPrismaService.workOrderType.findFirst.mockResolvedValue(inactiveType);
      mockPrismaService.workOrderType.update.mockResolvedValue(reactivatedType);

      const result = await service.reactivate(mockUserId, mockTypeId);

      expect(result.isActive).toBe(true);
      expect(mockPrismaService.workOrderType.update).toHaveBeenCalledWith({
        where: { id: mockTypeId },
        data: { isActive: true },
      });
    });
  });

  describe('getSyncData', () => {
    it('should return sync data with all types', async () => {
      const mockTypes = [mockWorkOrderType];
      mockPrismaService.workOrderType.findMany.mockResolvedValue(mockTypes);
      mockPrismaService.workOrderType.count.mockResolvedValue(1);

      const result = await service.getSyncData(mockUserId);

      expect(result.items).toEqual(mockTypes);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.serverTime).toBeDefined();
      expect(result.nextCursor).toBe(mockWorkOrderType.updatedAt.toISOString());
    });

    it('should filter by updatedSince', async () => {
      const updatedSince = '2025-01-01T00:00:00.000Z';
      mockPrismaService.workOrderType.findMany.mockResolvedValue([mockWorkOrderType]);
      mockPrismaService.workOrderType.count.mockResolvedValue(1);

      await service.getSyncData(mockUserId, updatedSince);

      expect(mockPrismaService.workOrderType.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          updatedAt: { gte: new Date(updatedSince) },
        },
        orderBy: { updatedAt: 'asc' },
      });
    });

    it('should return null cursor when no items', async () => {
      mockPrismaService.workOrderType.findMany.mockResolvedValue([]);
      mockPrismaService.workOrderType.count.mockResolvedValue(0);

      const result = await service.getSyncData(mockUserId);

      expect(result.items).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });
  });
});
