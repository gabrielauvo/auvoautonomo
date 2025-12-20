import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ItemsService } from './items.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto, ItemType } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Decimal } from '@prisma/client/runtime/library';

describe('ItemsService', () => {
  let service: ItemsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    item: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    productCategory: {
      findFirst: jest.fn(),
    },
  };

  const mockItem = {
    id: 'item-id',
    userId: 'user-id',
    name: 'Test Item',
    description: 'Test description',
    type: ItemType.PRODUCT,
    sku: 'PROD-001',
    basePrice: new Decimal(100.0),
    costPrice: new Decimal(60.0),
    unit: 'UN',
    categoryId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const createItemDto: CreateItemDto = {
        name: 'Test Item',
        description: 'Test description',
        type: ItemType.PRODUCT,
        sku: 'PROD-001',
        basePrice: 100.0,
        costPrice: 60.0,
        unit: 'UN',
        isActive: true,
      };

      mockPrismaService.item.create.mockResolvedValue(mockItem);

      const result = await service.create('user-id', createItemDto);

      expect(prisma.item.create).toHaveBeenCalled();
      expect(result).toEqual(mockItem);
    });
  });

  describe('findAll', () => {
    it('should return all items for a user', async () => {
      const mockItems = [mockItem];
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);

      const result = await service.findAll('user-id');

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      expect(result).toEqual(mockItems);
    });

    it('should filter items by type', async () => {
      const mockItems = [mockItem];
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);

      await service.findAll('user-id', ItemType.PRODUCT);

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', type: ItemType.PRODUCT },
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should filter items by search query', async () => {
      const mockItems = [mockItem];
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);

      await service.findAll('user-id', undefined, undefined, 'Test');

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          OR: [
            { name: { contains: 'Test', mode: 'insensitive' } },
            { sku: { contains: 'Test', mode: 'insensitive' } },
            { description: { contains: 'Test', mode: 'insensitive' } },
          ],
        },
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });

    it('should filter items by active status', async () => {
      const mockItems = [mockItem];
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);

      await service.findAll('user-id', undefined, undefined, undefined, true);

      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', isActive: true },
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return an item by id', async () => {
      const mockItemDetail = {
        ...mockItem,
        _count: { quoteItems: 5, workOrderItems: 2 },
      };

      mockPrismaService.item.findFirst.mockResolvedValue(mockItemDetail);

      const result = await service.findOne('user-id', 'item-id');

      expect(result).toEqual(mockItemDetail);
    });

    it('should throw NotFoundException when item not found', async () => {
      mockPrismaService.item.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        'Item with ID invalid-id not found',
      );
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const updateItemDto: UpdateItemDto = {
        name: 'Updated Item',
        basePrice: 120.0,
      };

      const mockItemDetail = {
        ...mockItem,
        _count: { quoteItems: 5, workOrderItems: 2 },
      };

      mockPrismaService.item.findFirst.mockResolvedValue(mockItemDetail);
      mockPrismaService.item.update.mockResolvedValue({
        ...mockItem,
        name: 'Updated Item',
        basePrice: new Decimal(120.0),
      });

      const result = await service.update('user-id', 'item-id', updateItemDto);

      expect(prisma.item.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Item');
    });

    it('should throw NotFoundException when updating non-existent item', async () => {
      mockPrismaService.item.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-id', 'invalid-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an item without references', async () => {
      const mockItemDetail = {
        ...mockItem,
        _count: { quoteItems: 0, workOrderItems: 0 },
      };

      mockPrismaService.item.findFirst.mockResolvedValue(mockItemDetail);
      mockPrismaService.item.delete.mockResolvedValue(mockItem);

      const result = await service.remove('user-id', 'item-id');

      expect(prisma.item.delete).toHaveBeenCalledWith({
        where: { id: 'item-id' },
      });
      expect(result).toEqual(mockItem);
    });

    it('should soft delete an item with references', async () => {
      const mockItemDetail = {
        ...mockItem,
        _count: { quoteItems: 5, workOrderItems: 2 },
      };

      mockPrismaService.item.findFirst.mockResolvedValue(mockItemDetail);
      mockPrismaService.item.update.mockResolvedValue({
        ...mockItem,
        isActive: false,
      });

      const result = await service.remove('user-id', 'item-id');

      expect(prisma.item.update).toHaveBeenCalledWith({
        where: { id: 'item-id' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when deleting non-existent item', async () => {
      mockPrismaService.item.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('count', () => {
    it('should return count of items for a user', async () => {
      mockPrismaService.item.count.mockResolvedValue(10);

      const result = await service.count('user-id');

      expect(prisma.item.count).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
      expect(result).toBe(10);
    });
  });

  describe('getStats', () => {
    it('should return statistics for items', async () => {
      mockPrismaService.item.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(12) // products
        .mockResolvedValueOnce(8) // services
        .mockResolvedValueOnce(0) // bundles
        .mockResolvedValueOnce(18) // active
        .mockResolvedValueOnce(2); // inactive

      const result = await service.getStats('user-id');

      expect(result).toEqual({
        total: 20,
        products: 12,
        services: 8,
        bundles: 0,
        active: 18,
        inactive: 2,
      });
    });
  });
});
