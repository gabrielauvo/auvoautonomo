/**
 * Database Optimizations
 *
 * Helpers para operações otimizadas de banco de dados:
 * - Batch upserts
 * - Paginação
 * - Queries otimizadas
 */

import type { SQLiteDatabase } from 'expo-sqlite';

// =============================================================================
// TYPES
// =============================================================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
  cursorColumn?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface BatchUpsertOptions {
  conflictColumns?: string[];
  updateColumns?: string[];
  batchSize?: number;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Batch upsert records into a table
 * Uses INSERT OR REPLACE for SQLite
 */
export async function batchUpsert<T extends Record<string, unknown>>(
  db: SQLiteDatabase,
  table: string,
  records: T[],
  options: BatchUpsertOptions = {}
): Promise<number> {
  if (records.length === 0) return 0;

  const batchSize = options.batchSize ?? 500;
  let totalInserted = 0;

  // Get column names from first record
  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    await db.withTransactionAsync(async () => {
      for (const record of batch) {
        const values = columns.map((col) => {
          const val = record[col];
          // Convert objects to JSON strings
          if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val);
          }
          // Convert booleans to integers
          if (typeof val === 'boolean') {
            return val ? 1 : 0;
          }
          return val;
        });

        await db.runAsync(sql, values as (string | number | null)[]);
        totalInserted++;
      }
    });
  }

  return totalInserted;
}

/**
 * Batch delete records by IDs
 */
export async function batchDelete(
  db: SQLiteDatabase,
  table: string,
  ids: string[],
  idColumn: string = 'id'
): Promise<number> {
  if (ids.length === 0) return 0;

  const batchSize = 500;
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders})`;

    const result = await db.runAsync(sql, batch);
    totalDeleted += result.changes;
  }

  return totalDeleted;
}

/**
 * Batch update a single column for multiple records
 */
export async function batchUpdateColumn(
  db: SQLiteDatabase,
  table: string,
  ids: string[],
  column: string,
  value: unknown,
  idColumn: string = 'id'
): Promise<number> {
  if (ids.length === 0) return 0;

  const batchSize = 500;
  let totalUpdated = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const sql = `UPDATE ${table} SET ${column} = ? WHERE ${idColumn} IN (${placeholders})`;

    const result = await db.runAsync(sql, [value, ...batch] as (string | number | null)[]);
    totalUpdated += result.changes;
  }

  return totalUpdated;
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Execute a paginated query with offset-based pagination
 */
export async function paginatedQuery<T>(
  db: SQLiteDatabase,
  baseQuery: string,
  params: PaginationParams = {},
  queryParams: (string | number | null)[] = []
): Promise<PaginatedResult<T>> {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 50, 100); // Max 100 per page
  const offset = (page - 1) * pageSize;

  // Count total records
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
  const countResult = await db.getFirstAsync(countQuery, queryParams) as { total: number } | null;
  const total = countResult?.total ?? 0;

  // Get paginated data
  const paginatedSql = `${baseQuery} LIMIT ? OFFSET ?`;
  const data = await db.getAllAsync(paginatedSql, [...queryParams, pageSize, offset]) as T[];

  return {
    data,
    total,
    page,
    pageSize,
    hasMore: offset + data.length < total,
  };
}

/**
 * Execute a cursor-based paginated query (more efficient for large datasets)
 */
export async function cursorPaginatedQuery<T extends { id: string }>(
  db: SQLiteDatabase,
  baseQuery: string,
  params: PaginationParams = {},
  queryParams: (string | number | null)[] = []
): Promise<PaginatedResult<T>> {
  const pageSize = Math.min(params.pageSize ?? 50, 100);
  const cursorColumn = params.cursorColumn ?? 'id';
  const cursor = params.cursor;

  // Build cursor condition
  let cursorCondition = '';
  const cursorParams: (string | number | null)[] = [];

  if (cursor) {
    // Assume ascending order for cursor
    cursorCondition = ` AND ${cursorColumn} > ?`;
    cursorParams.push(cursor);
  }

  // Insert cursor condition into query
  let modifiedQuery = baseQuery;
  if (cursorCondition) {
    // If query has WHERE, add AND; otherwise add WHERE
    if (baseQuery.toUpperCase().includes('WHERE')) {
      modifiedQuery = baseQuery.replace(
        /WHERE/i,
        `WHERE (1=1 ${cursorCondition}) AND `
      );
    } else {
      modifiedQuery = `${baseQuery} WHERE 1=1 ${cursorCondition}`;
    }
  }

  // Add ORDER BY if not present
  if (!modifiedQuery.toUpperCase().includes('ORDER BY')) {
    modifiedQuery += ` ORDER BY ${cursorColumn} ASC`;
  }

  // Add LIMIT
  modifiedQuery += ` LIMIT ?`;

  // Execute query
  const data = await db.getAllAsync(
    modifiedQuery,
    [...queryParams, ...cursorParams, pageSize + 1] // Get one extra to check hasMore
  ) as T[];

  const hasMore = data.length > pageSize;
  if (hasMore) {
    data.pop(); // Remove the extra record
  }

  const nextCursor = hasMore && data.length > 0 ? (data[data.length - 1] as T)[cursorColumn as keyof T] as string : undefined;

  return {
    data,
    total: -1, // Cursor pagination doesn't provide total count efficiently
    page: -1,
    pageSize,
    hasMore,
    nextCursor,
  };
}

// =============================================================================
// OPTIMIZED QUERIES
// =============================================================================

/**
 * Execute a query with automatic index hints
 * SQLite doesn't support index hints, but we can ensure proper column ordering
 */
export async function queryWithIndex<T>(
  db: SQLiteDatabase,
  table: string,
  indexedColumn: string,
  value: string | number,
  options: {
    select?: string;
    additionalWhere?: string;
    orderBy?: string;
    limit?: number;
  } = {}
): Promise<T[]> {
  const select = options.select ?? '*';
  const additionalWhere = options.additionalWhere ? ` AND ${options.additionalWhere}` : '';
  const orderBy = options.orderBy ? ` ORDER BY ${options.orderBy}` : '';
  const limit = options.limit ? ` LIMIT ${options.limit}` : '';

  const sql = `SELECT ${select} FROM ${table} WHERE ${indexedColumn} = ?${additionalWhere}${orderBy}${limit}`;

  return db.getAllAsync(sql, [value]) as Promise<T[]>;
}

/**
 * Execute a search query with LIKE optimization
 * Uses prefix search when possible for index usage
 */
export async function searchQuery<T>(
  db: SQLiteDatabase,
  table: string,
  searchColumn: string,
  searchTerm: string,
  options: {
    select?: string;
    additionalWhere?: string;
    whereParams?: (string | number | null)[];
    orderBy?: string;
    limit?: number;
    prefixOnly?: boolean;
  } = {}
): Promise<T[]> {
  const select = options.select ?? '*';
  const additionalWhere = options.additionalWhere ? ` AND ${options.additionalWhere}` : '';
  const orderBy = options.orderBy ? ` ORDER BY ${options.orderBy}` : '';
  const limit = options.limit ? ` LIMIT ${options.limit}` : ' LIMIT 100';

  // Use prefix search for index usage, or full LIKE for more results
  const searchPattern = options.prefixOnly ? `${searchTerm}%` : `%${searchTerm}%`;

  const sql = `SELECT ${select} FROM ${table} WHERE ${searchColumn} LIKE ?${additionalWhere}${orderBy}${limit}`;
  const params = [searchPattern, ...(options.whereParams ?? [])];

  return db.getAllAsync(sql, params) as Promise<T[]>;
}

/**
 * Get records by multiple IDs efficiently
 */
export async function getByIds<T>(
  db: SQLiteDatabase,
  table: string,
  ids: string[],
  options: {
    select?: string;
    idColumn?: string;
  } = {}
): Promise<T[]> {
  if (ids.length === 0) return [];

  const select = options.select ?? '*';
  const idColumn = options.idColumn ?? 'id';

  // Process in batches to avoid SQLite variable limits
  const batchSize = 500;
  const results: T[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const placeholders = batch.map(() => '?').join(', ');
    const sql = `SELECT ${select} FROM ${table} WHERE ${idColumn} IN (${placeholders})`;

    const batchResults = await db.getAllAsync(sql, batch) as T[];
    results.push(...batchResults);
  }

  return results;
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Get counts by a column (e.g., count by status)
 */
export async function countBy<T extends Record<string, number>>(
  db: SQLiteDatabase,
  table: string,
  groupColumn: string,
  options: {
    where?: string;
    whereParams?: (string | number | null)[];
  } = {}
): Promise<T> {
  const where = options.where ? ` WHERE ${options.where}` : '';
  const sql = `SELECT ${groupColumn}, COUNT(*) as count FROM ${table}${where} GROUP BY ${groupColumn}`;

  const results = await db.getAllAsync(sql, options.whereParams ?? []) as Array<{ [key: string]: string | number }>;

  const counts: Record<string, number> = {};
  for (const row of results) {
    const key = String(row[groupColumn]);
    counts[key] = row.count as number;
  }

  return counts as T;
}

/**
 * Get sum by a column
 */
export async function sumBy(
  db: SQLiteDatabase,
  table: string,
  sumColumn: string,
  options: {
    where?: string;
    whereParams?: (string | number | null)[];
  } = {}
): Promise<number> {
  const where = options.where ? ` WHERE ${options.where}` : '';
  const sql = `SELECT COALESCE(SUM(${sumColumn}), 0) as total FROM ${table}${where}`;

  const result = await db.getFirstAsync(sql, options.whereParams ?? []) as { total: number } | null;
  return result?.total ?? 0;
}

// =============================================================================
// MAINTENANCE
// =============================================================================

/**
 * Analyze tables for query optimization
 */
export async function analyzeTables(db: SQLiteDatabase, tables?: string[]): Promise<void> {
  if (tables && tables.length > 0) {
    for (const table of tables) {
      await db.runAsync(`ANALYZE ${table}`);
    }
  } else {
    await db.runAsync('ANALYZE');
  }
}

/**
 * Vacuum database to reclaim space
 */
export async function vacuumDatabase(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('VACUUM');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(
  db: SQLiteDatabase
): Promise<{
  tables: Array<{ name: string; rowCount: number }>;
  totalRows: number;
  pageSize: number;
  pageCount: number;
}> {
  // Get all tables
  const tables = await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ) as Array<{ name: string }>;

  // Get row counts
  const tableStats: Array<{ name: string; rowCount: number }> = [];
  let totalRows = 0;

  for (const table of tables) {
    const result = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table.name}`) as { count: number } | null;
    const rowCount = result?.count ?? 0;
    tableStats.push({ name: table.name, rowCount });
    totalRows += rowCount;
  }

  // Get page info
  const pageSize = await db.getFirstAsync('PRAGMA page_size') as { page_size: number } | null;
  const pageCount = await db.getFirstAsync('PRAGMA page_count') as { page_count: number } | null;

  return {
    tables: tableStats,
    totalRows,
    pageSize: pageSize?.page_size ?? 4096,
    pageCount: pageCount?.page_count ?? 0,
  };
}

export default {
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
};
