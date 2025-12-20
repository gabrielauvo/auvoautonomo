import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationsService } from './notifications.service';
import { NotificationChannel, NotificationType, NotificationStatus } from '@prisma/client';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    getOrCreatePreferences: jest.fn(),
    updatePreferences: jest.fn(),
    getNotificationLogs: jest.fn(),
    getNotificationStats: jest.fn(),
  };

  const mockPreferences = {
    id: 'pref-123',
    userId: 'user-123',
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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationPreferencesController>(NotificationPreferencesController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      mockNotificationsService.getOrCreatePreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getPreferences('user-123');

      expect(result).toEqual(mockPreferences);
      expect(mockNotificationsService.getOrCreatePreferences).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences', async () => {
      const updatedPrefs = { ...mockPreferences, notifyOnQuoteSent: false };
      mockNotificationsService.updatePreferences.mockResolvedValue(updatedPrefs);

      const result = await controller.updatePreferences('user-123', {
        notifyOnQuoteSent: false,
      });

      expect(result).toEqual(updatedPrefs);
      expect(mockNotificationsService.updatePreferences).toHaveBeenCalledWith('user-123', {
        notifyOnQuoteSent: false,
      });
    });

    it('should update multiple fields', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        notifyOnQuoteSent: false,
        defaultChannelWhatsApp: false,
      };
      mockNotificationsService.updatePreferences.mockResolvedValue(updatedPrefs);

      const result = await controller.updatePreferences('user-123', {
        notifyOnQuoteSent: false,
        defaultChannelWhatsApp: false,
      });

      expect(mockNotificationsService.updatePreferences).toHaveBeenCalledWith('user-123', {
        notifyOnQuoteSent: false,
        defaultChannelWhatsApp: false,
      });
    });
  });

  describe('getLogs', () => {
    const mockLogs = {
      data: [
        {
          id: 'log-1',
          userId: 'user-123',
          channel: NotificationChannel.EMAIL,
          type: NotificationType.QUOTE_SENT,
          recipient: 'client@test.com',
          body: 'Test message',
          status: NotificationStatus.SENT,
          createdAt: new Date(),
          client: { id: 'client-1', name: 'Client 1' },
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };

    it('should return paginated logs', async () => {
      mockNotificationsService.getNotificationLogs.mockResolvedValue(mockLogs);

      const result = await controller.getLogs('user-123', { page: 1, limit: 20 });

      expect(result).toEqual(mockLogs);
      expect(mockNotificationsService.getNotificationLogs).toHaveBeenCalledWith('user-123', {
        clientId: undefined,
        type: undefined,
        channel: undefined,
        status: undefined,
        startDate: undefined,
        endDate: undefined,
        page: 1,
        limit: 20,
      });
    });

    it('should pass filters to service', async () => {
      mockNotificationsService.getNotificationLogs.mockResolvedValue(mockLogs);

      await controller.getLogs('user-123', {
        clientId: 'client-123',
        type: NotificationType.QUOTE_SENT,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
        page: 2,
        limit: 50,
      });

      expect(mockNotificationsService.getNotificationLogs).toHaveBeenCalledWith('user-123', {
        clientId: 'client-123',
        type: NotificationType.QUOTE_SENT,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SENT,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        page: 2,
        limit: 50,
      });
    });
  });

  describe('getStats', () => {
    const mockStats = {
      totalSent: 100,
      totalFailed: 5,
      successRate: 95,
      byChannel: { EMAIL: 60, WHATSAPP: 45 },
      byType: { QUOTE_SENT: 30, PAYMENT_CREATED: 25 },
      last7Days: 50,
    };

    it('should return notification statistics', async () => {
      mockNotificationsService.getNotificationStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('user-123');

      expect(result).toEqual(mockStats);
      expect(mockNotificationsService.getNotificationStats).toHaveBeenCalledWith('user-123');
    });
  });
});
