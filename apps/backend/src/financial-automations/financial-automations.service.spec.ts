import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAutomationsService } from './financial-automations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AsaasIntegrationService } from '../asaas-integration/asaas-integration.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { PaymentStatus, QuoteStatus, NotificationType } from '@prisma/client';

describe('FinancialAutomationsService', () => {
  let service: FinancialAutomationsService;
  let prismaService: PrismaService;
  let notificationsService: NotificationsService;
  let asaasIntegrationService: AsaasIntegrationService;
  let asaasClient: AsaasHttpClient;

  const mockPrismaService = {
    financialAutomationSettings: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clientPayment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
    },
    notificationLog: {
      findFirst: jest.fn(),
    },
  };

  const mockNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockAsaasIntegrationService = {
    getApiKey: jest.fn(),
  };

  const mockAsaasClient = {
    deletePayment: jest.fn(),
  };

  const mockSettings = {
    id: 'settings-1',
    userId: 'user-1',
    isEnabled: true,
    paymentReminderDaysBefore: [3, 1],
    paymentReminderDaysAfter: [3, 7],
    autoMarkOverdueAsDelinquentAfterDays: 30,
    enableQuoteFollowUp: true,
    quoteFollowUpDays: [3, 7],
    autoCancelPaymentAfterDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', email: 'test@test.com' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAutomationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AsaasIntegrationService, useValue: mockAsaasIntegrationService },
        { provide: AsaasHttpClient, useValue: mockAsaasClient },
      ],
    }).compile();

    service = module.get<FinancialAutomationsService>(FinancialAutomationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(NotificationsService);
    asaasIntegrationService = module.get<AsaasIntegrationService>(AsaasIntegrationService);
    asaasClient = module.get<AsaasHttpClient>(AsaasHttpClient);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateSettings', () => {
    it('should return existing settings', async () => {
      mockPrismaService.financialAutomationSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.getOrCreateSettings('user-1');

      expect(result).toEqual(mockSettings);
      expect(mockPrismaService.financialAutomationSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should create default settings if not exists', async () => {
      mockPrismaService.financialAutomationSettings.findUnique.mockResolvedValue(null);
      mockPrismaService.financialAutomationSettings.create.mockResolvedValue(mockSettings);

      const result = await service.getOrCreateSettings('user-1');

      expect(result).toEqual(mockSettings);
      expect(mockPrismaService.financialAutomationSettings.create).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update settings with sanitized arrays', async () => {
      mockPrismaService.financialAutomationSettings.findUnique.mockResolvedValue(mockSettings);
      mockPrismaService.financialAutomationSettings.update.mockResolvedValue({
        ...mockSettings,
        paymentReminderDaysBefore: [5, 2],
      });

      const result = await service.updateSettings('user-1', {
        paymentReminderDaysBefore: [2, 5, 2], // Duplicates and unsorted
      });

      expect(mockPrismaService.financialAutomationSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          paymentReminderDaysBefore: [5, 2], // Deduplicated and sorted desc
        },
      });
    });
  });

  describe('runDailyAutomations', () => {
    it('should process all users with active automations', async () => {
      mockPrismaService.financialAutomationSettings.findMany.mockResolvedValue([mockSettings]);
      mockPrismaService.clientPayment.findMany.mockResolvedValue([]);
      mockPrismaService.client.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.runDailyAutomations();

      expect(result.usersProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockPrismaService.financialAutomationSettings.findMany).toHaveBeenCalledWith({
        where: { isEnabled: true },
        include: { user: { select: { id: true, email: true } } },
      });
    });

    it('should return empty results when no active users', async () => {
      mockPrismaService.financialAutomationSettings.findMany.mockResolvedValue([]);

      const result = await service.runDailyAutomations();

      expect(result.usersProcessed).toBe(0);
      expect(result.results.paymentRemindersBeforeDue.processed).toBe(0);
    });
  });

  describe('processPaymentRemindersBeforeDue', () => {
    const mockPayment = {
      id: 'payment-1',
      userId: 'user-1',
      asaasPaymentId: 'asaas-pay-1',
      value: 100,
      dueDate: new Date(),
      asaasInvoiceUrl: 'https://pay.link',
      asaasPixCode: 'PIX123',
      client: { id: 'client-1', name: 'Client 1', email: 'client@test.com', phone: '11999999999' },
      workOrder: { id: 'wo-1' },
      quote: null,
    };

    it('should send reminders for eligible payments', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.notificationLog.findFirst.mockResolvedValue(null);
      mockNotificationsService.sendNotification.mockResolvedValue({});

      const result = await service.processPaymentRemindersBeforeDue(mockSettings as any);

      expect(result.processed).toBeGreaterThan(0);
      expect(mockNotificationsService.sendNotification).toHaveBeenCalled();
    });

    it('should skip already notified payments', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([mockPayment]);
      mockPrismaService.notificationLog.findFirst.mockResolvedValue({ id: 'existing-log' });

      const result = await service.processPaymentRemindersBeforeDue(mockSettings as any);

      expect(mockNotificationsService.sendNotification).not.toHaveBeenCalled();
    });

    it('should return zero stats when no reminder days configured', async () => {
      const settingsNoReminders = { ...mockSettings, paymentReminderDaysBefore: [] };

      const result = await service.processPaymentRemindersBeforeDue(settingsNoReminders as any);

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('processPaymentRemindersAfterDue', () => {
    const mockOverduePayment = {
      id: 'payment-overdue',
      userId: 'user-1',
      asaasPaymentId: 'asaas-pay-2',
      value: 200,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      status: PaymentStatus.OVERDUE,
      asaasInvoiceUrl: 'https://pay.link',
      client: { id: 'client-1', name: 'Client 1', email: 'client@test.com', phone: '11999999999' },
      workOrder: null,
      quote: { id: 'quote-1' },
    };

    it('should send overdue reminders', async () => {
      mockPrismaService.clientPayment.findMany.mockResolvedValue([mockOverduePayment]);
      mockPrismaService.notificationLog.findFirst.mockResolvedValue(null);
      mockNotificationsService.sendNotification.mockResolvedValue({});

      const result = await service.processPaymentRemindersAfterDue(mockSettings as any);

      expect(result.processed).toBeGreaterThan(0);
    });
  });

  describe('processDelinquentClients', () => {
    const mockClientWithOverdue = {
      id: 'client-delinquent',
      name: 'Delinquent Client',
      isDelinquent: false,
      payments: [
        { id: 'pay-1', value: 100, dueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
      ],
    };

    it('should mark clients as delinquent', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([mockClientWithOverdue]);
      mockPrismaService.client.update.mockResolvedValue({ ...mockClientWithOverdue, isDelinquent: true });

      const result = await service.processDelinquentClients(mockSettings as any);

      expect(result.successful).toBe(1);
      expect(mockPrismaService.client.update).toHaveBeenCalledWith({
        where: { id: 'client-delinquent' },
        data: { isDelinquent: true, delinquentAt: expect.any(Date) },
      });
    });

    it('should skip when no threshold configured', async () => {
      const settingsNoThreshold = { ...mockSettings, autoMarkOverdueAsDelinquentAfterDays: null };

      const result = await service.processDelinquentClients(settingsNoThreshold as any);

      expect(result.processed).toBe(0);
      expect(mockPrismaService.client.findMany).not.toHaveBeenCalled();
    });
  });

  describe('processQuoteFollowUps', () => {
    const mockQuote = {
      id: 'quote-1',
      userId: 'user-1',
      totalValue: 1500,
      status: QuoteStatus.SENT,
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      client: { id: 'client-1', name: 'Client 1', email: 'client@test.com', phone: '11999999999' },
    };

    it('should send follow-ups for unanswered quotes', async () => {
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuote]);
      mockPrismaService.notificationLog.findFirst.mockResolvedValue(null);
      mockNotificationsService.sendNotification.mockResolvedValue({});

      const result = await service.processQuoteFollowUps(mockSettings as any);

      expect(result.processed).toBeGreaterThan(0);
      expect(mockNotificationsService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: NotificationType.QUOTE_FOLLOW_UP,
        }),
      );
    });

    it('should skip when follow-ups disabled', async () => {
      const settingsNoFollowUp = { ...mockSettings, enableQuoteFollowUp: false };

      const result = await service.processQuoteFollowUps(settingsNoFollowUp as any);

      expect(result.processed).toBe(0);
    });
  });

  describe('processAutoCancelPayments', () => {
    const mockOldOverduePayment = {
      id: 'payment-old',
      asaasPaymentId: 'asaas-pay-old',
      value: 300,
      dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      status: PaymentStatus.OVERDUE,
    };

    it('should cancel old overdue payments', async () => {
      const settingsWithAutoCancel = { ...mockSettings, autoCancelPaymentAfterDays: 45 };
      mockPrismaService.clientPayment.findMany.mockResolvedValue([mockOldOverduePayment]);
      mockAsaasIntegrationService.getApiKey.mockResolvedValue({
        apiKey: 'test-key',
        environment: 'SANDBOX',
      });
      mockAsaasClient.deletePayment.mockResolvedValue(undefined);
      mockPrismaService.clientPayment.update.mockResolvedValue({
        ...mockOldOverduePayment,
        status: PaymentStatus.DELETED,
      });

      const result = await service.processAutoCancelPayments(settingsWithAutoCancel as any);

      expect(result.successful).toBe(1);
      expect(mockAsaasClient.deletePayment).toHaveBeenCalled();
      expect(mockPrismaService.clientPayment.update).toHaveBeenCalledWith({
        where: { id: 'payment-old' },
        data: { status: PaymentStatus.DELETED, canceledAt: expect.any(Date) },
      });
    });

    it('should skip when auto-cancel not configured', async () => {
      const result = await service.processAutoCancelPayments(mockSettings as any);

      expect(result.processed).toBe(0);
      expect(mockPrismaService.clientPayment.findMany).not.toHaveBeenCalled();
    });

    it('should continue even if Asaas fails', async () => {
      const settingsWithAutoCancel = { ...mockSettings, autoCancelPaymentAfterDays: 45 };
      mockPrismaService.clientPayment.findMany.mockResolvedValue([mockOldOverduePayment]);
      mockAsaasIntegrationService.getApiKey.mockRejectedValue(new Error('No integration'));
      mockPrismaService.clientPayment.update.mockResolvedValue({
        ...mockOldOverduePayment,
        status: PaymentStatus.DELETED,
      });

      const result = await service.processAutoCancelPayments(settingsWithAutoCancel as any);

      // Should still update local status even if Asaas fails
      expect(result.successful).toBe(1);
      expect(mockPrismaService.clientPayment.update).toHaveBeenCalled();
    });
  });
});
