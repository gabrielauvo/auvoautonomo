/**
 * CatalogItemSyncConfig Tests
 *
 * Testes para a configuração de sincronização de itens do catálogo.
 */

// Mock database
const mockRunAsync = jest.fn();
const mockGetDatabase = jest.fn(() => Promise.resolve({
  runAsync: mockRunAsync,
}));

jest.mock('../../../src/db', () => ({
  getDatabase: () => mockGetDatabase(),
  rawQuery: jest.fn(),
}));

import { CatalogItemSyncConfig, SyncCatalogItem } from '../../../src/sync/entities/CatalogItemSyncConfig';

describe('CatalogItemSyncConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAsync.mockResolvedValue(undefined);
  });

  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(CatalogItemSyncConfig.name).toBe('catalogItems');
    });

    it('should have correct table name', () => {
      expect(CatalogItemSyncConfig.tableName).toBe('catalog_items');
    });

    it('should have correct API endpoint', () => {
      expect(CatalogItemSyncConfig.apiEndpoint).toBe('/sync/items');
    });

    it('should have empty mutation endpoint (pull-only)', () => {
      expect(CatalogItemSyncConfig.apiMutationEndpoint).toBe('');
    });

    it('should use updatedAt as cursor field', () => {
      expect(CatalogItemSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(CatalogItemSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(CatalogItemSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 100', () => {
      expect(CatalogItemSyncConfig.batchSize).toBe(100);
    });

    it('should use server_wins for conflict resolution', () => {
      expect(CatalogItemSyncConfig.conflictResolution).toBe('server_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server product to local format', () => {
      const serverData = {
        id: 'item-1',
        categoryId: 'cat-1',
        categoryName: 'Elétrica',
        categoryColor: '#FF5722',
        name: 'Tomada Dupla',
        description: 'Tomada dupla 10A',
        type: 'PRODUCT',
        sku: 'TOM-001',
        unit: 'un',
        basePrice: 25.5,
        costPrice: 15.0,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('item-1');
      expect(result.categoryId).toBe('cat-1');
      expect(result.categoryName).toBe('Elétrica');
      expect(result.categoryColor).toBe('#FF5722');
      expect(result.name).toBe('Tomada Dupla');
      expect(result.description).toBe('Tomada dupla 10A');
      expect(result.type).toBe('PRODUCT');
      expect(result.sku).toBe('TOM-001');
      expect(result.unit).toBe('un');
      expect(result.basePrice).toBe(25.5);
      expect(result.costPrice).toBe(15.0);
      expect(result.isActive).toBe(1);
    });

    it('should transform server service to local format', () => {
      const serverData = {
        id: 'item-2',
        name: 'Instalação Elétrica',
        type: 'SERVICE',
        unit: 'h',
        basePrice: 80.0,
        defaultDurationMinutes: 60,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.type).toBe('SERVICE');
      expect(result.defaultDurationMinutes).toBe(60);
    });

    it('should transform server bundle to local format', () => {
      const serverData = {
        id: 'bundle-1',
        name: 'Kit Instalação',
        type: 'BUNDLE',
        unit: 'kit',
        basePrice: 150.0,
        isActive: true,
        bundleItems: [
          {
            id: 'bi-1',
            itemId: 'item-1',
            itemName: 'Tomada',
            itemType: 'PRODUCT',
            itemUnit: 'un',
            itemBasePrice: 25.0,
            quantity: 2,
          },
          {
            id: 'bi-2',
            itemId: 'item-2',
            itemName: 'Serviço',
            itemType: 'SERVICE',
            itemUnit: 'h',
            itemBasePrice: 50.0,
            quantity: 1,
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.type).toBe('BUNDLE');
      expect(result.bundleItems).toHaveLength(2);
      expect(result.bundleItems![0].itemName).toBe('Tomada');
      expect(result.bundleItems![1].quantity).toBe(1);
    });

    it('should handle boolean isActive true', () => {
      const serverData = {
        id: 'item-1',
        name: 'Test',
        type: 'PRODUCT',
        unit: 'un',
        basePrice: 10,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle boolean isActive false', () => {
      const serverData = {
        id: 'item-1',
        name: 'Test',
        type: 'PRODUCT',
        unit: 'un',
        basePrice: 10,
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle missing optional fields', () => {
      const serverData = {
        id: 'item-1',
        name: 'Test',
        type: 'PRODUCT',
        unit: 'un',
        basePrice: 10,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformFromServer(serverData);

      expect(result.categoryId).toBeUndefined();
      expect(result.categoryName).toBeUndefined();
      expect(result.categoryColor).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.sku).toBeUndefined();
      expect(result.costPrice).toBeUndefined();
      expect(result.defaultDurationMinutes).toBeUndefined();
      expect(result.bundleItems).toBeUndefined();
    });
  });

  describe('transformToServer', () => {
    it('should return data as-is (pull-only sync)', () => {
      const localItem: SyncCatalogItem = {
        id: 'item-1',
        name: 'Test',
        type: 'PRODUCT',
        unit: 'un',
        basePrice: 10,
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CatalogItemSyncConfig.transformToServer(localItem);

      expect(result).toBe(localItem);
    });
  });

  describe('customSave', () => {
    it('should do nothing for empty array', async () => {
      await CatalogItemSyncConfig.customSave!([], 'tech-1');

      expect(mockGetDatabase).not.toHaveBeenCalled();
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('should save product to database', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'item-1',
          name: 'Tomada',
          type: 'PRODUCT',
          unit: 'un',
          basePrice: 25,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO catalog_items'),
        expect.arrayContaining(['item-1', 'Tomada', 'PRODUCT'])
      );
    });

    it('should save service with duration', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'item-2',
          name: 'Instalação',
          type: 'SERVICE',
          unit: 'h',
          basePrice: 80,
          defaultDurationMinutes: 60,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO catalog_items'),
        expect.arrayContaining(['item-2', 'Instalação', 'SERVICE', 60])
      );
    });

    it('should save bundle with bundle items', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'bundle-1',
          name: 'Kit',
          type: 'BUNDLE',
          unit: 'kit',
          basePrice: 150,
          isActive: true,
          bundleItems: [
            {
              id: 'bi-1',
              itemId: 'item-1',
              itemName: 'Tomada',
              itemType: 'PRODUCT',
              itemUnit: 'un',
              itemBasePrice: 25,
              quantity: 2,
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      // Should insert catalog item
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO catalog_items'),
        expect.arrayContaining(['bundle-1', 'Kit', 'BUNDLE'])
      );

      // Should delete existing bundle items
      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM bundle_items WHERE bundleId = ?',
        ['bundle-1']
      );

      // Should insert bundle item
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO bundle_items'),
        expect.arrayContaining(['bi-1', 'bundle-1', 'item-1', 'Tomada', 'PRODUCT'])
      );
    });

    it('should not save bundle items for non-bundle types', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'item-1',
          name: 'Product',
          type: 'PRODUCT',
          unit: 'un',
          basePrice: 25,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      // Should not call DELETE or INSERT for bundle_items
      const bundleItemCalls = mockRunAsync.mock.calls.filter(
        (call) => call[0].includes('bundle_items')
      );
      expect(bundleItemCalls).toHaveLength(0);
    });

    it('should save multiple items', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'item-1',
          name: 'Item 1',
          type: 'PRODUCT',
          unit: 'un',
          basePrice: 10,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
        {
          id: 'item-2',
          name: 'Item 2',
          type: 'SERVICE',
          unit: 'h',
          basePrice: 50,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      const insertCalls = mockRunAsync.mock.calls.filter(
        (call) => call[0].includes('INSERT OR REPLACE INTO catalog_items')
      );
      expect(insertCalls).toHaveLength(2);
    });

    it('should handle item with category', async () => {
      const items: SyncCatalogItem[] = [
        {
          id: 'item-1',
          categoryId: 'cat-1',
          categoryName: 'Elétrica',
          categoryColor: '#FF5722',
          name: 'Tomada',
          type: 'PRODUCT',
          unit: 'un',
          basePrice: 25,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          technicianId: 'tech-1',
        },
      ];

      await CatalogItemSyncConfig.customSave!(items, 'tech-1');

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO catalog_items'),
        expect.arrayContaining(['cat-1', 'Elétrica', '#FF5722'])
      );
    });
  });
});
