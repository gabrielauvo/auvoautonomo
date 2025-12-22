/**
 * CatalogItemRepository Tests
 *
 * Testes para operações do repositório de itens do catálogo.
 */

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockCount = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  count: (...args: unknown[]) => mockCount(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { CatalogItemRepository } from '../../../src/db/repositories/CatalogItemRepository';
import { CatalogItem, BundleItem, ItemType } from '../../../src/db/schema';

describe('CatalogItemRepository', () => {
  const technicianId = 'tech-123';

  const mockItem: CatalogItem = {
    id: 'item-1',
    name: 'Test Service',
    description: 'Test description',
    type: 'SERVICE' as ItemType,
    categoryId: 'cat-1',
    categoryName: 'Category 1',
    sku: 'SKU-001',
    basePrice: 100,
    unit: 'UN',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  const mockBundleItem: BundleItem = {
    id: 'bi-1',
    bundleId: 'bundle-1',
    itemId: 'item-1',
    itemName: 'Test Item',
    itemType: 'SERVICE',
    itemUnit: 'UN',
    itemBasePrice: 100,
    quantity: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active items for a technician', async () => {
      mockFindAll.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.getAll(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockItem]);
    });

    it('should pass additional options', async () => {
      mockFindAll.mockResolvedValue([]);

      await CatalogItemRepository.getAll(technicianId, { limit: 10, offset: 5 });

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getAllIncludingInactive', () => {
    it('should return all items including inactive', async () => {
      mockFindAll.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.getAllIncludingInactive(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getById', () => {
    it('should return item by ID', async () => {
      mockFindById.mockResolvedValue(mockItem);

      const result = await CatalogItemRepository.getById('item-1');

      expect(mockFindById).toHaveBeenCalledWith('catalog_items', 'item-1');
      expect(result).toEqual(mockItem);
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await CatalogItemRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByIdWithBundleItems', () => {
    it('should return item without bundle items for non-BUNDLE type', async () => {
      mockFindById.mockResolvedValue(mockItem);

      const result = await CatalogItemRepository.getByIdWithBundleItems('item-1');

      expect(result).toEqual(mockItem);
    });

    it('should return item with bundle items for BUNDLE type', async () => {
      const bundleItem = { ...mockItem, id: 'bundle-1', type: 'BUNDLE' as ItemType };
      mockFindById.mockResolvedValue(bundleItem);
      mockFindAll.mockResolvedValue([mockBundleItem]);

      const result = await CatalogItemRepository.getByIdWithBundleItems('bundle-1');

      expect(result).toEqual({ ...bundleItem, bundleItems: [mockBundleItem] });
    });

    it('should return null if not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await CatalogItemRepository.getByIdWithBundleItems('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByCategory', () => {
    it('should return items by category', async () => {
      mockFindAll.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.getByCategory(technicianId, 'cat-1');

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId, categoryId: 'cat-1', isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getByType', () => {
    it('should return items by type', async () => {
      mockFindAll.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.getByType(technicianId, 'SERVICE');

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId, type: 'SERVICE', isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getByTypeAndCategory', () => {
    it('should return items by type and category', async () => {
      mockFindAll.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.getByTypeAndCategory(technicianId, 'SERVICE', 'cat-1');

      expect(mockFindAll).toHaveBeenCalledWith('catalog_items', {
        where: { technicianId, type: 'SERVICE', categoryId: 'cat-1', isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getPaginated', () => {
    it('should return paginated items', async () => {
      mockRawQuery
        .mockResolvedValueOnce([mockItem])
        .mockResolvedValueOnce([{ count: 100 }]);

      const result = await CatalogItemRepository.getPaginated(technicianId, 1, 50);

      expect(mockRawQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        data: [mockItem],
        total: 100,
        pages: 2,
      });
    });

    it('should apply filters', async () => {
      mockRawQuery
        .mockResolvedValueOnce([mockItem])
        .mockResolvedValueOnce([{ count: 10 }]);

      await CatalogItemRepository.getPaginated(technicianId, 1, 50, {
        type: 'SERVICE',
        categoryId: 'cat-1',
        search: 'test',
      });

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = ?'),
        expect.arrayContaining([technicianId, 'SERVICE', 'cat-1'])
      );
    });
  });

  describe('search', () => {
    it('should search items by query', async () => {
      mockRawQuery.mockResolvedValue([mockItem]);

      const result = await CatalogItemRepository.search(technicianId, 'test');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('name LIKE'),
        expect.arrayContaining([technicianId, '%test%'])
      );
      expect(result).toEqual([mockItem]);
    });

    it('should apply type and category filters', async () => {
      mockRawQuery.mockResolvedValue([]);

      await CatalogItemRepository.search(technicianId, 'test', {
        type: 'SERVICE',
        categoryId: 'cat-1',
        limit: 10,
      });

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = ?'),
        expect.arrayContaining(['SERVICE', 'cat-1', 10])
      );
    });
  });

  describe('count', () => {
    it('should return count of items', async () => {
      mockCount.mockResolvedValue(42);

      const result = await CatalogItemRepository.count(technicianId);

      expect(mockCount).toHaveBeenCalledWith('catalog_items', { technicianId, isActive: 1 });
      expect(result).toBe(42);
    });

    it('should apply filters', async () => {
      mockCount.mockResolvedValue(10);

      await CatalogItemRepository.count(technicianId, { type: 'SERVICE', categoryId: 'cat-1' });

      expect(mockCount).toHaveBeenCalledWith('catalog_items', {
        technicianId,
        isActive: 1,
        type: 'SERVICE',
        categoryId: 'cat-1',
      });
    });
  });

  describe('getModifiedAfter', () => {
    it('should return items modified after date', async () => {
      mockRawQuery.mockResolvedValue([mockItem]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      const result = await CatalogItemRepository.getModifiedAfter(technicianId, afterDate);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('updatedAt > ?'),
        [technicianId, afterDate, 100]
      );
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getBundleItems', () => {
    it('should return bundle items', async () => {
      mockFindAll.mockResolvedValue([mockBundleItem]);

      const result = await CatalogItemRepository.getBundleItems('bundle-1');

      expect(mockFindAll).toHaveBeenCalledWith('bundle_items', {
        where: { bundleId: 'bundle-1' },
      });
      expect(result).toEqual([mockBundleItem]);
    });
  });

  describe('calculateBundlePrice', () => {
    it('should calculate bundle total price', async () => {
      mockFindAll.mockResolvedValue([
        { ...mockBundleItem, itemBasePrice: 100, quantity: 2 },
        { ...mockBundleItem, id: 'bi-2', itemBasePrice: 50, quantity: 3 },
      ]);

      const result = await CatalogItemRepository.calculateBundlePrice('bundle-1');

      // (100 * 2) + (50 * 3) = 350
      expect(result).toBe(350);
    });

    it('should return 0 for empty bundle', async () => {
      mockFindAll.mockResolvedValue([]);

      const result = await CatalogItemRepository.calculateBundlePrice('bundle-1');

      expect(result).toBe(0);
    });
  });

  describe('upsert', () => {
    it('should insert new item', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await CatalogItemRepository.upsert(mockItem);

      expect(mockInsert).toHaveBeenCalledWith('catalog_items', expect.objectContaining({
        id: mockItem.id,
        isActive: 1,
        syncedAt: expect.any(String),
      }));
    });

    it('should update existing item', async () => {
      mockFindById.mockResolvedValue(mockItem);
      mockUpdate.mockResolvedValue(undefined);

      await CatalogItemRepository.upsert(mockItem);

      expect(mockUpdate).toHaveBeenCalledWith('catalog_items', mockItem.id, expect.objectContaining({
        syncedAt: expect.any(String),
      }));
    });
  });

  describe('batchUpsert', () => {
    it('should batch upsert items', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await CatalogItemRepository.batchUpsert([mockItem]);

      expect(mockInsert).toHaveBeenCalledWith('catalog_items', expect.objectContaining({
        id: mockItem.id,
      }));
    });

    it('should process bundle items for BUNDLE type', async () => {
      const bundleItem = {
        ...mockItem,
        id: 'bundle-1',
        type: 'BUNDLE' as ItemType,
        bundleItems: [mockBundleItem],
      };
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);
      mockRawQuery.mockResolvedValue(undefined);

      await CatalogItemRepository.batchUpsert([bundleItem]);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM bundle_items'),
        ['bundle-1']
      );
      expect(mockInsert).toHaveBeenCalledWith('bundle_items', expect.objectContaining({
        bundleId: 'bundle-1',
      }));
    });

    it('should do nothing for empty array', async () => {
      await CatalogItemRepository.batchUpsert([]);

      expect(mockFindById).not.toHaveBeenCalled();
    });
  });

  describe('deleteAll', () => {
    it('should delete all items and bundle items', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await CatalogItemRepository.deleteAll(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM bundle_items'),
        [technicianId]
      );
      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM catalog_items'),
        [technicianId]
      );
    });
  });

  describe('markSynced', () => {
    it('should update syncedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await CatalogItemRepository.markSynced('item-1');

      expect(mockUpdate).toHaveBeenCalledWith('catalog_items', 'item-1', {
        syncedAt: expect.any(String),
      });
    });
  });
});
