/**
 * ClientService Tests
 *
 * Testes para o serviço de clientes.
 */

import { ClientService } from '../../../src/modules/clients/ClientService';

// Mock dependencies
jest.mock('../../../src/db/repositories/ClientRepository', () => ({
  ClientRepository: {
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    softDelete: jest.fn().mockResolvedValue(undefined),
    getById: jest.fn(),
    getPaginated: jest.fn(),
    search: jest.fn(),
    count: jest.fn(),
  },
}));

jest.mock('../../../src/queue/MutationQueue', () => ({
  MutationQueue: {
    enqueue: jest.fn().mockResolvedValue(1),
    countPending: jest.fn().mockResolvedValue(0),
    hasPendingFor: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../../src/sync', () => ({
  syncEngine: {
    isNetworkOnline: jest.fn().mockReturnValue(true),
    syncEntity: jest.fn().mockResolvedValue(undefined),
    syncAll: jest.fn().mockResolvedValue([]),
    getState: jest.fn().mockReturnValue({ status: 'idle' }),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123'),
}));

import { ClientRepository } from '../../../src/db/repositories/ClientRepository';
import { MutationQueue } from '../../../src/queue/MutationQueue';

describe('ClientService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ClientService.configure('technician-123');
  });

  describe('createClient', () => {
    it('should create client in local DB', async () => {
      const input = {
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        taxId: '12345678901',
      };

      const client = await ClientService.createClient(input);

      expect(ClientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-123',
          name: 'João Silva',
          email: 'joao@email.com',
          phone: '11999999999',
          technicianId: 'technician-123',
        })
      );

      expect(client.id).toBe('test-uuid-123');
      expect(client.name).toBe('João Silva');
    });

    it('should enqueue mutation for sync', async () => {
      const input = {
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        taxId: '12345678901',
      };

      await ClientService.createClient(input);

      expect(MutationQueue.enqueue).toHaveBeenCalledWith(
        'clients',
        'test-uuid-123',
        'create',
        expect.objectContaining({
          id: 'test-uuid-123',
          name: 'João Silva',
          email: 'joao@email.com',
        })
      );
    });

    it('should throw error if not configured', async () => {
      // Create new instance without configuring
      const service = Object.create(ClientService);
      service.technicianId = null;

      // Reset the service
      ClientService.configure(null as any);

      await expect(
        ClientService.createClient({ name: 'Test', phone: '11999999999', taxId: '12345678901' })
      ).rejects.toThrow('ClientService not configured');

      // Restore
      ClientService.configure('technician-123');
    });
  });

  describe('updateClient', () => {
    it('should update client in local DB', async () => {
      const existingClient = {
        id: 'client-123',
        name: 'João Silva',
        email: 'joao@email.com',
        phone: '11999999999',
        technicianId: 'technician-123',
      };

      (ClientRepository.getById as jest.Mock).mockResolvedValue(existingClient);

      const input = {
        name: 'João da Silva',
        phone: '11888888888',
      };

      await ClientService.updateClient('client-123', input);

      expect(ClientRepository.update).toHaveBeenCalledWith(
        'client-123',
        expect.objectContaining({
          name: 'João da Silva',
          phone: '11888888888',
        })
      );
    });

    it('should enqueue mutation for sync', async () => {
      const existingClient = {
        id: 'client-123',
        name: 'João Silva',
        email: 'joao@email.com',
        technicianId: 'technician-123',
      };

      (ClientRepository.getById as jest.Mock).mockResolvedValue(existingClient);

      await ClientService.updateClient('client-123', { name: 'João Novo' });

      expect(MutationQueue.enqueue).toHaveBeenCalledWith(
        'clients',
        'client-123',
        'update',
        expect.objectContaining({
          id: 'client-123',
          name: 'João Novo',
        })
      );
    });

    it('should throw error if client not found', async () => {
      (ClientRepository.getById as jest.Mock).mockResolvedValue(null);

      await expect(
        ClientService.updateClient('non-existent', { name: 'Test' })
      ).rejects.toThrow('Client non-existent not found');
    });
  });

  describe('deleteClient', () => {
    it('should soft delete client', async () => {
      const existingClient = {
        id: 'client-123',
        name: 'João Silva',
        technicianId: 'technician-123',
      };

      (ClientRepository.getById as jest.Mock).mockResolvedValue(existingClient);

      await ClientService.deleteClient('client-123');

      expect(ClientRepository.softDelete).toHaveBeenCalledWith('client-123');
    });

    it('should enqueue delete mutation', async () => {
      const existingClient = {
        id: 'client-123',
        name: 'João Silva',
        technicianId: 'technician-123',
      };

      (ClientRepository.getById as jest.Mock).mockResolvedValue(existingClient);

      await ClientService.deleteClient('client-123');

      expect(MutationQueue.enqueue).toHaveBeenCalledWith(
        'clients',
        'client-123',
        'delete',
        expect.objectContaining({
          id: 'client-123',
          name: 'João Silva',
        })
      );
    });
  });

  describe('listClients', () => {
    it('should return paginated clients', async () => {
      const mockResult = {
        data: [
          { id: '1', name: 'Cliente 1' },
          { id: '2', name: 'Cliente 2' },
        ],
        total: 100,
        pages: 2,
      };

      (ClientRepository.getPaginated as jest.Mock).mockResolvedValue(mockResult);

      const result = await ClientService.listClients(1, 50);

      expect(ClientRepository.getPaginated).toHaveBeenCalledWith(
        'technician-123',
        1,
        50
      );
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(100);
    });
  });

  describe('searchClients', () => {
    it('should search locally first', async () => {
      const mockResults = [
        { id: '1', name: 'João Silva' },
        { id: '2', name: 'João Santos' },
      ];

      (ClientRepository.search as jest.Mock).mockResolvedValue(mockResults);

      const result = await ClientService.searchClients('João');

      expect(ClientRepository.search).toHaveBeenCalledWith(
        'technician-123',
        'João',
        50
      );
      expect(result.data).toHaveLength(2);
      expect(result.isLocal).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return client stats', async () => {
      (ClientRepository.count as jest.Mock).mockResolvedValue(150);
      (MutationQueue.countPending as jest.Mock).mockResolvedValue(5);

      const stats = await ClientService.getStats();

      expect(stats.total).toBe(150);
      expect(stats.pending).toBe(5);
    });
  });
});
