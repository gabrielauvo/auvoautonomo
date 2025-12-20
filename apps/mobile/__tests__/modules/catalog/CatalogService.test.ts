/**
 * CatalogService Tests
 *
 * Testes para o serviço de catálogo de produtos e serviços.
 */

// Mock repositories
const mockCategoryGetAll = jest.fn();
const mockCategoryGetById = jest.fn();
const mockCategorySearch = jest.fn();
const mockCategoryCount = jest.fn();

const mockItemGetAll = jest.fn();
const mockItemGetById = jest.fn();
const mockItemGetByIdWithBundleItems = jest.fn();
const mockItemGetByCategory = jest.fn();
const mockItemGetByType = jest.fn();
const mockItemSearch = jest.fn();
const mockItemGetPaginated = jest.fn();
const mockItemGetBundleItems = jest.fn();
const mockItemCalculateBundlePrice = jest.fn();
const mockItemCount = jest.fn();

jest.mock('../../../src/db/repositories/CategoryRepository', () => ({
  CategoryRepository: {
    getAll: (...args: unknown[]) => mockCategoryGetAll(...args),
    getById: (...args: unknown[]) => mockCategoryGetById(...args),
    search: (...args: unknown[]) => mockCategorySearch(...args),
    count: (...args: unknown[]) => mockCategoryCount(...args),
  },
}));

jest.mock('../../../src/db/repositories/CatalogItemRepository', () => ({
  CatalogItemRepository: {
    getAll: (...args: unknown[]) => mockItemGetAll(...args),
    getById: (...args: unknown[]) => mockItemGetById(...args),
    getByIdWithBundleItems: (...args: unknown[]) => mockItemGetByIdWithBundleItems(...args),
    getByCategory: (...args: unknown[]) => mockItemGetByCategory(...args),
    getByType: (...args: unknown[]) => mockItemGetByType(...args),
    search: (...args: unknown[]) => mockItemSearch(...args),
    getPaginated: (...args: unknown[]) => mockItemGetPaginated(...args),
    getBundleItems: (...args: unknown[]) => mockItemGetBundleItems(...args),
    calculateBundlePrice: (...args: unknown[]) => mockItemCalculateBundlePrice(...args),
    count: (...args: unknown[]) => mockItemCount(...args),
  },
}));

import { CatalogService } from '../../../src/modules/catalog/CatalogService';

describe('CatalogService', () => {
  const technicianId = 'tech-123';

  const mockCategory = {
    id: 'cat-1',
    name: 'Elétrica',
    description: 'Serviços elétricos',
    technicianId,
  };

  const mockItem = {
    id: 'item-1',
    name: 'Instalação de Tomada',
    type: 'SERVICE',
    basePrice: 150,
    categoryId: 'cat-1',
    technicianId,
  };

  const mockBundleItem = {
    id: 'bundle-1',
    name: 'Kit Elétrica Básico',
    type: 'BUNDLE',
    basePrice: 500,
    technicianId,
    bundleItems: [
      { id: 'bi-1', bundleId: 'bundle-1', itemId: 'item-1', quantity: 2 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    CatalogService.configure(technicianId);
  });

  describe('configure', () => {
    it('should set technician ID', () => {
      CatalogService.configure('new-tech');
      expect(() => CatalogService.configure('test')).not.toThrow();
    });
  });

  // =============================================================================
  // CATEGORIES
  // =============================================================================

  describe('getCategories', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.getCategories.call({ technicianId: null })
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should return all categories', async () => {
      mockCategoryGetAll.mockResolvedValue([mockCategory]);

      const result = await CatalogService.getCategories();

      expect(mockCategoryGetAll).toHaveBeenCalledWith(technicianId);
      expect(result).toEqual([mockCategory]);
    });
  });

  describe('getCategoryById', () => {
    it('should return category by ID', async () => {
      mockCategoryGetById.mockResolvedValue(mockCategory);

      const result = await CatalogService.getCategoryById('cat-1');

      expect(mockCategoryGetById).toHaveBeenCalledWith('cat-1');
      expect(result).toEqual(mockCategory);
    });

    it('should return null if not found', async () => {
      mockCategoryGetById.mockResolvedValue(null);

      const result = await CatalogService.getCategoryById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('searchCategories', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.searchCategories.call({ technicianId: null }, 'test')
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should search categories', async () => {
      mockCategorySearch.mockResolvedValue([mockCategory]);

      const result = await CatalogService.searchCategories('Elé');

      expect(mockCategorySearch).toHaveBeenCalledWith(technicianId, 'Elé', 50);
      expect(result).toEqual([mockCategory]);
    });

    it('should use custom limit', async () => {
      mockCategorySearch.mockResolvedValue([]);

      await CatalogService.searchCategories('test', 10);

      expect(mockCategorySearch).toHaveBeenCalledWith(technicianId, 'test', 10);
    });
  });

  // =============================================================================
  // ITEMS
  // =============================================================================

  describe('getItems', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.getItems.call({ technicianId: null })
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should return all items', async () => {
      mockItemGetAll.mockResolvedValue([mockItem]);

      const result = await CatalogService.getItems();

      expect(mockItemGetAll).toHaveBeenCalledWith(technicianId);
      expect(result).toEqual([mockItem]);
    });

    it('should filter by type', async () => {
      mockItemGetByType.mockResolvedValue([mockItem]);

      const result = await CatalogService.getItems('SERVICE');

      expect(mockItemGetByType).toHaveBeenCalledWith(technicianId, 'SERVICE');
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      mockItemGetById.mockResolvedValue(mockItem);

      const result = await CatalogService.getItemById('item-1');

      expect(mockItemGetById).toHaveBeenCalledWith('item-1');
      expect(result).toEqual(mockItem);
    });
  });

  describe('getItemWithBundle', () => {
    it('should return null if item not found', async () => {
      mockItemGetByIdWithBundleItems.mockResolvedValue(null);

      const result = await CatalogService.getItemWithBundle('non-existent');

      expect(result).toBeNull();
    });

    it('should return item without bundle total for non-bundles', async () => {
      mockItemGetByIdWithBundleItems.mockResolvedValue(mockItem);

      const result = await CatalogService.getItemWithBundle('item-1');

      expect(result).toEqual(mockItem);
      expect(mockItemCalculateBundlePrice).not.toHaveBeenCalled();
    });

    it('should return item with bundle total for bundles', async () => {
      mockItemGetByIdWithBundleItems.mockResolvedValue(mockBundleItem);
      mockItemCalculateBundlePrice.mockResolvedValue(750);

      const result = await CatalogService.getItemWithBundle('bundle-1');

      expect(mockItemCalculateBundlePrice).toHaveBeenCalledWith('bundle-1');
      expect(result?.bundleTotal).toBe(750);
    });
  });

  describe('getItemsByCategory', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.getItemsByCategory.call({ technicianId: null }, 'cat-1')
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should return items by category', async () => {
      mockItemGetByCategory.mockResolvedValue([mockItem]);

      const result = await CatalogService.getItemsByCategory('cat-1');

      expect(mockItemGetByCategory).toHaveBeenCalledWith(technicianId, 'cat-1');
      expect(result).toEqual([mockItem]);
    });
  });

  describe('getItemsByType', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.getItemsByType.call({ technicianId: null }, 'SERVICE')
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should return items by type', async () => {
      mockItemGetByType.mockResolvedValue([mockItem]);

      const result = await CatalogService.getItemsByType('SERVICE');

      expect(mockItemGetByType).toHaveBeenCalledWith(technicianId, 'SERVICE');
      expect(result).toEqual([mockItem]);
    });
  });

  describe('searchItems', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.searchItems.call({ technicianId: null })
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should search items with options', async () => {
      mockItemSearch.mockResolvedValue([mockItem]);

      const result = await CatalogService.searchItems({
        query: 'Tomada',
        type: 'SERVICE',
        categoryId: 'cat-1',
        limit: 10,
      });

      expect(mockItemSearch).toHaveBeenCalledWith(technicianId, 'Tomada', {
        limit: 10,
        type: 'SERVICE',
        categoryId: 'cat-1',
      });
      expect(result).toEqual([mockItem]);
    });

    it('should use empty query by default', async () => {
      mockItemSearch.mockResolvedValue([]);

      await CatalogService.searchItems();

      expect(mockItemSearch).toHaveBeenCalledWith(technicianId, '', expect.any(Object));
    });
  });

  describe('getItemsPaginated', () => {
    it('should throw if not configured', async () => {
      await expect(
        CatalogService.getItemsPaginated.call({ technicianId: null })
      ).rejects.toThrow('CatalogService not configured');
    });

    it('should return paginated items', async () => {
      mockItemGetPaginated.mockResolvedValue({ data: [mockItem], total: 10, pages: 1 });

      const result = await CatalogService.getItemsPaginated(1, 50);

      expect(mockItemGetPaginated).toHaveBeenCalledWith(technicianId, 1, 50, undefined);
      expect(result.data).toEqual([mockItem]);
    });

    it('should pass filters', async () => {
      mockItemGetPaginated.mockResolvedValue({ data: [], total: 0, pages: 0 });

      await CatalogService.getItemsPaginated(2, 20, { type: 'PRODUCT', search: 'cable' });

      expect(mockItemGetPaginated).toHaveBeenCalledWith(technicianId, 2, 20, {
        type: 'PRODUCT',
        search: 'cable',
      });
    });
  });

  // =============================================================================
  // BUNDLES
  // =============================================================================

  describe('getBundles', () => {
    it('should return all bundles', async () => {
      mockItemGetByType.mockResolvedValue([mockBundleItem]);

      const result = await CatalogService.getBundles();

      expect(mockItemGetByType).toHaveBeenCalledWith(technicianId, 'BUNDLE');
      expect(result).toEqual([mockBundleItem]);
    });
  });

  describe('getBundleItems', () => {
    it('should return bundle items', async () => {
      mockItemGetBundleItems.mockResolvedValue(mockBundleItem.bundleItems);

      const result = await CatalogService.getBundleItems('bundle-1');

      expect(mockItemGetBundleItems).toHaveBeenCalledWith('bundle-1');
      expect(result).toEqual(mockBundleItem.bundleItems);
    });
  });

  describe('calculateBundlePrice', () => {
    it('should calculate bundle price', async () => {
      mockItemCalculateBundlePrice.mockResolvedValue(750);

      const result = await CatalogService.calculateBundlePrice('bundle-1');

      expect(mockItemCalculateBundlePrice).toHaveBeenCalledWith('bundle-1');
      expect(result).toBe(750);
    });
  });

  // =============================================================================
  // STATISTICS
  // =============================================================================

  describe('getStats', () => {
    it('should return zeros if not configured', async () => {
      const service = Object.create(CatalogService);
      service.technicianId = null;

      const result = await CatalogService.getStats.call({ technicianId: null });

      expect(result).toEqual({
        totalItems: 0,
        totalProducts: 0,
        totalServices: 0,
        totalBundles: 0,
        totalCategories: 0,
      });
    });

    it('should return catalog statistics', async () => {
      mockItemCount
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(50)   // products
        .mockResolvedValueOnce(40)   // services
        .mockResolvedValueOnce(10);  // bundles
      mockCategoryCount.mockResolvedValue(5);

      const result = await CatalogService.getStats();

      expect(result).toEqual({
        totalItems: 100,
        totalProducts: 50,
        totalServices: 40,
        totalBundles: 10,
        totalCategories: 5,
      });
    });
  });

  // =============================================================================
  // HELPERS
  // =============================================================================

  describe('formatPrice', () => {
    it('should format price in BRL', () => {
      const result = CatalogService.formatPrice(1500.50);

      expect(result).toMatch(/R\$\s?1\.500,50/);
    });

    it('should format zero', () => {
      const result = CatalogService.formatPrice(0);

      expect(result).toMatch(/R\$\s?0,00/);
    });
  });

  describe('getTypeLabel', () => {
    it('should return Produto for PRODUCT', () => {
      expect(CatalogService.getTypeLabel('PRODUCT')).toBe('Produto');
    });

    it('should return Serviço for SERVICE', () => {
      expect(CatalogService.getTypeLabel('SERVICE')).toBe('Serviço');
    });

    it('should return Kit for BUNDLE', () => {
      expect(CatalogService.getTypeLabel('BUNDLE')).toBe('Kit');
    });

    it('should return type itself for unknown', () => {
      expect(CatalogService.getTypeLabel('UNKNOWN' as any)).toBe('UNKNOWN');
    });
  });

  describe('getTypeColor', () => {
    it('should return blue for PRODUCT', () => {
      expect(CatalogService.getTypeColor('PRODUCT')).toBe('#3498db');
    });

    it('should return green for SERVICE', () => {
      expect(CatalogService.getTypeColor('SERVICE')).toBe('#2ecc71');
    });

    it('should return purple for BUNDLE', () => {
      expect(CatalogService.getTypeColor('BUNDLE')).toBe('#9b59b6');
    });

    it('should return gray for unknown', () => {
      expect(CatalogService.getTypeColor('UNKNOWN' as any)).toBe('#95a5a6');
    });
  });
});
