import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    client: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    id: 'client-id',
    userId: 'user-id',
    name: 'Test Client',
    email: 'client@test.com',
    phone: '(11) 99999-9999',
    address: 'Rua Teste, 123',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567',
    taxId: '123.456.789-00',
    notes: 'Test notes',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
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

    service = module.get<ClientsService>(ClientsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createClientDto: CreateClientDto = {
        name: 'Test Client',
        email: 'client@test.com',
        phone: '(11) 99999-9999',
        address: 'Rua Teste, 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
        taxId: '123.456.789-00',
        notes: 'Test notes',
      };

      mockPrismaService.client.create.mockResolvedValue({
        ...mockClient,
        equipment: [],
      });

      const result = await service.create('user-id', createClientDto);

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          ...createClientDto,
          userId: 'user-id',
        },
        include: {
          equipment: true,
        },
      });
      expect(result).toEqual({
        ...mockClient,
        equipment: [],
      });
    });
  });

  describe('findAll', () => {
    it('should return all clients for a user', async () => {
      const mockClients = [
        {
          ...mockClient,
          equipment: [],
          _count: { quotes: 2, workOrders: 1, invoices: 3 },
        },
      ];

      mockPrismaService.client.findMany.mockResolvedValue(mockClients);

      const result = await service.findAll('user-id');

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        include: {
          equipment: true,
          _count: {
            select: {
              quotes: true,
              workOrders: true,
              invoices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockClients);
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      const mockClientDetail = {
        ...mockClient,
        equipment: [],
        quotes: [],
        workOrders: [],
        invoices: [],
        _count: { quotes: 0, workOrders: 0, invoices: 0 },
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClientDetail);

      const result = await service.findOne('user-id', 'client-id');

      expect(result).toEqual(mockClientDetail);
    });

    it('should throw NotFoundException when client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        'Client with ID invalid-id not found',
      );
    });
  });

  describe('search', () => {
    it('should search clients by query', async () => {
      const mockClients = [
        {
          ...mockClient,
          equipment: [],
          _count: { quotes: 0, workOrders: 0, invoices: 0 },
        },
      ];

      mockPrismaService.client.findMany.mockResolvedValue(mockClients);

      const result = await service.search('user-id', 'Test');

      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          OR: [
            { name: { contains: 'Test', mode: 'insensitive' } },
            { email: { contains: 'Test', mode: 'insensitive' } },
            { phone: { contains: 'Test' } },
            { taxId: { contains: 'Test' } },
          ],
        },
        include: {
          equipment: true,
          _count: {
            select: {
              quotes: true,
              workOrders: true,
              invoices: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      expect(result).toEqual(mockClients);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const updateClientDto: UpdateClientDto = {
        name: 'Updated Client',
        phone: '(11) 88888-8888',
      };

      const mockClientDetail = {
        ...mockClient,
        equipment: [],
        quotes: [],
        workOrders: [],
        invoices: [],
        _count: { quotes: 0, workOrders: 0, invoices: 0 },
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClientDetail);
      mockPrismaService.client.update.mockResolvedValue({
        ...mockClient,
        ...updateClientDto,
        equipment: [],
      });

      const result = await service.update(
        'user-id',
        'client-id',
        updateClientDto,
      );

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: 'client-id' },
        data: updateClientDto,
        include: {
          equipment: true,
        },
      });
      expect(result.name).toBe('Updated Client');
    });

    it('should throw NotFoundException when updating non-existent client', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-id', 'invalid-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a client', async () => {
      const mockClientDetail = {
        ...mockClient,
        equipment: [],
        quotes: [],
        workOrders: [],
        invoices: [],
        _count: { quotes: 0, workOrders: 0, invoices: 0 },
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClientDetail);
      mockPrismaService.client.delete.mockResolvedValue(mockClient);

      const result = await service.remove('user-id', 'client-id');

      expect(prisma.client.delete).toHaveBeenCalledWith({
        where: { id: 'client-id' },
      });
      expect(result).toEqual(mockClient);
    });

    it('should throw NotFoundException when deleting non-existent client', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('count', () => {
    it('should return count of clients for a user', async () => {
      mockPrismaService.client.count.mockResolvedValue(5);

      const result = await service.count('user-id');

      expect(prisma.client.count).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(result).toBe(5);
    });
  });
});
