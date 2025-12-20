/**
 * Reports Service - Serviço de Relatórios
 *
 * Consome endpoints do backend para relatórios detalhados:
 * - Financeiro
 * - Vendas (Orçamentos)
 * - Operacional (OS)
 * - Clientes
 */

import api, { getErrorMessage } from './api';
import type {
  ReportFilters,
  FinanceReportData,
  SalesReportData,
  OperationsReportData,
  ClientsReportData,
  DashboardOverviewData,
} from '@/types/reports';

/**
 * Converte parâmetros de filtro para query string
 */
function buildQueryParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.groupBy) params.append('groupBy', filters.groupBy);
  if (filters.period) params.append('period', filters.period);

  return params;
}

/**
 * Dashboard Overview - KPIs e gráficos principais
 */
export async function getDashboardOverview(filters?: ReportFilters): Promise<DashboardOverviewData> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    const url = `/reports/dashboard${params.toString() ? `?${params}` : ''}`;
    const response = await api.get<DashboardOverviewData>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Relatório Financeiro
 */
export async function getFinanceReport(filters?: ReportFilters): Promise<FinanceReportData> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    const url = `/reports/finance${params.toString() ? `?${params}` : ''}`;
    const response = await api.get<FinanceReportData>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Relatório de Vendas (Orçamentos)
 */
export async function getSalesReport(filters?: ReportFilters): Promise<SalesReportData> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    const url = `/reports/sales${params.toString() ? `?${params}` : ''}`;
    const response = await api.get<SalesReportData>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Relatório Operacional (Ordens de Serviço)
 */
export async function getOperationsReport(filters?: ReportFilters): Promise<OperationsReportData> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    const url = `/reports/operations${params.toString() ? `?${params}` : ''}`;
    const response = await api.get<OperationsReportData>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Relatório de Clientes
 */
export async function getClientsReport(filters?: ReportFilters): Promise<ClientsReportData> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    const url = `/reports/clients${params.toString() ? `?${params}` : ''}`;
    const response = await api.get<ClientsReportData>(url);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Exportar relatório (CSV/PDF)
 */
export async function exportReport(
  reportType: 'finance' | 'sales' | 'operations' | 'clients',
  format: 'csv' | 'pdf',
  filters?: ReportFilters
): Promise<Blob> {
  try {
    const params = filters ? buildQueryParams(filters) : new URLSearchParams();
    params.append('format', format);

    const url = `/reports/${reportType}/export?${params}`;
    const response = await api.get(url, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export const reportsService = {
  getDashboardOverview,
  getFinanceReport,
  getSalesReport,
  getOperationsReport,
  getClientsReport,
  exportReport,
};

export default reportsService;
