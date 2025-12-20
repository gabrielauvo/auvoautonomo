/**
 * Banquinho - Database Module
 *
 * Exportação centralizada do módulo de banco de dados.
 */

// Database manager
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  resetDatabase,
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
} from './database';
export type { QueryOptions } from './database';

// Schema
export {
  CREATE_TABLES_SQL,
  MIGRATIONS,
  CURRENT_DB_VERSION,
} from './schema';
export type {
  Client,
  WorkOrder,
  Quote,
  Invoice,
  SyncMeta,
  MutationQueueItem,
} from './schema';

// Repositories
export { ClientRepository } from './repositories/ClientRepository';

// Optimizations
export {
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
} from './optimizations';
export type {
  PaginationParams,
  PaginatedResult,
  BatchUpsertOptions,
} from './optimizations';
