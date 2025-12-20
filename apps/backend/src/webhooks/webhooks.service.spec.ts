import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { AsaasWebhookEvent } from '../common/asaas/asaas-http.client';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let clientPaymentsService: ClientPaymentsService;

  const mockClientPaymentsService = {
    updatePaymentStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: ClientPaymentsService,
          useValue: mockClientPaymentsService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    clientPaymentsService = module.get<ClientPaymentsService>(ClientPaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleAsaasEvent', () => {
    it('should handle PAYMENT_CONFIRMED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'PIX',
          status: 'CONFIRMED',
          confirmedDate: '2025-12-15',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'pay_123',
        'CONFIRMED',
        new Date('2025-12-15'),
      );
    });

    it('should handle PAYMENT_RECEIVED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'PIX',
          status: 'RECEIVED',
          paymentDate: '2025-12-18',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'pay_123',
        'RECEIVED',
        new Date('2025-12-18'),
      );
    });

    it('should handle PAYMENT_OVERDUE event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_OVERDUE',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'BOLETO',
          status: 'OVERDUE',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'OVERDUE');
    });

    it('should handle PAYMENT_REFUNDED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_REFUNDED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'REFUNDED',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'REFUNDED');
    });

    it('should handle PAYMENT_UPDATED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_UPDATED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 150,
          dueDate: '2025-12-25',
          billingType: 'PIX',
          status: 'PENDING',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'PENDING');
    });

    it('should handle PAYMENT_CHARGEBACK_REQUESTED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_CHARGEBACK_REQUESTED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'CHARGEBACK_REQUESTED',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'pay_123',
        'CHARGEBACK_REQUESTED',
      );
    });

    it('should handle PAYMENT_AWAITING_RISK_ANALYSIS event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_AWAITING_RISK_ANALYSIS',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 500,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'AWAITING_RISK_ANALYSIS',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith(
        'pay_123',
        'AWAITING_RISK_ANALYSIS',
      );
    });

    it('should handle PAYMENT_CREATED event (log only)', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_CREATED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'PIX',
          status: 'PENDING',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle event without payment data', async () => {
      const event: AsaasWebhookEvent = {
        event: 'SOME_OTHER_EVENT',
      };

      await expect(service.handleAsaasEvent(event)).resolves.not.toThrow();
      expect(mockClientPaymentsService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should handle unrecognized event type', async () => {
      const event: AsaasWebhookEvent = {
        event: 'UNKNOWN_EVENT',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'PIX',
          status: 'PENDING',
        },
      };

      await expect(service.handleAsaasEvent(event)).resolves.not.toThrow();
    });

    it('should handle PAYMENT_DELETED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_DELETED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'PIX',
          status: 'DELETED',
          deleted: true,
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'DELETED');
    });

    it('should handle PAYMENT_AUTHORIZED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_AUTHORIZED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'AUTHORIZED',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'AUTHORIZED');
    });

    it('should handle PAYMENT_PARTIALLY_REFUNDED event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_PARTIALLY_REFUNDED',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'PARTIALLY_REFUNDED',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'PARTIALLY_REFUNDED');
    });

    it('should handle PAYMENT_REFUND_IN_PROGRESS event', async () => {
      const event: AsaasWebhookEvent = {
        event: 'PAYMENT_REFUND_IN_PROGRESS',
        payment: {
          id: 'pay_123',
          customer: 'cus_123',
          value: 100,
          dueDate: '2025-12-20',
          billingType: 'CREDIT_CARD',
          status: 'REFUND_IN_PROGRESS',
        },
      };

      await service.handleAsaasEvent(event);

      expect(mockClientPaymentsService.updatePaymentStatus).toHaveBeenCalledWith('pay_123', 'REFUND_IN_PROGRESS');
    });

    it('should handle all webhook events without errors', async () => {
      const events = [
        'PAYMENT_CREATED',
        'PAYMENT_UPDATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_REFUNDED',
        'PAYMENT_PARTIALLY_REFUNDED',
        'PAYMENT_REFUND_IN_PROGRESS',
        'PAYMENT_AUTHORIZED',
        'PAYMENT_CHARGEBACK_REQUESTED',
        'PAYMENT_CHARGEBACK_DISPUTE',
        'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
        'PAYMENT_DUNNING_REQUESTED',
        'PAYMENT_DUNNING_RECEIVED',
        'PAYMENT_AWAITING_RISK_ANALYSIS',
        'PAYMENT_DELETED',
        'PAYMENT_RESTORED',
        'PAYMENT_BANK_SLIP_VIEWED',
        'PAYMENT_CHECKOUT_VIEWED',
      ];

      for (const eventType of events) {
        const event: AsaasWebhookEvent = {
          event: eventType,
          payment: {
            id: 'pay_123',
            customer: 'cus_123',
            value: 100,
            dueDate: '2025-12-20',
            billingType: 'PIX',
            status: 'PENDING',
          },
        };

        await expect(service.handleAsaasEvent(event)).resolves.not.toThrow();
      }
    });
  });
});
