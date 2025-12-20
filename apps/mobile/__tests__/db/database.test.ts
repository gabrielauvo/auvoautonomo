/**
 * Database Tests
 *
 * Testes para o gerenciador de banco de dados SQLite.
 */

// Mock expo-sqlite
const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockCloseAsync = jest.fn();

const mockDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getAllAsync: mockGetAllAsync,
  getFirstAsync: mockGetFirstAsync,
  closeAsync: mockCloseAsync,
};

const mockOpenDatabaseAsync = jest.fn(() => Promise.resolve(mockDb));
const mockDeleteDatabaseAsync = jest.fn(() => Promise.resolve());

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
  deleteDatabaseAsync: (...args: unknown[]) => mockDeleteDatabaseAsync(...args),
}));

jest.mock('../../src/db/schema', () => ({
  CREATE_TABLES_SQL: 'CREATE TABLE test (id TEXT);',
  MIGRATIONS: [
    { version: 1, sql: 'CREATE TABLE v1 (id TEXT);' },
    { version: 2, sql: 'ALTER TABLE v1 ADD col TEXT;' },
  ],
  CURRENT_DB_VERSION: 2,
}));

// Import after mocks - use static imports
import {
  findAll,
  findOne,
  findById,
  insert,
  update,
  remove,
  count,
  rawQuery,
  rawExec,
  transaction,
} from '../../src/db/database';

describe('Database CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mock responses
    mockGetFirstAsync.mockResolvedValue({ version: 2, id: '1' });
    mockExecAsync.mockResolvedValue(undefined);
    mockRunAsync.mockResolvedValue(undefined);
    mockGetAllAsync.mockResolvedValue([]);
  });

  describe('findAll', () => {
    it('should query all records from table', async () => {
      mockGetAllAsync.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await findAll('test_table');

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table',
        []
      );
      expect(result).toHaveLength(2);
    });

    it('should apply where clause', async () => {
      mockGetAllAsync.mockResolvedValue([{ id: '1' }]);

      await findAll('test_table', { where: { status: 'active', type: 'A' } });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE status = ? AND type = ?',
        ['active', 'A']
      );
    });

    it('should apply order by with default ASC', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', { orderBy: 'name' });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table ORDER BY name ASC',
        []
      );
    });

    it('should apply order by with DESC', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', { orderBy: 'name', order: 'DESC' });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table ORDER BY name DESC',
        []
      );
    });

    it('should apply limit only', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', { limit: 10 });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table LIMIT 10',
        []
      );
    });

    it('should apply limit and offset', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', { limit: 10, offset: 20 });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table LIMIT 10 OFFSET 20',
        []
      );
    });

    it('should combine all query options', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', {
        where: { status: 'active' },
        orderBy: 'createdAt',
        order: 'DESC',
        limit: 50,
        offset: 100,
      });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE status = ? ORDER BY createdAt DESC LIMIT 50 OFFSET 100',
        ['active']
      );
    });

    it('should handle empty where object', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findAll('test_table', { where: {} });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test_table',
        []
      );
    });
  });

  describe('findOne', () => {
    it('should return first matching record', async () => {
      mockGetAllAsync.mockResolvedValue([{ id: '1', name: 'Test' }]);

      const result = await findOne('test_table', { id: '1' });

      expect(result).toEqual({ id: '1', name: 'Test' });
    });

    it('should return null if not found', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      const result = await findOne('test_table', { id: 'non-existent' });

      expect(result).toBeNull();
    });

    it('should apply limit 1', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await findOne('test_table', { status: 'active' });

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1'),
        expect.any(Array)
      );
    });
  });

  describe('findById', () => {
    it('should find record by ID', async () => {
      mockGetAllAsync.mockResolvedValue([{ id: '123', name: 'Test' }]);

      const result = await findById('test_table', '123');

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?'),
        ['123']
      );
      expect(result).toEqual({ id: '123', name: 'Test' });
    });

    it('should return null if ID not found', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      const result = await findById('test_table', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('insert', () => {
    it('should insert new record', async () => {
      await insert('test_table', { id: '1', name: 'Test', value: 100 });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT INTO test_table (id, name, value) VALUES (?, ?, ?)',
        ['1', 'Test', 100]
      );
    });

    it('should handle single column insert', async () => {
      await insert('test_table', { id: '1' });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT INTO test_table (id) VALUES (?)',
        ['1']
      );
    });

    it('should handle null values', async () => {
      await insert('test_table', { id: '1', name: null });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT INTO test_table (id, name) VALUES (?, ?)',
        ['1', null]
      );
    });
  });

  describe('update', () => {
    it('should update record by ID', async () => {
      await update('test_table', '123', { name: 'Updated', value: 200 });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE test_table SET name = ?, value = ? WHERE id = ?',
        ['Updated', 200, '123']
      );
    });

    it('should handle single field update', async () => {
      await update('test_table', '123', { status: 'inactive' });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'UPDATE test_table SET status = ? WHERE id = ?',
        ['inactive', '123']
      );
    });
  });

  describe('remove', () => {
    it('should delete record by ID', async () => {
      await remove('test_table', '123');

      expect(mockRunAsync).toHaveBeenCalledWith(
        'DELETE FROM test_table WHERE id = ?',
        ['123']
      );
    });
  });

  describe('count', () => {
    it('should count all records', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 42 });

      const result = await count('test_table');

      expect(mockGetFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table',
        []
      );
      expect(result).toBe(42);
    });

    it('should count with where clause', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 10 });

      const result = await count('test_table', { status: 'active' });

      expect(mockGetFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table WHERE status = ?',
        ['active']
      );
      expect(result).toBe(10);
    });

    it('should count with multiple where conditions', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({ count: 5 });

      await count('test_table', { status: 'active', type: 'A' });

      expect(mockGetFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_table WHERE status = ? AND type = ?',
        ['active', 'A']
      );
    });

    it('should return 0 for null result', async () => {
      mockGetFirstAsync.mockResolvedValueOnce(null);

      const result = await count('test_table');

      expect(result).toBe(0);
    });

    it('should return 0 for empty result', async () => {
      mockGetFirstAsync.mockResolvedValueOnce({});

      const result = await count('test_table');

      expect(result).toBe(0);
    });
  });

  describe('rawQuery', () => {
    it('should execute raw query with params', async () => {
      mockGetAllAsync.mockResolvedValue([{ id: '1' }]);

      const result = await rawQuery('SELECT * FROM test WHERE id = ?', ['123']);

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM test WHERE id = ?',
        ['123']
      );
      expect(result).toEqual([{ id: '1' }]);
    });

    it('should use empty params by default', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await rawQuery('SELECT * FROM test');

      expect(mockGetAllAsync).toHaveBeenCalledWith('SELECT * FROM test', []);
    });

    it('should handle complex queries', async () => {
      mockGetAllAsync.mockResolvedValue([]);

      await rawQuery(
        'SELECT a.*, b.name FROM table_a a JOIN table_b b ON a.id = b.a_id WHERE a.status = ?',
        ['active']
      );

      expect(mockGetAllAsync).toHaveBeenCalledWith(
        'SELECT a.*, b.name FROM table_a a JOIN table_b b ON a.id = b.a_id WHERE a.status = ?',
        ['active']
      );
    });
  });

  describe('rawExec', () => {
    it('should execute raw SQL', async () => {
      await rawExec('DROP TABLE IF EXISTS temp');

      expect(mockExecAsync).toHaveBeenCalledWith('DROP TABLE IF EXISTS temp');
    });

    it('should execute DDL statements', async () => {
      await rawExec('CREATE INDEX idx_test ON test(name)');

      expect(mockExecAsync).toHaveBeenCalledWith('CREATE INDEX idx_test ON test(name)');
    });
  });

  describe('transaction', () => {
    it('should commit on success', async () => {
      const result = await transaction(async (db) => {
        return 'success';
      });

      expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockExecAsync).toHaveBeenCalledWith('COMMIT');
      expect(result).toBe('success');
    });

    it('should rollback on error', async () => {
      await expect(
        transaction(async () => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');

      expect(mockExecAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockExecAsync).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should return callback result', async () => {
      const result = await transaction(async () => {
        return { inserted: 5, updated: 3 };
      });

      expect(result).toEqual({ inserted: 5, updated: 3 });
    });

    it('should pass database to callback', async () => {
      const callbackSpy = jest.fn().mockResolvedValue('done');

      await transaction(callbackSpy);

      expect(callbackSpy).toHaveBeenCalledWith(expect.objectContaining({
        execAsync: expect.any(Function),
        runAsync: expect.any(Function),
      }));
    });
  });
});
