/**
 * Billing Service
 *
 * Serviço para consultar informações de billing/plano do usuário.
 *
 * Modelo de Planos:
 * - TRIAL: 14 dias grátis com tudo liberado
 * - PRO: R$ 99,90/mês ou R$ 89,90/mês (anual)
 */

import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Duração do trial em dias */
export const TRIAL_DURATION_DAYS = 14;

/** Preços do plano PRO */
export const PRO_PLAN_PRICING = {
  MONTHLY: 99.90,
  YEARLY: 89.90, // por mês
  YEARLY_TOTAL: 1078.80, // total anual
  YEARLY_SAVINGS: 119.00, // economia vs mensal
};

// =============================================================================
// TYPES
// =============================================================================

export type BillingPeriod = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'EXPIRED';

export interface BillingStatus {
  /** Tipo do plano: TRIAL (14 dias grátis) ou PRO (pago) */
  planKey: 'TRIAL' | 'PRO';
  planName: string;
  /** Status da assinatura */
  subscriptionStatus: SubscriptionStatus;
  /** Período de cobrança (mensal ou anual) */
  billingPeriod?: BillingPeriod;
  /** Data de início do período atual */
  currentPeriodStart?: string | null;
  /** Data de fim do período atual */
  currentPeriodEnd?: string | null;
  /** Data de fim do trial (apenas para TRIALING) */
  trialEndAt?: string | null;
  /** Dias restantes do trial */
  trialDaysRemaining?: number;
  /** Se vai cancelar no fim do período */
  cancelAtPeriodEnd?: boolean;
  /** Data de criação da conta */
  createdAt?: string;
}

// Legacy types for backwards compatibility
export type LimitedResource = 'CLIENT' | 'QUOTE' | 'WORK_ORDER' | 'PAYMENT' | 'NOTIFICATION';

export interface QuotaInfo {
  remaining: number;
  max: number;
  current: number;
  unlimited: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calcula dias restantes do trial
 */
export function calculateTrialDaysRemaining(trialEndAt: string | null | undefined): number {
  if (!trialEndAt) return 0;
  const now = new Date();
  const endDate = new Date(trialEndAt);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Verifica se o trial expirou
 */
export function isTrialExpired(trialEndAt: string | null | undefined): boolean {
  if (!trialEndAt) return false;
  return new Date(trialEndAt) < new Date();
}

// =============================================================================
// SERVICE
// =============================================================================

export const BillingService = {
  /**
   * Get billing status (plan info and trial status)
   */
  async getBillingStatus(): Promise<BillingStatus | null> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/billing/plan`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
        retries: 2,
      });

      if (!response.ok) {
        console.error('[BillingService] Failed to get billing status:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[BillingService] Error getting billing status:', error);
      return null;
    }
  },

  /**
   * Get remaining quota for a specific resource
   */
  async getQuota(resource: LimitedResource): Promise<QuotaInfo> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      // Return unlimited if not authenticated (shouldn't happen)
      return { remaining: -1, max: -1, current: 0, unlimited: true };
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/billing/quota?resource=${resource}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000, // 10s timeout para billing
        retries: 2, // Retry em caso de falha
      });

      if (!response.ok) {
        console.error('[BillingService] Failed to get quota:', response.status);
        // Return unlimited on error to not block the user
        return { remaining: -1, max: -1, current: 0, unlimited: true };
      }

      return await response.json();
    } catch (error) {
      console.error('[BillingService] Error getting quota:', error);
      // Return unlimited on error to not block the user
      return { remaining: -1, max: -1, current: 0, unlimited: true };
    }
  },

  /**
   * Check if user is on trial
   */
  async isOnTrial(): Promise<boolean> {
    const status = await this.getBillingStatus();
    return status?.subscriptionStatus === 'TRIALING';
  },

  /**
   * Get client quota specifically
   */
  async getClientQuota(): Promise<QuotaInfo> {
    return this.getQuota('CLIENT');
  },

  // Constants
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
  calculateTrialDaysRemaining,
  isTrialExpired,
};

export default BillingService;
