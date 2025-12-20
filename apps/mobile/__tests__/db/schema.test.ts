/**
 * Tests for Database Schema
 */

import {
  CREATE_TABLES_SQL,
  MIGRATIONS,
  CURRENT_DB_VERSION,
} from '../../src/db/schema';

describe('Database Schema', () => {
  describe('CREATE_TABLES_SQL', () => {
    it('should be defined', () => {
      expect(CREATE_TABLES_SQL).toBeDefined();
      expect(typeof CREATE_TABLES_SQL).toBe('string');
      expect(CREATE_TABLES_SQL.length).toBeGreaterThan(0);
    });

    it('should include clients table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS clients');
      expect(CREATE_TABLES_SQL).toContain('id TEXT PRIMARY KEY');
      expect(CREATE_TABLES_SQL).toContain('name TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('email TEXT');
      expect(CREATE_TABLES_SQL).toContain('phone TEXT');
      expect(CREATE_TABLES_SQL).toContain('technicianId TEXT NOT NULL');
    });

    it('should include work_orders table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS work_orders');
      expect(CREATE_TABLES_SQL).toContain('clientId TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('title TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain("status TEXT DEFAULT 'SCHEDULED'");
      expect(CREATE_TABLES_SQL).toContain('scheduledStartTime TEXT');
      expect(CREATE_TABLES_SQL).toContain('scheduledEndTime TEXT');
      expect(CREATE_TABLES_SQL).toContain('executionStart TEXT');
      expect(CREATE_TABLES_SQL).toContain('executionEnd TEXT');
      expect(CREATE_TABLES_SQL).toContain('isActive INTEGER DEFAULT 1');
      expect(CREATE_TABLES_SQL).toContain('deletedAt TEXT');
    });

    it('should include quotes table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS quotes');
      expect(CREATE_TABLES_SQL).toContain('number TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('subtotal REAL NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('total REAL NOT NULL');
    });

    it('should include invoices table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS invoices');
      expect(CREATE_TABLES_SQL).toContain('issueDate TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('dueDate TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('workOrderId TEXT');
      expect(CREATE_TABLES_SQL).toContain('quoteId TEXT');
    });

    it('should include sync_meta table', () => {
      expect(CREATE_TABLES_SQL).toContain('CREATE TABLE IF NOT EXISTS sync_meta');
      expect(CREATE_TABLES_SQL).toContain('entity TEXT UNIQUE NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('lastSyncAt TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('lastCursor TEXT');
      expect(CREATE_TABLES_SQL).toContain('syncStatus TEXT DEFAULT');
    });

    it('should include mutations_queue table', () => {
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE TABLE IF NOT EXISTS mutations_queue'
      );
      expect(CREATE_TABLES_SQL).toContain('entity TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('entityId TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('operation TEXT NOT NULL');
      expect(CREATE_TABLES_SQL).toContain('payload TEXT NOT NULL');
    });

    it('should include indexes for performance', () => {
      // Client indexes
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_clients_name'
      );
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_clients_technicianId'
      );
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_clients_updatedAt'
      );

      // Work order indexes
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_work_orders_status'
      );
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_work_orders_scheduledDate'
      );

      // Quote indexes
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_quotes_status'
      );

      // Invoice indexes
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_invoices_dueDate'
      );

      // Mutations queue indexes
      expect(CREATE_TABLES_SQL).toContain(
        'CREATE INDEX IF NOT EXISTS idx_mutations_queue_status'
      );
    });

    it('should include foreign key constraints', () => {
      expect(CREATE_TABLES_SQL).toContain('FOREIGN KEY (clientId) REFERENCES clients(id)');
    });

    it('should initialize sync_meta for all entities', () => {
      expect(CREATE_TABLES_SQL).toContain(
        "INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('clients'"
      );
      expect(CREATE_TABLES_SQL).toContain(
        "INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('workOrders'"
      );
      expect(CREATE_TABLES_SQL).toContain(
        "INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('quotes'"
      );
      expect(CREATE_TABLES_SQL).toContain(
        "INSERT OR IGNORE INTO sync_meta (entity, lastSyncAt, syncStatus) VALUES ('invoices'"
      );
    });
  });

  describe('MIGRATIONS', () => {
    it('should be an array', () => {
      expect(Array.isArray(MIGRATIONS)).toBe(true);
    });

    it('should have at least one migration', () => {
      expect(MIGRATIONS.length).toBeGreaterThan(0);
    });

    it('should have migration with version 1', () => {
      const v1Migration = MIGRATIONS.find((m) => m.version === 1);
      expect(v1Migration).toBeDefined();
      expect(v1Migration?.sql).toBe(CREATE_TABLES_SQL);
    });

    it('should have migrations with incrementing versions', () => {
      const versions = MIGRATIONS.map((m) => m.version);
      const sortedVersions = [...versions].sort((a, b) => a - b);
      expect(versions).toEqual(sortedVersions);
    });

    it('should have unique versions', () => {
      const versions = MIGRATIONS.map((m) => m.version);
      const uniqueVersions = [...new Set(versions)];
      expect(versions.length).toBe(uniqueVersions.length);
    });
  });

  describe('CURRENT_DB_VERSION', () => {
    it('should be a positive number', () => {
      expect(typeof CURRENT_DB_VERSION).toBe('number');
      expect(CURRENT_DB_VERSION).toBeGreaterThan(0);
    });

    it('should match the highest migration version', () => {
      const highestVersion = Math.max(...MIGRATIONS.map((m) => m.version));
      expect(CURRENT_DB_VERSION).toBe(highestVersion);
    });
  });
});
