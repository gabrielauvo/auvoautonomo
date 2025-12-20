/**
 * Catalog Service Tests
 *
 * Testes unitários para o serviço de catálogo
 * Cobre:
 * - Helper functions (formatItemType, getItemTypeBadgeColor, calculateBundlePrice, canDeleteItem)
 */

import {
  formatItemType,
  getItemTypeBadgeColor,
  calculateBundlePrice,
  canDeleteItem,
  type CatalogItem,
  type BundleItem,
  type ItemType,
} from '../catalog.service';

// Mock catalog item factory
function createMockItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: '1',
    userId: 'user-1',
    name: 'Item Teste',
    type: 'PRODUCT',
    unit: 'un',
    basePrice: 100,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Mock bundle item factory
function createMockBundleItem(overrides: Partial<BundleItem> = {}): BundleItem {
  return {
    id: 'bi-1',
    bundleId: 'bundle-1',
    itemId: 'item-1',
    quantity: 1,
    createdAt: '2024-01-01T00:00:00Z',
    item: {
      id: 'item-1',
      name: 'Item do Kit',
      type: 'PRODUCT',
      unit: 'un',
      basePrice: 50,
    },
    ...overrides,
  };
}

describe('Catalog Service', () => {
  describe('formatItemType', () => {
    it('should return "Produto" for PRODUCT type', () => {
      expect(formatItemType('PRODUCT')).toBe('Produto');
    });

    it('should return "Serviço" for SERVICE type', () => {
      expect(formatItemType('SERVICE')).toBe('Serviço');
    });

    it('should return "Kit" for BUNDLE type', () => {
      expect(formatItemType('BUNDLE')).toBe('Kit');
    });

    it('should return the type itself for unknown types', () => {
      // @ts-expect-error Testing unknown type
      expect(formatItemType('UNKNOWN')).toBe('UNKNOWN');
    });
  });

  describe('getItemTypeBadgeColor', () => {
    it('should return "info" for PRODUCT type', () => {
      expect(getItemTypeBadgeColor('PRODUCT')).toBe('info');
    });

    it('should return "success" for SERVICE type', () => {
      expect(getItemTypeBadgeColor('SERVICE')).toBe('success');
    });

    it('should return "warning" for BUNDLE type', () => {
      expect(getItemTypeBadgeColor('BUNDLE')).toBe('warning');
    });

    it('should return "default" for unknown types', () => {
      // @ts-expect-error Testing unknown type
      expect(getItemTypeBadgeColor('UNKNOWN')).toBe('default');
    });
  });

  describe('calculateBundlePrice', () => {
    it('should return 0 for empty bundle', () => {
      expect(calculateBundlePrice([])).toBe(0);
    });

    it('should calculate total price for single item', () => {
      const bundleItems = [
        createMockBundleItem({ quantity: 2, item: { id: '1', name: 'Item', type: 'PRODUCT', unit: 'un', basePrice: 100 } }),
      ];
      expect(calculateBundlePrice(bundleItems)).toBe(200);
    });

    it('should calculate total price for multiple items', () => {
      const bundleItems = [
        createMockBundleItem({
          quantity: 2,
          item: { id: '1', name: 'Item 1', type: 'PRODUCT', unit: 'un', basePrice: 100 },
        }),
        createMockBundleItem({
          quantity: 3,
          item: { id: '2', name: 'Item 2', type: 'SERVICE', unit: 'h', basePrice: 50 },
        }),
      ];
      // 2 * 100 + 3 * 50 = 200 + 150 = 350
      expect(calculateBundlePrice(bundleItems)).toBe(350);
    });

    it('should handle decimal quantities', () => {
      const bundleItems = [
        createMockBundleItem({
          quantity: 1.5,
          item: { id: '1', name: 'Item', type: 'PRODUCT', unit: 'm', basePrice: 100 },
        }),
      ];
      expect(calculateBundlePrice(bundleItems)).toBe(150);
    });

    it('should handle zero quantity', () => {
      const bundleItems = [
        createMockBundleItem({
          quantity: 0,
          item: { id: '1', name: 'Item', type: 'PRODUCT', unit: 'un', basePrice: 100 },
        }),
      ];
      expect(calculateBundlePrice(bundleItems)).toBe(0);
    });

    it('should handle zero price', () => {
      const bundleItems = [
        createMockBundleItem({
          quantity: 5,
          item: { id: '1', name: 'Item Grátis', type: 'SERVICE', unit: 'un', basePrice: 0 },
        }),
      ];
      expect(calculateBundlePrice(bundleItems)).toBe(0);
    });
  });

  describe('canDeleteItem', () => {
    it('should return true for item with no usage', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 0,
          workOrderItems: 0,
          bundleAsParent: 0,
        },
      });
      expect(canDeleteItem(item)).toBe(true);
    });

    it('should return false for item used in quotes', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 1,
          workOrderItems: 0,
          bundleAsParent: 0,
        },
      });
      expect(canDeleteItem(item)).toBe(false);
    });

    it('should return false for item used in work orders', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 0,
          workOrderItems: 1,
          bundleAsParent: 0,
        },
      });
      expect(canDeleteItem(item)).toBe(false);
    });

    it('should return false for item used in bundles', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 0,
          workOrderItems: 0,
          bundleAsParent: 1,
        },
      });
      expect(canDeleteItem(item)).toBe(false);
    });

    it('should return false for item with multiple usages', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 5,
          workOrderItems: 3,
          bundleAsParent: 2,
        },
      });
      expect(canDeleteItem(item)).toBe(false);
    });

    it('should return true for item without _count property', () => {
      const item = createMockItem();
      delete item._count;
      expect(canDeleteItem(item)).toBe(true);
    });

    it('should handle partial _count properties', () => {
      const item = createMockItem({
        _count: {
          quoteItems: 0,
        } as any,
      });
      expect(canDeleteItem(item)).toBe(true);
    });
  });

  describe('ItemType values', () => {
    it('should have correct item types', () => {
      const types: ItemType[] = ['PRODUCT', 'SERVICE', 'BUNDLE'];
      types.forEach((type) => {
        expect(['PRODUCT', 'SERVICE', 'BUNDLE']).toContain(type);
      });
    });
  });
});
