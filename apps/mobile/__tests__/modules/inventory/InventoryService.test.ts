/**
 * InventoryService Tests
 *
 * Testes para a lógica de negócio do módulo de estoque.
 */

import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

// Mock repository
const mockGetSettings = jest.fn();
const mockUpsertSettings = jest.fn();
const mockGetBalances = jest.fn();
const mockGetBalanceByItemId = jest.fn();
const mockUpsertBalance = jest.fn();
const mockUpdateBalanceQuantity = jest.fn();
const mockSearchBalances = jest.fn();
const mockGetLowStockBalances = jest.fn();
const mockCountBalances = jest.fn();
const mockGetTotalQuantity = jest.fn();
const mockGetMovements = jest.fn();
const mockInsertMovement = jest.fn();
const mockGetRecentMovements = jest.fn();
const mockAddToOutbox = jest.fn();
const mockGetPendingOutbox = jest.fn();

jest.mock('../../../src/modules/inventory/InventoryRepository', () => ({
  InventoryRepository: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
    getBalances: (...args: unknown[]) => mockGetBalances(...args),
    getBalanceByItemId: (...args: unknown[]) => mockGetBalanceByItemId(...args),
    upsertBalance: (...args: unknown[]) => mockUpsertBalance(...args),
    updateBalanceQuantity: (...args: unknown[]) => mockUpdateBalanceQuantity(...args),
    searchBalances: (...args: unknown[]) => mockSearchBalances(...args),
    getLowStockBalances: (...args: unknown[]) => mockGetLowStockBalances(...args),
    countBalances: (...args: unknown[]) => mockCountBalances(...args),
    getTotalQuantity: (...args: unknown[]) => mockGetTotalQuantity(...args),
    getMovements: (...args: unknown[]) => mockGetMovements(...args),
    insertMovement: (...args: unknown[]) => mockInsertMovement(...args),
    getRecentMovements: (...args: unknown[]) => mockGetRecentMovements(...args),
    addToOutbox: (...args: unknown[]) => mockAddToOutbox(...args),
    getPendingOutbox: (...args: unknown[]) => mockGetPendingOutbox(...args),
  },
}));

import { InventoryService } from '../../../src/modules/inventory/InventoryService';
import type {
  InventorySettings,
  InventoryBalance,
  InventoryMovement,
} from '../../../src/modules/inventory/InventoryRepository';

describe('InventoryService', () => {
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Configure service with userId
    InventoryService.configure(userId);
  });

  // ===========================================================================
  // CONFIGURATION TESTS
  // ===========================================================================

  describe('Configuration', () => {
    it('should throw error when not configured', async () => {
      // Create a new instance to test unconfigured state
      const unconfiguredService = Object.create(InventoryService);
      unconfiguredService.userId = null;

      // The actual service is configured in beforeEach, so we test the getter
      expect(() => {
        // Access private method through any cast
        (unconfiguredService as any).getUserId();
      }).toThrow('InventoryService not configured');
    });
  });

  // ===========================================================================
  // SETTINGS TESTS
  // ===========================================================================

  describe('Settings', () => {
    describe('getSettings', () => {
      it('should return settings from repository', async () => {
        mockGetSettings.mockResolvedValue(mockSettings);

        const result = await InventoryService.getSettings();

        expect(mockGetSettings).toHaveBeenCalledWith(userId);
        expect(result).toEqual(mockSettings);
      });
    });

    describe('isEnabled', () => {
      it('should return true when isEnabled is 1', async () => {
        mockGetSettings.mockResolvedValue(mockSettings);

        const result = await InventoryService.isEnabled();

        expect(result).toBe(true);
      });

      it('should return false when isEnabled is 0', async () => {
        mockGetSettings.mockResolvedValue({ ...mockSettings, isEnabled: 0 });

        const result = await InventoryService.isEnabled();

        expect(result).toBe(false);
      });

      it('should return false when no settings exist', async () => {
        mockGetSettings.mockResolvedValue(null);

        const result = await InventoryService.isEnabled();

        expect(result).toBe(false);
      });
    });

    describe('getDeductOnStatus', () => {
      it('should return configured deductOnStatus', async () => {
        mockGetSettings.mockResolvedValue(mockSettings);

        const result = await InventoryService.getDeductOnStatus();

        expect(result).toBe('DONE');
      });

      it('should return DONE as default', async () => {
        mockGetSettings.mockResolvedValue(null);

        const result = await InventoryService.getDeductOnStatus();

        expect(result).toBe('DONE');
      });
    });

    describe('allowsNegativeStock', () => {
      it('should return true when allowNegativeStock is 1', async () => {
        mockGetSettings.mockResolvedValue({ ...mockSettings, allowNegativeStock: 1 });

        const result = await InventoryService.allowsNegativeStock();

        expect(result).toBe(true);
      });

      it('should return false when allowNegativeStock is 0', async () => {
        mockGetSettings.mockResolvedValue(mockSettings);

        const result = await InventoryService.allowsNegativeStock();

        expect(result).toBe(false);
      });
    });
  });

  // ===========================================================================
  // BALANCES TESTS
  // ===========================================================================

  describe('Balances', () => {
    describe('getBalances', () => {
      it('should return all balances', async () => {
        mockGetBalances.mockResolvedValue([mockBalance]);

        const result = await InventoryService.getBalances();

        expect(mockGetBalances).toHaveBeenCalledWith(userId);
        expect(result).toEqual([mockBalance]);
      });
    });

    describe('getBalance', () => {
      it('should return balance for specific item', async () => {
        mockGetBalanceByItemId.mockResolvedValue(mockBalance);

        const result = await InventoryService.getBalance('item-1');

        expect(mockGetBalanceByItemId).toHaveBeenCalledWith('item-1');
        expect(result).toEqual(mockBalance);
      });
    });

    describe('searchBalances', () => {
      it('should search balances by query', async () => {
        mockSearchBalances.mockResolvedValue([mockBalance]);

        const result = await InventoryService.searchBalances('Product');

        expect(mockSearchBalances).toHaveBeenCalledWith(userId, 'Product');
        expect(result).toEqual([mockBalance]);
      });
    });

    describe('getLowStockItems', () => {
      it('should return low stock items with default threshold', async () => {
        mockGetLowStockBalances.mockResolvedValue([mockBalance]);

        const result = await InventoryService.getLowStockItems();

        expect(mockGetLowStockBalances).toHaveBeenCalledWith(userId, 5);
        expect(result).toEqual([mockBalance]);
      });

      it('should respect custom threshold', async () => {
        mockGetLowStockBalances.mockResolvedValue([]);

        await InventoryService.getLowStockItems(10);

        expect(mockGetLowStockBalances).toHaveBeenCalledWith(userId, 10);
      });
    });
  });

  // ===========================================================================
  // ADJUST STOCK TESTS
  // ===========================================================================

  describe('adjustStock', () => {
    beforeEach(() => {
      mockGetSettings.mockResolvedValue(mockSettings);
      mockGetBalanceByItemId.mockResolvedValue(mockBalance);
      mockUpdateBalanceQuantity.mockResolvedValue(undefined);
      mockInsertMovement.mockResolvedValue(undefined);
      mockAddToOutbox.mockResolvedValue(undefined);
    });

    it('should create adjustment movement when increasing stock', async () => {
      const result = await InventoryService.adjustStock({
        itemId: 'item-1',
        newQuantity: 150,
        notes: 'Restock',
      });

      expect(mockUpdateBalanceQuantity).toHaveBeenCalledWith('item-1', 150);
      expect(mockInsertMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT_IN',
          quantity: 50, // 150 - 100
          balanceAfter: 150,
        })
      );
      expect(result.type).toBe('ADJUSTMENT_IN');
      expect(result.quantity).toBe(50);
    });

    it('should create adjustment movement when decreasing stock', async () => {
      const result = await InventoryService.adjustStock({
        itemId: 'item-1',
        newQuantity: 80,
      });

      expect(mockUpdateBalanceQuantity).toHaveBeenCalledWith('item-1', 80);
      expect(mockInsertMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT_OUT',
          quantity: -20, // 80 - 100
          balanceAfter: 80,
        })
      );
      expect(result.type).toBe('ADJUSTMENT_OUT');
    });

    it('should add movement to outbox for sync', async () => {
      await InventoryService.adjustStock({
        itemId: 'item-1',
        newQuantity: 150,
      });

      expect(mockAddToOutbox).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'item-1',
          syncStatus: 'pending',
          syncAttempts: 0,
        })
      );
    });

    it('should create new balance if item has no balance yet', async () => {
      mockGetBalanceByItemId.mockResolvedValue(null);
      mockUpsertBalance.mockResolvedValue(undefined);

      const result = await InventoryService.adjustStock({
        itemId: 'new-item',
        newQuantity: 50,
      });

      expect(mockUpsertBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'new-item',
          quantity: 50,
        })
      );
      expect(result.quantity).toBe(50);
    });

    it('should throw error for negative stock when not allowed', async () => {
      mockGetSettings.mockResolvedValue({ ...mockSettings, allowNegativeStock: 0 });

      await expect(
        InventoryService.adjustStock({
          itemId: 'item-1',
          newQuantity: -10,
        })
      ).rejects.toThrow('Estoque negativo não permitido');
    });

    it('should allow negative stock when configured', async () => {
      mockGetSettings.mockResolvedValue({ ...mockSettings, allowNegativeStock: 1 });

      const result = await InventoryService.adjustStock({
        itemId: 'item-1',
        newQuantity: -10,
      });

      expect(result.balanceAfter).toBe(-10);
    });

    it('should throw error when new quantity equals current', async () => {
      await expect(
        InventoryService.adjustStock({
          itemId: 'item-1',
          newQuantity: 100, // Same as mockBalance.quantity
        })
      ).rejects.toThrow('Novo saldo igual ao atual');
    });
  });

  // ===========================================================================
  // MOVEMENTS TESTS
  // ===========================================================================

  describe('Movements', () => {
    describe('getMovements', () => {
      it('should return movements from repository', async () => {
        mockGetMovements.mockResolvedValue([mockMovement]);

        const result = await InventoryService.getMovements();

        expect(mockGetMovements).toHaveBeenCalledWith(userId, undefined);
        expect(result).toEqual([mockMovement]);
      });

      it('should pass options to repository', async () => {
        mockGetMovements.mockResolvedValue([]);
        const options = { itemId: 'item-1', limit: 10 };

        await InventoryService.getMovements(options);

        expect(mockGetMovements).toHaveBeenCalledWith(userId, options);
      });
    });

    describe('getRecentMovements', () => {
      it('should return recent movements with default limit', async () => {
        mockGetRecentMovements.mockResolvedValue([mockMovement]);

        const result = await InventoryService.getRecentMovements();

        expect(mockGetRecentMovements).toHaveBeenCalledWith(userId, 10);
        expect(result).toEqual([mockMovement]);
      });

      it('should respect custom limit', async () => {
        mockGetRecentMovements.mockResolvedValue([]);

        await InventoryService.getRecentMovements(5);

        expect(mockGetRecentMovements).toHaveBeenCalledWith(userId, 5);
      });
    });

    describe('getItemMovements', () => {
      it('should return movements for specific item', async () => {
        mockGetMovements.mockResolvedValue([mockMovement]);

        const result = await InventoryService.getItemMovements('item-1');

        expect(mockGetMovements).toHaveBeenCalledWith(userId, { itemId: 'item-1', limit: 20 });
        expect(result).toEqual([mockMovement]);
      });
    });
  });

  // ===========================================================================
  // STATISTICS TESTS
  // ===========================================================================

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return aggregated stats', async () => {
        mockCountBalances.mockResolvedValue(42);
        mockGetTotalQuantity.mockResolvedValue(1500);
        mockGetLowStockBalances.mockResolvedValue([mockBalance, mockBalance]);
        mockGetPendingOutbox.mockResolvedValue([{ id: '1' }]);

        const result = await InventoryService.getStats();

        expect(result).toEqual({
          totalProducts: 42,
          totalQuantity: 1500,
          lowStockCount: 2,
          pendingSyncCount: 1,
        });
      });
    });
  });

  // ===========================================================================
  // SYNC HELPERS TESTS
  // ===========================================================================

  describe('Sync Helpers', () => {
    describe('getPendingSync', () => {
      it('should return pending outbox items', async () => {
        const pendingItems = [{ id: '1', syncStatus: 'pending' }];
        mockGetPendingOutbox.mockResolvedValue(pendingItems);

        const result = await InventoryService.getPendingSync();

        expect(result).toEqual(pendingItems);
      });
    });
  });

  // ===========================================================================
  // HELPER METHODS TESTS
  // ===========================================================================

  describe('Helper Methods', () => {
    describe('formatQuantity', () => {
      it('should format integer quantities without decimals', () => {
        const result = InventoryService.formatQuantity(100);
        expect(result).toBe('100');
      });

      it('should format decimal quantities with 2 decimal places', () => {
        const result = InventoryService.formatQuantity(100.5);
        expect(result).toBe('100.50');
      });

      it('should append unit when provided', () => {
        const result = InventoryService.formatQuantity(100, 'un');
        expect(result).toBe('100 un');
      });
    });

    describe('getMovementTypeLabel', () => {
      it('should return correct labels', () => {
        expect(InventoryService.getMovementTypeLabel('ADJUSTMENT_IN')).toBe('Entrada Manual');
        expect(InventoryService.getMovementTypeLabel('ADJUSTMENT_OUT')).toBe('Saída Manual');
        expect(InventoryService.getMovementTypeLabel('WORK_ORDER_OUT')).toBe('Baixa por OS');
        expect(InventoryService.getMovementTypeLabel('INITIAL')).toBe('Saldo Inicial');
      });
    });

    describe('getMovementTypeColor', () => {
      it('should return green for inbound movements', () => {
        expect(InventoryService.getMovementTypeColor('ADJUSTMENT_IN')).toBe('#22c55e');
        expect(InventoryService.getMovementTypeColor('INITIAL')).toBe('#22c55e');
      });

      it('should return red for outbound movements', () => {
        expect(InventoryService.getMovementTypeColor('ADJUSTMENT_OUT')).toBe('#ef4444');
        expect(InventoryService.getMovementTypeColor('WORK_ORDER_OUT')).toBe('#ef4444');
      });
    });

    describe('isInboundMovement', () => {
      it('should return true for inbound types', () => {
        expect(InventoryService.isInboundMovement('ADJUSTMENT_IN')).toBe(true);
        expect(InventoryService.isInboundMovement('INITIAL')).toBe(true);
      });

      it('should return false for outbound types', () => {
        expect(InventoryService.isInboundMovement('ADJUSTMENT_OUT')).toBe(false);
        expect(InventoryService.isInboundMovement('WORK_ORDER_OUT')).toBe(false);
      });
    });
  });
});
