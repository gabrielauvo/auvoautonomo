import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EquipmentsService } from './equipments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

describe('EquipmentsService', () => {
  let service: EquipmentsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
    },
    equipment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EquipmentsService>(EquipmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-123';
    const createEquipmentDto: CreateEquipmentDto = {
      clientId: 'client-456',
      type: 'Ar-condicionado Split 12000 BTUs',
      brand: 'LG',
      model: 'S4-W12JA3AA',
      serialNumber: 'SN123456',
      installationDate: '2024-01-15',
      warrantyEndDate: '2026-01-15',
      notes: 'Instalado na sala principal',
    };

    it('should create equipment when client belongs to user', async () => {
      const mockClient = {
        id: 'client-456',
        name: 'Cliente Teste',
        userId,
      };

      const mockEquipment = {
        id: 'equipment-789',
        userId,
        ...createEquipmentDto,
        client: {
          id: mockClient.id,
          name: mockClient.name,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.equipment.create.mockResolvedValue(mockEquipment);

      const result = await service.create(userId, createEquipmentDto);

      expect(result).toEqual(mockEquipment);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: createEquipmentDto.clientId,
          userId,
        },
      });
      expect(prisma.equipment.create).toHaveBeenCalledWith({
        data: {
          ...createEquipmentDto,
          userId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw ForbiddenException when client does not belong to user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, createEquipmentDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(userId, createEquipmentDto)).rejects.toThrow(
        `Client with ID ${createEquipmentDto.clientId} not found or does not belong to you`,
      );

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: createEquipmentDto.clientId,
          userId,
        },
      });
      expect(prisma.equipment.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const userId = 'user-123';

    it('should return all equipment for user without filters', async () => {
      const mockEquipment = [
        {
          id: 'equipment-1',
          userId,
          clientId: 'client-1',
          type: 'Ar-condicionado',
          brand: 'LG',
          client: { id: 'client-1', name: 'Cliente 1' },
        },
        {
          id: 'equipment-2',
          userId,
          clientId: 'client-2',
          type: 'Geladeira',
          brand: 'Samsung',
          client: { id: 'client-2', name: 'Cliente 2' },
        },
      ];

      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipment);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockEquipment);
      expect(prisma.equipment.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should filter equipment by clientId when provided', async () => {
      const clientId = 'client-1';
      const mockEquipment = [
        {
          id: 'equipment-1',
          userId,
          clientId,
          type: 'Ar-condicionado',
          brand: 'LG',
          client: { id: clientId, name: 'Cliente 1' },
        },
      ];

      const mockClient = {
        id: clientId,
        name: 'Cliente 1',
        userId,
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipment);

      const result = await service.findAll(userId, clientId);

      expect(result).toEqual(mockEquipment);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: clientId,
          userId,
        },
      });
      expect(prisma.equipment.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          clientId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should throw ForbiddenException when filtering by clientId that does not belong to user', async () => {
      const clientId = 'client-999';

      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.findAll(userId, clientId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findAll(userId, clientId)).rejects.toThrow(
        `Client with ID ${clientId} not found or does not belong to you`,
      );

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: clientId,
          userId,
        },
      });
      expect(prisma.equipment.findMany).not.toHaveBeenCalled();
    });

    it('should filter equipment by type when provided', async () => {
      const type = 'Ar-condicionado';
      const mockEquipment = [
        {
          id: 'equipment-1',
          userId,
          clientId: 'client-1',
          type: 'Ar-condicionado Split 12000 BTUs',
          brand: 'LG',
          client: { id: 'client-1', name: 'Cliente 1' },
        },
        {
          id: 'equipment-2',
          userId,
          clientId: 'client-2',
          type: 'Ar-condicionado Janela',
          brand: 'Samsung',
          client: { id: 'client-2', name: 'Cliente 2' },
        },
      ];

      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipment);

      const result = await service.findAll(userId, undefined, type);

      expect(result).toEqual(mockEquipment);
      expect(prisma.equipment.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          type: {
            contains: type,
            mode: 'insensitive',
          },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should filter equipment by both clientId and type when provided', async () => {
      const clientId = 'client-1';
      const type = 'Ar-condicionado';
      const mockClient = {
        id: clientId,
        name: 'Cliente 1',
        userId,
      };

      const mockEquipment = [
        {
          id: 'equipment-1',
          userId,
          clientId,
          type: 'Ar-condicionado Split 12000 BTUs',
          brand: 'LG',
          client: { id: clientId, name: 'Cliente 1' },
        },
      ];

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipment);

      const result = await service.findAll(userId, clientId, type);

      expect(result).toEqual(mockEquipment);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: clientId,
          userId,
        },
      });
      expect(prisma.equipment.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          clientId,
          type: {
            contains: type,
            mode: 'insensitive',
          },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findOne', () => {
    const userId = 'user-123';
    const equipmentId = 'equipment-789';

    it('should return equipment with client and work orders', async () => {
      const mockEquipment = {
        id: equipmentId,
        userId,
        clientId: 'client-456',
        type: 'Ar-condicionado',
        brand: 'LG',
        client: {
          id: 'client-456',
          name: 'Cliente Teste',
        },
        workOrders: [
          {
            workOrder: {
              id: 'wo-1',
              title: 'Manutenção preventiva',
              status: 'COMPLETED',
              createdAt: new Date(),
            },
          },
        ],
        _count: {
          workOrders: 1,
        },
      };

      mockPrismaService.equipment.findFirst.mockResolvedValue(mockEquipment);

      const result = await service.findOne(userId, equipmentId);

      expect(result).toEqual(mockEquipment);
      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          workOrderEquipments: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
            select: {
              workOrder: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when equipment does not exist', async () => {
      mockPrismaService.equipment.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, equipmentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(userId, equipmentId)).rejects.toThrow(
        `Equipment with ID ${equipmentId} not found`,
      );

      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          workOrderEquipments: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
            select: {
              workOrder: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
          },
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
      });
    });
  });

  describe('update', () => {
    const userId = 'user-123';
    const equipmentId = 'equipment-789';
    const updateEquipmentDto: UpdateEquipmentDto = {
      brand: 'Samsung',
      model: 'Updated Model',
      notes: 'Updated notes',
    };

    it('should update equipment when it belongs to user', async () => {
      const mockExistingEquipment = {
        id: equipmentId,
        userId,
        clientId: 'client-456',
      };

      const mockUpdatedEquipment = {
        ...mockExistingEquipment,
        ...updateEquipmentDto,
        client: {
          id: 'client-456',
          name: 'Cliente Teste',
        },
      };

      mockPrismaService.equipment.findFirst.mockResolvedValue(
        mockExistingEquipment,
      );
      mockPrismaService.equipment.update.mockResolvedValue(
        mockUpdatedEquipment,
      );

      const result = await service.update(userId, equipmentId, updateEquipmentDto);

      expect(result).toEqual(mockUpdatedEquipment);
      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: expect.any(Object),
      });
      expect(prisma.equipment.update).toHaveBeenCalledWith({
        where: { id: equipmentId },
        data: updateEquipmentDto,
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when equipment does not exist', async () => {
      mockPrismaService.equipment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, equipmentId, updateEquipmentDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(userId, equipmentId, updateEquipmentDto),
      ).rejects.toThrow(`Equipment with ID ${equipmentId} not found`);

      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: expect.any(Object),
      });
      expect(prisma.equipment.update).not.toHaveBeenCalled();
    });

    it('should validate new clientId belongs to user when updating clientId', async () => {
      const updateWithNewClient: UpdateEquipmentDto = {
        clientId: 'client-new',
      };

      const mockExistingEquipment = {
        id: equipmentId,
        userId,
        clientId: 'client-old',
      };

      const mockNewClient = {
        id: 'client-new',
        name: 'New Client',
        userId,
      };

      const mockUpdatedEquipment = {
        ...mockExistingEquipment,
        clientId: 'client-new',
        client: {
          id: 'client-new',
          name: 'New Client',
        },
      };

      mockPrismaService.equipment.findFirst.mockResolvedValue(
        mockExistingEquipment,
      );
      mockPrismaService.client.findFirst.mockResolvedValue(mockNewClient);
      mockPrismaService.equipment.update.mockResolvedValue(
        mockUpdatedEquipment,
      );

      const result = await service.update(userId, equipmentId, updateWithNewClient);

      expect(result).toEqual(mockUpdatedEquipment);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'client-new',
          userId,
        },
      });
    });

    it('should throw ForbiddenException when new clientId does not belong to user', async () => {
      const updateWithNewClient: UpdateEquipmentDto = {
        clientId: 'client-unauthorized',
      };

      const mockExistingEquipment = {
        id: equipmentId,
        userId,
        clientId: 'client-old',
      };

      mockPrismaService.equipment.findFirst.mockResolvedValue(
        mockExistingEquipment,
      );
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, equipmentId, updateWithNewClient),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(userId, equipmentId, updateWithNewClient),
      ).rejects.toThrow(
        `Client with ID ${updateWithNewClient.clientId} not found or does not belong to you`,
      );

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'client-unauthorized',
          userId,
        },
      });
      expect(prisma.equipment.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const userId = 'user-123';
    const equipmentId = 'equipment-789';

    it('should delete equipment when it belongs to user', async () => {
      const mockExistingEquipment = {
        id: equipmentId,
        userId,
        clientId: 'client-456',
        client: { id: 'client-456', name: 'Test' },
        workOrders: [],
        _count: { workOrders: 0 },
      };

      mockPrismaService.equipment.findFirst.mockResolvedValue(
        mockExistingEquipment,
      );
      mockPrismaService.equipment.delete.mockResolvedValue(
        mockExistingEquipment,
      );

      const result = await service.remove(userId, equipmentId);

      expect(result).toEqual(mockExistingEquipment);
      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: expect.any(Object),
      });
      expect(prisma.equipment.delete).toHaveBeenCalledWith({
        where: { id: equipmentId },
      });
    });

    it('should throw NotFoundException when equipment does not exist', async () => {
      mockPrismaService.equipment.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, equipmentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(userId, equipmentId)).rejects.toThrow(
        `Equipment with ID ${equipmentId} not found`,
      );

      expect(prisma.equipment.findFirst).toHaveBeenCalledWith({
        where: {
          id: equipmentId,
          userId,
        },
        include: expect.any(Object),
      });
      expect(prisma.equipment.delete).not.toHaveBeenCalled();
    });
  });

  describe('count', () => {
    const userId = 'user-123';

    it('should return count of all equipment for user', async () => {
      mockPrismaService.equipment.count.mockResolvedValue(5);

      const result = await service.count(userId);

      expect(result).toBe(5);
      expect(prisma.equipment.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return count of equipment for specific client', async () => {
      const clientId = 'client-456';
      mockPrismaService.equipment.count.mockResolvedValue(3);

      const result = await service.count(userId, clientId);

      expect(result).toBe(3);
      expect(prisma.equipment.count).toHaveBeenCalledWith({
        where: {
          userId,
          clientId,
        },
      });
    });
  });

  describe('getByClient', () => {
    const userId = 'user-123';
    const clientId = 'client-456';

    it('should return all equipment for a specific client', async () => {
      const mockClient = {
        id: clientId,
        name: 'Cliente Teste',
        userId,
      };

      const mockEquipment = [
        {
          id: 'equipment-1',
          userId,
          clientId,
          type: 'Ar-condicionado',
          brand: 'LG',
          _count: { workOrders: 2 },
        },
        {
          id: 'equipment-2',
          userId,
          clientId,
          type: 'Geladeira',
          brand: 'Samsung',
          _count: { workOrders: 0 },
        },
      ];

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.equipment.findMany.mockResolvedValue(mockEquipment);

      const result = await service.getByClient(userId, clientId);

      expect(result).toEqual(mockEquipment);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: clientId,
          userId,
        },
      });
      expect(prisma.equipment.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          clientId,
        },
        include: {
          _count: {
            select: {
              workOrderEquipments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should throw ForbiddenException when client does not belong to user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.getByClient(userId, clientId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getByClient(userId, clientId)).rejects.toThrow(
        `Client with ID ${clientId} not found or does not belong to you`,
      );

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: clientId,
          userId,
        },
      });
      expect(prisma.equipment.findMany).not.toHaveBeenCalled();
    });
  });
});
