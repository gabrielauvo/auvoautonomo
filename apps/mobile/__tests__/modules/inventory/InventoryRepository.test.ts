/**
 * InventoryRepository Tests
 *
 * Testes para operações do repositório de estoque.
 */

// Mock database
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockRunAsync = jest.fn();

const mockDb = {
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
  runAsync: mockRunAsync,
};

jest.mock('../../../src/db/database', () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDb)),
  rawQuery: jest.fn(),
}));

import { InventoryRepository } from '../../../src/modules/inventory/InventoryRepository';
import type {
  InventorySettings,
  InventoryBalance,
  InventoryMovement,
  InventoryMovementOutbox,
} from '../../../src/modules/inventory/InventoryRepository';

describe('InventoryRepository', () => {
  const userId = 'user-123';

  const mockSettings: InventorySettings = {
    id: 'settings-1',
    userId,
    isEnabled: 1,
    deductOnStatus: 'DONE',
    allowNegativeStock: 0,
    deductOnlyOncePerWorkOrder: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  const mockBalance: InventoryBalance = {
    id: 'balance-1',
    itemId: 'item-1',
    quantity: 100,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    itemName: 'Product A',
    itemSku: 'SKU-001',
    itemUnit: 'un',
    itemType: 'PRODUCT',
  };

  const mockMovement: InventoryMovement = {
    id: 'movement-1',
    itemId: 'item-1',
    type: 'ADJUSTMENT_IN',
    source: 'MANUAL',
    quantity: 10,
    balanceAfter: 110,
    notes: 'Test adjustment',
    createdBy: userId,
    createdAt: '2024-01-01T00:00:00.000Z',
    syncStatus: 'pending',
    itemName: 'Product A',
    itemSku: 'SKU-001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // SETTINGS TESTS
  // ===========================================================================

  describe('Settings', () => {
    describe('getSettings', () => {
      it('should return settings for user', async () => {
        mockGetFirstAsync.mockResolvedValue(mockSettings);

        const result = await InventoryRepository.getSettings(userId);

        expect(mockGetFirstAsync).toHaveBeenCalledWith(
          'SELECT * FROM inventory_settings WHERE userId = ?',
          [userId]
        );
        expect(result).toEqual(mockSettings);
      });

      it('should return null if no settings exist', async () => {
        mockGetFirstAsync.mockResolvedValue(null);

        const result = await InventoryRepository.getSettings(userId);

        expect(result).toBeNull();
      });
    });

    describe('upsertSettings', () => {
      it('should insert or replace settings', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.upsertSettings(mockSettings);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT OR REPLACE INTO inventory_settings'),
          [
            mockSettings.id,
            mockSettings.userId,
            mockSettings.isEnabled,
            mockSettings.deductOnStatus,
            mockSettings.allowNegativeStock,
            mockSettings.deductOnlyOncePerWorkOrder,
            mockSettings.createdAt,
            mockSettings.updatedAt,
          ]
        );
      });
    });
  });

  // ===========================================================================
  // BALANCES TESTS
  // ===========================================================================

  describe('Balances', () => {
    describe('getBalances', () => {
      it('should return all balances for user', async () => {
        mockGetAllAsync.mockResolvedValue([mockBalance]);

        const result = await InventoryRepository.getBalances(userId);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('FROM inventory_balances ib'),
          [userId]
        );
        expect(result).toEqual([mockBalance]);
      });

      it('should return empty array if no balances', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        const result = await InventoryRepository.getBalances(userId);

        expect(result).toEqual([]);
      });
    });

    describe('getBalanceByItemId', () => {
      it('should return balance for specific item', async () => {
        mockGetFirstAsync.mockResolvedValue(mockBalance);

        const result = await InventoryRepository.getBalanceByItemId('item-1');

        expect(mockGetFirstAsync).toHaveBeenCalledWith(
          expect.stringContaining('WHERE ib.itemId = ?'),
          ['item-1']
        );
        expect(result).toEqual(mockBalance);
      });

      it('should return null if item has no balance', async () => {
        mockGetFirstAsync.mockResolvedValue(null);

        const result = await InventoryRepository.getBalanceByItemId('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('upsertBalance', () => {
      it('should insert or replace balance', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.upsertBalance(mockBalance);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT OR REPLACE INTO inventory_balances'),
          [
            mockBalance.id,
            mockBalance.itemId,
            mockBalance.quantity,
            mockBalance.createdAt,
            mockBalance.updatedAt,
          ]
        );
      });
    });

    describe('updateBalanceQuantity', () => {
      it('should update quantity for item', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.updateBalanceQuantity('item-1', 150);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE inventory_balances SET quantity = ?'),
          expect.arrayContaining([150, 'item-1'])
        );
      });
    });

    describe('searchBalances', () => {
      it('should search balances by query', async () => {
        mockGetAllAsync.mockResolvedValue([mockBalance]);

        const result = await InventoryRepository.searchBalances(userId, 'Product');

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('i.name LIKE ?'),
          expect.arrayContaining([userId, '%Product%', '%Product%', 50])
        );
        expect(result).toEqual([mockBalance]);
      });

      it('should respect limit parameter', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.searchBalances(userId, 'test', 10);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT ?'),
          expect.arrayContaining([10])
        );
      });
    });

    describe('getLowStockBalances', () => {
      it('should return balances below threshold', async () => {
        const lowStockBalance = { ...mockBalance, quantity: 3 };
        mockGetAllAsync.mockResolvedValue([lowStockBalance]);

        const result = await InventoryRepository.getLowStockBalances(userId, 5);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('ib.quantity <= ?'),
          [userId, 5]
        );
        expect(result).toEqual([lowStockBalance]);
      });

      it('should use default threshold of 5', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getLowStockBalances(userId);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.any(String),
          [userId, 5]
        );
      });
    });

    describe('countBalances', () => {
      it('should return count of balances', async () => {
        mockGetFirstAsync.mockResolvedValue({ count: 42 });

        const result = await InventoryRepository.countBalances(userId);

        expect(result).toBe(42);
      });

      it('should return 0 if no balances', async () => {
        mockGetFirstAsync.mockResolvedValue(null);

        const result = await InventoryRepository.countBalances(userId);

        expect(result).toBe(0);
      });
    });

    describe('getTotalQuantity', () => {
      it('should return sum of all quantities', async () => {
        mockGetFirstAsync.mockResolvedValue({ total: 1500 });

        const result = await InventoryRepository.getTotalQuantity(userId);

        expect(result).toBe(1500);
      });

      it('should return 0 if no quantities', async () => {
        mockGetFirstAsync.mockResolvedValue(null);

        const result = await InventoryRepository.getTotalQuantity(userId);

        expect(result).toBe(0);
      });
    });
  });

  // ===========================================================================
  // MOVEMENTS TESTS
  // ===========================================================================

  describe('Movements', () => {
    describe('getMovements', () => {
      it('should return movements for user', async () => {
        mockGetAllAsync.mockResolvedValue([mockMovement]);

        const result = await InventoryRepository.getMovements(userId);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('FROM inventory_movements im'),
          expect.arrayContaining([userId, 50, 0])
        );
        expect(result).toEqual([mockMovement]);
      });

      it('should filter by itemId', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getMovements(userId, { itemId: 'item-1' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('im.itemId = ?'),
          expect.arrayContaining(['item-1'])
        );
      });

      it('should filter by type', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getMovements(userId, { type: 'ADJUSTMENT_IN' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('im.type = ?'),
          expect.arrayContaining(['ADJUSTMENT_IN'])
        );
      });

      it('should filter by source', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getMovements(userId, { source: 'MANUAL' });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('im.source = ?'),
          expect.arrayContaining(['MANUAL'])
        );
      });

      it('should respect limit and offset', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getMovements(userId, { limit: 10, offset: 20 });

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT ? OFFSET ?'),
          expect.arrayContaining([10, 20])
        );
      });
    });

    describe('insertMovement', () => {
      it('should insert movement record', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.insertMovement(mockMovement);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO inventory_movements'),
          [
            mockMovement.id,
            mockMovement.itemId,
            mockMovement.type,
            mockMovement.source,
            mockMovement.quantity,
            mockMovement.balanceAfter,
            mockMovement.sourceId || null,
            mockMovement.notes,
            mockMovement.createdBy,
            mockMovement.createdAt,
            mockMovement.syncStatus,
          ]
        );
      });

      it('should handle null optional fields', async () => {
        const movementWithNulls: InventoryMovement = {
          ...mockMovement,
          sourceId: undefined,
          notes: undefined,
          createdBy: undefined,
        };
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.insertMovement(movementWithNulls);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([null, null, null])
        );
      });
    });

    describe('getRecentMovements', () => {
      it('should return recent movements with default limit', async () => {
        mockGetAllAsync.mockResolvedValue([mockMovement]);

        const result = await InventoryRepository.getRecentMovements(userId);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([userId, 10, 0])
        );
        expect(result).toEqual([mockMovement]);
      });

      it('should respect custom limit', async () => {
        mockGetAllAsync.mockResolvedValue([]);

        await InventoryRepository.getRecentMovements(userId, 5);

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([userId, 5, 0])
        );
      });
    });
  });

  // ===========================================================================
  // OUTBOX TESTS
  // ===========================================================================

  describe('Outbox', () => {
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

    describe('addToOutbox', () => {
      it('should add item to outbox', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.addToOutbox(mockOutboxItem);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO inventory_movements_outbox'),
          expect.arrayContaining([
            mockOutboxItem.id,
            mockOutboxItem.movementId,
            mockOutboxItem.itemId,
          ])
        );
      });
    });

    describe('getPendingOutbox', () => {
      it('should return pending and error items', async () => {
        mockGetAllAsync.mockResolvedValue([mockOutboxItem]);

        const result = await InventoryRepository.getPendingOutbox();

        expect(mockGetAllAsync).toHaveBeenCalledWith(
          expect.stringContaining("syncStatus IN ('pending', 'error')")
        );
        expect(result).toEqual([mockOutboxItem]);
      });
    });

    describe('updateOutboxStatus', () => {
      it('should update status and increment attempts', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.updateOutboxStatus('outbox-1', 'error', 'Network error');

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('SET syncStatus = ?'),
          expect.arrayContaining(['error', 'Network error', 'outbox-1'])
        );
      });

      it('should handle null error message', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.updateOutboxStatus('outbox-1', 'syncing');

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([null])
        );
      });
    });

    describe('removeFromOutbox', () => {
      it('should delete item from outbox', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.removeFromOutbox('outbox-1');

        expect(mockRunAsync).toHaveBeenCalledWith(
          'DELETE FROM inventory_movements_outbox WHERE id = ?',
          ['outbox-1']
        );
      });
    });

    describe('clearSyncedOutbox', () => {
      it('should delete all synced items', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.clearSyncedOutbox();

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining("syncStatus = 'synced'")
        );
      });
    });
  });

  // ===========================================================================
  // BULK OPERATIONS TESTS
  // ===========================================================================

  describe('Bulk Operations', () => {
    describe('replaceAllBalances', () => {
      it('should delete all and insert new balances', async () => {
        mockRunAsync.mockResolvedValue(undefined);
        const balances = [mockBalance, { ...mockBalance, id: 'balance-2', itemId: 'item-2' }];

        await InventoryRepository.replaceAllBalances(balances);

        expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM inventory_balances');
        // Should insert each balance
        expect(mockRunAsync).toHaveBeenCalledTimes(1 + balances.length);
      });

      it('should only delete if empty array', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.replaceAllBalances([]);

        expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM inventory_balances');
        expect(mockRunAsync).toHaveBeenCalledTimes(1);
      });
    });

    describe('replaceAllMovements', () => {
      it('should delete synced movements and insert new ones', async () => {
        mockRunAsync.mockResolvedValue(undefined);
        const movements = [mockMovement];

        await InventoryRepository.replaceAllMovements(userId, movements);

        expect(mockRunAsync).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM inventory_movements'),
          [userId]
        );
      });

      it('should mark inserted movements as synced', async () => {
        mockRunAsync.mockResolvedValue(undefined);

        await InventoryRepository.replaceAllMovements(userId, [mockMovement]);

        // Second call should be the insert with syncStatus = 'synced'
        const insertCall = mockRunAsync.mock.calls[1];
        expect(insertCall[1]).toContain('synced');
      });
    });
  });
});
