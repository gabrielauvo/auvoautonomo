/**
 * CategoryRepository Tests
 *
 * Testes para operações do repositório de categorias.
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

import { CategoryRepository } from '../../../src/db/repositories/CategoryRepository';
import { ProductCategory } from '../../../src/db/schema';

describe('CategoryRepository', () => {
  const technicianId = 'tech-123';

  const mockCategory: ProductCategory = {
    id: 'cat-1',
    name: 'Elétrica',
    description: 'Serviços elétricos',
    color: '#FF5722',
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active categories for a technician', async () => {
      mockFindAll.mockResolvedValue([mockCategory]);

      const result = await CategoryRepository.getAll(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('product_categories', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockCategory]);
    });

    it('should pass additional options', async () => {
      mockFindAll.mockResolvedValue([]);

      await CategoryRepository.getAll(technicianId, { limit: 10, offset: 5 });

      expect(mockFindAll).toHaveBeenCalledWith('product_categories', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getAllIncludingInactive', () => {
    it('should return all categories including inactive', async () => {
      const inactiveCategory = { ...mockCategory, id: 'cat-2', isActive: 0 };
      mockFindAll.mockResolvedValue([mockCategory, inactiveCategory]);

      const result = await CategoryRepository.getAllIncludingInactive(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('product_categories', {
        where: { technicianId },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getById', () => {
    it('should return category by ID', async () => {
      mockFindById.mockResolvedValue(mockCategory);

      const result = await CategoryRepository.getById('cat-1');

      expect(mockFindById).toHaveBeenCalledWith('product_categories', 'cat-1');
      expect(result).toEqual(mockCategory);
    });

    it('should return null if category not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await CategoryRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByName', () => {
    it('should return category by name and technician', async () => {
      mockFindOne.mockResolvedValue(mockCategory);

      const result = await CategoryRepository.getByName('Elétrica', technicianId);

      expect(mockFindOne).toHaveBeenCalledWith('product_categories', {
        name: 'Elétrica',
        technicianId,
      });
      expect(result).toEqual(mockCategory);
    });

    it('should return null if no category with name', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await CategoryRepository.getByName('NotFound', technicianId);

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search categories by query', async () => {
      mockRawQuery.mockResolvedValue([mockCategory]);

      const result = await CategoryRepository.search(technicianId, 'Elé');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ?'),
        [technicianId, '%Elé%', '%Elé%', 50]
      );
      expect(result).toEqual([mockCategory]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);

      await CategoryRepository.search(technicianId, 'test', 10);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });
  });

  describe('count', () => {
    it('should return count of active categories', async () => {
      mockCount.mockResolvedValue(5);

      const result = await CategoryRepository.count(technicianId);

      expect(mockCount).toHaveBeenCalledWith('product_categories', { technicianId, isActive: 1 });
      expect(result).toBe(5);
    });
  });

  describe('getModifiedAfter', () => {
    it('should return categories modified after date', async () => {
      mockRawQuery.mockResolvedValue([mockCategory]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      const result = await CategoryRepository.getModifiedAfter(technicianId, afterDate);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ? AND updatedAt > ?'),
        [technicianId, afterDate, 100]
      );
      expect(result).toEqual([mockCategory]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      await CategoryRepository.getModifiedAfter(technicianId, afterDate, 50);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        [technicianId, afterDate, 50]
      );
    });
  });

  describe('upsert', () => {
    it('should update existing category', async () => {
      mockFindById.mockResolvedValue(mockCategory);
      mockUpdate.mockResolvedValue(undefined);

      await CategoryRepository.upsert(mockCategory);

      expect(mockFindById).toHaveBeenCalledWith('product_categories', mockCategory.id);
      expect(mockUpdate).toHaveBeenCalledWith('product_categories', mockCategory.id, expect.objectContaining({
        name: mockCategory.name,
        isActive: 1,
        syncedAt: expect.any(String),
      }));
    });

    it('should insert new category', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      await CategoryRepository.upsert(mockCategory);

      expect(mockInsert).toHaveBeenCalledWith('product_categories', expect.objectContaining({
        id: mockCategory.id,
        name: mockCategory.name,
        isActive: 1,
        syncedAt: expect.any(String),
      }));
    });

    it('should handle isActive conversion', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      const categoryWithFalseActive = { ...mockCategory, isActive: 0 };
      await CategoryRepository.upsert(categoryWithFalseActive);

      expect(mockInsert).toHaveBeenCalledWith('product_categories', expect.objectContaining({
        isActive: 0,
      }));
    });
  });

  describe('batchUpsert', () => {
    it('should batch upsert multiple categories', async () => {
      mockFindById.mockResolvedValue(null);
      mockInsert.mockResolvedValue(undefined);

      const categories = [mockCategory, { ...mockCategory, id: 'cat-2', name: 'Hidráulica' }];
      await CategoryRepository.batchUpsert(categories);

      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('should do nothing for empty array', async () => {
      await CategoryRepository.batchUpsert([]);

      expect(mockFindById).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should mix insert and update', async () => {
      mockFindById
        .mockResolvedValueOnce(mockCategory) // existing
        .mockResolvedValueOnce(null);        // new
      mockUpdate.mockResolvedValue(undefined);
      mockInsert.mockResolvedValue(undefined);

      const categories = [mockCategory, { ...mockCategory, id: 'cat-2', name: 'Hidráulica' }];
      await CategoryRepository.batchUpsert(categories);

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteAll', () => {
    it('should delete all categories for a technician', async () => {
      mockRawQuery.mockResolvedValue(undefined);

      await CategoryRepository.deleteAll(technicianId);

      expect(mockRawQuery).toHaveBeenCalledWith(
        'DELETE FROM product_categories WHERE technicianId = ?',
        [technicianId]
      );
    });
  });

  describe('markSynced', () => {
    it('should update syncedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await CategoryRepository.markSynced('cat-1');

      expect(mockUpdate).toHaveBeenCalledWith('product_categories', 'cat-1', {
        syncedAt: expect.any(String),
      });
    });
  });
});
