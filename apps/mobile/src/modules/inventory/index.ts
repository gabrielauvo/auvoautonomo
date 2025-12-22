// Inventory Module exports

// Services
export { InventoryService } from './InventoryService';
export { InventoryRepository } from './InventoryRepository';
export { inventorySyncService, InventorySyncService } from './InventorySyncConfig';

// Types
export type {
  InventorySettings,
  InventoryBalance,
  InventoryMovement,
  InventoryMovementOutbox,
} from './InventoryRepository';

export type {
  AdjustStockInput,
  InventoryStats,
} from './InventoryService';

// Sync Configs
export {
  InventorySettingsSyncConfig,
  InventoryBalancesSyncConfig,
  InventoryMovementsSyncConfig,
} from './InventorySyncConfig';

// Screens
export { InventoryListScreen } from './InventoryListScreen';
export { InventoryMovementsScreen } from './InventoryMovementsScreen';

// Components
export * from './components';
