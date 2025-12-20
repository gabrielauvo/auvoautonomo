/**
 * BulkInsertService Tests
 *
 * Testes para o serviço de inserção em lote otimizado.
 * Verifica:
 * 1. Inserção básica em chunks
 * 2. Isolamento de registros inválidos com bisect
 * 3. Métricas de performance
 * 4. Callbacks de progresso e erro
 */

// Mock expo-sqlite
const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      withTransactionAsync: mockWithTransactionAsync,
    })
  ),
}));

// Mock syncFlags
const mockSyncFlags = {
  SYNC_OPT_BULK_INSERT: true,
  BULK_INSERT_CHUNK_SIZE: 50,
  BULK_INSERT_BISECT_MIN_SIZE: 1,
  BULK_INSERT_CONTINUE_ON_ERROR: true,
  BULK_INSERT_LOG_INVALID_RECORDS: false,
};

jest.mock('../../src/config/syncFlags', () => ({
  SYNC_FLAGS: mockSyncFlags,
}));

import { bulkInsert, simpleBulkInsert } from '../../src/db/BulkInsertService';
import type { SQLiteDatabase } from 'expo-sqlite';

describe('BulkInsertService', () => {
  let mockDb: SQLiteDatabase;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock behavior
    mockWithTransactionAsync.mockImplementation(async (callback: () => Promise<void>) => {
      await callback();
    });
    mockRunAsync.mockResolvedValue({ changes: 1 });

    mockDb = {
      runAsync: mockRunAsync,
      withTransactionAsync: mockWithTransactionAsync,
    } as unknown as SQLiteDatabase;
  });

  describe('bulkInsert()', () => {
    it('should insert empty array without error', async () => {
      const result = await bulkInsert(mockDb, [], {
        tableName: 'test_table',
        columns: ['id', 'name'],
      });

      expect(result.totalRecords).toBe(0);
      expect(result.insertedRecords).toBe(0);
      expect(result.failedRecords).toBe(0);
      expect(mockRunAsync).not.toHaveBeenCalled();
    });

    it('should insert single record successfully', async () => {
      const records = [{ id: '1', name: 'Test' }];

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
      });

      expect(result.totalRecords).toBe(1);
      expect(result.insertedRecords).toBe(1);
      expect(result.failedRecords).toBe(0);
      expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    });

    it('should insert multiple records in single chunk', async () => {
      const records = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
        { id: '3', name: 'Test 3' },
      ];

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10, // All records fit in one chunk
      });

      expect(result.totalRecords).toBe(3);
      expect(result.insertedRecords).toBe(3);
      expect(result.failedRecords).toBe(0);
      expect(result.metrics.chunksProcessed).toBe(1);
    });

    it('should split records into multiple chunks', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 3, // 10 records / 3 per chunk = 4 chunks
      });

      expect(result.totalRecords).toBe(10);
      expect(result.insertedRecords).toBe(10);
      expect(result.metrics.chunksProcessed).toBe(4);
      expect(result.metrics.chunksSucceeded).toBe(4);
    });

    it('should convert boolean values to integers', async () => {
      const records = [{ id: '1', active: true, deleted: false }];

      await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'active', 'deleted'],
      });

      // Verify the SQL was called with converted values
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE'),
        expect.arrayContaining([1, 0]) // true -> 1, false -> 0
      );
    });

    it('should convert objects to JSON strings', async () => {
      const records = [{ id: '1', metadata: { key: 'value' } }];

      await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'metadata'],
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{"key":"value"}'])
      );
    });

    it('should convert undefined to null', async () => {
      const records = [{ id: '1', name: undefined }];

      await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });

    it('should call onProgress callback', async () => {
      const onProgress = jest.fn();
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 5,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          currentChunk: 0,
          totalChunks: 2,
          totalRecords: 10,
        })
      );
    });

    it('should record metrics correctly', async () => {
      const records = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
      });

      expect(result.metrics.chunksProcessed).toBe(5);
      expect(result.metrics.totalDurationMs).toBeGreaterThan(0);
      expect(result.metrics.rowsPerSecond).toBeGreaterThan(0);
      expect(result.metrics.chunkDetails).toHaveLength(5);
    });
  });

  describe('bisect error handling', () => {
    it('should isolate single invalid record using bisect', async () => {
      const records = [
        { id: '1', name: 'Valid 1' },
        { id: 'INVALID', name: 'Invalid' },
        { id: '3', name: 'Valid 3' },
      ];

      // First chunk fails, then individual inserts: 1 succeeds, INVALID fails, 3 succeeds
      mockWithTransactionAsync
        .mockRejectedValueOnce(new Error('Constraint violation')) // Chunk fails
        .mockImplementation(async (callback: () => Promise<void>) => {
          await callback();
        });

      mockRunAsync
        .mockResolvedValueOnce({ changes: 1 }) // Record 1 succeeds
        .mockRejectedValueOnce(new Error('Invalid ID')) // Record INVALID fails
        .mockResolvedValueOnce({ changes: 1 }); // Record 3 succeeds

      const onInvalidRecord = jest.fn();

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
        bisectMinSize: 1,
        onInvalidRecord,
      });

      expect(result.insertedRecords).toBe(2);
      expect(result.failedRecords).toBe(1);
      expect(result.failedIds).toContain('INVALID');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].recordId).toBe('INVALID');
      expect(onInvalidRecord).toHaveBeenCalledTimes(1);
    });

    it('should continue processing after error when continueOnError=true', async () => {
      const records = [
        { id: '1', name: 'Valid 1' },
        { id: '2', name: 'Valid 2' },
      ];

      // First record fails, second succeeds
      let callCount = 0;
      mockWithTransactionAsync.mockImplementation(async (callback: () => Promise<void>) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First chunk fails');
        }
        await callback();
      });

      // After bisect, individual inserts
      mockRunAsync
        .mockRejectedValueOnce(new Error('Invalid')) // First individual fails
        .mockResolvedValueOnce({ changes: 1 }); // Second individual succeeds

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
        continueOnError: true,
        bisectMinSize: 1,
      });

      expect(result.failedRecords).toBe(1);
      expect(result.insertedRecords).toBe(1);
    });

    it('should stop on first error when continueOnError=false', async () => {
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      // First chunk fails
      mockWithTransactionAsync
        .mockRejectedValueOnce(new Error('Constraint violation'))
        .mockImplementation(async (callback: () => Promise<void>) => {
          await callback();
        });

      // All individual records in first chunk fail
      mockRunAsync.mockRejectedValue(new Error('Invalid'));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 5, // 2 chunks of 5
        continueOnError: false,
        bisectMinSize: 1,
      });

      // Should have processed first chunk (5 failed) but not second chunk
      expect(result.failedRecords).toBe(5);
      expect(result.metrics.chunksProcessed).toBe(1);
    });

    it('should report chunksBisected in metrics', async () => {
      const records = [
        { id: '1', name: 'Valid' },
        { id: 'INVALID', name: 'Invalid' },
      ];

      mockWithTransactionAsync
        .mockRejectedValueOnce(new Error('Constraint violation'))
        .mockImplementation(async (callback: () => Promise<void>) => {
          await callback();
        });

      mockRunAsync
        .mockResolvedValueOnce({ changes: 1 })
        .mockRejectedValueOnce(new Error('Invalid'));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
        bisectMinSize: 1,
      });

      expect(result.metrics.chunksBisected).toBe(1);
      expect(result.metrics.chunkDetails[0].bisected).toBe(true);
    });

    it('should use bisect to divide chunks recursively', async () => {
      // 8 records: 4 valid, 4 invalid (interleaved)
      const records = [
        { id: '1', name: 'Valid' },
        { id: 'INV1', name: 'Invalid' },
        { id: '3', name: 'Valid' },
        { id: 'INV2', name: 'Invalid' },
        { id: '5', name: 'Valid' },
        { id: 'INV3', name: 'Invalid' },
        { id: '7', name: 'Valid' },
        { id: 'INV4', name: 'Invalid' },
      ];

      // All chunks with invalid records fail
      mockWithTransactionAsync.mockImplementation(async (callback: () => Promise<void>) => {
        // Check if any record in this transaction is invalid
        await callback();
      });

      // Simulate: valid IDs succeed, invalid IDs fail
      mockRunAsync.mockImplementation(async (sql: string, values: unknown[]) => {
        const idValue = (values as string[])[0];
        if (idValue && idValue.toString().startsWith('INV')) {
          throw new Error('Invalid ID');
        }
        return { changes: 1 };
      });

      // Make first transaction fail to trigger bisect
      let firstCall = true;
      mockWithTransactionAsync.mockImplementation(async (callback: () => Promise<void>) => {
        if (firstCall) {
          firstCall = false;
          throw new Error('Constraint violation');
        }
        await callback();
      });

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
        bisectMinSize: 1,
      });

      expect(result.insertedRecords).toBe(4);
      expect(result.failedRecords).toBe(4);
      expect(result.failedIds).toEqual(
        expect.arrayContaining(['INV1', 'INV2', 'INV3', 'INV4'])
      );
    });
  });

  describe('simpleBulkInsert()', () => {
    it('should work with minimal parameters', async () => {
      const records = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ];

      const result = await simpleBulkInsert(mockDb, 'test_table', records);

      expect(result.totalRecords).toBe(2);
      expect(result.insertedRecords).toBe(2);
      expect(mockRunAsync).toHaveBeenCalledWith(
        expect.stringContaining('test_table'),
        expect.any(Array)
      );
    });

    it('should handle empty array', async () => {
      const result = await simpleBulkInsert(mockDb, 'test_table', []);

      expect(result.totalRecords).toBe(0);
      expect(result.insertedRecords).toBe(0);
      expect(mockRunAsync).not.toHaveBeenCalled();
    });
  });

  describe('SQL generation', () => {
    it('should generate correct INSERT OR REPLACE statement', async () => {
      const records = [{ id: '1', name: 'Test', value: 42 }];

      await bulkInsert(mockDb, records, {
        tableName: 'my_table',
        columns: ['id', 'name', 'value'],
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO my_table (id, name, value) VALUES (?, ?, ?)',
        ['1', 'Test', 42]
      );
    });

    it('should generate multi-row INSERT for multiple records', async () => {
      const records = [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
      ];

      await bulkInsert(mockDb, records, {
        tableName: 'test',
        columns: ['id', 'name'],
        chunkSize: 10,
      });

      expect(mockRunAsync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO test (id, name) VALUES (?, ?), (?, ?)',
        ['1', 'A', '2', 'B']
      );
    });
  });

  describe('performance', () => {
    it('should calculate rowsPerSecond correctly', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 50,
      });

      expect(result.metrics.rowsPerSecond).toBeGreaterThan(0);
      expect(result.metrics.avgChunkDurationMs).toBeGreaterThan(0);
    });

    it('should track chunk details', async () => {
      const records = Array.from({ length: 25 }, (_, i) => ({
        id: String(i + 1),
        name: `Test ${i + 1}`,
      }));

      const result = await bulkInsert(mockDb, records, {
        tableName: 'test_table',
        columns: ['id', 'name'],
        chunkSize: 10,
      });

      expect(result.metrics.chunkDetails).toHaveLength(3);
      result.metrics.chunkDetails.forEach((detail, index) => {
        expect(detail.index).toBe(index);
        expect(detail.durationMs).toBeGreaterThanOrEqual(0);
        expect(detail.success).toBe(true);
        expect(detail.bisected).toBe(false);
      });
    });
  });
});
