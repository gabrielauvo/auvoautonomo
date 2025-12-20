/**
 * Quotes Module Index
 *
 * Exporta todos os componentes e hooks do módulo de orçamentos.
 */

// Repository
export { QuoteRepository } from './QuoteRepository';

// Sync Config
export { QuoteSyncConfig, type SyncQuote, type SyncQuoteItem } from './QuoteSyncConfig';

// Service
export {
  QuoteService,
  type CreateQuoteInput,
  type CreateQuoteItemInput,
  type UpdateQuoteInput,
  type QuoteWithItems,
} from './QuoteService';

// Signature Service
export {
  QuoteSignatureService,
  type QuoteSignature,
  type CreateQuoteSignatureInput,
} from './QuoteSignatureService';

// Screens
export { QuotesListScreen } from './QuotesListScreen';
export { QuoteDetailScreen } from './QuoteDetailScreen';
export { QuoteFormScreen } from './QuoteFormScreen';
export { QuoteSignatureScreen } from './QuoteSignatureScreen';
