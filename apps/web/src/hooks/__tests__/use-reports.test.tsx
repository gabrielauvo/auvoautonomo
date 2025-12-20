import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFinanceReport, useSalesReport, useOperationsReport, useClientsReport, useReportFilters } from '../use-reports';
import { reportsService } from '@/services/reports.service';

// Mock the reports service
jest.mock('@/services/reports.service', () => ({
  reportsService: {
    getFinanceReport: jest.fn(),
    getSalesReport: jest.fn(),
    getOperationsReport: jest.fn(),
    getClientsReport: jest.fn(),
    getDashboardOverview: jest.fn(),
  },
}));

const mockReportsService = reportsService as jest.Mocked<typeof reportsService>;

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useReports hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useFinanceReport', () => {
    it('should fetch finance report data', async () => {
      const mockData = {
        summary: { totalRevenue: 100000 },
        revenueByPeriod: [],
      };
      mockReportsService.getFinanceReport.mockResolvedValueOnce(mockData as any);

      const { result } = renderHook(() => useFinanceReport(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(mockReportsService.getFinanceReport).toHaveBeenCalled();
    });

    it('should not fetch when enabled is false', () => {
      renderHook(() => useFinanceReport(undefined, false), {
        wrapper: createWrapper(),
      });

      expect(mockReportsService.getFinanceReport).not.toHaveBeenCalled();
    });

    it('should pass filters to service', async () => {
      mockReportsService.getFinanceReport.mockResolvedValueOnce({} as any);

      const filters = { period: 'last30days' as const, groupBy: 'week' as const };

      renderHook(() => useFinanceReport(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockReportsService.getFinanceReport).toHaveBeenCalledWith(filters);
      });
    });
  });

  describe('useSalesReport', () => {
    it('should fetch sales report data', async () => {
      const mockData = {
        summary: { totalQuotes: 50 },
        quotesByPeriod: [],
      };
      mockReportsService.getSalesReport.mockResolvedValueOnce(mockData as any);

      const { result } = renderHook(() => useSalesReport(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useOperationsReport', () => {
    it('should fetch operations report data', async () => {
      const mockData = {
        summary: { totalWorkOrders: 100 },
        workOrdersByPeriod: [],
      };
      mockReportsService.getOperationsReport.mockResolvedValueOnce(mockData as any);

      const { result } = renderHook(() => useOperationsReport(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useClientsReport', () => {
    it('should fetch clients report data', async () => {
      const mockData = {
        summary: { totalClients: 150 },
        clientsByPeriod: [],
      };
      mockReportsService.getClientsReport.mockResolvedValueOnce(mockData as any);

      const { result } = renderHook(() => useClientsReport(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useReportFilters', () => {
    it('should parse filters from search params', () => {
      const searchParams = new URLSearchParams(
        'period=last30days&startDate=2024-01-01&endDate=2024-01-31&groupBy=week'
      );

      const { result } = renderHook(() => useReportFilters(searchParams));

      expect(result.current).toEqual({
        period: 'last30days',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'week',
      });
    });

    it('should use default period when not specified', () => {
      const searchParams = new URLSearchParams('');

      const { result } = renderHook(() => useReportFilters(searchParams));

      expect(result.current.period).toBe('last30days');
    });

    it('should return undefined for missing optional params', () => {
      const searchParams = new URLSearchParams('period=thisMonth');

      const { result } = renderHook(() => useReportFilters(searchParams));

      expect(result.current).toEqual({
        period: 'thisMonth',
        startDate: undefined,
        endDate: undefined,
        groupBy: undefined,
      });
    });
  });
});
