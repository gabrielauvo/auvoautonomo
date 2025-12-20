import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ServiceFlowController } from './service-flow.controller';
import { ServiceFlowService } from './service-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteStatus, WorkOrderStatus, PaymentStatus, PaymentBillingType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('ServiceFlowController (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    quote: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    workOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    equipment: {
      findMany: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    clientPayment: {
      findMany: jest.fn(),
    },
  };

  const mockClientPaymentsService = {
    createPayment: jest.fn(),
  };

  const mockUser = { sub: 'user-123', email: 'test@test.com' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ServiceFlowController],
      providers: [
        ServiceFlowService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ClientPaymentsService,
          useValue: mockClientPaymentsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // CONVERT QUOTE TO WORK ORDER
  // ============================================

  describe('POST /service-flow/quote/:quoteId/convert-to-work-order', () => {
    it('should convert approved quote to work order', async () => {
      const quoteId = 'quote-123';
      const mockQuote = {
        id: quoteId,
        userId: mockUser.sub,
        clientId: 'client-456',
        status: QuoteStatus.APPROVED,
        totalValue: new Decimal(1500),
        client: { id: 'client-456', name: 'Cliente', address: 'Rua Teste' },
        workOrder: null,
      };

      const mockWorkOrder = {
        id: 'wo-001',
        userId: mockUser.sub,
        clientId: 'client-456',
        quoteId,
        title: 'Instalacao',
        status: WorkOrderStatus.SCHEDULED,
        client: mockQuote.client,
        quote: { id: quoteId, totalValue: new Decimal(1500), status: QuoteStatus.APPROVED },
        equipments: [],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.workOrder.create.mockResolvedValue(mockWorkOrder);

      const response = await request(app.getHttpServer())
        .post(`/service-flow/quote/${quoteId}/convert-to-work-order`)
        .send({
          title: 'Instalacao',
          scheduledDate: '2025-01-15',
        })
        .expect(201);

      expect(response.body.id).toBe('wo-001');
      expect(response.body.quoteId).toBe(quoteId);
      expect(response.body.status).toBe(WorkOrderStatus.SCHEDULED);
    });

    it('should return 400 when quote is not approved', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue({
        id: 'quote-123',
        userId: mockUser.sub,
        status: QuoteStatus.DRAFT,
        workOrder: null,
      });

      await request(app.getHttpServer())
        .post('/service-flow/quote/quote-123/convert-to-work-order')
        .send({ title: 'Test' })
        .expect(400);
    });

    it('should return 404 when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/service-flow/quote/invalid-id/convert-to-work-order')
        .send({ title: 'Test' })
        .expect(404);
    });
  });

  // ============================================
  // COMPLETE WORK ORDER
  // ============================================

  describe('POST /service-flow/work-order/:workOrderId/complete', () => {
    it('should complete work order successfully', async () => {
      const workOrderId = 'wo-123';
      const mockWorkOrder = {
        id: workOrderId,
        userId: mockUser.sub,
        status: WorkOrderStatus.IN_PROGRESS,
        quote: { id: 'quote-123', totalValue: new Decimal(1500) },
        checklists: [],
        executionStart: new Date(),
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrder.update.mockResolvedValue({
        ...mockWorkOrder,
        status: WorkOrderStatus.DONE,
        executionEnd: new Date(),
        client: { id: 'c', name: 'C', email: 'c@c.com', phone: '123' },
        quote: { id: 'quote-123', totalValue: new Decimal(1500) },
      });

      const response = await request(app.getHttpServer())
        .post(`/service-flow/work-order/${workOrderId}/complete`)
        .send({})
        .expect(201);

      expect(response.body.workOrder.status).toBe(WorkOrderStatus.DONE);
      expect(response.body.paymentSuggestion).toBeDefined();
      expect(response.body.paymentSuggestion.canGeneratePayment).toBe(true);
    });

    it('should return 400 when work order already done', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: 'wo-123',
        userId: mockUser.sub,
        status: WorkOrderStatus.DONE,
        checklists: [],
      });

      await request(app.getHttpServer())
        .post('/service-flow/work-order/wo-123/complete')
        .send({})
        .expect(400);
    });
  });

  // ============================================
  // GENERATE PAYMENT
  // ============================================

  describe('POST /service-flow/work-order/:workOrderId/generate-payment', () => {
    it('should generate payment from completed work order', async () => {
      const workOrderId = 'wo-123';
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId: mockUser.sub,
        clientId: 'client-456',
        quoteId: 'quote-123',
        status: WorkOrderStatus.DONE,
        quote: { id: 'quote-123', totalValue: new Decimal(1500) },
        payments: [],
      });

      mockClientPaymentsService.createPayment.mockResolvedValue({
        id: 'payment-001',
        asaasPaymentId: 'pay_123',
        value: 1500,
        status: PaymentStatus.PENDING,
        pixCode: '00020126...',
        qrCodeUrl: 'https://qr.asaas.com/...',
      });

      const response = await request(app.getHttpServer())
        .post(`/service-flow/work-order/${workOrderId}/generate-payment`)
        .send({
          billingType: 'PIX',
          dueDate: '2025-01-20',
        })
        .expect(201);

      expect(response.body.id).toBe('payment-001');
      expect(response.body.pixCode).toBeDefined();
    });

    it('should return 400 when work order not done', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: 'wo-123',
        userId: mockUser.sub,
        status: WorkOrderStatus.IN_PROGRESS,
        payments: [],
      });

      await request(app.getHttpServer())
        .post('/service-flow/work-order/wo-123/generate-payment')
        .send({
          billingType: 'PIX',
          dueDate: '2025-01-20',
        })
        .expect(400);
    });
  });

  // ============================================
  // CLIENT TIMELINE
  // ============================================

  describe('GET /service-flow/client/:clientId/timeline', () => {
    it('should return client timeline', async () => {
      const clientId = 'client-456';

      mockPrismaService.client.findFirst.mockResolvedValue({
        id: clientId,
        userId: mockUser.sub,
        name: 'Cliente',
      });

      mockPrismaService.quote.findMany.mockResolvedValue([
        {
          id: 'quote-1',
          status: QuoteStatus.APPROVED,
          totalValue: new Decimal(1500),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-02'),
          items: [],
        },
      ]);

      mockPrismaService.workOrder.findMany.mockResolvedValue([
        {
          id: 'wo-1',
          title: 'OS Teste',
          status: WorkOrderStatus.DONE,
          quoteId: 'quote-1',
          createdAt: new Date('2025-01-03'),
          executionStart: new Date('2025-01-04'),
          executionEnd: new Date('2025-01-05'),
          equipments: [],
          checklists: [],
        },
      ]);

      mockPrismaService.clientPayment.findMany.mockResolvedValue([
        {
          id: 'payment-1',
          value: new Decimal(1500),
          billingType: PaymentBillingType.PIX,
          status: PaymentStatus.RECEIVED,
          dueDate: new Date('2025-01-15'),
          paidAt: new Date('2025-01-10'),
          createdAt: new Date('2025-01-06'),
          workOrderId: 'wo-1',
          quoteId: 'quote-1',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/service-flow/client/${clientId}/timeline`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('type');
      expect(response.body[0]).toHaveProperty('date');
      expect(response.body[0]).toHaveProperty('data');
    });

    it('should return 403 when client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/service-flow/client/invalid-id/timeline')
        .expect(403);
    });
  });

  // ============================================
  // WORK ORDER EXTRACT
  // ============================================

  describe('GET /service-flow/work-order/:workOrderId/extract', () => {
    it('should return work order extract', async () => {
      const workOrderId = 'wo-123';

      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId: mockUser.sub,
        title: 'OS Teste',
        description: 'Descricao',
        status: WorkOrderStatus.DONE,
        scheduledDate: new Date('2025-01-10'),
        executionStart: new Date('2025-01-10T09:00:00'),
        executionEnd: new Date('2025-01-10T12:00:00'),
        createdAt: new Date('2025-01-01'),
        client: {
          id: 'client-456',
          name: 'Cliente',
          email: 'cliente@test.com',
          phone: '11999999999',
        },
        quote: {
          id: 'quote-123',
          totalValue: new Decimal(1500),
          discountValue: new Decimal(100),
          status: QuoteStatus.APPROVED,
          items: [
            {
              quantity: new Decimal(1),
              unitPrice: new Decimal(1600),
              totalPrice: new Decimal(1600),
              item: { name: 'Servico' },
            },
          ],
        },
        payments: [
          {
            id: 'payment-1',
            value: new Decimal(1500),
            billingType: PaymentBillingType.PIX,
            status: PaymentStatus.RECEIVED,
            dueDate: new Date('2025-01-15'),
            paidAt: new Date('2025-01-12'),
            asaasInvoiceUrl: 'https://asaas.com/invoice',
          },
        ],
        checklists: [
          {
            id: 'cl-1',
            title: 'Checklist',
            template: { title: 'Template' },
            _count: { answers: 5 },
          },
        ],
        equipments: [
          {
            equipment: {
              id: 'eq-1',
              type: 'Ar-condicionado',
              brand: 'LG',
              model: 'Split',
            },
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/service-flow/work-order/${workOrderId}/extract`)
        .expect(200);

      expect(response.body.workOrder.id).toBe(workOrderId);
      expect(response.body.client).toBeDefined();
      expect(response.body.quote).toBeDefined();
      expect(response.body.payments).toBeDefined();
      expect(response.body.checklists).toBeDefined();
      expect(response.body.equipments).toBeDefined();
      expect(response.body.financialSummary).toBeDefined();
    });

    it('should return 404 when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/service-flow/work-order/invalid-id/extract')
        .expect(404);
    });
  });

  // ============================================
  // FULL FLOW TEST
  // ============================================

  describe('Full Service Flow Integration', () => {
    it('should complete entire flow: Quote -> WorkOrder -> Complete -> Payment', async () => {
      const quoteId = 'quote-flow-test';
      const clientId = 'client-flow-test';

      // Step 1: Convert quote to work order
      const mockQuote = {
        id: quoteId,
        userId: mockUser.sub,
        clientId,
        status: QuoteStatus.APPROVED,
        totalValue: new Decimal(2000),
        client: { id: clientId, name: 'Cliente Flow', address: 'Rua Flow' },
        workOrder: null,
      };

      const mockCreatedWO = {
        id: 'wo-flow-test',
        userId: mockUser.sub,
        clientId,
        quoteId,
        title: 'OS Flow Test',
        status: WorkOrderStatus.SCHEDULED,
        client: mockQuote.client,
        quote: { id: quoteId, totalValue: new Decimal(2000), status: QuoteStatus.APPROVED },
        equipments: [],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.workOrder.create.mockResolvedValue(mockCreatedWO);

      const convertResponse = await request(app.getHttpServer())
        .post(`/service-flow/quote/${quoteId}/convert-to-work-order`)
        .send({ title: 'OS Flow Test' })
        .expect(201);

      expect(convertResponse.body.id).toBe('wo-flow-test');

      // Step 2: Complete work order
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        ...mockCreatedWO,
        status: WorkOrderStatus.IN_PROGRESS,
        quote: { id: quoteId, totalValue: new Decimal(2000) },
        checklists: [],
        executionStart: new Date(),
      });

      mockPrismaService.workOrder.update.mockResolvedValue({
        ...mockCreatedWO,
        status: WorkOrderStatus.DONE,
        executionEnd: new Date(),
        client: { id: clientId, name: 'Cliente', email: 'c@c.com', phone: '123' },
        quote: { id: quoteId, totalValue: new Decimal(2000) },
      });

      const completeResponse = await request(app.getHttpServer())
        .post('/service-flow/work-order/wo-flow-test/complete')
        .send({})
        .expect(201);

      expect(completeResponse.body.workOrder.status).toBe(WorkOrderStatus.DONE);
      expect(completeResponse.body.paymentSuggestion.suggestedValue).toBe(2000);

      // Step 3: Generate payment
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: 'wo-flow-test',
        userId: mockUser.sub,
        clientId,
        quoteId,
        status: WorkOrderStatus.DONE,
        quote: { id: quoteId, totalValue: new Decimal(2000) },
        payments: [],
      });

      mockClientPaymentsService.createPayment.mockResolvedValue({
        id: 'payment-flow-test',
        asaasPaymentId: 'pay_flow',
        value: 2000,
        status: PaymentStatus.PENDING,
        pixCode: '00020126flow...',
      });

      const paymentResponse = await request(app.getHttpServer())
        .post('/service-flow/work-order/wo-flow-test/generate-payment')
        .send({
          billingType: 'PIX',
          dueDate: '2025-02-01',
        })
        .expect(201);

      expect(paymentResponse.body.id).toBe('payment-flow-test');
      expect(paymentResponse.body.value).toBe(2000);
    });
  });
});
