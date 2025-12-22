/**
 * PowerSync Module
 *
 * Exports all PowerSync-related functionality.
 *
 * NOTE: This module supports both Expo Go (mock mode) and production builds.
 * In Expo Go, native modules are not available and the provider uses a mock database.
 */

// Provider and Context (safe for Expo Go - uses dynamic imports internally)
export {
  PowerSyncProvider,
  usePowerSync,
  usePowerSyncDatabase,
  useSyncStatus,
  useIsMockMode,
} from './PowerSyncProvider';

// Hooks (safe for Expo Go - gracefully handles mock db)
export {
  useQuery,
  useQueryFirst,
  useMutation,
  useEntity,
  usePowerSyncWatchedQuery,
} from './hooks';

// =============================================================================
// LAZY EXPORTS (only import in production builds, not in Expo Go)
// =============================================================================
// These exports require native modules and will fail in Expo Go.
// Use dynamic imports in your code if needed:
//
// const { AppSchema } = await import('../powersync/schema');
// const { AuvoBackendConnector } = await import('../powersync/BackendConnector');
// const { MigrationService } = await import('../powersync/MigrationService');
// =============================================================================

// Re-export types (types are safe - no runtime code)
export type {
  Database,
  ClientRecord,
  WorkOrderRecord,
  QuoteRecord,
  QuoteItemRecord,
  InvoiceRecord,
  ChecklistTemplateRecord,
  ChecklistInstanceRecord,
  ChecklistAnswerRecord,
  ChecklistAttachmentRecord,
  ProductCategoryRecord,
  CatalogItemRecord,
  BundleItemRecord,
  SignatureRecord,
  ExecutionSessionRecord,
} from './schema';
