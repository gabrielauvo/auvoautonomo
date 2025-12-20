/**
 * ClientSyncConfig Tests
 *
 * Testes para a configuração de sincronização de clientes.
 */

import { ClientSyncConfig, SyncClient } from '../../../src/sync/entities/ClientSyncConfig';

describe('ClientSyncConfig', () => {
  describe('configuration properties', () => {
    it('should have correct entity name', () => {
      expect(ClientSyncConfig.name).toBe('clients');
    });

    it('should have correct table name', () => {
      expect(ClientSyncConfig.tableName).toBe('clients');
    });

    it('should have correct API endpoints', () => {
      expect(ClientSyncConfig.apiEndpoint).toBe('/clients/sync');
      expect(ClientSyncConfig.apiMutationEndpoint).toBe('/clients/sync/mutations');
    });

    it('should use updatedAt as cursor field', () => {
      expect(ClientSyncConfig.cursorField).toBe('updatedAt');
    });

    it('should have correct primary key', () => {
      expect(ClientSyncConfig.primaryKeys).toEqual(['id']);
    });

    it('should use technicianId as scope field', () => {
      expect(ClientSyncConfig.scopeField).toBe('technicianId');
    });

    it('should have batch size of 100', () => {
      expect(ClientSyncConfig.batchSize).toBe(100);
    });

    it('should use last_write_wins for conflict resolution', () => {
      expect(ClientSyncConfig.conflictResolution).toBe('last_write_wins');
    });
  });

  describe('transformFromServer', () => {
    it('should transform server client to local format', () => {
      const serverData = {
        id: 'client-1',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        taxId: '12345678901',
        address: 'Rua Test 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
        notes: 'Test client',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.id).toBe('client-1');
      expect(result.name).toBe('João Silva');
      expect(result.email).toBe('joao@email.com');
      expect(result.phone).toBe('11999999999');
      expect(result.document).toBe('12345678901'); // taxId → document
      expect(result.address).toBe('Rua Test 123');
      expect(result.city).toBe('São Paulo');
      expect(result.state).toBe('SP');
      expect(result.zipCode).toBe('01234-567');
      expect(result.technicianId).toBe('tech-1');
    });

    it('should map taxId to document', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        taxId: '98765432100',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.document).toBe('98765432100');
    });

    it('should handle boolean isActive true', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle boolean isActive false', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle numeric isActive 1', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(1);
    });

    it('should handle numeric isActive 0', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.isActive).toBe(0);
    });

    it('should handle missing optional fields', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.email).toBeUndefined();
      expect(result.phone).toBeUndefined();
      expect(result.document).toBeUndefined();
      expect(result.address).toBeUndefined();
      expect(result.city).toBeUndefined();
      expect(result.state).toBeUndefined();
      expect(result.zipCode).toBeUndefined();
      expect(result.notes).toBeUndefined();
      expect(result.deletedAt).toBeUndefined();
    });

    it('should include deletedAt for soft deleted clients', () => {
      const serverData = {
        id: 'client-1',
        name: 'Test',
        isActive: false,
        deletedAt: '2024-01-10T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-10T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformFromServer(serverData);

      expect(result.deletedAt).toBe('2024-01-10T00:00:00.000Z');
      expect(result.isActive).toBe(0);
    });
  });

  describe('transformToServer', () => {
    it('should transform local client to server format', () => {
      const localClient: SyncClient = {
        id: 'client-1',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        document: '12345678901',
        address: 'Rua Test 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
        notes: 'Test client',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformToServer(localClient) as any;

      expect(result.id).toBe('client-1');
      expect(result.name).toBe('João Silva');
      expect(result.email).toBe('joao@email.com');
      expect(result.phone).toBe('11999999999');
      expect(result.taxId).toBe('12345678901'); // document → taxId
      expect(result.address).toBe('Rua Test 123');
      expect(result.city).toBe('São Paulo');
      expect(result.state).toBe('SP');
      expect(result.zipCode).toBe('01234-567');
      expect(result.notes).toBe('Test client');
      expect(result.isActive).toBe(true);
      expect(result.technicianId).toBe('tech-1');
    });

    it('should map document to taxId', () => {
      const localClient: SyncClient = {
        id: 'client-1',
        name: 'Test',
        document: '98765432100',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformToServer(localClient) as any;

      expect(result.taxId).toBe('98765432100');
    });

    it('should convert undefined fields to null', () => {
      const localClient: SyncClient = {
        id: 'client-1',
        name: 'Test',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      };

      const result = ClientSyncConfig.transformToServer(localClient) as any;

      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.taxId).toBeNull();
      expect(result.address).toBeNull();
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.zipCode).toBeNull();
      expect(result.notes).toBeNull();
    });

    it('should accept taxId from mutation payload', () => {
      const mutationPayload = {
        id: 'client-1',
        name: 'Test',
        taxId: '12345678901', // From mutation queue
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      } as any;

      const result = ClientSyncConfig.transformToServer(mutationPayload) as any;

      expect(result.taxId).toBe('12345678901');
    });

    it('should prefer document over taxId when both exist', () => {
      const mixedPayload = {
        id: 'client-1',
        name: 'Test',
        document: '11111111111',
        taxId: '22222222222',
        isActive: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        technicianId: 'tech-1',
      } as any;

      const result = ClientSyncConfig.transformToServer(mixedPayload) as any;

      expect(result.taxId).toBe('11111111111'); // document takes precedence
    });
  });
});
