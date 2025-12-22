/**
 * Work Orders Module
 *
 * Exports all work order related components and services.
 */

// Repository
export { WorkOrderRepository, workOrderRepository } from './WorkOrderRepository';
export type { WorkOrderFilter, PaginationOptions, WorkOrderListResult, DateRangeResult } from './WorkOrderRepository';

// Service
export { workOrderService } from './WorkOrderService';
export type { CreateWorkOrderInput, UpdateWorkOrderInput, WorkOrderServiceError } from './WorkOrderService';

// Sync Config
export { default as WorkOrderSyncConfig } from './WorkOrderSyncConfig';
export {
  VALID_STATUS_TRANSITIONS,
  isValidStatusTransition,
  getAllowedNextStatuses,
  canEditWorkOrder,
  canDeleteWorkOrder,
} from './WorkOrderSyncConfig';

// Work Order Types Sync Config
export { default as WorkOrderTypeSyncConfig } from './WorkOrderTypeSyncConfig';
export {
  getActiveWorkOrderTypes,
  getWorkOrderTypeById,
  getAllWorkOrderTypes,
} from './WorkOrderTypeSyncConfig';

// Signature
export { SignatureRepository } from './repositories/SignatureRepository';
export { WorkOrderSignatureService } from './services/WorkOrderSignatureService';
export { SignatureSection } from './components/SignatureSection';

// Screens
export { WorkOrdersListScreen } from './WorkOrdersListScreen';
export { WorkOrderDetailScreen } from './WorkOrderDetailScreen';
