import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientPaymentsService } from './client-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { AsaasIntegrationService } from '../asaas-integration/asaas-integration.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { PaymentStatus, PaymentBillingType, AsaasEnvironment } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const mockDecimal = (value: number) => new Decimal(value);

describe('ClientPaymentsService', () => {
  let service: ClientPaymentsService;
  let prisma: PrismaService;
  let asaasClient: AsaasHttpClient;
  let asaasIntegration: AsaasIntegrationService;

  const mockPrismaService = {
    client: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
    },
    workOrder: {
      findUnique: jest.fn(),
    },
    clientPayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAsaasHttpClient = {
    createOrUpdateCustomer: jest.fn(),
    createPayment: jest.fn(),
  };

  const mockAsaasIntegrationService = {
    getApiKey: jest.fn(),
  };

  const mockNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockDomainEventsService = {
    createEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    createEventsForUsers: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientPaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AsaasHttpClient,
          useValue: mockAsaasHttpClient,
        },
        {
          provide: AsaasIntegrationService,
          useValue: mockAsaasIntegrationService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PlanLimitsService,
          useValue: mockPlanLimitsService,
        },
        {
          provide: DomainEventsService,
          useValue: mockDomainEventsService,
        },
      ],
    }).compile();

    service = module.get<ClientPaymentsService>(ClientPaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    asaasClient = module.get<AsaasHttpClient>(AsaasHttpClient);
    asaasIntegration = module.get<AsaasIntegrationService>(AsaasIntegrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('syncCustomer', () => {
    const userId = 'user-123';
    const clientId = 'client-123';

    const mockClient = {
      id: clientId,
      userId,
      name: 'João Silva',
      email: 'joao@example.com',
      phone: '11999999999',
      taxId: '12345678900',
      zipCode: '01234-567',
      address: 'Rua Exemplo, 123',
      state: 'SP',
      asaasCustomerId: null,
    };

    it('should sync client with Asaas successfully', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);
      mockAsaasIntegrationService.getApiKey.mockResolvedValue({
        apiKey: '$aak_test_123',
        environment: AsaasEnvironment.SANDBOX,
      });
      mockAsaasHttpClient.createOrUpdateCustomer.mockResolvedValue({
        id: 'cus_000005161589',
        name: 'João Silva',
      });
      mockPrismaService.client.update.mockResolvedValue({
        ...mockClient,
        asaasCustomerId: 'cus_000005161589',
      });

      const result = await service.syncCustomer(userId, clientId);

      expect(mockPrismaService.client.findUnique).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
      expect(mockAsaasHttpClient.createOrUpdateCustomer).toHaveBeenCalledWith(
        '$aak_test_123',
        AsaasEnvironment.SANDBOX,
        {
          id: undefined,
          name: 'João Silva',
          email: 'joao@example.com',
          phone: '11999999999',
          cpfCnpj: '12345678900',
          postalCode: '01234-567',
          address: 'Rua Exemplo, 123',
          province: 'SP',
          externalReference: clientId,
        },
      );
      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: clientId },
        data: { asaasCustomerId: 'cus_000005161589' },
      });
      expect(result).toBe('cus_000005161589');
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.syncCustomer(userId, clientId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPayment', () => {
    const userId = 'user-123';
    const dto = {
      clientId: 'client-123',
      billingType: PaymentBillingType.PIX,
      value: 150.0,
      dueDate: '2025-12-20',
      description: 'Test payment',
    };

    const mockClient = {
      id: 'client-123',
      userId,
      name: 'João Silva',
      asaasCustomerId: 'cus_123',
    };

    const mockPaymentResponse = {
      id: 'pay_123',
      customer: 'cus_123',
      billingType: 'PIX',
      value: 150,
      dueDate: '2025-12-20',
      status: 'PENDING',
      invoiceUrl: null,
      pixTransaction: {
        qrCode: {
          payload: '00020126...',
          encodedImage: 'data:image/png;base64,...',
        },
      },
    };

    it('should create payment successfully with existing customer', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(mockClient);
      mockAsaasIntegrationService.getApiKey.mockResolvedValue({
        apiKey: '$aak_test_123',
        environment: AsaasEnvironment.SANDBOX,
      });
      mockAsaasHttpClient.createPayment.mockResolvedValue(mockPaymentResponse);
      mockPrismaService.clientPayment.create.mockResolvedValue({
        id: 'payment-123',
        asaasPaymentId: 'pay_123',
        userId,
        clientId: 'client-123',
        billingType: PaymentBillingType.PIX,
        value: mockDecimal(150),
        status: PaymentStatus.PENDING,
        dueDate: new Date('2025-12-20'),
        createdAt: new Date(),
        client: mockClient,
        quote: null,
        workOrder: null,
        asaasInvoiceUrl: null,
        asaasQrCodeUrl: 'data:image/png;base64,...',
        asaasPixCode: '00020126...',
      });

      const result = await service.createPayment(userId, dto);

      expect(mockPrismaService.client.findUnique).toHaveBeenCalled();
      expect(mockAsaasHttpClient.createPayment).toHaveBeenCalledWith(
        '$aak_test_123',
        AsaasEnvironment.SANDBOX,
        {
          customer: 'cus_123',
          billingType: 'PIX',
          value: 150,
          dueDate: '2025-12-20',
          description: 'Test payment',
          externalReference: undefined,
        },
      );
      expect(result.asaasPaymentId).toBe('pay_123');
      expect(result.pixCode).toBe('00020126...');
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrismaService.client.findUnique.mockResolvedValue(null);

      await expect(service.createPayment(userId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPayments', () => {
    const userId = 'user-123';

    it('should list all payments for user', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          asaasPaymentId: 'pay_1',
          userId,
          clientId: 'client-1',
          billingType: PaymentBillingType.PIX,
          value: mockDecimal(100),
          status: PaymentStatus.RECEIVED,
          dueDate: new Date(),
          createdAt: new Date(),
          client: { name: 'Client 1' },
        },
      ];

      mockPrismaService.clientPayment.findMany.mockResolvedValue(mockPayments);

      const result = await service.listPayments(userId);

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { client: true, quote: true, workOrder: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].clientName).toBe('Client 1');
    });

    it('should filter payments by clientId', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);

      await service.listPayments(userId, 'client-123');

      expect(mockPrismaService.clientPayment.findMany).toHaveBeenCalledWith({
        where: { userId, clientId: 'client-123' },
        include: { client: true, quote: true, workOrder: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getPayment', () => {
    const userId = 'user-123';
    const paymentId = 'payment-123';

    it('should get payment by id', async () => {
      const mockPayment = {
        id: paymentId,
        asaasPaymentId: 'pay_123',
        userId,
        clientId: 'client-123',
        billingType: PaymentBillingType.PIX,
        value: mockDecimal(150),
        status: PaymentStatus.PENDING,
        dueDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { name: 'Client Name' },
        quote: null,
        workOrder: null,
      };

      mockPrismaService.clientPayment.findUnique.mockResolvedValue(mockPayment);

      const result = await service.getPayment(userId, paymentId);

      expect(mockPrismaService.clientPayment.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId, userId },
        include: { client: true, quote: true, workOrder: true },
      });
      expect(result.id).toBe(paymentId);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPrismaService.clientPayment.findUnique.mockResolvedValue(null);

      await expect(service.getPayment(userId, paymentId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePaymentStatus', () => {
    const asaasPaymentId = 'pay_123';

    it('should update payment status', async () => {
      mockPrismaService.clientPayment.findUnique.mockResolvedValue({
        id: 'payment-123',
        asaasPaymentId,
        userId: 'user-123',
      });
      mockPrismaService.clientPayment.update.mockResolvedValue({
        id: 'payment-123',
        value: mockDecimal(150),
        client: { name: 'Test', email: 'test@test.com' },
        status: PaymentStatus.RECEIVED,
      });

      await service.updatePaymentStatus(asaasPaymentId, 'RECEIVED', new Date());

      expect(mockPrismaService.clientPayment.update).toHaveBeenCalledWith({
        where: { asaasPaymentId },
        data: {
          status: PaymentStatus.RECEIVED,
          paidAt: expect.any(Date),
        },
        include: {
          client: true,
          quote: true,
          workOrder: true,
        },
      });
    });

    it('should not throw if payment not found', async () => {
      mockPrismaService.clientPayment.findUnique.mockResolvedValue(null);

      await expect(service.updatePaymentStatus(asaasPaymentId, 'RECEIVED')).resolves.not.toThrow();
    });
  });
});
