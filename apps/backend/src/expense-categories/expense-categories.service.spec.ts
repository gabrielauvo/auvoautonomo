import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ExpenseCategoriesService } from './expense-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    expenseCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockCategory = {
    id: 'category-id',
    userId: 'user-id',
    name: 'Material',
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { expenses: 3 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ExpenseCategoriesService>(ExpenseCategoriesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new expense category', async () => {
      const createDto: CreateExpenseCategoryDto = {
        name: 'Material',
        color: '#3B82F6',
      };

      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);
      mockPrismaService.expenseCategory.create.mockResolvedValue(mockCategory);

      const result = await service.create('user-id', createDto);

      expect(prisma.expenseCategory.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          name: { equals: 'Material', mode: 'insensitive' },
        },
      });
      expect(prisma.expenseCategory.create).toHaveBeenCalledWith({
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
      expect(result).toEqual(mockCategory);
    });

    it('should throw ConflictException when category name already exists', async () => {
      const createDto: CreateExpenseCategoryDto = {
        name: 'Material',
        color: '#3B82F6',
      };

      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(mockCategory);

      await expect(service.create('user-id', createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create('user-id', createDto)).rejects.toThrow(
        'Já existe uma categoria com o nome "Material"',
      );
    });
  });

  describe('findAll', () => {
    it('should return all categories for a user', async () => {
      const mockCategories = [mockCategory];
      mockPrismaService.expenseCategory.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll('user-id');

      expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
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
      expect(result).toEqual(mockCategories);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(mockCategory);

      const result = await service.findOne('user-id', 'category-id');

      expect(prisma.expenseCategory.findFirst).toHaveBeenCalledWith({
        where: { id: 'category-id', userId: 'user-id' },
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        'Categoria com ID invalid-id não encontrada',
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updateDto: UpdateExpenseCategoryDto = {
        name: 'Materiais',
        color: '#10B981',
      };

      mockPrismaService.expenseCategory.findFirst
        .mockResolvedValueOnce(mockCategory) // findOne call
        .mockResolvedValueOnce(null); // duplicate check
      mockPrismaService.expenseCategory.update.mockResolvedValue({
        ...mockCategory,
        ...updateDto,
      });

      const result = await service.update('user-id', 'category-id', updateDto);

      expect(prisma.expenseCategory.update).toHaveBeenCalledWith({
        where: { id: 'category-id' },
        data: updateDto,
        include: {
          _count: {
            select: {
              expenses: true,
            },
          },
        },
      });
      expect(result.name).toBe('Materiais');
    });

    it('should throw ConflictException when updating to duplicate name', async () => {
      const updateDto: UpdateExpenseCategoryDto = {
        name: 'Combustível',
      };

      const existingCategory = {
        ...mockCategory,
        id: 'other-category-id',
        name: 'Combustível',
      };

      mockPrismaService.expenseCategory.findFirst
        .mockResolvedValueOnce(mockCategory) // findOne call
        .mockResolvedValueOnce(existingCategory); // duplicate check

      await expect(
        service.update('user-id', 'category-id', updateDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when updating non-existent category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-id', 'invalid-id', { name: 'Teste' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a category without expenses', async () => {
      const categoryWithoutExpenses = {
        ...mockCategory,
        _count: { expenses: 0 },
      };

      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(
        categoryWithoutExpenses,
      );
      mockPrismaService.expenseCategory.delete.mockResolvedValue(
        categoryWithoutExpenses,
      );

      const result = await service.remove('user-id', 'category-id');

      expect(prisma.expenseCategory.delete).toHaveBeenCalledWith({
        where: { id: 'category-id' },
      });
      expect(result).toEqual(categoryWithoutExpenses);
    });

    it('should throw ConflictException when deleting category with expenses', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(mockCategory);

      await expect(service.remove('user-id', 'category-id')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.remove('user-id', 'category-id')).rejects.toThrow(
        'Não é possível excluir a categoria "Material" pois existem 3 despesas vinculadas',
      );
    });

    it('should throw NotFoundException when deleting non-existent category', async () => {
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
