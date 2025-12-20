/**
 * Banquinho - Database Manager
 *
 * Gerenciador do banco SQLite local.
 * Otimizado para 100k+ registros por entidade.
 */

import * as SQLite from 'expo-sqlite';
import type { SQLiteBindValue } from 'expo-sqlite';
import { CREATE_TABLES_SQL, MIGRATIONS, CURRENT_DB_VERSION } from './schema';

// =============================================================================
// DATABASE INSTANCE
// =============================================================================

const DB_NAME = 'prodesign.db';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// =============================================================================
// INITIALIZATION
// =============================================================================

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  // If already initialized, return existing instance
  if (db) return db;

  // If initialization is in progress, wait for it
  if (initPromise) return initPromise;

  // Start new initialization
  initPromise = doInitDatabase();

  try {
    return await initPromise;
  } finally {
    // Clear promise after completion (success or failure)
    initPromise = null;
  }
}

async function doInitDatabase(): Promise<SQLite.SQLiteDatabase> {
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);

    // Enable WAL mode for better performance
    await db.execAsync('PRAGMA journal_mode = WAL;');

    // Disable foreign keys during migrations to avoid constraint issues
    await db.execAsync('PRAGMA foreign_keys = OFF;');

    // Run migrations
    await runMigrations(db);

    // Re-enable foreign keys after migrations
    await db.execAsync('PRAGMA foreign_keys = ON;');

    console.log('[Banquinho] Database initialized');

    return db;
  } catch (error) {
    console.error('[Banquinho] Database init error, performing full reset:', error);

    // Close if opened
    if (db) {
      try {
        await db.closeAsync();
      } catch {
        // Ignore close errors
      }
      db = null;
    }

    // Delete the corrupted database
    try {
      await SQLite.deleteDatabaseAsync(DB_NAME);
      console.log('[Banquinho] Corrupted database deleted');
    } catch (deleteError) {
      console.warn('[Banquinho] Could not delete database:', deleteError);
    }

    // Small delay to ensure file is released
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try again with fresh database
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    await runMigrations(db);
    await db.execAsync('PRAGMA foreign_keys = ON;');

    console.log('[Banquinho] Database initialized after reset');
    return db;
  }
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    console.log('[Banquinho] Database closed');
  }
}

/**
 * Reset database by dropping all tables and recreating
 * Use this when there are schema/data corruption issues
 */
export async function resetDatabase(): Promise<void> {
  console.log('[Banquinho] Resetting database...');

  // Close existing connection
  if (db) {
    await db.closeAsync();
    db = null;
  }

  // Delete the database file
  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
    console.log('[Banquinho] Database file deleted');
  } catch (error) {
    console.warn('[Banquinho] Could not delete database file:', error);
  }

  // Reinitialize
  await initDatabase();

  console.log('[Banquinho] Database reset complete');
}

// =============================================================================
// MIGRATIONS
// =============================================================================

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create version table if not exists
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS db_version (
      version INTEGER PRIMARY KEY
    );
  `);

  // Get current version
  const result = await database.getFirstAsync<{ version: number }>(
    'SELECT version FROM db_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = result?.version ?? 0;

  console.log(`[Banquinho] Current DB version: ${currentVersion}`);

  // If version is already at current, verify schema integrity
  if (currentVersion >= CURRENT_DB_VERSION) {
    try {
      // Quick schema check - try to query key tables
      await database.getFirstAsync('SELECT id, deletedAt FROM clients LIMIT 1');
      await database.getFirstAsync('SELECT id, status FROM work_orders LIMIT 1');
      console.log(`[Banquinho] Schema integrity check passed`);
    } catch (schemaError) {
      console.error(`[Banquinho] Schema integrity check failed:`, schemaError);
      throw new Error('Schema integrity check failed - database needs reset');
    }
    return;
  }

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      console.log(`[Banquinho] Running migration v${migration.version}`);
      await database.execAsync(migration.sql);
      await database.runAsync(
        'INSERT INTO db_version (version) VALUES (?)',
        [migration.version]
      );
    }
  }

  console.log(`[Banquinho] Migrations complete. Version: ${CURRENT_DB_VERSION}`);
}

// =============================================================================
// GENERIC CRUD HELPERS
// =============================================================================

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export async function findAll<T>(
  table: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const database = await getDatabase();

  let sql = `SELECT * FROM ${table}`;
  const params: SQLiteBindValue[] = [];

  // WHERE clause
  if (options.where && Object.keys(options.where).length > 0) {
    const conditions = Object.entries(options.where).map(([key, value]) => {
      params.push(value as SQLiteBindValue);
      return `${key} = ?`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // ORDER BY
  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
  }

  // LIMIT and OFFSET
  if (options.limit) {
    sql += ` LIMIT ${options.limit}`;
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
  }

  return database.getAllAsync<T>(sql, params);
}

export async function findOne<T>(
  table: string,
  where: Record<string, unknown>
): Promise<T | null> {
  const results = await findAll<T>(table, { where, limit: 1 });
  return results[0] || null;
}

export async function findById<T>(
  table: string,
  id: string
): Promise<T | null> {
  return findOne<T>(table, { id });
}

export async function insert<T extends Record<string, unknown>>(
  table: string,
  data: T
): Promise<void> {
  const database = await getDatabase();

  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  const values = Object.values(data) as SQLiteBindValue[];

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  try {
    await database.runAsync(sql, values);
  } catch (error: any) {
    // Log constraint errors for debugging
    if (error.message?.includes('constraint')) {
      console.error(`[Database] Constraint error on ${table}:`, error.message);
      console.error('[Database] Data:', JSON.stringify(data, null, 2));
    }
    throw error;
  }
}

export async function update<T extends Record<string, unknown>>(
  table: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const database = await getDatabase();

  const updates = Object.keys(data).map((key) => `${key} = ?`);
  const values = [...Object.values(data), id] as SQLiteBindValue[];

  const sql = `UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`;

  try {
    await database.runAsync(sql, values);
  } catch (error: any) {
    // Log constraint errors for debugging
    if (error.message?.includes('constraint')) {
      console.error(`[Database] Constraint error on ${table}:`, error.message);
      console.error('[Database] Update data:', JSON.stringify(data, null, 2));
    }
    throw error;
  }
}

export async function remove(table: string, id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function count(
  table: string,
  where?: Record<string, unknown>
): Promise<number> {
  const database = await getDatabase();

  let sql = `SELECT COUNT(*) as count FROM ${table}`;
  const params: SQLiteBindValue[] = [];

  if (where && Object.keys(where).length > 0) {
    const conditions = Object.entries(where).map(([key, value]) => {
      params.push(value as SQLiteBindValue);
      return `${key} = ?`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  const result = await database.getFirstAsync<{ count: number }>(sql, params);
  return result?.count ?? 0;
}

// =============================================================================
// RAW QUERY
// =============================================================================

export async function rawQuery<T>(
  sql: string,
  params: SQLiteBindValue[] = []
): Promise<T[]> {
  const database = await getDatabase();
  return database.getAllAsync<T>(sql, params);
}

export async function rawExec(sql: string): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(sql);
}

// =============================================================================
// TRANSACTIONS
// =============================================================================

export async function transaction<T>(
  callback: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const database = await getDatabase();

  await database.execAsync('BEGIN TRANSACTION');

  try {
    const result = await callback(database);
    await database.execAsync('COMMIT');
    return result;
  } catch (error: any) {
    await database.execAsync('ROLLBACK');
    // Log constraint errors in transactions
    if (error.message?.includes('constraint')) {
      console.error('[Database] Constraint error in transaction:', error.message);
    }
    throw error;
  }
}
