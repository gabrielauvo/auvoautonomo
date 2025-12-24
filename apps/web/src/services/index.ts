/**
 * Services - Re-export de todos os serviços
 */

export { api, getErrorMessage, isNetworkError, AUTH_TOKEN_KEY } from './api';
export type { default as ApiClient } from './api';

export {
  authService,
  login,
  logout,
  register,
  getProfile,
  hasToken,
  getToken,
  clearToken,
} from './auth.service';
export type { User, LoginCredentials, LoginResponse, RegisterData } from './auth.service';

export {
  billingService,
  getBillingStatus,
  calculateTrialDaysRemaining,
  isTrialExpired,
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
} from './billing.service';
export type {
  BillingStatus,
  BillingPeriod,
  CheckoutPixDto,
  CheckoutCreditCardDto,
  PixCheckoutResult,
  CreditCardCheckoutResult,
  PixStatusResult,
} from './billing.service';

export { analyticsService, getOverview, getRevenueByPeriod, getQuoteConversion } from './analytics.service';
export type { AnalyticsOverview, RevenueByPeriod, QuoteConversion } from './analytics.service';

export {
  clientsService,
  listClients,
  searchClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientTimeline,
  getClientSummary,
} from './clients.service';
export type {
  Client,
  CreateClientDto,
  UpdateClientDto,
  ClientListResponse,
  ClientSearchParams,
  TimelineEvent,
  TimelineEventType,
  ClientSummary,
} from './clients.service';

export {
  quotesService,
  listQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  updateQuoteStatus,
  addQuoteItem,
  updateQuoteItem,
  removeQuoteItem,
  listCatalogItems,
  listCatalogCategories,
  generateQuotePdf,
  downloadQuotePdf,
  createPublicLink,
  getQuoteAttachments,
  canEditQuote,
  canSendQuote,
  canApproveRejectQuote,
  canConvertToWorkOrder,
  generateWhatsAppMessage,
  openWhatsApp,
} from './quotes.service';
export type {
  Quote,
  QuoteItem,
  QuoteStatus,
  QuoteItemType,
  QuoteSearchParams,
  CreateQuoteDto,
  CreateQuoteItemDto,
  AddQuoteItemDto,
  UpdateQuoteDto,
  UpdateQuoteItemDto,
  CatalogItem,
  CatalogCategory,
  GeneratePdfResponse,
  PublicLinkResponse,
} from './quotes.service';

// Suppliers (Fornecedores)
export {
  suppliersService,
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from './suppliers.service';
export type {
  Supplier,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierListResponse,
  SupplierSearchParams,
} from './suppliers.service';

// Expense Categories (Categorias de Despesas)
export {
  expenseCategoriesService,
  listExpenseCategories,
  getExpenseCategoryById,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from './expense-categories.service';
export type {
  ExpenseCategory,
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './expense-categories.service';

// Expenses (Despesas/Contas a Pagar)
export {
  expensesService,
  listExpenses,
  getExpenseSummary,
  getExpenseById,
  createExpense,
  updateExpense,
  markExpenseAsPaid,
  deleteExpense,
  getStatusLabel,
  getStatusColor,
  getPaymentMethodLabel,
} from './expenses.service';
export type {
  Expense,
  ExpenseStatus,
  ExpensePaymentMethod,
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilters,
  ExpenseListResponse,
  ExpenseSummary,
  MarkAsPaidDto,
} from './expenses.service';

// Inventory (Estoque)
export {
  getInventorySettings,
  updateInventorySettings,
  getInventoryBalances,
  getInventoryBalance,
  updateInventoryBalance,
  createInventoryMovement,
  getInventoryMovements,
  getInventoryDashboard,
} from './inventory.service';
export type {
  InventorySettings,
  UpdateInventorySettingsDto,
  InventoryBalance,
  InventoryBalanceList,
  UpdateBalanceDto,
  InventoryMovement,
  CreateMovementDto,
  MovementListQuery,
  MovementListResponse,
  InventoryDashboard,
} from './inventory.service';
