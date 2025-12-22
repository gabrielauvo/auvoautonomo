/**
 * Migration Service
 *
 * Handles migration from the legacy sync system to PowerSync.
 * Processes pending mutations before switching to the new system.
 */

import * as SQLite from 'expo-sqlite';
import { AuthService } from '../services/AuthService';
import { getApiBaseUrl } from '../config/api';

// =============================================================================
// TYPES
// =============================================================================

interface LegacyMutation {
  id: number;
  entity: string;
  entityId: string;
  operation: string;
  payload: string;
  status: string;
  createdAt: string;
}

interface MigrationResult {
  success: number;
  failed: number;
  errors: Array<{ entity: string; entityId: string; error: string }>;
}

// =============================================================================
// MIGRATION SERVICE
// =============================================================================

export class MigrationService {
  private static OLD_DB_NAME = 'prodesign.db';
  private static baseUrl = getApiBaseUrl();

  /**
   * Check if there are pending mutations that need to be migrated
   */
  static async needsMigration(): Promise<boolean> {
    try {
      const db = await SQLite.openDatabaseAsync(this.OLD_DB_NAME);

      // Check if mutations_queue table exists
      const tableExists = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sqlite_master
         WHERE type='table' AND name='mutations_queue'`
      );

      if (!tableExists || tableExists.count === 0) {
        await db.closeAsync();
        return false;
      }

      // Check for pending mutations
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM mutations_queue
         WHERE status IN ('pending', 'failed', 'processing')`
      );

      await db.closeAsync();

      const hasPending = (result?.count ?? 0) > 0;
      console.log(`[Migration] Pending mutations: ${result?.count ?? 0}`);

      return hasPending;
    } catch (error) {
      // Database doesn't exist or error - no migration needed
      console.log('[Migration] No legacy database found or error checking:', error);
      return false;
    }
  }

  /**
   * Process all pending mutations from the legacy system
   */
  static async processPendingMutations(
    onProgress?: (current: number, total: number) => void
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    try {
      const db = await SQLite.openDatabaseAsync(this.OLD_DB_NAME);

      // Get all pending mutations
      const mutations = await db.getAllAsync<LegacyMutation>(
        `SELECT * FROM mutations_queue
         WHERE status IN ('pending', 'failed', 'processing')
         ORDER BY createdAt ASC`
      );

      console.log(`[Migration] Processing ${mutations.length} mutations`);

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        onProgress?.(i + 1, mutations.length);

        try {
          await this.processMutation(mutation);

          // Mark as completed
          await db.runAsync(
            'UPDATE mutations_queue SET status = ? WHERE id = ?',
            ['completed', mutation.id]
          );

          result.success++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(
            `[Migration] Failed to process ${mutation.entity}:${mutation.entityId}:`,
            errorMessage
          );

          // Mark as failed with error message
          await db.runAsync(
            'UPDATE mutations_queue SET status = ?, errorMessage = ? WHERE id = ?',
            ['failed', errorMessage, mutation.id]
          );

          result.failed++;
          result.errors.push({
            entity: mutation.entity,
            entityId: mutation.entityId,
            error: errorMessage,
          });
        }
      }

      await db.closeAsync();
    } catch (error) {
      console.error('[Migration] Error processing mutations:', error);
    }

    return result;
  }

  /**
   * Process a single mutation via the existing API endpoints
   */
  private static async processMutation(mutation: LegacyMutation): Promise<void> {
    const token = await AuthService.getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const payload = JSON.parse(mutation.payload);
    const endpoint = this.getEndpoint(mutation.entity);

    switch (mutation.operation) {
      case 'create':
        await this.httpRequest('POST', `${this.baseUrl}${endpoint}`, payload, headers);
        break;

      case 'update':
      case 'update_status':
        await this.httpRequest(
          'PUT',
          `${this.baseUrl}${endpoint}/${mutation.entityId}`,
          payload,
          headers
        );
        break;

      case 'delete':
        await this.httpRequest(
          'DELETE',
          `${this.baseUrl}${endpoint}/${mutation.entityId}`,
          null,
          headers
        );
        break;

      default:
        console.warn(`[Migration] Unknown operation: ${mutation.operation}`);
    }
  }

  /**
   * Map entity names to API endpoints
   */
  private static getEndpoint(entity: string): string {
    const endpoints: Record<string, string> = {
      clients: '/clients',
      work_orders: '/work-orders',
      quotes: '/quotes',
      quote_items: '/quotes/items',
      invoices: '/invoices',
      checklist_instances: '/checklists/instances',
      checklist_answers: '/checklists/answers',
      checklist_attachments: '/checklists/attachments',
      signatures: '/signatures',
      execution_sessions: '/execution-sessions',
    };

    return endpoints[entity] || `/${entity.replace(/_/g, '-')}`;
  }

  /**
   * Make HTTP request with error handling
   */
  private static async httpRequest(
    method: string,
    url: string,
    data: unknown | null,
    headers: HeadersInit
  ): Promise<void> {
    const options: RequestInit = {
      method,
      headers,
    };

    if (data && method !== 'DELETE') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `${method} ${url} failed with status ${response.status}`;

      try {
        const errorBody = await response.json();
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Cleanup the old database after successful migration
   */
  static async cleanupOldDatabase(): Promise<void> {
    try {
      const db = await SQLite.openDatabaseAsync(this.OLD_DB_NAME);

      // Clear completed/failed mutations
      await db.execAsync('DELETE FROM mutations_queue WHERE status IN ("completed", "failed")');

      // Clear sync metadata
      await db.execAsync('DELETE FROM sync_meta');

      // Clear upload queue if exists
      try {
        await db.execAsync('DELETE FROM upload_queue WHERE status IN ("completed", "failed")');
      } catch {
        // Table might not exist
      }

      await db.closeAsync();

      console.log('[Migration] Old database cleaned up');
    } catch (error) {
      console.error('[Migration] Error cleaning up old database:', error);
      // Don't throw - cleanup is not critical
    }
  }

  /**
   * Get count of pending migrations
   */
  static async getPendingCount(): Promise<number> {
    try {
      const db = await SQLite.openDatabaseAsync(this.OLD_DB_NAME);

      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM mutations_queue
         WHERE status IN ('pending', 'failed', 'processing')`
      );

      await db.closeAsync();

      return result?.count ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Force retry all failed migrations
   */
  static async retryFailedMigrations(
    onProgress?: (current: number, total: number) => void
  ): Promise<MigrationResult> {
    try {
      const db = await SQLite.openDatabaseAsync(this.OLD_DB_NAME);

      // Reset failed mutations to pending
      await db.runAsync(
        'UPDATE mutations_queue SET status = ? WHERE status = ?',
        ['pending', 'failed']
      );

      await db.closeAsync();
    } catch (error) {
      console.error('[Migration] Error resetting failed mutations:', error);
    }

    return this.processPendingMutations(onProgress);
  }
}
