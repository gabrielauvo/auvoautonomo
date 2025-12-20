/**
 * Shared Types - Tipos compartilhados entre frontend, backend e mobile
 *
 * IMPORTANTE: Use string para datas em vez de Date para evitar problemas de serialização JSON
 */

// =============================================================================
// DATE TYPES - Use strings ISO 8601 para datas serializáveis
// =============================================================================

/** Data em formato ISO 8601 string (ex: "2024-01-15T10:30:00.000Z") */
export type ISODateString = string;

// =============================================================================
// USER TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: UserRole;
  avatarUrl?: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type UserRole = 'admin' | 'user' | 'technician' | 'guest';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Resposta padrão da API */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  /** Código de erro para tratamento no frontend */
  errorCode?: string;
  /** Lista de erros de validação por campo */
  errors?: Record<string, string[]>;
}

/** Resposta paginada da API */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  /** Total de páginas calculado */
  totalPages: number;
  /** Indica se há próxima página */
  hasNextPage: boolean;
  /** Indica se há página anterior */
  hasPreviousPage: boolean;
}

/** Parâmetros padrão de paginação */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/** Códigos de erro padronizados */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'LIMIT_REACHED'
  | 'FEATURE_NOT_AVAILABLE'
  | 'PAYMENT_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/** Erro estruturado da API */
export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  /** Stack trace apenas em desenvolvimento */
  stack?: string;
}

// =============================================================================
// BILLING TYPES
// =============================================================================

export type PlanType = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'TRIAL';
export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';

export interface Plan {
  id: string;
  type: PlanType;
  name: string;
  description?: string;
  price: number;
  features: string[];
}

// =============================================================================
// RESOURCE TYPES - Para limites de plano
// =============================================================================

export type LimitedResource = 'CLIENT' | 'QUOTE' | 'WORK_ORDER' | 'PAYMENT' | 'NOTIFICATION';
export type FeatureFlag =
  | 'ADVANCED_AUTOMATIONS'
  | 'ADVANCED_ANALYTICS'
  | 'CLIENT_PORTAL'
  | 'PDF_EXPORT'
  | 'DIGITAL_SIGNATURE'
  | 'WHATSAPP';

// =============================================================================
// AUDIT TYPES - Para rastreabilidade
// =============================================================================

export interface AuditInfo {
  createdAt: ISODateString;
  createdBy?: string;
  updatedAt: ISODateString;
  updatedBy?: string;
  deletedAt?: ISODateString | null;
  deletedBy?: string | null;
}

// =============================================================================
// TYPE GUARDS - Para validação em runtime
// =============================================================================

export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as User).id === 'string' &&
    typeof (obj as User).email === 'string'
  );
}

export function isApiResponse<T>(obj: unknown): obj is ApiResponse<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as ApiResponse<T>).success === 'boolean'
  );
}

export function isApiError(obj: unknown): obj is ApiError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as ApiError).code === 'string' &&
    typeof (obj as ApiError).message === 'string'
  );
}
