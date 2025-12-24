/**
 * Google Business Growth Service
 *
 * Gerencia:
 * - Integração OAuth com Google Business Profile
 * - Links de atribuição (tracking WhatsApp/Site)
 * - Dashboard de crescimento com métricas
 * - Insights automatizados
 */

import api, { getErrorMessage } from './api';

// ============================================================================
// TYPES - Google OAuth
// ============================================================================

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

export interface GoogleLocation {
  locationId: string;
  name: string;
  address?: string;
  phoneNumber?: string;
}

export interface OAuthUrlResponse {
  url: string;
  state: string;
}

// ============================================================================
// TYPES - Attribution Links
// ============================================================================

export type AttributionLinkType = 'WHATSAPP' | 'WEBSITE';

export interface AttributionLink {
  id: string;
  slug: string;
  type: AttributionLinkType;
  targetUrl: string;
  clickCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  trackingUrl: string;
}

export interface CreateAttributionLinkDto {
  type: AttributionLinkType;
  targetUrl: string;
  customSlug?: string;
}

export interface UpdateAttributionLinkDto {
  targetUrl?: string;
  isActive?: boolean;
}

export interface AttributionLinkStats {
  totalClicks: number;
  clicksToday: number;
  clicksThisWeek: number;
  clicksThisMonth: number;
  dailyClicks: Array<{ date: string; count: number }>;
}

// ============================================================================
// TYPES - Dashboard
// ============================================================================

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

// ============================================================================
// TYPES - Insights
// ============================================================================

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

// ============================================================================
// API Functions - Google OAuth
// ============================================================================

/**
 * Check if Google Business OAuth is configured on the server
 */
export async function isGoogleBusinessConfigured(): Promise<boolean> {
  try {
    const response = await api.get<{ configured: boolean }>('/google-business/configured');
    return response.data.configured;
  } catch (error) {
    console.error('Failed to check Google Business configuration:', error);
    return false;
  }
}

/**
 * Get current Google integration status
 */
export async function getGoogleIntegrationStatus(): Promise<GoogleIntegrationStatusResponse> {
  try {
    const response = await api.get<GoogleIntegrationStatusResponse>('/google-business/status');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get OAuth URL to initiate Google Business connection
 */
export async function getGoogleOAuthUrl(redirectUrl?: string): Promise<OAuthUrlResponse> {
  try {
    const params = redirectUrl ? { redirectUrl } : {};
    const response = await api.get<OAuthUrlResponse>('/google-business/oauth/url', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get available Google Business locations
 */
export async function getGoogleLocations(): Promise<GoogleLocation[]> {
  try {
    const response = await api.get<{ locations: GoogleLocation[] }>('/google-business/locations');
    return response.data.locations;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Select a Google Business location to track
 */
export async function selectGoogleLocation(locationId: string): Promise<void> {
  try {
    await api.post('/google-business/locations/select', { locationId });
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Disconnect Google Business integration
 */
export async function disconnectGoogle(): Promise<void> {
  try {
    await api.delete('/google-business/disconnect');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================================================
// API Functions - Attribution Links
// ============================================================================

/**
 * Get all attribution links
 */
export async function getAttributionLinks(): Promise<AttributionLink[]> {
  try {
    const response = await api.get<AttributionLink[]>('/attribution-links');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get a single attribution link by ID
 */
export async function getAttributionLink(id: string): Promise<AttributionLink> {
  try {
    const response = await api.get<AttributionLink>(`/attribution-links/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Create a new attribution link
 */
export async function createAttributionLink(data: CreateAttributionLinkDto): Promise<AttributionLink> {
  try {
    const response = await api.post<AttributionLink>('/attribution-links', data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Update an attribution link
 */
export async function updateAttributionLink(
  id: string,
  data: UpdateAttributionLinkDto,
): Promise<AttributionLink> {
  try {
    const response = await api.put<AttributionLink>(`/attribution-links/${id}`, data);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Delete an attribution link
 */
export async function deleteAttributionLink(id: string): Promise<void> {
  try {
    await api.delete(`/attribution-links/${id}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get statistics for an attribution link
 */
export async function getAttributionLinkStats(id: string): Promise<AttributionLinkStats> {
  try {
    const response = await api.get<AttributionLinkStats>(`/attribution-links/${id}/stats`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================================================
// API Functions - Dashboard
// ============================================================================

/**
 * Get complete dashboard data
 */
export async function getDashboardData(params?: DashboardQueryParams): Promise<DashboardData> {
  try {
    const response = await api.get<DashboardData>('/growth-dashboard', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Get dashboard summary only (for mobile/quick view)
 */
export async function getDashboardSummary(params?: DashboardQueryParams): Promise<DashboardSummary> {
  try {
    const response = await api.get<DashboardSummary>('/growth-dashboard/summary', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Trigger manual sync of Google Business metrics
 */
export async function triggerMetricsSync(): Promise<void> {
  try {
    await api.post('/growth-dashboard/sync');
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================================================
// API Functions - Insights
// ============================================================================

/**
 * Get active growth insights
 */
export async function getGrowthInsights(): Promise<GrowthInsight[]> {
  try {
    const response = await api.get<GrowthInsight[]>('/growth-dashboard/insights');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Mark an insight as read
 */
export async function markInsightAsRead(id: string): Promise<void> {
  try {
    await api.post(`/growth-dashboard/insights/${id}/read`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(id: string): Promise<void> {
  try {
    await api.post(`/growth-dashboard/insights/${id}/dismiss`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// ============================================================================
// Service Export
// ============================================================================

export const googleBusinessService = {
  // OAuth
  isConfigured: isGoogleBusinessConfigured,
  getStatus: getGoogleIntegrationStatus,
  getOAuthUrl: getGoogleOAuthUrl,
  getLocations: getGoogleLocations,
  selectLocation: selectGoogleLocation,
  disconnect: disconnectGoogle,

  // Attribution Links
  getLinks: getAttributionLinks,
  getLink: getAttributionLink,
  createLink: createAttributionLink,
  updateLink: updateAttributionLink,
  deleteLink: deleteAttributionLink,
  getLinkStats: getAttributionLinkStats,

  // Dashboard
  getDashboard: getDashboardData,
  getSummary: getDashboardSummary,
  triggerSync: triggerMetricsSync,

  // Insights
  getInsights: getGrowthInsights,
  markInsightRead: markInsightAsRead,
  dismissInsight: dismissInsight,
};
