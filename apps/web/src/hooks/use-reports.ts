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
 * Hook para gerenciar filtros de período via URL
 */
export function useReportFilters(searchParams: URLSearchParams): ReportFilters {
  const period = (searchParams.get('period') as ReportFilters['period']) || 'last30days';
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  const groupBy = (searchParams.get('groupBy') as ReportFilters['groupBy']) || undefined;

  return {
    period,
    startDate,
    endDate,
    groupBy,
  };
}
