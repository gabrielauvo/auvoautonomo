import { Test, TestingModule } from '@nestjs/testing';
import { FinancialDashboardController } from './financial-dashboard.controller';
import { FinancialDashboardService } from './financial-dashboard.service';
import { PaymentStatus, PaymentBillingType } from '@prisma/client';

describe('FinancialDashboardController', () => {
  let controller: FinancialDashboardController;
  let service: FinancialDashboardService;

  const mockUserId = 'user-123';
  const mockRequest = { user: { userId: mockUserId } };

  const mockOverviewResponse = {
    period: 'current_month',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-01-31T23:59:59.999Z',
    received: 1500,
    pending: 500,
    overdue: 200,
    canceled: 100,
    refused: 50,
    totalExpected: 2200,
    netRevenue: 1500,
    invoicedCount: 10,
    paidCount: 6,
    overdueCount: 2,
    averageTicket: 220,
    averageTicketPaid: 250,
    paymentDistribution: {
      PIX: 800,
      BOLETO: 500,
      CREDIT_CARD: 200,
    },
  };

  const mockFinancialDashboardService = {
    getOverview: jest.fn(),
    getRevenueByDay: jest.fn(),
    getRevenueByClient: jest.fn(),
    getPayments: jest.fn(),
    getClientExtract: jest.fn(),
    getWorkOrderExtract: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialDashboardController],
      providers: [
        {
          provide: FinancialDashboardService,
          useValue: mockFinancialDashboardService,
        },
      ],
    }).compile();

    controller = module.get<FinancialDashboardController>(FinancialDashboardController);
    service = module.get<FinancialDashboardService>(FinancialDashboardService);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should call service with correct parameters', async () => {
      mockFinancialDashboardService.getOverview.mockResolvedValue(mockOverviewResponse);

      const query = { period: 'current_month' as const };
      const result = await controller.getOverview(mockRequest, query);

      expect(service.getOverview).toHaveBeenCalledWith(mockUserId, query);
      expect(result).toEqual(mockOverviewResponse);
    });

    it('should handle custom period with date range', async () => {
      mockFinancialDashboardService.getOverview.mockResolvedValue(mockOverviewResponse);

      const query = {
        period: 'custom' as const,
        startDate: '2025-01-01',
        endDate: '2025-01-15',
      };

      await controller.getOverview(mockRequest, query);

      expect(service.getOverview).toHaveBeenCalledWith(mockUserId, query);
    });
  });

  describe('getRevenueByDay', () => {
    it('should call service with correct parameters', async () => {
      const mockRevenueByDay = [
        { date: '2025-01-01', value: 100 },
        { date: '2025-01-02', value: 200 },
      ];
      mockFinancialDashboardService.getRevenueByDay.mockResolvedValue(mockRevenueByDay);

      const query = { startDate: '2025-01-01', endDate: '2025-01-31' };
      const result = await controller.getRevenueByDay(mockRequest, query);

      expect(service.getRevenueByDay).toHaveBeenCalledWith(mockUserId, query);
      expect(result).toEqual(mockRevenueByDay);
    });
  });

  describe('getRevenueByClient', () => {
    it('should call service with correct parameters', async () => {
      const mockRevenueByClient = [
        { clientId: 'c1', name: 'Client A', totalPaid: 500, count: 5 },
        { clientId: 'c2', name: 'Client B', totalPaid: 300, count: 3 },
      ];
      mockFinancialDashboardService.getRevenueByClient.mockResolvedValue(mockRevenueByClient);

      const query = { period: 'current_month' as const };
      const result = await controller.getRevenueByClient(mockRequest, query);

      expect(service.getRevenueByClient).toHaveBeenCalledWith(mockUserId, query);
      expect(result).toEqual(mockRevenueByClient);
    });
  });

  describe('getPayments', () => {
    it('should call service with all filter parameters', async () => {
      const mockPayments = [
        {
          id: 'p1',
          asaasPaymentId: 'pay_1',
          clientId: 'c1',
          clientName: 'Client',
          billingType: PaymentBillingType.PIX,
          value: 100,
          status: PaymentStatus.PENDING,
        },
      ];
      mockFinancialDashboardService.getPayments.mockResolvedValue(mockPayments);

      const query = {
        status: PaymentStatus.PENDING,
        billingType: PaymentBillingType.PIX,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        clientId: 'client-123',
        sortBy: 'value' as const,
        sortOrder: 'desc' as const,
      };

      const result = await controller.getPayments(mockRequest, query);

      expect(service.getPayments).toHaveBeenCalledWith(mockUserId, query);
      expect(result).toEqual(mockPayments);
    });
  });

  describe('getClientExtract', () => {
    it('should call service with clientId', async () => {
      const mockClientExtract = {
        clientId: 'client-123',
        clientName: 'Test Client',
        totalPaid: 1000,
        totalPending: 200,
        totalOverdue: 50,
        history: [],
      };
      mockFinancialDashboardService.getClientExtract.mockResolvedValue(mockClientExtract);

      const result = await controller.getClientExtract(mockRequest, 'client-123');

      expect(service.getClientExtract).toHaveBeenCalledWith(mockUserId, 'client-123');
      expect(result).toEqual(mockClientExtract);
    });
  });

  describe('getWorkOrderExtract', () => {
    it('should call service with workOrderId', async () => {
      const mockWorkOrderExtract = {
        workOrderId: 'wo-123',
        workOrderTitle: 'Test WO',
        totalPaid: 500,
        totalPending: 100,
        totalOverdue: 0,
        payments: [],
      };
      mockFinancialDashboardService.getWorkOrderExtract.mockResolvedValue(mockWorkOrderExtract);

      const result = await controller.getWorkOrderExtract(mockRequest, 'wo-123');

      expect(service.getWorkOrderExtract).toHaveBeenCalledWith(mockUserId, 'wo-123');
      expect(result).toEqual(mockWorkOrderExtract);
    });
  });
});
