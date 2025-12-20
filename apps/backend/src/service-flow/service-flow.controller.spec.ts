import { Test, TestingModule } from '@nestjs/testing';
import { ServiceFlowController } from './service-flow.controller';
import { ServiceFlowService } from './service-flow.service';
import { PaymentBillingType, WorkOrderStatus, QuoteStatus, PaymentStatus } from '@prisma/client';

describe('ServiceFlowController', () => {
  let controller: ServiceFlowController;
  let service: ServiceFlowService;

  const mockServiceFlowService = {
    convertQuoteToWorkOrder: jest.fn(),
    completeWorkOrder: jest.fn(),
    generatePayment: jest.fn(),
    getClientTimeline: jest.fn(),
    getWorkOrderExtract: jest.fn(),
  };

  const mockRequest = {
    user: { sub: 'user-123' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceFlowController],
      providers: [
        {
          provide: ServiceFlowService,
          useValue: mockServiceFlowService,
        },
      ],
    }).compile();

    controller = module.get<ServiceFlowController>(ServiceFlowController);
    service = module.get<ServiceFlowService>(ServiceFlowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('convertToWorkOrder', () => {
    it('should convert quote to work order', async () => {
      const quoteId = 'quote-123';
      const dto = {
        title: 'Instalacao',
        description: 'Descricao',
        scheduledDate: '2025-01-15',
      };

      const expectedResult = {
        id: 'wo-001',
        userId: 'user-123',
        clientId: 'client-123',
        quoteId,
        title: dto.title,
        status: WorkOrderStatus.SCHEDULED,
      };

      mockServiceFlowService.convertQuoteToWorkOrder.mockResolvedValue(expectedResult);

      const result = await controller.convertToWorkOrder(mockRequest, quoteId, dto);

      expect(result).toEqual(expectedResult);
      expect(service.convertQuoteToWorkOrder).toHaveBeenCalledWith(
        'user-123',
        quoteId,
        dto,
      );
    });
  });

  describe('completeWorkOrder', () => {
    it('should complete work order', async () => {
      const workOrderId = 'wo-123';
      const dto = { skipChecklistValidation: false };

      const expectedResult = {
        workOrder: {
          id: workOrderId,
          status: WorkOrderStatus.DONE,
        },
        paymentSuggestion: {
          canGeneratePayment: true,
          suggestedValue: 1500,
          hasQuote: true,
          quoteId: 'quote-123',
        },
      };

      mockServiceFlowService.completeWorkOrder.mockResolvedValue(expectedResult);

      const result = await controller.completeWorkOrder(mockRequest, workOrderId, dto);

      expect(result).toEqual(expectedResult);
      expect(service.completeWorkOrder).toHaveBeenCalledWith(
        'user-123',
        workOrderId,
        dto,
      );
    });
  });

  describe('generatePayment', () => {
    it('should generate payment from work order', async () => {
      const workOrderId = 'wo-123';
      const dto = {
        billingType: PaymentBillingType.PIX,
        dueDate: '2025-01-20',
      };

      const expectedResult = {
        id: 'payment-001',
        asaasPaymentId: 'pay_123',
        value: 1500,
        status: PaymentStatus.PENDING,
        pixCode: '00020126...',
      };

      mockServiceFlowService.generatePayment.mockResolvedValue(expectedResult);

      const result = await controller.generatePayment(mockRequest, workOrderId, dto);

      expect(result).toEqual(expectedResult);
      expect(service.generatePayment).toHaveBeenCalledWith(
        'user-123',
        workOrderId,
        dto,
      );
    });
  });

  describe('getClientTimeline', () => {
    it('should return client timeline', async () => {
      const clientId = 'client-123';

      const expectedResult = [
        {
          type: 'QUOTE_CREATED',
          date: new Date('2025-01-01'),
          data: { id: 'quote-1', status: QuoteStatus.APPROVED },
        },
        {
          type: 'WORK_ORDER_CREATED',
          date: new Date('2025-01-02'),
          data: { id: 'wo-1', title: 'OS Teste' },
        },
        {
          type: 'PAYMENT_CONFIRMED',
          date: new Date('2025-01-03'),
          data: { id: 'payment-1', value: 1500 },
        },
      ];

      mockServiceFlowService.getClientTimeline.mockResolvedValue(expectedResult);

      const result = await controller.getClientTimeline(mockRequest, clientId);

      expect(result).toEqual(expectedResult);
      expect(service.getClientTimeline).toHaveBeenCalledWith('user-123', clientId);
    });
  });

  describe('getWorkOrderExtract', () => {
    it('should return work order extract', async () => {
      const workOrderId = 'wo-123';

      const expectedResult = {
        workOrder: {
          id: workOrderId,
          title: 'OS Teste',
          status: WorkOrderStatus.DONE,
        },
        client: { id: 'client-123', name: 'Cliente' },
        quote: { id: 'quote-123', totalValue: 1500 },
        payments: [{ id: 'payment-1', value: 1500, status: PaymentStatus.RECEIVED }],
        checklists: [{ id: 'checklist-1', title: 'Checklist', answersCount: 5 }],
        equipments: [{ id: 'eq-1', type: 'Ar-condicionado' }],
        financialSummary: {
          totalQuoted: 1500,
          totalPaid: 1500,
          totalPending: 0,
          balance: 0,
        },
      };

      mockServiceFlowService.getWorkOrderExtract.mockResolvedValue(expectedResult);

      const result = await controller.getWorkOrderExtract(mockRequest, workOrderId);

      expect(result).toEqual(expectedResult);
      expect(service.getWorkOrderExtract).toHaveBeenCalledWith('user-123', workOrderId);
    });
  });
});
