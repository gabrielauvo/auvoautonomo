import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ItemType } from './dto/create-item.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';

  const mockPrismaService = {
    productCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    item: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    bundleItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==================== CATEGORY TESTS ====================

  describe('Categories', () => {
    describe('createCategory', () => {
      it('should create a category', async () => {
        const dto = { name: 'Test Category', description: 'Test Description' };
        const expectedCategory = {
          id: 'cat-1',
          userId: mockUserId,
          ...dto,
          color: null,
          isActive: true,
        };

        mockPrismaService.productCategory.create.mockResolvedValue(expectedCategory);

        const result = await service.createCategory(mockUserId, dto);

        expect(result).toEqual(expectedCategory);
        expect(mockPrismaService.productCategory.create).toHaveBeenCalledWith({
          data: { ...dto, userId: mockUserId },
        });
      });
    });

    describe('findAllCategories', () => {
      it('should return all categories for user', async () => {
        const categories = [
          { id: 'cat-1', name: 'Category 1', userId: mockUserId },
          { id: 'cat-2', name: 'Category 2', userId: mockUserId },
        ];

        mockPrismaService.productCategory.findMany.mockResolvedValue(categories);

        const result = await service.findAllCategories(mockUserId);

        expect(result).toEqual(categories);
        expect(mockPrismaService.productCategory.findMany).toHaveBeenCalledWith({
          where: { userId: mockUserId },
          include: { _count: { select: { items: true } } },
          orderBy: { name: 'asc' },
        });
      });

      it('should filter by isActive', async () => {
        const categories = [{ id: 'cat-1', name: 'Active Category', isActive: true }];

        mockPrismaService.productCategory.findMany.mockResolvedValue(categories);

        const result = await service.findAllCategories(mockUserId, true);

        expect(result).toEqual(categories);
        expect(mockPrismaService.productCategory.findMany).toHaveBeenCalledWith({
          where: { userId: mockUserId, isActive: true },
          include: { _count: { select: { items: true } } },
          orderBy: { name: 'asc' },
        });
      });
    });

    describe('findOneCategory', () => {
      it('should return a category', async () => {
        const category = { id: 'cat-1', name: 'Category 1', userId: mockUserId, _count: { items: 0 } };

        mockPrismaService.productCategory.findFirst.mockResolvedValue(category);

        const result = await service.findOneCategory(mockUserId, 'cat-1');

        expect(result).toEqual(category);
      });

      it('should throw NotFoundException if category not found', async () => {
        mockPrismaService.productCategory.findFirst.mockResolvedValue(null);

        await expect(service.findOneCategory(mockUserId, 'cat-999')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('updateCategory', () => {
      it('should update a category', async () => {
        const existingCategory = { id: 'cat-1', name: 'Category 1', userId: mockUserId, _count: { items: 0 } };
        const updateDto = { name: 'Updated Category' };
        const updatedCategory = { ...existingCategory, ...updateDto };

        mockPrismaService.productCategory.findFirst.mockResolvedValue(existingCategory);
        mockPrismaService.productCategory.update.mockResolvedValue(updatedCategory);

        const result = await service.updateCategory(mockUserId, 'cat-1', updateDto);

        expect(result).toEqual(updatedCategory);
        expect(mockPrismaService.productCategory.update).toHaveBeenCalledWith({
          where: { id: 'cat-1' },
          data: updateDto,
        });
      });
    });

    describe('removeCategory', () => {
      it('should delete a category without items', async () => {
        const category = {
          id: 'cat-1',
          name: 'Category 1',
          userId: mockUserId,
          _count: { items: 0 },
        };

        mockPrismaService.productCategory.findFirst.mockResolvedValue(category);
        mockPrismaService.productCategory.delete.mockResolvedValue(category);

        const result = await service.removeCategory(mockUserId, 'cat-1');

        expect(mockPrismaService.productCategory.delete).toHaveBeenCalled();
        expect(result).toEqual(category);
      });

      it('should throw BadRequestException if category has items', async () => {
        const category = {
          id: 'cat-1',
          name: 'Category 1',
          userId: mockUserId,
          _count: { items: 5 },
        };

        mockPrismaService.productCategory.findFirst.mockResolvedValue(category);

        await expect(service.removeCategory(mockUserId, 'cat-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  // ==================== ITEM TESTS ====================

  describe('Items', () => {
    describe('createItem', () => {
      it('should create an item', async () => {
        const dto = {
          name: 'Test Item',
          basePrice: 100,
          type: ItemType.PRODUCT,
          unit: 'UN',
        };
        const expectedItem = {
          id: 'item-1',
          userId: mockUserId,
          name: dto.name,
          type: dto.type,
          unit: dto.unit,
          basePrice: new Decimal(100),
          category: null,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };

        mockPrismaService.item.create.mockResolvedValue(expectedItem);

        const result = await service.createItem(mockUserId, dto);

        expect(result).toEqual(expectedItem);
      });

      it('should validate category exists if provided', async () => {
        const dto = {
          name: 'Test Item',
          basePrice: 100,
          categoryId: 'cat-invalid',
          type: ItemType.PRODUCT,
          unit: 'UN',
        };

        mockPrismaService.productCategory.findFirst.mockResolvedValue(null);

        await expect(service.createItem(mockUserId, dto)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('findAllItems', () => {
      it('should return all items', async () => {
        const items = [
          { id: 'item-1', name: 'Item 1' },
          { id: 'item-2', name: 'Item 2' },
        ];

        mockPrismaService.item.findMany.mockResolvedValue(items);

        const result = await service.findAllItems(mockUserId);

        expect(result).toEqual(items);
      });

      it('should filter by type', async () => {
        const items = [{ id: 'item-1', name: 'Service', type: 'SERVICE' }];

        mockPrismaService.item.findMany.mockResolvedValue(items);

        const result = await service.findAllItems(mockUserId, { type: ItemType.SERVICE });

        expect(mockPrismaService.item.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ type: ItemType.SERVICE }),
          }),
        );
      });

      it('should filter by search', async () => {
        mockPrismaService.item.findMany.mockResolvedValue([]);

        await service.findAllItems(mockUserId, { search: 'test' });

        expect(mockPrismaService.item.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [
                { name: { contains: 'test', mode: 'insensitive' } },
                { sku: { contains: 'test', mode: 'insensitive' } },
                { description: { contains: 'test', mode: 'insensitive' } },
              ],
            }),
          }),
        );
      });
    });

    describe('findOneItem', () => {
      it('should return an item with relations', async () => {
        const item = {
          id: 'item-1',
          name: 'Item 1',
          category: { id: 'cat-1', name: 'Category' },
          bundleAsParent: [],
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };

        mockPrismaService.item.findFirst.mockResolvedValue(item);

        const result = await service.findOneItem(mockUserId, 'item-1');

        expect(result).toEqual(item);
      });

      it('should throw NotFoundException if item not found', async () => {
        mockPrismaService.item.findFirst.mockResolvedValue(null);

        await expect(service.findOneItem(mockUserId, 'item-999')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('removeItem', () => {
      it('should hard delete item without references', async () => {
        const item = {
          id: 'item-1',
          name: 'Item 1',
          type: 'PRODUCT',
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };

        mockPrismaService.item.findFirst.mockResolvedValue(item);
        mockPrismaService.item.delete.mockResolvedValue(item);

        const result = await service.removeItem(mockUserId, 'item-1');

        expect(mockPrismaService.item.delete).toHaveBeenCalled();
      });

      it('should soft delete item with references', async () => {
        const item = {
          id: 'item-1',
          name: 'Item 1',
          isActive: true,
          type: 'PRODUCT',
          _count: { quoteItems: 5, workOrderItems: 2, bundleAsParent: 0 },
        };

        mockPrismaService.item.findFirst.mockResolvedValue(item);
        mockPrismaService.item.update.mockResolvedValue({ ...item, isActive: false });

        const result = await service.removeItem(mockUserId, 'item-1');

        expect(mockPrismaService.item.update).toHaveBeenCalledWith({
          where: { id: 'item-1' },
          data: { isActive: false },
        });
      });
    });
  });

  // ==================== BUNDLE TESTS ====================

  describe('Bundles', () => {
    describe('addBundleItem', () => {
      it('should add item to bundle', async () => {
        const bundle = {
          id: 'bundle-1',
          name: 'Bundle',
          type: 'BUNDLE',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };
        const childItem = {
          id: 'item-1',
          name: 'Child Item',
          type: 'PRODUCT',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };
        const dto = { itemId: 'item-1', quantity: 2 };

        mockPrismaService.item.findFirst
          .mockResolvedValueOnce(bundle)
          .mockResolvedValueOnce(childItem);
        mockPrismaService.bundleItem.findUnique.mockResolvedValue(null);
        mockPrismaService.bundleItem.create.mockResolvedValue({
          id: 'bi-1',
          bundleId: 'bundle-1',
          itemId: 'item-1',
          quantity: new Decimal(2),
        });

        const result = await service.addBundleItem(mockUserId, 'bundle-1', dto);

        expect(mockPrismaService.bundleItem.create).toHaveBeenCalled();
      });

      it('should throw if item is not a BUNDLE type', async () => {
        const notBundle = {
          id: 'item-1',
          name: 'Product',
          type: 'PRODUCT',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };

        mockPrismaService.item.findFirst.mockResolvedValue(notBundle);

        await expect(
          service.addBundleItem(mockUserId, 'item-1', { itemId: 'item-2', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw if adding bundle to itself', async () => {
        const bundle = {
          id: 'bundle-1',
          name: 'Bundle',
          type: 'BUNDLE',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };

        mockPrismaService.item.findFirst.mockResolvedValue(bundle);

        await expect(
          service.addBundleItem(mockUserId, 'bundle-1', { itemId: 'bundle-1', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should update quantity if item already in bundle', async () => {
        const bundle = {
          id: 'bundle-1',
          name: 'Bundle',
          type: 'BUNDLE',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };
        const childItem = {
          id: 'item-1',
          name: 'Child Item',
          type: 'PRODUCT',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };
        const existingBundleItem = {
          id: 'bi-1',
          bundleId: 'bundle-1',
          itemId: 'item-1',
        };

        mockPrismaService.item.findFirst
          .mockResolvedValueOnce(bundle)
          .mockResolvedValueOnce(childItem);
        mockPrismaService.bundleItem.findUnique.mockResolvedValue(existingBundleItem);
        mockPrismaService.bundleItem.update.mockResolvedValue({
          ...existingBundleItem,
          quantity: new Decimal(5),
        });

        await service.addBundleItem(mockUserId, 'bundle-1', { itemId: 'item-1', quantity: 5 });

        expect(mockPrismaService.bundleItem.update).toHaveBeenCalled();
      });
    });

    describe('getBundleItems', () => {
      it('should return bundle items with details', async () => {
        const bundle = {
          id: 'bundle-1',
          name: 'Test Bundle',
          type: 'BUNDLE',
          userId: mockUserId,
          _count: { quoteItems: 0, workOrderItems: 0, bundleAsParent: 0 },
        };
        const bundleItems = [
          {
            id: 'bi-1',
            item: { id: 'item-1', name: 'Item 1', basePrice: new Decimal(100) },
            quantity: new Decimal(2),
          },
        ];

        mockPrismaService.item.findFirst.mockResolvedValue(bundle);
        mockPrismaService.bundleItem.findMany.mockResolvedValue(bundleItems);

        const result = await service.getBundleItems(mockUserId, 'bundle-1');

        expect(result.bundleId).toBe('bundle-1');
        expect(result.items).toEqual(bundleItems);
        expect(result.totalPrice).toBe(200);
      });
    });

    describe('calculateBundlePrice', () => {
      it('should calculate total bundle price', async () => {
        const bundleItems = [
          {
            id: 'bi-1',
            item: { basePrice: new Decimal(100) },
            quantity: new Decimal(2),
          },
          {
            id: 'bi-2',
            item: { basePrice: new Decimal(50) },
            quantity: new Decimal(3),
          },
        ];

        mockPrismaService.bundleItem.findMany.mockResolvedValue(bundleItems);

        const result = await service.calculateBundlePrice(mockUserId, 'bundle-1');

        // 100 * 2 + 50 * 3 = 350
        expect(result).toBe(350);
      });
    });
  });

  // ==================== STATS TESTS ====================

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockPrismaService.item.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(60) // products
        .mockResolvedValueOnce(35) // services
        .mockResolvedValueOnce(5) // bundles
        .mockResolvedValueOnce(90) // active
        .mockResolvedValueOnce(10); // inactive
      mockPrismaService.productCategory.count.mockResolvedValue(5);

      const result = await service.getStats(mockUserId);

      expect(result).toEqual({
        categories: 5,
        totalItems: 100,
        products: 60,
        services: 35,
        bundles: 5,
        activeItems: 90,
        inactiveItems: 10,
      });
    });
  });
});
