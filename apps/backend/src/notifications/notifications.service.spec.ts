import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannelService } from './channels/email-channel.service';
import { WhatsAppChannelService } from './channels/whatsapp-channel.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { NotificationType, NotificationChannel, NotificationStatus } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  let emailChannel: EmailChannelService;
  let whatsAppChannel: WhatsAppChannelService;

  const mockPrisma = {
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notificationLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockEmailChannel = {
    channel: NotificationChannel.EMAIL,
    send: jest.fn(),
    validateRecipient: jest.fn(),
  };

  const mockWhatsAppChannel = {
    channel: NotificationChannel.WHATSAPP,
    send: jest.fn(),
    validateRecipient: jest.fn(),
  };

  const mockPlanLimitsService = {
    checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailChannelService, useValue: mockEmailChannel },
        { provide: WhatsAppChannelService, useValue: mockWhatsAppChannel },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
    emailChannel = module.get<EmailChannelService>(EmailChannelService);
    whatsAppChannel = module.get<WhatsAppChannelService>(WhatsAppChannelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreatePreferences', () => {
    const userId = 'user-123';
    const mockPreferences = {
      id: 'pref-123',
      userId,
      notifyOnQuoteSent: true,
      notifyOnQuoteApproved: true,
      notifyOnWorkOrderCreated: true,
      notifyOnWorkOrderCompleted: true,
      notifyOnPaymentCreated: true,
      notifyOnPaymentConfirmed: true,
      notifyOnPaymentOverdue: true,
      defaultChannelEmail: true,
      defaultChannelWhatsApp: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return existing preferences', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(mockPreferences);

      const result = await service.getOrCreatePreferences(userId);

      expect(result).toEqual(mockPreferences);
      expect(mockPrisma.notificationPreference.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockPrisma.notificationPreference.create).not.toHaveBeenCalled();
    });

    it('should create preferences if not found', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
      mockPrisma.notificationPreference.create.mockResolvedValue(mockPreferences);

      const result = await service.getOrCreatePreferences(userId);

      expect(result).toEqual(mockPreferences);
      expect(mockPrisma.notificationPreference.create).toHaveBeenCalledWith({
        data: { userId },
      });
    });
  });

  describe('updatePreferences', () => {
    const userId = 'user-123';
    const mockPreferences = {
      id: 'pref-123',
      userId,
      notifyOnQuoteSent: false,
      defaultChannelEmail: true,
      defaultChannelWhatsApp: false,
    };

    it('should update preferences', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({ id: 'pref-123' });
      mockPrisma.notificationPreference.update.mockResolvedValue(mockPreferences);

      const result = await service.updatePreferences(userId, {
        notifyOnQuoteSent: false,
        defaultChannelWhatsApp: false,
      });

      expect(mockPrisma.notificationPreference.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          notifyOnQuoteSent: false,
          defaultChannelWhatsApp: false,
        },
      });
    });
  });

  describe('sendNotification', () => {
    const userId = 'user-123';
    const mockPreferences = {
      id: 'pref-123',
      userId,
      notifyOnQuoteSent: true,
      notifyOnQuoteApproved: true,
      notifyOnWorkOrderCreated: true,
      notifyOnWorkOrderCompleted: true,
      notifyOnPaymentCreated: true,
      notifyOnPaymentConfirmed: true,
      notifyOnPaymentOverdue: true,
      defaultChannelEmail: true,
      defaultChannelWhatsApp: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const quoteContext = {
      clientName: 'Test Client',
      clientEmail: 'client@test.com',
      clientPhone: '11999999999',
      quoteId: 'quote-123',
      quoteNumber: 'QUOTE123',
      totalValue: 1000,
    };

    beforeEach(() => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue(mockPreferences);
      mockEmailChannel.send.mockResolvedValue({ success: true, messageId: 'email-123' });
      mockWhatsAppChannel.send.mockResolvedValue({ success: true, messageId: 'whatsapp-123' });
      mockPrisma.notificationLog.create.mockResolvedValue({});
    });

    it('should send notifications via both channels', async () => {
      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      expect(mockEmailChannel.send).toHaveBeenCalled();
      expect(mockWhatsAppChannel.send).toHaveBeenCalled();
      expect(result.email).toEqual({ success: true, messageId: 'email-123' });
      expect(result.whatsapp).toEqual({ success: true, messageId: 'whatsapp-123' });
    });

    it('should not send if notification type is disabled', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        notifyOnQuoteSent: false,
      });

      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      expect(mockEmailChannel.send).not.toHaveBeenCalled();
      expect(mockWhatsAppChannel.send).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should only send email if WhatsApp is disabled', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        defaultChannelWhatsApp: false,
      });

      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      expect(mockEmailChannel.send).toHaveBeenCalled();
      expect(mockWhatsAppChannel.send).not.toHaveBeenCalled();
      expect(result.email).toEqual({ success: true, messageId: 'email-123' });
      expect(result.whatsapp).toBeUndefined();
    });

    it('should only send WhatsApp if Email is disabled', async () => {
      mockPrisma.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        defaultChannelEmail: false,
      });

      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      expect(mockEmailChannel.send).not.toHaveBeenCalled();
      expect(mockWhatsAppChannel.send).toHaveBeenCalled();
      expect(result.email).toBeUndefined();
      expect(result.whatsapp).toEqual({ success: true, messageId: 'whatsapp-123' });
    });

    it('should not send if no contact info provided', async () => {
      const contextWithoutContact = {
        clientName: 'Test Client',
        quoteId: 'quote-123',
        quoteNumber: 'QUOTE123',
        totalValue: 1000,
      };

      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: contextWithoutContact as any,
      });

      expect(mockEmailChannel.send).not.toHaveBeenCalled();
      expect(mockWhatsAppChannel.send).not.toHaveBeenCalled();
    });

    it('should log notifications to database', async () => {
      await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      // Should log both email and WhatsApp
      expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(2);
    });

    it('should handle channel errors gracefully', async () => {
      mockEmailChannel.send.mockResolvedValue({ success: false, error: 'SMTP error' });
      mockWhatsAppChannel.send.mockResolvedValue({ success: true, messageId: 'whatsapp-123' });

      const result = await service.sendNotification({
        userId,
        clientId: 'client-123',
        quoteId: 'quote-123',
        type: NotificationType.QUOTE_SENT,
        contextData: quoteContext,
      });

      expect(result.email).toEqual({ success: false, error: 'SMTP error' });
      expect(result.whatsapp).toEqual({ success: true, messageId: 'whatsapp-123' });
    });
  });

  describe('getNotificationLogs', () => {
    const userId = 'user-123';
    const mockLogs = [
      {
        id: 'log-1',
        userId,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.QUOTE_SENT,
        recipient: 'client@test.com',
        body: 'Test message',
        status: NotificationStatus.SENT,
        createdAt: new Date(),
        client: { id: 'client-1', name: 'Client 1' },
      },
    ];

    it('should return paginated logs', async () => {
      mockPrisma.notificationLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.notificationLog.count.mockResolvedValue(1);

      const result = await service.getNotificationLogs(userId, { page: 1, limit: 20 });

      expect(result.data).toEqual(mockLogs);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply filters', async () => {
      mockPrisma.notificationLog.findMany.mockResolvedValue([]);
      mockPrisma.notificationLog.count.mockResolvedValue(0);

      await service.getNotificationLogs(userId, {
        clientId: 'client-123',
        type: NotificationType.QUOTE_SENT,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
      });

      expect(mockPrisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            clientId: 'client-123',
            type: NotificationType.QUOTE_SENT,
            channel: NotificationChannel.EMAIL,
            status: NotificationStatus.SENT,
          }),
        }),
      );
    });
  });

  describe('getNotificationStats', () => {
    const userId = 'user-123';

    it('should return notification statistics', async () => {
      mockPrisma.notificationLog.count
        .mockResolvedValueOnce(100) // totalSent
        .mockResolvedValueOnce(5)   // totalFailed
        .mockResolvedValueOnce(50); // last7Days

      mockPrisma.notificationLog.groupBy
        .mockResolvedValueOnce([
          { channel: 'EMAIL', _count: { id: 60 } },
          { channel: 'WHATSAPP', _count: { id: 45 } },
        ])
        .mockResolvedValueOnce([
          { type: 'QUOTE_SENT', _count: { id: 30 } },
          { type: 'PAYMENT_CREATED', _count: { id: 25 } },
        ]);

      const result = await service.getNotificationStats(userId);

      expect(result.totalSent).toBe(100);
      expect(result.totalFailed).toBe(5);
      expect(result.successRate).toBe(95);
      expect(result.byChannel).toEqual({ EMAIL: 60, WHATSAPP: 45 });
      expect(result.byType).toEqual({ QUOTE_SENT: 30, PAYMENT_CREATED: 25 });
      expect(result.last7Days).toBe(50);
    });
  });
});
