/**
 * Growth Service
 *
 * Serviço para consultar métricas de crescimento do Google Meu Negócio.
 * Fornece dados para o dashboard de crescimento mobile.
 */

import { AuthService } from './AuthService';
import { getApiBaseUrl } from '../config/api';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

// =============================================================================
// TYPES - Google Integration
// =============================================================================

export type GoogleIntegrationStatus =
  | 'PENDING'
  | 'CONNECTED'
  | 'ERROR'
  | 'DISCONNECTED'
  | 'REVOKED';

export interface GoogleIntegrationStatusResponse {
  status: GoogleIntegrationStatus;
  googleLocationName?: string;
  lastSyncAt?: string;
  lastSyncError?: string;
  isConnected: boolean;
}

// =============================================================================
// TYPES - Dashboard
// =============================================================================

export interface KpiCard {
  label: string;
  value: number;
  previousValue?: number;
  change: number | null;
  trend: 'up' | 'down' | 'neutral';
  unit?: string;
}

export interface DashboardSummary {
  totalActions: KpiCard;
  calls: KpiCard;
  routes: KpiCard;
  websiteClicks: KpiCard;
  whatsappClicks: KpiCard;
  profileViews: KpiCard;
  impressions: KpiCard;
  periodStart: string;
  periodEnd: string;
}

export interface TimeSeriesPoint {
  date: string;
  calls: number;
  routes: number;
  websiteClicks: number;
  whatsappClicks: number;
  profileViews: number;
  impressions: number;
  totalActions: number;
}

export interface TimeSeries {
  data: TimeSeriesPoint[];
  periodStart: string;
  periodEnd: string;
}

export interface ChannelBreakdown {
  channel: string;
  icon: string;
  clicks: number;
  percentage: number;
  color: string;
}

export interface ConversionFunnelStage {
  stage: string;
  value: number;
  percentage: number;
  dropoff: number;
}

export interface ConversionFunnel {
  stages: ConversionFunnelStage[];
  overallConversionRate: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  timeSeries: TimeSeries;
  channelBreakdown: ChannelBreakdown[];
  conversionFunnel: ConversionFunnel;
  lastSyncAt: string | null;
  isGoogleConnected: boolean;
}

export type DashboardPeriod = '7d' | '30d' | '90d' | 'custom';

export interface DashboardQueryParams {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
}

// =============================================================================
// TYPES - Insights
// =============================================================================

export type GrowthInsightType =
  | 'CONVERSION_DROP'
  | 'ACTION_SPIKE'
  | 'LOW_CONVERSION_RATE'
  | 'CHANNEL_COMPARISON'
  | 'WEEKLY_SUMMARY'
  | 'GOAL_ACHIEVED';

export type GrowthInsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface GrowthInsight {
  id: string;
  type: GrowthInsightType;
  severity: GrowthInsightSeverity;
  title: string;
  description: string;
  recommendations: string[];
  metrics?: Record<string, number>;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export const GrowthService = {
  /**
   * Check if Google Business is configured on the server
   */
  async isGoogleConfigured(): Promise<boolean> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return false;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/google-business/configured`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
        retries: 2,
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.configured === true;
    } catch (error) {
      console.error('[GrowthService] Error checking Google configuration:', error);
      return false;
    }
  },

  /**
   * Get Google integration status
   */
  async getGoogleStatus(): Promise<GoogleIntegrationStatusResponse | null> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return null;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/google-business/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
        retries: 2,
      });

      if (!response.ok) {
        console.error('[GrowthService] Failed to get Google status:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[GrowthService] Error getting Google status:', error);
      return null;
    }
  },

  /**
   * Get dashboard data (full)
   */
  async getDashboardData(params?: DashboardQueryParams): Promise<DashboardData | null> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return null;
    }

    try {
      const queryParams = new URLSearchParams();
      if (params?.period) queryParams.append('period', params.period);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const url = `${baseUrl}/growth-dashboard${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 15000, // Longer timeout for dashboard
        retries: 2,
      });

      if (!response.ok) {
        console.error('[GrowthService] Failed to get dashboard data:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[GrowthService] Error getting dashboard data:', error);
      return null;
    }
  },

  /**
   * Get dashboard summary only (lighter, for mobile quick view)
   */
  async getDashboardSummary(params?: DashboardQueryParams): Promise<DashboardSummary | null> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return null;
    }

    try {
      const queryParams = new URLSearchParams();
      if (params?.period) queryParams.append('period', params.period);
      if (params?.startDate) queryParams.append('startDate', params.startDate);
      if (params?.endDate) queryParams.append('endDate', params.endDate);

      const url = `${baseUrl}/growth-dashboard/summary${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
        retries: 2,
      });

      if (!response.ok) {
        console.error('[GrowthService] Failed to get dashboard summary:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[GrowthService] Error getting dashboard summary:', error);
      return null;
    }
  },

  /**
   * Get growth insights
   */
  async getInsights(): Promise<GrowthInsight[]> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return [];
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/growth-dashboard/insights`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
        retries: 2,
      });

      if (!response.ok) {
        console.error('[GrowthService] Failed to get insights:', response.status);
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('[GrowthService] Error getting insights:', error);
      return [];
    }
  },

  /**
   * Mark insight as read
   */
  async markInsightRead(id: string): Promise<boolean> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return false;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/growth-dashboard/insights/${id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      });

      return response.ok;
    } catch (error) {
      console.error('[GrowthService] Error marking insight as read:', error);
      return false;
    }
  },

  /**
   * Dismiss insight
   */
  async dismissInsight(id: string): Promise<boolean> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return false;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/growth-dashboard/insights/${id}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      });

      return response.ok;
    } catch (error) {
      console.error('[GrowthService] Error dismissing insight:', error);
      return false;
    }
  },

  /**
   * Trigger manual sync of metrics
   */
  async triggerSync(): Promise<boolean> {
    const token = await AuthService.getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (!token) {
      return false;
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/growth-dashboard/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 30000, // Longer timeout for sync
      });

      return response.ok;
    } catch (error) {
      console.error('[GrowthService] Error triggering sync:', error);
      return false;
    }
  },

  /**
   * Check if user is connected to Google Business
   */
  async isGoogleConnected(): Promise<boolean> {
    const status = await this.getGoogleStatus();
    return status?.status === 'CONNECTED';
  },
};

export default GrowthService;
