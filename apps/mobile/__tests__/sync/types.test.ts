/**
 * Tests for Sync Types
 *
 * These tests verify the type definitions are properly exported.
 */

import {
  SyncEntityConfig,
  SyncState,
  SyncStatus,
  SyncResult,
  SyncError,
  SyncEvent,
  SyncEventType,
  SyncPullResponse,
  SyncPushResponse,
  Mutation,
  MutationOperation,
} from '../../src/sync/types';

describe('Sync Types', () => {
  describe('SyncStatus', () => {
    it('should support all valid status values', () => {
      const statuses: SyncStatus[] = ['idle', 'syncing', 'error', 'offline'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('MutationOperation', () => {
    it('should support all valid operation values', () => {
      const operations: MutationOperation[] = ['create', 'update', 'delete'];
      expect(operations).toHaveLength(3);
    });
  });

  describe('SyncEventType', () => {
    it('should support all valid event types', () => {
      const eventTypes: SyncEventType[] = [
        'sync_start',
        'sync_complete',
        'sync_error',
        'entity_sync_start',
        'entity_sync_complete',
        'mutation_pushed',
        'mutation_failed',
        'conflict_resolved',
        'offline_detected',
        'online_detected',
      ];
      expect(eventTypes).toHaveLength(10);
    });
  });

  describe('SyncState', () => {
    it('should have correct structure', () => {
      const state: SyncState = {
        status: 'idle',
        lastSyncAt: null,
        error: null,
        progress: null,
      };

      expect(state.status).toBe('idle');
      expect(state.lastSyncAt).toBeNull();
      expect(state.error).toBeNull();
      expect(state.progress).toBeNull();
    });

    it('should support progress tracking', () => {
      const state: SyncState = {
        status: 'syncing',
        lastSyncAt: new Date(),
        error: null,
        progress: {
          current: 50,
          total: 100,
          entity: 'clients',
        },
      };

      expect(state.progress?.current).toBe(50);
      expect(state.progress?.total).toBe(100);
      expect(state.progress?.entity).toBe('clients');
    });
  });

  describe('SyncResult', () => {
    it('should have correct structure', () => {
      const result: SyncResult = {
        success: true,
        entity: 'clients',
        pulled: 100,
        pushed: 5,
        errors: [],
        duration: 1500,
      };

      expect(result.success).toBe(true);
      expect(result.entity).toBe('clients');
      expect(result.pulled).toBe(100);
      expect(result.pushed).toBe(5);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBe(1500);
    });
  });

  describe('SyncError', () => {
    it('should have correct structure', () => {
      const error: SyncError = {
        entity: 'clients',
        entityId: 'c123',
        operation: 'push',
        message: 'Network error',
        code: 'NETWORK_ERROR',
      };

      expect(error.entity).toBe('clients');
      expect(error.entityId).toBe('c123');
      expect(error.operation).toBe('push');
      expect(error.message).toBe('Network error');
      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should support optional fields', () => {
      const error: SyncError = {
        entity: 'clients',
        operation: 'pull',
        message: 'Server error',
      };

      expect(error.entityId).toBeUndefined();
      expect(error.code).toBeUndefined();
    });
  });

  describe('SyncEvent', () => {
    it('should have correct structure', () => {
      const event: SyncEvent = {
        type: 'sync_complete',
        entity: 'clients',
        data: { pulled: 100 },
        timestamp: new Date(),
      };

      expect(event.type).toBe('sync_complete');
      expect(event.entity).toBe('clients');
      expect(event.data).toEqual({ pulled: 100 });
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should support optional fields', () => {
      const event: SyncEvent = {
        type: 'sync_start',
        timestamp: new Date(),
      };

      expect(event.entity).toBeUndefined();
      expect(event.data).toBeUndefined();
    });
  });

  describe('SyncPullResponse', () => {
    it('should have correct structure', () => {
      interface TestEntity {
        id: string;
        name: string;
      }

      const response: SyncPullResponse<TestEntity> = {
        data: [{ id: '1', name: 'Test' }],
        cursor: 'next-cursor',
        hasMore: true,
        total: 100,
      };

      expect(response.data).toHaveLength(1);
      expect(response.cursor).toBe('next-cursor');
      expect(response.hasMore).toBe(true);
      expect(response.total).toBe(100);
    });
  });

  describe('SyncPushResponse', () => {
    it('should have correct structure for success', () => {
      const response: SyncPushResponse = {
        success: true,
        entityId: 'local-123',
        serverId: 'server-456',
      };

      expect(response.success).toBe(true);
      expect(response.entityId).toBe('local-123');
      expect(response.serverId).toBe('server-456');
    });

    it('should have correct structure for failure', () => {
      const response: SyncPushResponse = {
        success: false,
        entityId: 'local-123',
        error: 'Validation failed',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Validation failed');
    });
  });

  describe('Mutation', () => {
    it('should have correct structure', () => {
      const mutation: Mutation = {
        id: 1,
        entity: 'clients',
        entityId: 'c123',
        operation: 'create',
        payload: { name: 'John Doe' },
        createdAt: new Date(),
        attempts: 0,
        status: 'pending',
      };

      expect(mutation.id).toBe(1);
      expect(mutation.entity).toBe('clients');
      expect(mutation.entityId).toBe('c123');
      expect(mutation.operation).toBe('create');
      expect(mutation.payload).toEqual({ name: 'John Doe' });
      expect(mutation.attempts).toBe(0);
      expect(mutation.status).toBe('pending');
    });
  });

  describe('SyncEntityConfig', () => {
    it('should have correct structure', () => {
      interface TestEntity {
        id: string;
        name: string;
        updatedAt: string;
        technicianId: string;
      }

      const config: SyncEntityConfig<TestEntity> = {
        name: 'test',
        tableName: 'tests',
        apiEndpoint: '/api/sync/tests',
        apiMutationEndpoint: '/api/sync/tests/mutations',
        cursorField: 'updatedAt',
        primaryKeys: ['id'],
        scopeField: 'technicianId',
        batchSize: 100,
        conflictResolution: 'last_write_wins',
      };

      expect(config.name).toBe('test');
      expect(config.tableName).toBe('tests');
      expect(config.batchSize).toBe(100);
      expect(config.conflictResolution).toBe('last_write_wins');
    });

    it('should support transform functions', () => {
      interface TestEntity {
        id: string;
        updatedAt: string;
        technicianId: string;
      }

      const config: SyncEntityConfig<TestEntity> = {
        name: 'test',
        tableName: 'tests',
        apiEndpoint: '/api/sync/tests',
        apiMutationEndpoint: '/api/sync/tests/mutations',
        cursorField: 'updatedAt',
        primaryKeys: ['id'],
        scopeField: 'technicianId',
        batchSize: 100,
        conflictResolution: 'server_wins',
        transformFromServer: (data) => data as TestEntity,
        transformToServer: (data) => data,
      };

      expect(config.transformFromServer).toBeDefined();
      expect(config.transformToServer).toBeDefined();
    });
  });
});
