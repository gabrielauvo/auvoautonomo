/**
 * Invoices Module Index
 *
 * Exporta todos os componentes e hooks do módulo de faturas.
 */

// Repository
export { InvoiceRepository } from './InvoiceRepository';

// Sync Config
export { InvoiceSyncConfig, type SyncInvoice } from './InvoiceSyncConfig';

// Service
export {
  InvoiceService,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type InvoiceSearchResult,
  type FinancialSummary,
} from './InvoiceService';

// Screens
export { InvoicesListScreen } from './InvoicesListScreen';
export { InvoiceDetailScreen } from './InvoiceDetailScreen';
export { InvoiceFormScreen } from './InvoiceFormScreen';
