'use client';

/**
 * useReports - Hooks para carregar dados de relatórios
 *
 * Utiliza React Query para:
 * - Cache automático
 * - Revalidação
 * - Estados de loading/error
 */

import { useQuery } from '@tanstack/react-query';
import { reportsService } from '@/services/reports.service';
import type {
  ReportFilters,
  FinanceReportData,
  SalesReportData,
  OperationsReportData,
  ClientsReportData,
  DashboardOverviewData,
  ProfitLossReportData,
  ServicesReportData,
} from '@/types/reports';

/**
 * Hook para Dashboard Overview
 */
export function useDashboardOverview(filters?: ReportFilters) {
  return useQuery<DashboardOverviewData>({
    queryKey: ['reports', 'dashboard', filters?.period, filters?.startDate, filters?.endDate],
    queryFn: () => reportsService.getDashboardOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para Relatório Financeiro
 */
export function useFinanceReport(filters?: ReportFilters, enabled = true) {
  return useQuery<FinanceReportData>({
    queryKey: ['reports', 'finance', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getFinanceReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para Relatório de Vendas
 */
export function useSalesReport(filters?: ReportFilters, enabled = true) {
  return useQuery<SalesReportData>({
    queryKey: ['reports', 'sales', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getSalesReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para Relatório Operacional
 */
export function useOperationsReport(filters?: ReportFilters, enabled = true) {
  return useQuery<OperationsReportData>({
    queryKey: ['reports', 'operations', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getOperationsReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para Relatório de Clientes
 */
export function useClientsReport(filters?: ReportFilters, enabled = true) {
  return useQuery<ClientsReportData>({
    queryKey: ['reports', 'clients', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getClientsReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para Relatório de Lucro/Prejuízo
 */
export function useProfitLossReport(filters?: ReportFilters, enabled = true) {
  return useQuery<ProfitLossReportData>({
    queryKey: ['reports', 'profit-loss', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getProfitLossReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Hook para Relatório de Serviços (OS por Tipo)
 */
export function useServicesReport(filters?: ReportFilters, enabled = true) {
  return useQuery<ServicesReportData>({
    queryKey: ['reports', 'services', filters?.period, filters?.startDate, filters?.endDate, filters?.groupBy],
    queryFn: () => reportsService.getServicesReport(filters),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

/**
 * Converte um período em datas de início e fim
 */
function getPeriodDates(period: ReportFilters['period']): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  switch (period) {
    case 'today': {
      return {
        startDate: formatDate(today),
        endDate: formatDate(today),
      };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday),
      };
    }
    case 'last7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6); // 7 days including today
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }
    case 'last30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29); // 30 days including today
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
    }
    case 'thisMonth': {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDate(firstOfMonth),
        endDate: formatDate(today),
      };
    }
    case 'lastMonth': {
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDate(firstOfLastMonth),
        endDate: formatDate(lastOfLastMonth),
      };
    }
    case 'thisYear': {
      const firstOfYear = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: formatDate(firstOfYear),
        endDate: formatDate(today),
      };
    }
    default:
      // For 'custom' or unknown, return last 30 days as fallback
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return {
        startDate: formatDate(start),
        endDate: formatDate(today),
      };
  }
}

/**
 * Hook para gerenciar filtros de período via URL
 */
export function useReportFilters(searchParams: URLSearchParams): ReportFilters {
  const period = (searchParams.get('period') as ReportFilters['period']) || 'last30days';
  const groupBy = (searchParams.get('groupBy') as ReportFilters['groupBy']) || undefined;

  // For custom period, use URL dates; otherwise compute from period
  if (period === 'custom') {
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    return {
      period,
      startDate,
      endDate,
      groupBy,
    };
  }

  // Compute dates based on period
  const { startDate, endDate } = getPeriodDates(period);

  return {
    period,
    startDate,
    endDate,
    groupBy,
  };
}
