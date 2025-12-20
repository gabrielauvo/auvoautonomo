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

export { billingService, getBillingStatus, getQuota, checkLimit } from './billing.service';
export type {
  UsageLimits,
  CurrentUsage,
  BillingStatus,
  QuotaInfo,
  AllQuotas,
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
