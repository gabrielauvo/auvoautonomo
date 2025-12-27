/**
 * ChargesCacheService Tests
 *
 * Testes unitários para o serviço de cache de cobranças offline.
 * Testa operações de leitura, escrita e sincronização do cache.
 */

import { ChargesCacheService } from '../ChargesCacheService';
import * as database from '../../../db/database';
import { syncEngine } from '../../../sync';
import type { Charge, ChargeStats } from '../types';

// Mock database functions
jest.mock('../../../db/database', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  rawQuery: jest.fn(),
  count: jest.fn(),
  getDatabase: jest.fn(),
}));

// Mock syncEngine
jest.mock('../../../sync', () => ({
  syncEngine: {
    isNetworkOnline: jest.fn(),
    isConfigured: jest.fn(),
    authToken: 'mock-token',
    baseUrl: 'http://localhost:3001',
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Helper to create mock charges
function createMockCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'charge-1',
    asaasId: 'asaas-1',
    userId: 'user-1',
    clientId: 'client-1',
    value: 100,
    billingType: 'PIX',
    status: 'PENDING',
    dueDate: '2024-12-31',
    urls: {
      invoiceUrl: 'https://example.com/invoice',
      pixQrCodeUrl: 'https://example.com/qr',
    },
    client: {
      id: 'client-1',
      name: 'Cliente Teste',
      email: 'cliente@teste.com',
      phone: '11999999999',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    technicianId: 'tech-1',
    ...overrides,
  };
}

function createMockStats(overrides: Partial<ChargeStats> = {}): ChargeStats {
  return {
    total: 10,
    pending: 3,
    overdue: 2,
    confirmed: 4,
    canceled: 1,
    totalValue: 1000,
    receivedValue: 400,
    pendingValue: 300,
    overdueValue: 200,
    ...overrides,
  };
}

describe('ChargesCacheService', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state
    (ChargesCacheService as any).technicianId = null;
    (ChargesCacheService as any).isSyncing = false;
    (ChargesCacheService as any).lastSyncAt = null;
  });

  describe('configure', () => {
    it('should configure the service with technician ID', () => {
      expect(ChargesCacheService.isConfigured()).toBe(false);

      ChargesCacheService.configure('tech-123');

      expect(ChargesCacheService.isConfigured()).toBe(true);
    });

    it('should update technician ID when reconfigured', () => {
      ChargesCacheService.configure('tech-1');
      expect(ChargesCacheService.isConfigured()).toBe(true);

      ChargesCacheService.configure('tech-2');
      expect(ChargesCacheService.isConfigured()).toBe(true);
    });
  });

  describe('getSyncStatus', () => {
    it('should return initial sync status', () => {
      const status = ChargesCacheService.getSyncStatus();

      expect(status).toEqual({
        isSyncing: false,
        lastSyncAt: null,
      });
    });
  });

  describe('getCachedCharges', () => {
    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
    });

    it('should return empty result when not configured', async () => {
      (ChargesCacheService as any).technicianId = null;

      const result = await ChargesCacheService.getCachedCharges();

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });

    it('should return cached charges with pagination', async () => {
      const mockCachedCharges = [
        {
          id: 'charge-1',
          clientId: 'client-1',
          clientName: 'Cliente 1',
          clientEmail: 'c1@test.com',
          clientPhone: '11999999999',
          value: 100,
          billingType: 'PIX',
          status: 'PENDING',
          dueDate: '2024-12-31',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          technicianId: 'tech-1',
        },
        {
          id: 'charge-2',
          clientId: 'client-2',
          clientName: 'Cliente 2',
          clientEmail: 'c2@test.com',
          clientPhone: '11888888888',
          value: 200,
          billingType: 'BOLETO',
          status: 'CONFIRMED',
          dueDate: '2024-12-15',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          technicianId: 'tech-1',
        },
      ];

      // Mock count query
      (database.rawQuery as jest.Mock)
        .mockResolvedValueOnce([{ count: 2 }]) // Count query
        .mockResolvedValueOnce(mockCachedCharges); // Data query

      const result = await ChargesCacheService.getCachedCharges({
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      (database.rawQuery as jest.Mock)
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([
          {
            id: 'charge-1',
            status: 'PENDING',
            clientId: 'client-1',
            value: 100,
            billingType: 'PIX',
            dueDate: '2024-12-31',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            technicianId: 'tech-1',
          },
        ]);

      const result = await ChargesCacheService.getCachedCharges({
        status: 'PENDING',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('PENDING');

      // Verify SQL includes status filter
      const sqlCall = (database.rawQuery as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('status = ?');
    });

    it('should filter by billing type', async () => {
      (database.rawQuery as jest.Mock)
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([
          {
            id: 'charge-1',
            billingType: 'PIX',
            status: 'PENDING',
            clientId: 'client-1',
            value: 100,
            dueDate: '2024-12-31',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            technicianId: 'tech-1',
          },
        ]);

      const result = await ChargesCacheService.getCachedCharges({
        billingType: 'PIX',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].billingType).toBe('PIX');
    });

    it('should filter by search term', async () => {
      (database.rawQuery as jest.Mock)
        .mockResolvedValueOnce([{ count: 1 }])
        .mockResolvedValueOnce([
          {
            id: 'charge-1',
            clientName: 'João Silva',
            description: 'Serviço de manutenção',
            status: 'PENDING',
            clientId: 'client-1',
            value: 100,
            billingType: 'PIX',
            dueDate: '2024-12-31',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            technicianId: 'tech-1',
          },
        ]);

      const result = await ChargesCacheService.getCachedCharges({
        search: 'João',
      });

      expect(result.data).toHaveLength(1);

      // Verify SQL includes search filter
      const sqlCall = (database.rawQuery as jest.Mock).mock.calls[0][0];
      expect(sqlCall).toContain('clientName LIKE ?');
    });
  });

  describe('getCachedChargeById', () => {
    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
    });

    it('should return charge by ID', async () => {
      const mockCached = {
        id: 'charge-1',
        clientId: 'client-1',
        clientName: 'Cliente Teste',
        value: 100,
        billingType: 'PIX',
        status: 'PENDING',
        dueDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        technicianId: 'tech-1',
      };

      (database.findById as jest.Mock).mockResolvedValue(mockCached);

      const result = await ChargesCacheService.getCachedChargeById('charge-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('charge-1');
      expect(result?.value).toBe(100);
      expect(database.findById).toHaveBeenCalledWith('charges_cache', 'charge-1');
    });

    it('should return null when charge not found', async () => {
      (database.findById as jest.Mock).mockResolvedValue(null);

      const result = await ChargesCacheService.getCachedChargeById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getCachedStats', () => {
    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
    });

    it('should return null when not configured', async () => {
      (ChargesCacheService as any).technicianId = null;

      const result = await ChargesCacheService.getCachedStats();

      expect(result).toBeNull();
    });

    it('should return cached stats', async () => {
      (database.rawQuery as jest.Mock).mockResolvedValue([
        {
          id: 1,
          total: 10,
          pending: 3,
          overdue: 2,
          confirmed: 4,
          canceled: 1,
          totalValue: 1000,
          receivedValue: 400,
          pendingValue: 300,
          overdueValue: 200,
          updatedAt: '2024-01-01T00:00:00Z',
          technicianId: 'tech-1',
        },
      ]);

      const result = await ChargesCacheService.getCachedStats();

      expect(result).not.toBeNull();
      expect(result?.total).toBe(10);
      expect(result?.pending).toBe(3);
      expect(result?.receivedValue).toBe(400);
    });

    it('should return null when no stats cached', async () => {
      (database.rawQuery as jest.Mock).mockResolvedValue([]);

      const result = await ChargesCacheService.getCachedStats();

      expect(result).toBeNull();
    });
  });

  describe('hasCachedData', () => {
    it('should return false when not configured', async () => {
      const result = await ChargesCacheService.hasCachedData();
      expect(result).toBe(false);
    });

    it('should return true when cache has data', async () => {
      ChargesCacheService.configure('tech-1');
      (database.count as jest.Mock).mockResolvedValue(5);

      const result = await ChargesCacheService.hasCachedData();

      expect(result).toBe(true);
      expect(database.count).toHaveBeenCalledWith('charges_cache', { technicianId: 'tech-1' });
    });

    it('should return false when cache is empty', async () => {
      ChargesCacheService.configure('tech-1');
      (database.count as jest.Mock).mockResolvedValue(0);

      const result = await ChargesCacheService.hasCachedData();

      expect(result).toBe(false);
    });
  });

  describe('getCacheCount', () => {
    it('should return 0 when not configured', async () => {
      const result = await ChargesCacheService.getCacheCount();
      expect(result).toBe(0);
    });

    it('should return count from database', async () => {
      ChargesCacheService.configure('tech-1');
      (database.count as jest.Mock).mockResolvedValue(15);

      const result = await ChargesCacheService.getCacheCount();

      expect(result).toBe(15);
    });
  });

  describe('saveToCache', () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    it('should not save when not configured', async () => {
      (ChargesCacheService as any).technicianId = null;

      await ChargesCacheService.saveToCache([createMockCharge()]);

      expect(database.getDatabase).not.toHaveBeenCalled();
    });

    it('should not save empty array', async () => {
      await ChargesCacheService.saveToCache([]);

      expect(database.getDatabase).not.toHaveBeenCalled();
    });

    it('should save charges to cache', async () => {
      const charges = [
        createMockCharge({ id: 'charge-1' }),
        createMockCharge({ id: 'charge-2', value: 200 }),
      ];

      await ChargesCacheService.saveToCache(charges);

      expect(database.getDatabase).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    });

    it('should handle charges with discount, fine, and interest', async () => {
      const charge = createMockCharge({
        discount: { value: 10, dueDateLimitDays: 5, type: 'PERCENTAGE' },
        fine: { value: 2, type: 'PERCENTAGE' },
        interest: { value: 1, type: 'PERCENTAGE' },
      });

      await ChargesCacheService.saveToCache([charge]);

      expect(mockDb.runAsync).toHaveBeenCalled();
      const sqlCall = mockDb.runAsync.mock.calls[0][0];
      expect(sqlCall).toContain('INSERT OR REPLACE INTO charges_cache');
    });
  });

  describe('saveStatsToCache', () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    it('should not save when not configured', async () => {
      (ChargesCacheService as any).technicianId = null;

      await ChargesCacheService.saveStatsToCache(createMockStats());

      expect(database.getDatabase).not.toHaveBeenCalled();
    });

    it('should save stats to cache', async () => {
      const stats = createMockStats();

      await ChargesCacheService.saveStatsToCache(stats);

      expect(database.getDatabase).toHaveBeenCalled();
      // Should delete old stats and insert new
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache', () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    beforeEach(() => {
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    it('should not clear when not configured', async () => {
      await ChargesCacheService.clearCache();

      expect(database.getDatabase).not.toHaveBeenCalled();
    });

    it('should clear both charges and stats cache', async () => {
      ChargesCacheService.configure('tech-1');

      await ChargesCacheService.clearCache();

      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      // First call should delete from charges_cache
      expect(mockDb.runAsync.mock.calls[0][0]).toContain('DELETE FROM charges_cache');
      // Second call should delete from charges_stats_cache
      expect(mockDb.runAsync.mock.calls[1][0]).toContain('DELETE FROM charges_stats_cache');
    });
  });

  describe('removeFromCache', () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    beforeEach(() => {
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    it('should remove charge by ID', async () => {
      await ChargesCacheService.removeFromCache('charge-123');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM charges_cache WHERE id = ?'),
        ['charge-123']
      );
    });
  });

  describe('syncFromServer', () => {
    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
      (syncEngine.isNetworkOnline as jest.Mock).mockReturnValue(true);
    });

    it('should return false when not configured', async () => {
      (ChargesCacheService as any).technicianId = null;

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(false);
    });

    it('should return false when offline', async () => {
      (syncEngine.isNetworkOnline as jest.Mock).mockReturnValue(false);

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(false);
    });

    it('should return false when already syncing', async () => {
      (ChargesCacheService as any).isSyncing = true;

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(false);
    });

    it('should sync charges from server', async () => {
      const mockDb = {
        runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      };
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);

      const mockCharges: Charge[] = [
        createMockCharge({ id: 'charge-1' }),
        createMockCharge({ id: 'charge-2' }),
      ];

      const mockStats = createMockStats();

      // Mock fetch for charges
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: mockCharges,
              total: 2,
              page: 1,
              pageSize: 100,
              totalPages: 1,
            }),
        })
        // Mock fetch for stats
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStats),
        });

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify lastSyncAt was updated
      const status = ChargesCacheService.getSyncStatus();
      expect(status.lastSyncAt).not.toBeNull();
    });

    it('should handle server error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(false);
    });

    it('should handle network error gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await ChargesCacheService.syncFromServer();

      expect(result).toBe(false);
    });
  });

  describe('refreshCharge', () => {
    const mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };

    beforeEach(() => {
      ChargesCacheService.configure('tech-1');
      (database.getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    it('should return cached charge when offline', async () => {
      (syncEngine.isNetworkOnline as jest.Mock).mockReturnValue(false);

      const cachedCharge = {
        id: 'charge-1',
        clientId: 'client-1',
        value: 100,
        billingType: 'PIX',
        status: 'PENDING',
        dueDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        technicianId: 'tech-1',
      };
      (database.findById as jest.Mock).mockResolvedValue(cachedCharge);

      const result = await ChargesCacheService.refreshCharge('charge-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('charge-1');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch from server and update cache when online', async () => {
      (syncEngine.isNetworkOnline as jest.Mock).mockReturnValue(true);

      const freshCharge = createMockCharge({ id: 'charge-1', status: 'CONFIRMED' });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(freshCharge),
      });

      const result = await ChargesCacheService.refreshCharge('charge-1');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('CONFIRMED');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should fallback to cache when server fails', async () => {
      (syncEngine.isNetworkOnline as jest.Mock).mockReturnValue(true);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const cachedCharge = {
        id: 'charge-1',
        clientId: 'client-1',
        value: 100,
        billingType: 'PIX',
        status: 'PENDING',
        dueDate: '2024-12-31',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        technicianId: 'tech-1',
      };
      (database.findById as jest.Mock).mockResolvedValue(cachedCharge);

      const result = await ChargesCacheService.refreshCharge('charge-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('charge-1');
    });
  });
});
