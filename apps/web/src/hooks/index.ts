/**
 * Hooks - Re-export de todos os hooks customizados
 */

export { useDebounce, useDebouncedCallback, useDebouncedValue } from './use-debounce';

export { useCSRFToken, addCSRFHeader, addCSRFToFormData } from './use-csrf-token';

export { useAnalyticsOverview, useRevenueByPeriod, useQuoteConversion } from './use-analytics';

export {
  useClients,
  useSearchClients,
  useClient,
  useClientTimeline,
  useClientSummary,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
} from './use-clients';

export {
  // Quotes
  useQuotes,
  useQuote,
  useCreateQuote,
  useUpdateQuote,
  useDeleteQuote,
  useUpdateQuoteStatus,
  // Quote items
  useAddQuoteItem,
  useUpdateQuoteItem,
  useRemoveQuoteItem,
  // Catalog
  useCatalogItems,
  useCatalogCategories,
  // PDF & WhatsApp
  useGenerateQuotePdf,
  useDownloadQuotePdf,
  useSendWhatsApp,
  useQuoteAttachments,
} from './use-quotes';
