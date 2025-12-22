import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    supplier: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockSupplier = {
    id: 'supplier-id',
    userId: 'user-id',
    name: 'Fornecedor Teste',
    document: '12.345.678/0001-90',
    email: 'fornecedor@teste.com',
    phone: '(11) 99999-9999',
    address: 'Rua Teste, 123',
    notes: 'Observações',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    _count: { expenses: 2 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
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

    service = module.get<SuppliersService>(SuppliersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const createDto: CreateSupplierDto = {
        name: 'Fornecedor Teste',
        document: '12.345.678/0001-90',
        email: 'fornecedor@teste.com',
        phone: '(11) 99999-9999',
        address: 'Rua Teste, 123',
        notes: 'Observações',
      };

      mockPrismaService.supplier.create.mockResolvedValue(mockSupplier);

      const result = await service.create('user-id', createDto);

      expect(mockPlanLimitsService.checkLimitOrThrow).toHaveBeenCalledWith({
        userId: 'user-id',
        resource: 'SUPPLIER',
      });
      expect(prisma.supplier.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          userId: 'user-id',
        },
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
      });
      expect(result).toEqual(mockSupplier);
    });

    it('should throw error when plan limit reached', async () => {
      mockPlanLimitsService.checkLimitOrThrow.mockRejectedValue(
        new Error('LIMIT_REACHED'),
      );

      const createDto: CreateSupplierDto = {
        name: 'Fornecedor Teste',
      };

      await expect(service.create('user-id', createDto)).rejects.toThrow(
        'LIMIT_REACHED',
      );
    });
  });

  describe('findAll', () => {
    it('should return all suppliers for a user', async () => {
      const mockSuppliers = [mockSupplier];
      mockPrismaService.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.findAll('user-id');

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      expect(result).toEqual(mockSuppliers);
    });

    it('should filter suppliers by search term', async () => {
      const mockSuppliers = [mockSupplier];
      mockPrismaService.supplier.findMany.mockResolvedValue(mockSuppliers);

      const result = await service.findAll('user-id', { search: 'Teste' });

      expect(prisma.supplier.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deletedAt: null,
          OR: [
            { name: { contains: 'Teste', mode: 'insensitive' } },
            { email: { contains: 'Teste', mode: 'insensitive' } },
            { document: { contains: 'Teste' } },
            { phone: { contains: 'Teste' } },
          ],
        },
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      expect(result).toEqual(mockSuppliers);
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      const mockSupplierDetail = {
        ...mockSupplier,
        expenses: [],
      };
      mockPrismaService.supplier.findFirst.mockResolvedValue(mockSupplierDetail);

      const result = await service.findOne('user-id', 'supplier-id');

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: 'supplier-id', userId: 'user-id', deletedAt: null },
        include: {
          expenses: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: {
            select: {
              expenses: true,
            },
          },
        },
      });
      expect(result).toEqual(mockSupplierDetail);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        'Fornecedor com ID invalid-id não encontrado',
      );
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      const updateDto: UpdateSupplierDto = {
        name: 'Fornecedor Atualizado',
        phone: '(11) 88888-8888',
      };

      const mockSupplierDetail = {
        ...mockSupplier,
        expenses: [],
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue(mockSupplierDetail);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...mockSupplier,
        ...updateDto,
      });

      const result = await service.update('user-id', 'supplier-id', updateDto);

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 'supplier-id' },
        data: updateDto,
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
      });
      expect(result.name).toBe('Fornecedor Atualizado');
    });

    it('should throw NotFoundException when updating non-existent supplier', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-id', 'invalid-id', { name: 'Teste' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a supplier', async () => {
      const mockSupplierDetail = {
        ...mockSupplier,
        expenses: [],
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue(mockSupplierDetail);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...mockSupplier,
        deletedAt: new Date(),
      });

      const result = await service.remove('user-id', 'supplier-id');

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: 'supplier-id' },
        data: {
          deletedAt: expect.any(Date),
        },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when deleting non-existent supplier', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('count', () => {
    it('should return count of suppliers for a user', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(5);

      const result = await service.count('user-id');

      expect(prisma.supplier.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
      });
      expect(result).toBe(5);
    });
  });
});
