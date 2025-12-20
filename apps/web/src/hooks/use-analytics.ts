'use client';

/**
 * useAnalytics - Hook para carregar dados de analytics
 *
 * Utiliza React Query para:
 * - Cache automático
 * - Revalidação
 * - Estados de loading/error
 */

import { useQuery } from '@tanstack/react-query';
import { analyticsService, AnalyticsOverview } from '@/services/analytics.service';

interface UseAnalyticsParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Hook para obter overview do analytics
 */
export function useAnalyticsOverview(params?: UseAnalyticsParams) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', params?.startDate, params?.endDate],
    queryFn: () => analyticsService.getOverview(params),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para obter receita por período
 */
export function useRevenueByPeriod(params?: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  return useQuery({
    queryKey: ['analytics', 'revenue', params?.startDate, params?.endDate, params?.groupBy],
    queryFn: () => analyticsService.getRevenueByPeriod(params),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para obter conversão de orçamentos
 */
export function useQuoteConversion(months?: number) {
  return useQuery({
    queryKey: ['analytics', 'quotes', 'conversion', months],
    queryFn: () => analyticsService.getQuoteConversion({ months }),
    staleTime: 5 * 60 * 1000,
  });
}
