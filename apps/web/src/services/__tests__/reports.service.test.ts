import { reportsService } from '../reports.service';
import api from '../api';

// Mock the api module
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => error.message || 'Unknown error'),
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('reportsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardOverview', () => {
    it('should fetch dashboard overview without filters', async () => {
      const mockData = { kpis: {}, revenueChart: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await reportsService.getDashboardOverview();

      expect(mockApi.get).toHaveBeenCalledWith('/reports/dashboard');
      expect(result).toEqual(mockData);
    });

    it('should fetch dashboard overview with filters', async () => {
      const mockData = { kpis: {}, revenueChart: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const filters = {
        period: 'last30days' as const,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await reportsService.getDashboardOverview(filters);

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('period=last30days')
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01')
      );
    });

    it('should throw error on failure', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(reportsService.getDashboardOverview()).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('getFinanceReport', () => {
    it('should fetch finance report', async () => {
      const mockData = { summary: {}, revenueByPeriod: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await reportsService.getFinanceReport();

      expect(mockApi.get).toHaveBeenCalledWith('/reports/finance');
      expect(result).toEqual(mockData);
    });

    it('should include groupBy parameter', async () => {
      const mockData = { summary: {} };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      await reportsService.getFinanceReport({
        period: 'thisMonth',
        groupBy: 'week',
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('groupBy=week')
      );
    });
  });

  describe('getSalesReport', () => {
    it('should fetch sales report', async () => {
      const mockData = { summary: {}, quotesByPeriod: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await reportsService.getSalesReport();

      expect(mockApi.get).toHaveBeenCalledWith('/reports/sales');
      expect(result).toEqual(mockData);
    });
  });

  describe('getOperationsReport', () => {
    it('should fetch operations report', async () => {
      const mockData = { summary: {}, workOrdersByPeriod: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await reportsService.getOperationsReport();

      expect(mockApi.get).toHaveBeenCalledWith('/reports/operations');
      expect(result).toEqual(mockData);
    });
  });

  describe('getClientsReport', () => {
    it('should fetch clients report', async () => {
      const mockData = { summary: {}, clientsByPeriod: [] };
      mockApi.get.mockResolvedValueOnce({ data: mockData });

      const result = await reportsService.getClientsReport();

      expect(mockApi.get).toHaveBeenCalledWith('/reports/clients');
      expect(result).toEqual(mockData);
    });
  });

  describe('exportReport', () => {
    it('should export report as CSV', async () => {
      const mockBlob = new Blob(['csv data'], { type: 'text/csv' });
      mockApi.get.mockResolvedValueOnce({ data: mockBlob });

      const result = await reportsService.exportReport('finance', 'csv');

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('format=csv'),
        expect.objectContaining({ responseType: 'blob' })
      );
      expect(result).toEqual(mockBlob);
    });

    it('should export report as PDF', async () => {
      const mockBlob = new Blob(['pdf data'], { type: 'application/pdf' });
      mockApi.get.mockResolvedValueOnce({ data: mockBlob });

      const result = await reportsService.exportReport('sales', 'pdf');

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('format=pdf'),
        expect.objectContaining({ responseType: 'blob' })
      );
      expect(result).toEqual(mockBlob);
    });

    it('should include filters in export request', async () => {
      const mockBlob = new Blob(['data']);
      mockApi.get.mockResolvedValueOnce({ data: mockBlob });

      await reportsService.exportReport('operations', 'csv', {
        period: 'lastMonth',
        startDate: '2024-01-01',
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('period=lastMonth'),
        expect.any(Object)
      );
    });
  });
});
