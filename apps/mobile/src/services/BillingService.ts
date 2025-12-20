/**
 * Billing Service
 *
 * Serviço para consultar informações de billing/plano do usuário.
 */

import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// TYPES
// =============================================================================

export type LimitedResource = 'CLIENT' | 'QUOTE' | 'WORK_ORDER' | 'PAYMENT' | 'NOTIFICATION';

export interface QuotaInfo {
  remaining: number;
  max: number;
  current: number;
  unlimited: boolean;
}

export interface PlanLimits {
  maxClients: number;
  maxQuotes: number;
  maxWorkOrders: number;
  maxInvoices: number;
}

export interface PlanInfo {
  type: 'FREE' | 'PRO';
  name: string;
  price: number;
  limits: PlanLimits;
}

export interface SubscriptionInfo {
  plan: PlanInfo;
  usage: {
    clients: number;
    quotes: number;
    workOrders: number;
    payments: number;
  };
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

// =============================================================================
// SERVICE
// =============================================================================

export const BillingService = {
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
   * Get subscription info
   */
  async getSubscription(): Promise<SubscriptionInfo | null> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/billing/subscription`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000, // 10s timeout
        retries: 2,
      });

      if (!response.ok) {
        console.error('[BillingService] Failed to get subscription:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[BillingService] Error getting subscription:', error);
      return null;
    }
  },

  /**
   * Check if user is on FREE plan
   */
  async isFreePlan(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription?.plan?.type === 'FREE' || !subscription;
  },

  /**
   * Get client quota specifically
   */
  async getClientQuota(): Promise<QuotaInfo> {
    return this.getQuota('CLIENT');
  },
};

export default BillingService;
