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

export {
  useSuppliers,
  useSupplier,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from './use-suppliers';

export {
  useExpenseCategories,
  useExpenseCategory,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from './use-expense-categories';

export {
  useExpenses,
  useExpense,
  useExpenseSummary,
  useCreateExpense,
  useUpdateExpense,
  useMarkExpenseAsPaid,
  useDeleteExpense,
} from './use-expenses';

// AI Copilot
export { useAiChat, type UseAiChatOptions, type UseAiChatReturn } from './use-ai-chat';
export { useAiContext, type UseAiContextOptions, type UseAiContextReturn } from './use-ai-context';
