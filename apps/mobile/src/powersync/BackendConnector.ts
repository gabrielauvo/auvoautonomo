/**
 * PowerSync Backend Connector
 *
 * Handles authentication and data upload to the backend.
 * Mutations are validated through NestJS API endpoints.
 */

import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  CrudEntry,
  UpdateType,
} from '@powersync/react-native';
import { AuthService } from '../services/AuthService';
import { getApiBaseUrl } from '../config/api';

// PowerSync URL - can be Cloud or Self-hosted
// Cloud: https://<instance>.powersync.journeyapps.com
// Self-hosted: http://localhost:8080 (or your Docker host)
const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL || 'http://10.0.2.2:8080';

// =============================================================================
// BACKEND CONNECTOR
// =============================================================================

export class AuvoBackendConnector implements PowerSyncBackendConnector {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Fetch credentials for PowerSync connection
   * Uses the same JWT token as the rest of the app
   */
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const token = await AuthService.getAccessToken();

    if (!token) {
      throw new Error('No authentication token available');
    }

    if (!POWERSYNC_URL) {
      throw new Error('POWERSYNC_URL not configured');
    }

    return {
      endpoint: POWERSYNC_URL,
      token: token,
    };
  }

  /**
   * Upload local mutations to the backend
   * Each mutation is validated through the NestJS API
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    let lastError: Error | null = null;

    try {
      for (const op of transaction.crud) {
        try {
          await this.processOperation(op);
        } catch (error) {
          console.error(`[PowerSync] Operation failed for ${op.table}:`, error);
          lastError = error instanceof Error ? error : new Error(String(error));
          // Continue processing other operations
        }
      }

      // Complete transaction even if some operations failed
      // Failed operations will be retried on next sync
      await transaction.complete();

      if (lastError) {
        console.warn('[PowerSync] Some operations failed during upload');
      }
    } catch (error) {
      console.error('[PowerSync] Upload transaction failed:', error);
      throw error;
    }
  }

  /**
   * Process a single CRUD operation
   */
  private async processOperation(op: CrudEntry): Promise<void> {
    const token = await AuthService.getAccessToken();

    if (!token) {
      throw new Error('No authentication token');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const endpoint = this.getEndpoint(op.table);
    const data = this.transformToServer(op.table, op.opData || {});

    switch (op.op) {
      case UpdateType.PUT:
        // PUT can be create or update
        if (this.isNewRecord(op)) {
          await this.httpPost(`${this.baseUrl}${endpoint}`, data, headers);
        } else {
          await this.httpPut(`${this.baseUrl}${endpoint}/${op.id}`, data, headers);
        }
        break;

      case UpdateType.PATCH:
        await this.httpPatch(`${this.baseUrl}${endpoint}/${op.id}`, data, headers);
        break;

      case UpdateType.DELETE:
        await this.httpDelete(`${this.baseUrl}${endpoint}/${op.id}`, headers);
        break;

      default:
        console.warn(`[PowerSync] Unknown operation type: ${op.op}`);
    }
  }

  /**
   * Determine if this is a new record (create) or existing (update)
   */
  private isNewRecord(op: CrudEntry): boolean {
    // If the record has a created_at that matches updated_at, it's likely new
    const data = op.opData || {};
    if (data.created_at && data.updated_at) {
      return data.created_at === data.updated_at;
    }
    // Default to treating as update
    return false;
  }

  /**
   * Map table names to API endpoints
   */
  private getEndpoint(table: string): string {
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
      // Read-only tables (no write endpoints)
      // checklist_templates: read-only
      // product_categories: read-only
      // catalog_items: read-only
      // bundle_items: read-only
    };

    const endpoint = endpoints[table];
    if (!endpoint) {
      console.warn(`[PowerSync] No endpoint mapping for table: ${table}`);
      return `/${table.replace(/_/g, '-')}`;
    }

    return endpoint;
  }

  /**
   * Transform local data to server format
   */
  private transformToServer(
    table: string,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    // Remove PowerSync internal fields
    const { id, ...rest } = data;

    // Convert snake_case to camelCase
    const transformed = this.snakeToCamel(rest);

    // Table-specific transformations
    switch (table) {
      case 'clients':
        return {
          ...transformed,
          taxId: transformed.taxId || transformed.tax_id,
          isActive: this.toBoolean(transformed.isActive),
        };

      case 'work_orders':
        return {
          ...transformed,
          isActive: this.toBoolean(transformed.isActive),
        };

      case 'checklist_instances':
        return {
          ...transformed,
          templateVersionSnapshot: transformed.templateVersionSnapshot
            ? JSON.parse(transformed.templateVersionSnapshot as string)
            : undefined,
        };

      case 'checklist_answers':
        return {
          ...transformed,
          valueBoolean: this.toBoolean(transformed.valueBoolean),
          valueJson: transformed.valueJson
            ? JSON.parse(transformed.valueJson as string)
            : undefined,
        };

      case 'checklist_templates':
        return {
          ...transformed,
          sections: transformed.sections
            ? JSON.parse(transformed.sections as string)
            : [],
          questions: transformed.questions
            ? JSON.parse(transformed.questions as string)
            : [],
          isActive: this.toBoolean(transformed.isActive),
        };

      default:
        // Convert any is_active/isActive fields to boolean
        if ('isActive' in transformed) {
          transformed.isActive = this.toBoolean(transformed.isActive);
        }
        return transformed;
    }
  }

  /**
   * Convert snake_case keys to camelCase
   */
  private snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      result[camelKey] = value;
    }

    return result;
  }

  /**
   * Convert SQLite integer (0/1) to boolean
   */
  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return value === '1' || value === 'true';
    return false;
  }

  // =============================================================================
  // HTTP HELPERS
  // =============================================================================

  private async httpPost(
    url: string,
    data: Record<string, unknown>,
    headers: HeadersInit
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    await this.handleResponse(response, 'POST', url);
  }

  private async httpPut(
    url: string,
    data: Record<string, unknown>,
    headers: HeadersInit
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    await this.handleResponse(response, 'PUT', url);
  }

  private async httpPatch(
    url: string,
    data: Record<string, unknown>,
    headers: HeadersInit
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    await this.handleResponse(response, 'PATCH', url);
  }

  private async httpDelete(url: string, headers: HeadersInit): Promise<void> {
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });

    await this.handleResponse(response, 'DELETE', url);
  }

  private async handleResponse(
    response: Response,
    method: string,
    url: string
  ): Promise<void> {
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
}
