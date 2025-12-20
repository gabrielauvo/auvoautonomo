import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceFlowService } from './service-flow.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { QuoteStatus, WorkOrderStatus, PaymentStatus, PaymentBillingType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('ServiceFlowService', () => {
  let service: ServiceFlowService;
  let prisma: PrismaService;
  let clientPaymentsService: ClientPaymentsService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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
    }).compile();

    service = module.get<ServiceFlowService>(ServiceFlowService);
    prisma = module.get<PrismaService>(PrismaService);
    clientPaymentsService = module.get<ClientPaymentsService>(ClientPaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // CONVERT QUOTE TO WORK ORDER
  // ============================================

  describe('convertQuoteToWorkOrder', () => {
    const userId = 'user-123';
    const quoteId = 'quote-456';
    const dto = {
      title: 'Instalacao de ar-condicionado',
      description: 'Instalacao completa',
      scheduledDate: '2025-01-15',
    };

    it('should convert approved quote to work order', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        clientId: 'client-789',
        status: QuoteStatus.APPROVED,
        totalValue: new Decimal(1500),
        client: {
          id: 'client-789',
          name: 'Cliente Teste',
          address: 'Rua Teste, 123',
        },
        workOrder: null,
      };

      const mockCreatedWorkOrder = {
        id: 'wo-001',
        userId,
        clientId: 'client-789',
        quoteId,
        title: dto.title,
        status: WorkOrderStatus.SCHEDULED,
        client: mockQuote.client,
        quote: { id: quoteId, totalValue: new Decimal(1500), status: QuoteStatus.APPROVED },
        equipments: [],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.workOrder.create.mockResolvedValue(mockCreatedWorkOrder);

      const result = await service.convertQuoteToWorkOrder(userId, quoteId, dto);

      expect(result.id).toBe('wo-001');
      expect(result.quoteId).toBe(quoteId);
      expect(result.status).toBe(WorkOrderStatus.SCHEDULED);
      expect(prisma.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            clientId: 'client-789',
            quoteId,
            title: dto.title,
            status: WorkOrderStatus.SCHEDULED,
          }),
        }),
      );
    });

    it('should throw NotFoundException when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when quote is not APPROVED', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        status: QuoteStatus.DRAFT,
        workOrder: null,
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dto),
      ).rejects.toThrow('Quote must be APPROVED');
    });

    it('should throw BadRequestException when quote already has work order', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        status: QuoteStatus.APPROVED,
        workOrder: { id: 'existing-wo' },
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dto),
      ).rejects.toThrow('already has a work order');
    });

    it('should validate equipments belong to client', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        clientId: 'client-789',
        status: QuoteStatus.APPROVED,
        client: { id: 'client-789', name: 'Cliente', address: null },
        workOrder: null,
      };

      const dtoWithEquipments = {
        ...dto,
        equipmentIds: ['eq-1', 'eq-2'],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.equipment.findMany.mockResolvedValue([{ id: 'eq-1' }]); // Only one found

      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dtoWithEquipments),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.convertQuoteToWorkOrder(userId, quoteId, dtoWithEquipments),
      ).rejects.toThrow('One or more equipments not found');
    });
  });

  // ============================================
  // COMPLETE WORK ORDER
  // ============================================

  describe('completeWorkOrder', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';
    const dto = {};

    it('should complete work order without checklists', async () => {
      const mockWorkOrder = {
        id: workOrderId,
        userId,
        clientId: 'client-789',
        status: WorkOrderStatus.IN_PROGRESS,
        quote: { id: 'quote-123', totalValue: new Decimal(1500) },
        checklists: [],
        executionStart: new Date(),
      };

      const mockUpdatedWorkOrder = {
        ...mockWorkOrder,
        status: WorkOrderStatus.DONE,
        executionEnd: new Date(),
        client: { id: 'client-789', name: 'Cliente' },
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrder.update.mockResolvedValue(mockUpdatedWorkOrder);

      const result = await service.completeWorkOrder(userId, workOrderId, dto);

      expect(result.workOrder.status).toBe(WorkOrderStatus.DONE);
      expect(result.paymentSuggestion.canGeneratePayment).toBe(true);
      expect(result.paymentSuggestion.suggestedValue).toBe(1500);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: WorkOrderStatus.DONE,
            executionEnd: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when work order already DONE', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.DONE,
        checklists: [],
      });

      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow('already completed');
    });

    it('should throw BadRequestException when work order is CANCELED', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.CANCELED,
        checklists: [],
      });

      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow('Cannot complete a canceled work order');
    });

    it('should throw BadRequestException when checklist has unanswered required items', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.IN_PROGRESS,
        checklists: [
          {
            id: 'checklist-1',
            title: 'Checklist Obrigatorio',
            template: {
              items: [
                { id: 'item-1', isRequired: true },
                { id: 'item-2', isRequired: true },
              ],
            },
            answers: [
              { templateItemId: 'item-1' }, // Only one answered
            ],
          },
        ],
      });

      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeWorkOrder(userId, workOrderId, dto),
      ).rejects.toThrow('unanswered required items');
    });

    it('should complete work order with skipChecklistValidation', async () => {
      const mockWorkOrder = {
        id: workOrderId,
        userId,
        status: WorkOrderStatus.IN_PROGRESS,
        quote: null,
        checklists: [
          {
            id: 'checklist-1',
            title: 'Checklist',
            template: { items: [{ id: 'item-1', isRequired: true }] },
            answers: [],
          },
        ],
        executionStart: new Date(),
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockPrismaService.workOrder.update.mockResolvedValue({
        ...mockWorkOrder,
        status: WorkOrderStatus.DONE,
        client: { id: 'c', name: 'C' },
      });

      const result = await service.completeWorkOrder(userId, workOrderId, {
        skipChecklistValidation: true,
      });

      expect(result.workOrder.status).toBe(WorkOrderStatus.DONE);
    });
  });

  // ============================================
  // GENERATE PAYMENT
  // ============================================

  describe('generatePayment', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';
    const dto = {
      billingType: PaymentBillingType.PIX,
      dueDate: '2025-01-20',
    };

    it('should generate payment from work order with quote', async () => {
      const mockWorkOrder = {
        id: workOrderId,
        userId,
        clientId: 'client-789',
        quoteId: 'quote-123',
        status: WorkOrderStatus.DONE,
        quote: { id: 'quote-123', totalValue: new Decimal(1500) },
        payments: [],
      };

      const mockPayment = {
        id: 'payment-001',
        asaasPaymentId: 'pay_123',
        clientId: 'client-789',
        value: 1500,
        status: PaymentStatus.PENDING,
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockClientPaymentsService.createPayment.mockResolvedValue(mockPayment);

      const result = await service.generatePayment(userId, workOrderId, dto);

      expect(result.id).toBe('payment-001');
      expect(mockClientPaymentsService.createPayment).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          clientId: 'client-789',
          workOrderId,
          quoteId: 'quote-123',
          billingType: PaymentBillingType.PIX,
          value: 1500,
          dueDate: '2025-01-20',
        }),
      );
    });

    it('should generate payment with custom value when no quote', async () => {
      const mockWorkOrder = {
        id: workOrderId,
        userId,
        clientId: 'client-789',
        quoteId: null,
        status: WorkOrderStatus.DONE,
        quote: null,
        payments: [],
      };

      const dtoWithValue = { ...dto, value: 800 };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockClientPaymentsService.createPayment.mockResolvedValue({
        id: 'payment-001',
        value: 800,
      });

      const result = await service.generatePayment(userId, workOrderId, dtoWithValue);

      expect(mockClientPaymentsService.createPayment).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ value: 800 }),
      );
    });

    it('should throw NotFoundException when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when work order is not DONE', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.IN_PROGRESS,
        payments: [],
      });

      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow('Work order must be DONE');
    });

    it('should throw BadRequestException when value missing without quote', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.DONE,
        quote: null,
        payments: [],
      });

      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow('Value is required');
    });

    it('should throw BadRequestException when pending payment exists', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        status: WorkOrderStatus.DONE,
        quote: { totalValue: new Decimal(1000) },
        payments: [
          { id: 'existing-payment', status: PaymentStatus.PENDING },
        ],
      });

      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generatePayment(userId, workOrderId, dto),
      ).rejects.toThrow('already has a pending payment');
    });
  });

  // ============================================
  // CLIENT TIMELINE
  // ============================================

  describe('getClientTimeline', () => {
    const userId = 'user-123';
    const clientId = 'client-456';

    it('should return timeline with all events sorted by date', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({
        id: clientId,
        userId,
        name: 'Cliente',
      });

      mockPrismaService.quote.findMany.mockResolvedValue([
        {
          id: 'quote-1',
          status: QuoteStatus.APPROVED,
          totalValue: new Decimal(1500),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-05'),
          items: [],
        },
      ]);

      mockPrismaService.workOrder.findMany.mockResolvedValue([
        {
          id: 'wo-1',
          title: 'OS Teste',
          status: WorkOrderStatus.DONE,
          quoteId: 'quote-1',
          createdAt: new Date('2025-01-06'),
          executionStart: new Date('2025-01-07'),
          executionEnd: new Date('2025-01-08'),
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
          createdAt: new Date('2025-01-09'),
          workOrderId: 'wo-1',
          quoteId: 'quote-1',
        },
      ]);

      const result = await service.getClientTimeline(userId, clientId);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBeDefined();
      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[0].data).toBeDefined();

      // Check events are sorted by date descending
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].date.getTime()).toBeGreaterThanOrEqual(result[i + 1].date.getTime());
      }
    });

    it('should throw ForbiddenException when client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.getClientTimeline(userId, clientId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should include all event types', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({ id: clientId, userId });
      mockPrismaService.quote.findMany.mockResolvedValue([
        {
          id: 'q1',
          status: QuoteStatus.APPROVED,
          totalValue: new Decimal(100),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-02'),
          items: [],
        },
      ]);
      mockPrismaService.workOrder.findMany.mockResolvedValue([
        {
          id: 'wo1',
          title: 'OS',
          status: WorkOrderStatus.DONE,
          quoteId: 'q1',
          createdAt: new Date('2025-01-03'),
          executionStart: new Date('2025-01-04'),
          executionEnd: new Date('2025-01-05'),
          equipments: [],
          checklists: [{ id: 'cl1', title: 'Checklist', createdAt: new Date('2025-01-04') }],
        },
      ]);
      mockPrismaService.clientPayment.findMany.mockResolvedValue([
        {
          id: 'p1',
          value: new Decimal(100),
          billingType: PaymentBillingType.PIX,
          status: PaymentStatus.RECEIVED,
          dueDate: new Date('2025-01-10'),
          paidAt: new Date('2025-01-06'),
          createdAt: new Date('2025-01-05'),
          workOrderId: 'wo1',
          quoteId: 'q1',
        },
      ]);

      const result = await service.getClientTimeline(userId, clientId);
      const eventTypes = result.map((e) => e.type);

      expect(eventTypes).toContain('QUOTE_CREATED');
      expect(eventTypes).toContain('QUOTE_APPROVED');
      expect(eventTypes).toContain('WORK_ORDER_CREATED');
      expect(eventTypes).toContain('WORK_ORDER_STARTED');
      expect(eventTypes).toContain('WORK_ORDER_COMPLETED');
      expect(eventTypes).toContain('CHECKLIST_CREATED');
      expect(eventTypes).toContain('PAYMENT_CREATED');
      expect(eventTypes).toContain('PAYMENT_CONFIRMED');
    });
  });

  // ============================================
  // WORK ORDER EXTRACT
  // ============================================

  describe('getWorkOrderExtract', () => {
    const userId = 'user-123';
    const workOrderId = 'wo-456';

    it('should return complete work order extract', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        title: 'OS Teste',
        description: 'Descricao',
        status: WorkOrderStatus.DONE,
        scheduledDate: new Date('2025-01-10'),
        executionStart: new Date('2025-01-10T09:00:00'),
        executionEnd: new Date('2025-01-10T12:00:00'),
        createdAt: new Date('2025-01-01'),
        client: {
          id: 'client-123',
          name: 'Cliente Teste',
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
              quantity: new Decimal(2),
              unitPrice: new Decimal(700),
              totalPrice: new Decimal(1400),
              item: { name: 'Servico A' },
            },
            {
              quantity: new Decimal(1),
              unitPrice: new Decimal(200),
              totalPrice: new Decimal(200),
              item: { name: 'Servico B' },
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
            id: 'checklist-1',
            title: 'Checklist Inicial',
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
              model: 'Split 12000',
            },
          },
        ],
      });

      const result = await service.getWorkOrderExtract(userId, workOrderId);

      expect(result.workOrder.id).toBe(workOrderId);
      expect(result.client.name).toBe('Cliente Teste');
      expect(result.quote?.totalValue).toBe(1500);
      expect(result.payments.length).toBe(1);
      expect(result.checklists.length).toBe(1);
      expect(result.equipments.length).toBe(1);
      expect(result.financialSummary.totalQuoted).toBe(1500);
      expect(result.financialSummary.totalPaid).toBe(1500);
      expect(result.financialSummary.balance).toBe(0);
    });

    it('should throw NotFoundException when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getWorkOrderExtract(userId, workOrderId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should calculate financial summary correctly with pending payments', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue({
        id: workOrderId,
        userId,
        title: 'OS',
        status: WorkOrderStatus.DONE,
        createdAt: new Date(),
        client: { id: 'c', name: 'C' },
        quote: {
          id: 'q',
          totalValue: new Decimal(2000),
          discountValue: new Decimal(0),
          status: QuoteStatus.APPROVED,
          items: [],
        },
        payments: [
          { id: 'p1', value: new Decimal(1000), status: PaymentStatus.RECEIVED, dueDate: new Date() },
          { id: 'p2', value: new Decimal(1000), status: PaymentStatus.PENDING, dueDate: new Date() },
        ],
        checklists: [],
        equipments: [],
      });

      const result = await service.getWorkOrderExtract(userId, workOrderId);

      expect(result.financialSummary.totalQuoted).toBe(2000);
      expect(result.financialSummary.totalPaid).toBe(1000);
      expect(result.financialSummary.totalPending).toBe(1000);
      expect(result.financialSummary.balance).toBe(1000);
    });
  });
});
