/**
 * ClientRepository Tests
 *
 * Testes para operações do repositório de clientes.
 */

// Mock database functions
const mockFindAll = jest.fn();
const mockFindById = jest.fn();
const mockFindOne = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockRemove = jest.fn();
const mockCount = jest.fn();
const mockRawQuery = jest.fn();

jest.mock('../../../src/db/database', () => ({
  findAll: (...args: unknown[]) => mockFindAll(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  findOne: (...args: unknown[]) => mockFindOne(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  count: (...args: unknown[]) => mockCount(...args),
  rawQuery: (...args: unknown[]) => mockRawQuery(...args),
}));

import { ClientRepository } from '../../../src/db/repositories/ClientRepository';
import { Client } from '../../../src/db/schema';

describe('ClientRepository', () => {
  const technicianId = 'tech-123';

  const mockClient: Client = {
    id: 'client-1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    document: '12345678901',
    address: '123 Main St',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01234-567',
    notes: 'Test notes',
    isActive: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    syncedAt: '2024-01-01T00:00:00.000Z',
    technicianId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all active clients for a technician', async () => {
      mockFindAll.mockResolvedValue([mockClient]);

      const result = await ClientRepository.getAll(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('clients', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
      });
      expect(result).toEqual([mockClient]);
    });

    it('should pass additional options', async () => {
      mockFindAll.mockResolvedValue([]);

      await ClientRepository.getAll(technicianId, { limit: 10, offset: 5 });

      expect(mockFindAll).toHaveBeenCalledWith('clients', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('getById', () => {
    it('should return client by ID', async () => {
      mockFindById.mockResolvedValue(mockClient);

      const result = await ClientRepository.getById('client-1');

      expect(mockFindById).toHaveBeenCalledWith('clients', 'client-1');
      expect(result).toEqual(mockClient);
    });

    it('should return null if client not found', async () => {
      mockFindById.mockResolvedValue(null);

      const result = await ClientRepository.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('should return client by email and technician', async () => {
      mockFindOne.mockResolvedValue(mockClient);

      const result = await ClientRepository.getByEmail('john@example.com', technicianId);

      expect(mockFindOne).toHaveBeenCalledWith('clients', {
        email: 'john@example.com',
        technicianId,
      });
      expect(result).toEqual(mockClient);
    });

    it('should return null if no client with email', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await ClientRepository.getByEmail('notfound@example.com', technicianId);

      expect(result).toBeNull();
    });
  });

  describe('getPaginated', () => {
    it('should return paginated clients', async () => {
      mockFindAll.mockResolvedValue([mockClient]);
      mockCount.mockResolvedValue(100);

      const result = await ClientRepository.getPaginated(technicianId, 1, 50);

      expect(mockFindAll).toHaveBeenCalledWith('clients', {
        where: { technicianId, isActive: 1 },
        orderBy: 'name',
        order: 'ASC',
        limit: 50,
        offset: 0,
      });
      expect(mockCount).toHaveBeenCalledWith('clients', { technicianId, isActive: 1 });
      expect(result).toEqual({
        data: [mockClient],
        total: 100,
        pages: 2,
      });
    });

    it('should calculate correct offset for page 2', async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(100);

      await ClientRepository.getPaginated(technicianId, 2, 50);

      expect(mockFindAll).toHaveBeenCalledWith('clients', expect.objectContaining({
        offset: 50,
      }));
    });

    it('should use default page and pageSize', async () => {
      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await ClientRepository.getPaginated(technicianId);

      expect(mockFindAll).toHaveBeenCalledWith('clients', expect.objectContaining({
        limit: 50,
        offset: 0,
      }));
    });
  });

  describe('search', () => {
    it('should search clients by query', async () => {
      mockRawQuery.mockResolvedValue([mockClient]);

      const result = await ClientRepository.search(technicianId, 'John');

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ?'),
        [technicianId, '%John%', '%John%', '%John%', '%John%', 50]
      );
      expect(result).toEqual([mockClient]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);

      await ClientRepository.search(technicianId, 'test', 10);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });
  });

  describe('create', () => {
    it('should create a new client with timestamps', async () => {
      mockInsert.mockResolvedValue(undefined);
      const now = new Date().toISOString();

      const newClient = { ...mockClient };
      delete (newClient as Partial<Client>).createdAt;
      delete (newClient as Partial<Client>).updatedAt;

      await ClientRepository.create(newClient);

      expect(mockInsert).toHaveBeenCalledWith('clients', expect.objectContaining({
        id: mockClient.id,
        name: mockClient.name,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
    });

    it('should preserve existing timestamps', async () => {
      mockInsert.mockResolvedValue(undefined);

      await ClientRepository.create(mockClient);

      expect(mockInsert).toHaveBeenCalledWith('clients', expect.objectContaining({
        createdAt: mockClient.createdAt,
        updatedAt: mockClient.updatedAt,
      }));
    });
  });

  describe('update', () => {
    it('should update client with new updatedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ClientRepository.update('client-1', { name: 'Jane Doe' });

      expect(mockUpdate).toHaveBeenCalledWith('clients', 'client-1', {
        name: 'Jane Doe',
        updatedAt: expect.any(String),
      });
    });

    it('should update multiple fields', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ClientRepository.update('client-1', {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
      });

      expect(mockUpdate).toHaveBeenCalledWith('clients', 'client-1', {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
        updatedAt: expect.any(String),
      });
    });
  });

  describe('softDelete', () => {
    it('should set isActive to 0 and add deletedAt', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ClientRepository.softDelete('client-1');

      expect(mockUpdate).toHaveBeenCalledWith('clients', 'client-1', {
        isActive: 0,
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('delete', () => {
    it('should hard delete client', async () => {
      mockRemove.mockResolvedValue(undefined);

      await ClientRepository.delete('client-1');

      expect(mockRemove).toHaveBeenCalledWith('clients', 'client-1');
    });
  });

  describe('count', () => {
    it('should return count of active clients', async () => {
      mockCount.mockResolvedValue(42);

      const result = await ClientRepository.count(technicianId);

      expect(mockCount).toHaveBeenCalledWith('clients', { technicianId, isActive: 1 });
      expect(result).toBe(42);
    });
  });

  describe('getModifiedAfter', () => {
    it('should return clients modified after date', async () => {
      mockRawQuery.mockResolvedValue([mockClient]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      const result = await ClientRepository.getModifiedAfter(technicianId, afterDate);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE technicianId = ? AND updatedAt > ?'),
        [technicianId, afterDate, 100]
      );
      expect(result).toEqual([mockClient]);
    });

    it('should use custom limit', async () => {
      mockRawQuery.mockResolvedValue([]);
      const afterDate = '2024-01-01T00:00:00.000Z';

      await ClientRepository.getModifiedAfter(technicianId, afterDate, 50);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.any(String),
        [technicianId, afterDate, 50]
      );
    });
  });

  describe('batchInsert', () => {
    it('should batch insert multiple clients', async () => {
      mockRawQuery.mockResolvedValue(undefined);
      const clients = [mockClient, { ...mockClient, id: 'client-2', name: 'Jane Doe' }];

      await ClientRepository.batchInsert(clients);

      expect(mockRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO clients'),
        expect.any(Array)
      );
    });

    it('should do nothing for empty array', async () => {
      await ClientRepository.batchInsert([]);

      expect(mockRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('markSynced', () => {
    it('should update syncedAt timestamp', async () => {
      mockUpdate.mockResolvedValue(undefined);

      await ClientRepository.markSynced('client-1');

      expect(mockUpdate).toHaveBeenCalledWith('clients', 'client-1', {
        syncedAt: expect.any(String),
      });
    });
  });
});
