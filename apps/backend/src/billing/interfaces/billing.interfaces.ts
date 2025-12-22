import { PlanType, SubscriptionStatus } from '@prisma/client';

/**
 * Usage limits configuration for a plan
 */
export interface UsageLimits {
  maxClients: number; // -1 = unlimited
  maxQuotes: number;
  maxWorkOrders: number;
  maxPayments: number;
  maxNotificationsPerMonth: number;
  maxSuppliers: number;
  maxExpenses: number;
  enableAdvancedAutomations: boolean;
  enableAdvancedAnalytics: boolean;
  enableClientPortal: boolean;
  enablePdfExport: boolean;
  enableDigitalSignature: boolean;
  enableWhatsApp: boolean;
  enableExpenseManagement: boolean;
  enableWorkOrderTypes: boolean;
  enableAcceptanceTerms: boolean;
  enableInventory: boolean;
}

/**
 * Current usage counts for a user
 */
export interface CurrentUsage {
  clientsCount: number;
  quotesCount: number;
  workOrdersCount: number;
  paymentsCount: number;
  notificationsSentThisMonth: number;
}

/**
 * Effective plan information for a user
 */
export interface EffectivePlan {
  planKey: PlanType;
  planName: string;
  planId: string;
  limits: UsageLimits;
  subscriptionStatus: 'FREE' | SubscriptionStatus;
  currentPeriodEnd?: Date | null;
  trialEndAt?: Date | null;
}

/**
 * Full billing status response
 */
export interface BillingStatusResponse {
  planKey: PlanType;
  planName: string;
  subscriptionStatus: 'FREE' | SubscriptionStatus;
  limits: UsageLimits;
  usage: CurrentUsage;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndAt?: string | null;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Limit check result
 */
export interface LimitCheckResult {
  allowed: boolean;
  resource: LimitedResource;
  plan: PlanType;
  max: number;
  current: number;
  message?: string;
}

/**
 * Resources that can be limited
 */
export type LimitedResource =
  | 'CLIENT'
  | 'QUOTE'
  | 'WORK_ORDER'
  | 'PAYMENT'
  | 'NOTIFICATION'
  | 'SUPPLIER'
  | 'EXPENSE';

/**
 * Feature flags that can be checked
 */
export type FeatureFlag =
  | 'ADVANCED_AUTOMATIONS'
  | 'ADVANCED_ANALYTICS'
  | 'CLIENT_PORTAL'
  | 'PDF_EXPORT'
  | 'DIGITAL_SIGNATURE'
  | 'WHATSAPP'
  | 'EXPENSE_MANAGEMENT'
  | 'WORK_ORDER_TYPES'
  | 'ACCEPTANCE_TERMS'
  | 'INVENTORY';

/**
 * Limit reached error details
 */
export interface LimitReachedError {
  error: 'LIMIT_REACHED';
  resource: LimitedResource;
  plan: PlanType;
  max: number;
  current: number;
  message: string;
}

/**
 * Feature not available error details
 */
export interface FeatureNotAvailableError {
  error: 'FEATURE_NOT_AVAILABLE';
  feature: FeatureFlag;
  plan: PlanType;
  message: string;
}

/**
 * Asaas customer creation data
 */
export interface CreateAsaasCustomerDto {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
}

/**
 * Asaas subscription creation data
 */
export interface CreateAsaasSubscriptionDto {
  customer: string; // Asaas customer ID
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
  cycle: 'MONTHLY' | 'YEARLY';
  maxPayments?: number;
}

/**
 * Asaas customer response
 */
export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
}

/**
 * Asaas subscription response
 */
export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  status: string;
  nextDueDate: string;
  cycle: string;
}

/**
 * Upgrade request DTO
 */
export interface UpgradeRequestDto {
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX';
  billingPeriod: 'MONTHLY' | 'YEARLY';
  cpfCnpj: string;
  phone?: string;
  address?: string;
  postalCode?: string;
}

/**
 * Upgrade response
 */
export interface UpgradeResponse {
  subscriptionId: string;
  status: SubscriptionStatus;
  asaasSubscriptionId?: string;
  paymentUrl?: string;
  boletoUrl?: string;
  pixCode?: string;
  nextDueDate: string;
}
