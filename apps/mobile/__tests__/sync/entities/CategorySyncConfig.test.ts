/**
 * CategorySyncConfig Tests
 *
 * Testes para a configuração de sincronização de categorias (pull-only).
 */

import { CategorySyncConfig, SyncCategory } from '../../../src/sync/entities/CategorySyncConfig';

describe('CategorySyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(CategorySyncConfig.name).toBe('categories');
    });

    it('should have correct table name', () => {
      expect(CategorySyncConfig.tableName).toBe('product_categories');
    });

    it('should have correct API endpoint', () => {
      expect(CategorySyncConfig.apiEndpoint).toBe('/sync/categories');
    });

    it('should have empty mutation endpoint (pull-only)', () => {
      expect(CategorySyncConfig.apiMutationEndpoint).toBe('');
    });

    it('should use updatedAt as cursor field', () => {
      expect(CategorySyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(CategorySyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(CategorySyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 100', () => {
      expect(CategorySyncConfig.batchSize).toBe(100);
    });

    it('should use server_wins for conflict resolution', () => {
      expect(CategorySyncConfig.conflictResolution).toBe('server_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server category to local format', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Elétrica',
        description: 'Serviços elétricos',
        color: '#FF5722',
        isActive: true,
        itemCount: 15,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('cat-1');
      expect(result.name).toBe('Elétrica');
      expect(result.description).toBe('Serviços elétricos');
      expect(result.color).toBe('#FF5722');
      expect(result.isActive).toBe(1);
      expect(result.itemCount).toBe(15);
      expect(result.technicianId).toBe('tech-1');
    });

    it('should handle boolean isActive true', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Test',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle boolean isActive false', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Test',
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle numeric isActive 1', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Test',
        isActive: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle numeric isActive 0', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Test',
        isActive: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle missing optional fields', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Test',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.description).toBeUndefined();
      expect(result.color).toBeUndefined();
      expect(result.itemCount).toBeUndefined();
    });

    it('should handle category with items count', () => {
      const serverData = {
        id: 'cat-1',
        name: 'Hidráulica',
        isActive: true,
        itemCount: 25,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformFromServer(serverData);

      expect(result.itemCount).toBe(25);
    });
  });

  describe('transformToServer', () => {
    it('should return data as-is (pull-only sync)', () => {
      const localCategory: SyncCategory = {
        id: 'cat-1',
        name: 'Elétrica',
        description: 'Serviços elétricos',
        color: '#FF5722',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = CategorySyncConfig.transformToServer(localCategory);

      expect(result).toBe(localCategory);
    });
  });
});
