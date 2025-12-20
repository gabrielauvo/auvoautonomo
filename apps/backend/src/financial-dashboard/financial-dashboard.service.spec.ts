import { Test, TestingModule } from '@nestjs/testing';
import { FinancialDashboardService } from './financial-dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentBillingType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('FinancialDashboardService', () => {
  let service: FinancialDashboardService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockClientId = 'client-123';
  const mockWorkOrderId = 'wo-123';

  const createMockPayment = (overrides: Partial<any> = {}) => ({
    id: 'payment-123',
    userId: mockUserId,
    clientId: mockClientId,
    quoteId: null,
    workOrderId: null,
    asaasPaymentId: 'pay_123',
    billingType: PaymentBillingType.PIX,
    value: new Decimal(100),
    description: 'Test payment',
    dueDate: new Date('2025-01-15'),
    status: PaymentStatus.PENDING,
    asaasInvoiceUrl: null,
    asaasQrCodeUrl: null,
    asaasPixCode: null,
    paidAt: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { id: mockClientId, name: 'Test Client' },
    workOrder: null,
    quote: null,
    ...overrides,
  });

  const mockPrismaService = {
    clientPayment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    client: {
      findUnique: jest.fn(),
    },
    workOrder: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialDashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FinancialDashboardService>(FinancialDashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return empty overview when no payments exist', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.received).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.overdue).toBe(0);
      expect(result.canceled).toBe(0);
      expect(result.refused).toBe(0);
      expect(result.invoicedCount).toBe(0);
      expect(result.paidCount).toBe(0);
      expect(result.averageTicket).toBe(0);
      expect(result.averageTicketPaid).toBe(0);
    });

    it('should calculate received amount for RECEIVED status payments', async () => {
      const paidPayment = createMockPayment({
        status: PaymentStatus.RECEIVED,
        value: new Decimal(250),
        paidAt: new Date('2025-01-10'),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([paidPayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.received).toBe(250);
      expect(result.paidCount).toBe(1);
      expect(result.netRevenue).toBe(250);
    });

    it('should calculate received amount for CONFIRMED status payments', async () => {
      const confirmedPayment = createMockPayment({
        status: PaymentStatus.CONFIRMED,
        value: new Decimal(300),
        paidAt: new Date('2025-01-12'),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([confirmedPayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.received).toBe(300);
      expect(result.paidCount).toBe(1);
    });

    it('should calculate pending amount correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const pendingPayment = createMockPayment({
        status: PaymentStatus.PENDING,
        value: new Decimal(150),
        dueDate: futureDate,
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([pendingPayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.pending).toBe(150);
    });

    it('should calculate overdue amount for OVERDUE status', async () => {
      const overduePayment = createMockPayment({
        status: PaymentStatus.OVERDUE,
        value: new Decimal(200),
        dueDate: new Date('2025-01-01'),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([overduePayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.overdue).toBe(200);
      expect(result.overdueCount).toBe(1);
    });

    it('should calculate canceled amount for DELETED status', async () => {
      const canceledPayment = createMockPayment({
        status: PaymentStatus.DELETED,
        value: new Decimal(100),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([canceledPayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.canceled).toBe(100);
    });

    it('should calculate refused amount for refund-related statuses', async () => {
      const refundedPayment = createMockPayment({
        status: PaymentStatus.REFUNDED,
        value: new Decimal(175),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([refundedPayment]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.refused).toBe(175);
    });

    it('should calculate payment distribution by billing type', async () => {
      const pixPayment = createMockPayment({
        status: PaymentStatus.RECEIVED,
        billingType: PaymentBillingType.PIX,
        value: new Decimal(100),
        paidAt: new Date(),
      });
      const boletoPayment = createMockPayment({
        id: 'payment-456',
        status: PaymentStatus.RECEIVED,
        billingType: PaymentBillingType.BOLETO,
        value: new Decimal(200),
        paidAt: new Date(),
      });
      const creditCardPayment = createMockPayment({
        id: 'payment-789',
        status: PaymentStatus.CONFIRMED,
        billingType: PaymentBillingType.CREDIT_CARD,
        value: new Decimal(300),
        paidAt: new Date(),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([
        pixPayment,
        boletoPayment,
        creditCardPayment,
      ]);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.paymentDistribution.PIX).toBe(100);
      expect(result.paymentDistribution.BOLETO).toBe(200);
      expect(result.paymentDistribution.CREDIT_CARD).toBe(300);
    });

    it('should calculate totalExpected as sum of received + pending + overdue', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const payments = [
        createMockPayment({
          id: 'p1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date(),
        }),
        createMockPayment({
          id: 'p2',
          status: PaymentStatus.PENDING,
          value: new Decimal(50),
          dueDate: futureDate,
        }),
        createMockPayment({
          id: 'p3',
          status: PaymentStatus.OVERDUE,
          value: new Decimal(25),
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.totalExpected).toBe(175); // 100 + 50 + 25
    });

    it('should calculate average ticket correctly', async () => {
      const payments = [
        createMockPayment({ id: 'p1', value: new Decimal(100) }),
        createMockPayment({ id: 'p2', value: new Decimal(200) }),
        createMockPayment({ id: 'p3', value: new Decimal(300) }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.averageTicket).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should calculate averageTicketPaid only for paid payments', async () => {
      const payments = [
        createMockPayment({
          id: 'p1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date(),
        }),
        createMockPayment({
          id: 'p2',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(200),
          paidAt: new Date(),
        }),
        createMockPayment({
          id: 'p3',
          status: PaymentStatus.PENDING,
          value: new Decimal(1000),
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getOverview(mockUserId, { period: 'current_month' });

      expect(result.averageTicketPaid).toBe(150); // (100 + 200) / 2
    });

    it('should handle custom period with startDate and endDate', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getOverview(mockUserId, {
        period: 'custom',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(result.period).toBe('custom');
      expect(result.startDate).toContain('2025-01-01');
      expect(result.endDate).toContain('2025-01-31');
    });

    it('should handle last_month period', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getOverview(mockUserId, { period: 'last_month' });

      expect(result.period).toBe('last_month');
    });

    it('should handle current_year period', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getOverview(mockUserId, { period: 'current_year' });

      expect(result.period).toBe('current_year');
    });
  });

  describe('getRevenueByDay', () => {
    it('should return empty array when no paid payments exist', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getRevenueByDay(mockUserId, {
        startDate: '2025-01-01',
        endDate: '2025-01-03',
      });

      // Should have all days initialized with zero
      expect(result.length).toBe(3);
      expect(result.every((r) => r.value === 0)).toBe(true);
    });

    it('should aggregate revenue by day', async () => {
      const payments = [
        createMockPayment({
          id: 'p1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date('2025-01-01T10:00:00Z'),
        }),
        createMockPayment({
          id: 'p2',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(150),
          paidAt: new Date('2025-01-01T15:00:00Z'),
        }),
        createMockPayment({
          id: 'p3',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(200),
          paidAt: new Date('2025-01-02T10:00:00Z'),
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getRevenueByDay(mockUserId, {
        startDate: '2025-01-01',
        endDate: '2025-01-03',
      });

      expect(result.find((r) => r.date === '2025-01-01')?.value).toBe(250);
      expect(result.find((r) => r.date === '2025-01-02')?.value).toBe(200);
      expect(result.find((r) => r.date === '2025-01-03')?.value).toBe(0);
    });

    it('should sort results by date ascending', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getRevenueByDay(mockUserId, {
        startDate: '2025-01-01',
        endDate: '2025-01-05',
      });

      const dates = result.map((r) => r.date);
      expect(dates).toEqual([...dates].sort());
    });
  });

  describe('getRevenueByClient', () => {
    it('should return empty array when no paid payments exist', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      const result = await service.getRevenueByClient(mockUserId, { period: 'current_month' });

      expect(result).toEqual([]);
    });

    it('should group revenue by client', async () => {
      const payments = [
        createMockPayment({
          id: 'p1',
          clientId: 'client-1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date(),
          client: { id: 'client-1', name: 'Client A' },
        }),
        createMockPayment({
          id: 'p2',
          clientId: 'client-1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(200),
          paidAt: new Date(),
          client: { id: 'client-1', name: 'Client A' },
        }),
        createMockPayment({
          id: 'p3',
          clientId: 'client-2',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(500),
          paidAt: new Date(),
          client: { id: 'client-2', name: 'Client B' },
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getRevenueByClient(mockUserId, { period: 'current_month' });

      expect(result.length).toBe(2);
      expect(result[0].clientId).toBe('client-2'); // Higher revenue first
      expect(result[0].totalPaid).toBe(500);
      expect(result[0].count).toBe(1);
      expect(result[1].clientId).toBe('client-1');
      expect(result[1].totalPaid).toBe(300);
      expect(result[1].count).toBe(2);
    });

    it('should sort by totalPaid descending', async () => {
      const payments = [
        createMockPayment({
          id: 'p1',
          clientId: 'client-1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date(),
          client: { id: 'client-1', name: 'Client A' },
        }),
        createMockPayment({
          id: 'p2',
          clientId: 'client-2',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(500),
          paidAt: new Date(),
          client: { id: 'client-2', name: 'Client B' },
        }),
        createMockPayment({
          id: 'p3',
          clientId: 'client-3',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(250),
          paidAt: new Date(),
          client: { id: 'client-3', name: 'Client C' },
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getRevenueByClient(mockUserId, { period: 'current_month' });

      expect(result[0].totalPaid).toBe(500);
      expect(result[1].totalPaid).toBe(250);
      expect(result[2].totalPaid).toBe(100);
    });
  });

  describe('getPayments', () => {
    it('should return all payments for user', async () => {
      const payments = [
        createMockPayment({ id: 'p1' }),
        createMockPayment({ id: 'p2' }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getPayments(mockUserId, {});

      expect(result.length).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, { status: PaymentStatus.PENDING });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PaymentStatus.PENDING,
          }),
        }),
      );
    });

    it('should filter by billingType', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, { billingType: PaymentBillingType.PIX });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            billingType: PaymentBillingType.PIX,
          }),
        }),
      );
    });

    it('should filter by clientId', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, { clientId: 'client-123' });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-123',
          }),
        }),
      );
    });

    it('should filter by date range on dueDate by default', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.any(Object),
          }),
        }),
      );
    });

    it('should filter by date range on paidAt when specified', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        dateField: 'paidAt',
      });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paidAt: expect.any(Object),
          }),
        }),
      );
    });

    it('should apply custom sorting', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.getPayments(mockUserId, { sortBy: 'value', sortOrder: 'asc' });

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { value: 'asc' },
        }),
      );
    });

    it('should transform payment values correctly', async () => {
      const payment = createMockPayment({
        value: new Decimal(150.5),
        workOrder: { id: 'wo-1', title: 'Work Order 1' },
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([payment]);

      const result = await service.getPayments(mockUserId, {});

      expect(result[0].value).toBe(150.5);
      expect(result[0].clientName).toBe('Test Client');
      expect(result[0].workOrderTitle).toBe('Work Order 1');
    });
  });

  describe('getClientExtract', () => {
    it('should throw NotFoundException when client does not exist', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.getClientExtract(mockUserId, 'invalid-client')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return client financial extract', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: mockClientId,
        name: 'Test Client',
        userId: mockUserId,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const payments = [
        createMockPayment({
          id: 'p1',
          status: PaymentStatus.RECEIVED,
          value: new Decimal(100),
          paidAt: new Date(),
        }),
        createMockPayment({
          id: 'p2',
          status: PaymentStatus.PENDING,
          value: new Decimal(50),
          dueDate: futureDate,
        }),
        createMockPayment({
          id: 'p3',
          status: PaymentStatus.OVERDUE,
          value: new Decimal(25),
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getClientExtract(mockUserId, mockClientId);

      expect(result.clientId).toBe(mockClientId);
      expect(result.clientName).toBe('Test Client');
      expect(result.totalPaid).toBe(100);
      expect(result.totalPending).toBe(50);
      expect(result.totalOverdue).toBe(25);
      expect(result.history.length).toBe(3);
    });

    it('should include payment history with correct fields', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue({
        id: mockClientId,
        name: 'Test Client',
        userId: mockUserId,
      });

      const payment = createMockPayment({
        id: 'p1',
        status: PaymentStatus.RECEIVED,
        value: new Decimal(100),
        description: 'Test description',
        dueDate: new Date('2025-01-15'),
        paidAt: new Date('2025-01-10'),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([payment]);

      const result = await service.getClientExtract(mockUserId, mockClientId);

      expect(result.history[0]).toEqual(
        expect.objectContaining({
          paymentId: 'p1',
          value: 100,
          status: PaymentStatus.RECEIVED,
          description: 'Test description',
        }),
      );
    });
  });

  describe('getWorkOrderExtract', () => {
    it('should throw NotFoundException when work order does not exist', async () => {
      mockPrismaService.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.getWorkOrderExtract(mockUserId, 'invalid-wo')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return work order financial extract', async () => {
      mockPrismaService.workOrder.findUnique.mockResolvedValue({
        id: mockWorkOrderId,
        title: 'Test Work Order',
        userId: mockUserId,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const payments = [
        createMockPayment({
          id: 'p1',
          workOrderId: mockWorkOrderId,
          status: PaymentStatus.RECEIVED,
          value: new Decimal(200),
          billingType: PaymentBillingType.PIX,
          paidAt: new Date(),
        }),
        createMockPayment({
          id: 'p2',
          workOrderId: mockWorkOrderId,
          status: PaymentStatus.PENDING,
          value: new Decimal(100),
          billingType: PaymentBillingType.BOLETO,
          dueDate: futureDate,
        }),
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(payments);

      const result = await service.getWorkOrderExtract(mockUserId, mockWorkOrderId);

      expect(result.workOrderId).toBe(mockWorkOrderId);
      expect(result.workOrderTitle).toBe('Test Work Order');
      expect(result.totalPaid).toBe(200);
      expect(result.totalPending).toBe(100);
      expect(result.totalOverdue).toBe(0);
      expect(result.payments.length).toBe(2);
    });

    it('should include payment details with billingType', async () => {
      mockPrismaService.workOrder.findUnique.mockResolvedValue({
        id: mockWorkOrderId,
        title: 'Test Work Order',
        userId: mockUserId,
      });

      const payment = createMockPayment({
        id: 'p1',
        workOrderId: mockWorkOrderId,
        status: PaymentStatus.RECEIVED,
        value: new Decimal(150),
        billingType: PaymentBillingType.CREDIT_CARD,
        paidAt: new Date(),
      });

      mockPrismaService.clientPayment.findMany.mockResolvedValue([payment]);

      const result = await service.getWorkOrderExtract(mockUserId, mockWorkOrderId);

      expect(result.payments[0].billingType).toBe(PaymentBillingType.CREDIT_CARD);
    });
  });
});
