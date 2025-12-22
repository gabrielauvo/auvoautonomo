/**
 * InventorySyncService Tests
 *
 * Testes para sincronização de dados de estoque.
 */

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock repository
const mockGetPendingOutbox = jest.fn();
const mockUpdateOutboxStatus = jest.fn();
const mockRemoveFromOutbox = jest.fn();
const mockReplaceAllBalances = jest.fn();
const mockUpsertSettings = jest.fn();

jest.mock('../../../src/modules/inventory/InventoryRepository', () => ({
  InventoryRepository: {
    getPendingOutbox: (...args: unknown[]) => mockGetPendingOutbox(...args),
    updateOutboxStatus: (...args: unknown[]) => mockUpdateOutboxStatus(...args),
    removeFromOutbox: (...args: unknown[]) => mockRemoveFromOutbox(...args),
    replaceAllBalances: (...args: unknown[]) => mockReplaceAllBalances(...args),
    upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
  },
}));

import { inventorySyncService } from '../../../src/modules/inventory/InventorySyncConfig';
import type { InventoryMovementOutbox } from '../../../src/modules/inventory/InventoryRepository';

describe('InventorySyncService', () => {
  const baseUrl = 'https://api.example.com';
  const authToken = 'test-auth-token';

  const mockOutboxItem: InventoryMovementOutbox = {
    id: 'outbox-1',
    movementId: 'movement-1',
    itemId: 'item-1',
    type: 'ADJUSTMENT_IN',
    source: 'MANUAL',
    quantity: 10,
    balanceAfter: 110,
    notes: 'Test',
    createdAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'pending',
    syncAttempts: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    inventorySyncService.configure(baseUrl, authToken);
  });

  // ===========================================================================
  // PUSH PENDING MOVEMENTS TESTS
  // ===========================================================================

  describe('pushPendingMovements', () => {
    it('should return 0 success and 0 failed when no pending items', async () => {
      mockGetPendingOutbox.mockResolvedValue([]);

      const result = await inventorySyncService.pushPendingMovements();

      expect(result).toEqual({ success: 0, failed: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should push pending items to server', async () => {
      mockGetPendingOutbox.mockResolvedValue([mockOutboxItem]);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);
      mockRemoveFromOutbox.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: mockOutboxItem.movementId }),
      } as Response);

      const result = await inventorySyncService.pushPendingMovements();

      expect(mockUpdateOutboxStatus).toHaveBeenCalledWith(mockOutboxItem.id, 'syncing');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/inventory/movements`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        })
      );
      expect(mockRemoveFromOutbox).toHaveBeenCalledWith(mockOutboxItem.id);
      expect(result).toEqual({ success: 1, failed: 0 });
    });

    it('should handle server errors', async () => {
      mockGetPendingOutbox.mockResolvedValue([mockOutboxItem]);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server error'),
      } as Response);

      const result = await inventorySyncService.pushPendingMovements();

      expect(mockUpdateOutboxStatus).toHaveBeenCalledWith(
        mockOutboxItem.id,
        'error',
        'Server error'
      );
      expect(result).toEqual({ success: 0, failed: 1 });
    });

    it('should handle network errors', async () => {
      mockGetPendingOutbox.mockResolvedValue([mockOutboxItem]);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await inventorySyncService.pushPendingMovements();

      expect(mockUpdateOutboxStatus).toHaveBeenCalledWith(
        mockOutboxItem.id,
        'error',
        'Network error'
      );
      expect(result).toEqual({ success: 0, failed: 1 });
    });

    it('should process multiple items', async () => {
      const items = [
        mockOutboxItem,
        { ...mockOutboxItem, id: 'outbox-2', movementId: 'movement-2' },
        { ...mockOutboxItem, id: 'outbox-3', movementId: 'movement-3' },
      ];
      mockGetPendingOutbox.mockResolvedValue(items);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);
      mockRemoveFromOutbox.mockResolvedValue(undefined);

      // First two succeed, third fails
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as Response)
        .mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Error') } as Response);

      const result = await inventorySyncService.pushPendingMovements();

      expect(result).toEqual({ success: 2, failed: 1 });
    });
  });

  // ===========================================================================
  // PULL BALANCES TESTS
  // ===========================================================================

  describe('pullBalances', () => {
    it('should fetch and save balances from server', async () => {
      const serverBalances = {
        items: [
          {
            id: 'balance-1',
            itemId: 'item-1',
            quantity: 100,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            itemName: 'Product A',
            itemSku: 'SKU-001',
            itemUnit: 'un',
            itemType: 'PRODUCT',
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverBalances),
      } as Response);
      mockReplaceAllBalances.mockResolvedValue(undefined);

      const result = await inventorySyncService.pullBalances();

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/inventory/balances`,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${authToken}` },
        })
      );
      expect(mockReplaceAllBalances).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'balance-1',
            itemId: 'item-1',
            quantity: 100,
          }),
        ])
      );
      expect(result).toBe(1);
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      } as Response);
      mockReplaceAllBalances.mockResolvedValue(undefined);

      const result = await inventorySyncService.pullBalances();

      expect(mockReplaceAllBalances).toHaveBeenCalledWith([]);
      expect(result).toBe(0);
    });

    it('should throw error on server failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(inventorySyncService.pullBalances()).rejects.toThrow(
        'Failed to fetch balances: 500'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(inventorySyncService.pullBalances()).rejects.toThrow('Network error');
    });
  });

  // ===========================================================================
  // PULL SETTINGS TESTS
  // ===========================================================================

  describe('pullSettings', () => {
    it('should fetch and save settings from server', async () => {
      const serverSettings = {
        id: 'settings-1',
        userId: 'user-1',
        isEnabled: true,
        deductOnStatus: 'DONE',
        allowNegativeStock: false,
        deductOnlyOncePerWorkOrder: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(serverSettings),
      } as Response);
      mockUpsertSettings.mockResolvedValue(undefined);

      const result = await inventorySyncService.pullSettings();

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/inventory/settings`,
        expect.objectContaining({
          headers: { Authorization: `Bearer ${authToken}` },
        })
      );
      expect(mockUpsertSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'settings-1',
          isEnabled: 1, // Converted to SQLite integer
          allowNegativeStock: 0,
          deductOnlyOncePerWorkOrder: 1,
        })
      );
      expect(result).toBe(true);
    });

    it('should return false when settings not found (404)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await inventorySyncService.pullSettings();

      expect(result).toBe(false);
      expect(mockUpsertSettings).not.toHaveBeenCalled();
    });

    it('should throw error on other server failures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(inventorySyncService.pullSettings()).rejects.toThrow(
        'Failed to fetch settings: 500'
      );
    });
  });

  // ===========================================================================
  // FULL SYNC TESTS
  // ===========================================================================

  describe('fullSync', () => {
    it('should push pending then pull latest data', async () => {
      // Setup mocks
      mockGetPendingOutbox.mockResolvedValue([]);
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ isEnabled: true }),
        } as Response) // pullSettings
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        } as Response); // pullBalances

      mockUpsertSettings.mockResolvedValue(undefined);
      mockReplaceAllBalances.mockResolvedValue(undefined);

      await inventorySyncService.fullSync();

      // Verify order: push first, then pull
      expect(mockGetPendingOutbox).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should continue pulling even if push has failures', async () => {
      const failingItem = mockOutboxItem;
      mockGetPendingOutbox.mockResolvedValue([failingItem]);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);

      // Push fails, but pulls succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          text: () => Promise.resolve('Push error'),
        } as Response) // push movement
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ isEnabled: true }),
        } as Response) // pullSettings
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        } as Response); // pullBalances

      mockUpsertSettings.mockResolvedValue(undefined);
      mockReplaceAllBalances.mockResolvedValue(undefined);

      // Should not throw even with push failures
      await expect(inventorySyncService.fullSync()).resolves.not.toThrow();

      // Verify pulls were still called
      expect(mockUpsertSettings).toHaveBeenCalled();
      expect(mockReplaceAllBalances).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // CONFIGURATION TESTS
  // ===========================================================================

  describe('configure', () => {
    it('should store baseUrl and authToken', async () => {
      const newBaseUrl = 'https://new-api.example.com';
      const newToken = 'new-token';

      inventorySyncService.configure(newBaseUrl, newToken);

      // Verify configuration by making a call
      mockGetPendingOutbox.mockResolvedValue([mockOutboxItem]);
      mockUpdateOutboxStatus.mockResolvedValue(undefined);
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as Response);

      await inventorySyncService.pushPendingMovements();

      expect(mockFetch).toHaveBeenCalledWith(
        `${newBaseUrl}/inventory/movements`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${newToken}`,
          }),
        })
      );
    });
  });
});
