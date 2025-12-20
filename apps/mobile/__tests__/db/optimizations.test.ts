/**
 * Database Optimizations Tests
 *
 * Testes para operações otimizadas de banco de dados.
 */

// Mock database
const mockDb = {
  withTransactionAsync: jest.fn((callback) => callback()),
  runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
};

import {
  batchUpsert,
  batchDelete,
  batchUpdateColumn,
  paginatedQuery,
  cursorPaginatedQuery,
  queryWithIndex,
  searchQuery,
  getByIds,
  countBy,
  sumBy,
  analyzeTables,
  vacuumDatabase,
  getDatabaseStats,
} from '../../src/db/optimizations';

describe('Database Optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('batchUpsert', () => {
    it('should insert records in batches', async () => {
      const records = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ];

      const count = await batchUpsert(mockDb as any, 'test_table', records);

      expect(mockDb.withTransactionAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });

    it('should return 0 for empty records', async () => {
      const count = await batchUpsert(mockDb as any, 'test_table', []);

      expect(mockDb.withTransactionAsync).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should convert objects to JSON', async () => {
      const records = [{ id: '1', data: { nested: true } }];

      await batchUpsert(mockDb as any, 'test_table', records);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify({ nested: true })])
      );
    });

    it('should convert booleans to integers', async () => {
      const records = [{ id: '1', active: true, deleted: false }];

      await batchUpsert(mockDb as any, 'test_table', records);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 0])
      );
    });
  });

  describe('batchDelete', () => {
    it('should delete records by IDs', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 2 });
      const ids = ['1', '2'];

      const count = await batchDelete(mockDb as any, 'test_table', ids);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM test_table WHERE id IN'),
        ids
      );
      expect(count).toBe(2);
    });

    it('should return 0 for empty IDs', async () => {
      const count = await batchDelete(mockDb as any, 'test_table', []);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
      expect(count).toBe(0);
    });

    it('should use custom idColumn', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 1 });
      await batchDelete(mockDb as any, 'test_table', ['1'], 'customId');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE customId IN'),
        ['1']
      );
    });
  });

  describe('batchUpdateColumn', () => {
    it('should update column for multiple IDs', async () => {
      mockDb.runAsync.mockResolvedValueOnce({ changes: 2 });
      const ids = ['1', '2'];

      const count = await batchUpdateColumn(
        mockDb as any,
        'test_table',
        ids,
        'status',
        'active'
      );

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table SET status = ?'),
        ['active', '1', '2']
      );
      expect(count).toBe(2);
    });

    it('should return 0 for empty IDs', async () => {
      const count = await batchUpdateColumn(
        mockDb as any,
        'test_table',
        [],
        'status',
        'active'
      );

      expect(count).toBe(0);
    });
  });

  describe('paginatedQuery', () => {
    it('should return paginated results', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ total: 100 });
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);

      const result = await paginatedQuery(
        mockDb as any,
        'SELECT * FROM test_table',
        { page: 1, pageSize: 10 }
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it('should use default pagination', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ total: 10 });
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await paginatedQuery(mockDb as any, 'SELECT * FROM test');

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should cap pageSize at 100', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ total: 0 });
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const result = await paginatedQuery(
        mockDb as any,
        'SELECT * FROM test',
        { pageSize: 200 }
      );

      expect(result.pageSize).toBe(100);
    });
  });

  describe('cursorPaginatedQuery', () => {
    it('should return cursor-based results', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ]);

      const result = await cursorPaginatedQuery(
        mockDb as any,
        'SELECT * FROM test_table',
        { pageSize: 2 }
      );

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('2');
      expect(result.data).toHaveLength(2);
    });

    it('should handle cursor parameter', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: '4' }, { id: '5' }]);

      await cursorPaginatedQuery(
        mockDb as any,
        'SELECT * FROM test_table WHERE active = 1',
        { cursor: '3' }
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('id > ?'),
        expect.arrayContaining(['3'])
      );
    });
  });

  describe('queryWithIndex', () => {
    it('should query by indexed column', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: '1' }]);

      const result = await queryWithIndex(
        mockDb as any,
        'test_table',
        'technicianId',
        'tech-1'
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ?'),
        ['tech-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should apply additional options', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      await queryWithIndex(
        mockDb as any,
        'test_table',
        'status',
        'active',
        {
          select: 'id, name',
          additionalWhere: 'isActive = 1',
          orderBy: 'name ASC',
          limit: 10,
        }
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT id, name.*AND isActive = 1.*ORDER BY name ASC.*LIMIT 10/),
        ['active']
      );
    });
  });

  describe('searchQuery', () => {
    it('should search with LIKE pattern', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: '1', name: 'Test' }]);

      const result = await searchQuery(
        mockDb as any,
        'test_table',
        'name',
        'test'
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name LIKE ?'),
        ['%test%']
      );
      expect(result).toHaveLength(1);
    });

    it('should use prefix-only search', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      await searchQuery(
        mockDb as any,
        'test_table',
        'name',
        'test',
        { prefixOnly: true }
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        ['test%']
      );
    });
  });

  describe('getByIds', () => {
    it('should get records by multiple IDs', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);

      const result = await getByIds(mockDb as any, 'test_table', ['1', '2']);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id IN'),
        ['1', '2']
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty IDs', async () => {
      const result = await getByIds(mockDb as any, 'test_table', []);

      expect(mockDb.getAllAsync).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('countBy', () => {
    it('should return counts by column', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { status: 'OPEN', count: 5 },
        { status: 'CLOSED', count: 10 },
      ]);

      const result = await countBy(mockDb as any, 'test_table', 'status');

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY status'),
        []
      );
      expect(result).toEqual({ OPEN: 5, CLOSED: 10 });
    });

    it('should apply where clause', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      await countBy(
        mockDb as any,
        'test_table',
        'status',
        { where: 'technicianId = ?', whereParams: ['tech-1'] }
      );

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ?'),
        ['tech-1']
      );
    });
  });

  describe('sumBy', () => {
    it('should return sum of column', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce({ total: 1000 });

      const result = await sumBy(mockDb as any, 'test_table', 'amount');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SUM(amount)'),
        []
      );
      expect(result).toBe(1000);
    });

    it('should return 0 for null result', async () => {
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await sumBy(mockDb as any, 'test_table', 'amount');

      expect(result).toBe(0);
    });
  });

  describe('analyzeTables', () => {
    it('should analyze all tables', async () => {
      await analyzeTables(mockDb as any);

      expect(mockDb.runAsync).toHaveBeenCalledWith('ANALYZE');
    });

    it('should analyze specific tables', async () => {
      await analyzeTables(mockDb as any, ['clients', 'work_orders']);

      expect(mockDb.runAsync).toHaveBeenCalledWith('ANALYZE clients');
      expect(mockDb.runAsync).toHaveBeenCalledWith('ANALYZE work_orders');
    });
  });

  describe('vacuumDatabase', () => {
    it('should vacuum database', async () => {
      await vacuumDatabase(mockDb as any);

      expect(mockDb.runAsync).toHaveBeenCalledWith('VACUUM');
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      mockDb.getAllAsync.mockResolvedValueOnce([
        { name: 'clients' },
        { name: 'work_orders' },
      ]);
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 100 }) // clients
        .mockResolvedValueOnce({ count: 50 }) // work_orders
        .mockResolvedValueOnce({ page_size: 4096 })
        .mockResolvedValueOnce({ page_count: 100 });

      const result = await getDatabaseStats(mockDb as any);

      expect(result.tables).toHaveLength(2);
      expect(result.totalRows).toBe(150);
      expect(result.pageSize).toBe(4096);
      expect(result.pageCount).toBe(100);
    });
  });
});
