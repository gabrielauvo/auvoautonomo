import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsService, ConnectAsaasDto } from '@/services/integrations.service';
import { googleBusinessService, DashboardQueryParams } from '@/services/google-business.service';

export const INTEGRATIONS_QUERY_KEY = 'integrations';
export const ASAAS_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'asaas', 'status'];
export const GOOGLE_BUSINESS_STATUS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'google-business', 'status'];
export const GOOGLE_BUSINESS_LOCATIONS_QUERY_KEY = [INTEGRATIONS_QUERY_KEY, 'google-business', 'locations'];

export function useAsaasStatus() {
  return useQuery({
    queryKey: ASAAS_STATUS_QUERY_KEY,
    queryFn: () => integrationsService.getAsaasStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useConnectAsaas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: ConnectAsaasDto) => integrationsService.connectAsaas(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASAAS_STATUS_QUERY_KEY });
    },
  });
}

export function useDisconnectAsaas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsService.disconnectAsaas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASAAS_STATUS_QUERY_KEY });
    },
  });
}

// ============================================================================
// Google Business Integration Hooks
// ============================================================================

export function useGoogleBusinessConfigured() {
  return useQuery({
    queryKey: [INTEGRATIONS_QUERY_KEY, 'google-business', 'configured'],
    queryFn: () => googleBusinessService.isConfigured(),
    staleTime: 1000 * 60 * 60, // 1 hour - rarely changes
  });
}

export function useGoogleBusinessStatus() {
  return useQuery({
    queryKey: GOOGLE_BUSINESS_STATUS_QUERY_KEY,
    queryFn: () => googleBusinessService.getStatus(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGoogleBusinessLocations(enabled = true) {
  return useQuery({
    queryKey: GOOGLE_BUSINESS_LOCATIONS_QUERY_KEY,
    queryFn: () => googleBusinessService.getLocations(),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useConnectGoogleBusiness() {
  return useMutation({
    mutationFn: (redirectUrl?: string) => googleBusinessService.getOAuthUrl(redirectUrl),
  });
}

export function useSelectGoogleLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (locationId: string) => googleBusinessService.selectLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_BUSINESS_STATUS_QUERY_KEY });
    },
  });
}

export function useDisconnectGoogleBusiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => googleBusinessService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOOGLE_BUSINESS_STATUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: GOOGLE_BUSINESS_LOCATIONS_QUERY_KEY });
    },
  });
}

// ============================================================================
// Growth Dashboard Hooks
// ============================================================================

export const GROWTH_DASHBOARD_QUERY_KEY = ['growth', 'dashboard'];
export const GROWTH_INSIGHTS_QUERY_KEY = ['growth', 'insights'];
export const ATTRIBUTION_LINKS_QUERY_KEY = ['growth', 'attribution-links'];

export function useGrowthDashboard(params?: DashboardQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...GROWTH_DASHBOARD_QUERY_KEY, params],
    queryFn: () => googleBusinessService.getDashboard(params),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useGrowthSummary(params?: DashboardQueryParams, enabled = true) {
  return useQuery({
    queryKey: [...GROWTH_DASHBOARD_QUERY_KEY, 'summary', params],
    queryFn: () => googleBusinessService.getSummary(params),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useTriggerMetricsSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => googleBusinessService.triggerSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROWTH_DASHBOARD_QUERY_KEY });
    },
  });
}

export function useGrowthInsights() {
  return useQuery({
    queryKey: GROWTH_INSIGHTS_QUERY_KEY,
    queryFn: () => googleBusinessService.getInsights(),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useMarkInsightAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => googleBusinessService.markInsightRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROWTH_INSIGHTS_QUERY_KEY });
    },
  });
}

export function useDismissInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => googleBusinessService.dismissInsight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GROWTH_INSIGHTS_QUERY_KEY });
    },
  });
}

// ============================================================================
// Attribution Links Hooks
// ============================================================================

export function useAttributionLinks() {
  return useQuery({
    queryKey: ATTRIBUTION_LINKS_QUERY_KEY,
    queryFn: () => googleBusinessService.getLinks(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useAttributionLink(id: string, enabled = true) {
  return useQuery({
    queryKey: [...ATTRIBUTION_LINKS_QUERY_KEY, id],
    queryFn: () => googleBusinessService.getLink(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAttributionLinkStats(id: string, enabled = true) {
  return useQuery({
    queryKey: [...ATTRIBUTION_LINKS_QUERY_KEY, id, 'stats'],
    queryFn: () => googleBusinessService.getLinkStats(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateAttributionLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: googleBusinessService.createLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTRIBUTION_LINKS_QUERY_KEY });
    },
  });
}

export function useUpdateAttributionLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof googleBusinessService.updateLink>[1] }) =>
      googleBusinessService.updateLink(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...ATTRIBUTION_LINKS_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ATTRIBUTION_LINKS_QUERY_KEY });
    },
  });
}

export function useDeleteAttributionLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => googleBusinessService.deleteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ATTRIBUTION_LINKS_QUERY_KEY });
    },
  });
}
