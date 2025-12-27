import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import {
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  NotificationPreferences,
} from '@prisma/client';
import {
  SendNotificationRequest,
  NotificationResult,
  NotificationMessage,
  NOTIFICATION_TYPE_PREFERENCE_MAP,
} from './notifications.types';
import { renderTemplate } from './templates/notification-templates';
import { EmailChannelService } from './channels/email-channel.service';
import { WhatsAppChannelService } from './channels/whatsapp-channel.service';
import { ZApiService } from './channels/zapi.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannelService,
    private readonly whatsAppChannel: WhatsAppChannelService,
    private readonly planLimitsService: PlanLimitsService,
    private readonly zapiService: ZApiService,
  ) {}

  /**
   * Send notification based on user preferences
   *
   * This is the main entry point for sending notifications.
   * It resolves preferences, renders templates, and dispatches to channels.
   */
  async sendNotification(request: SendNotificationRequest): Promise<{
    email?: NotificationResult;
    whatsapp?: NotificationResult;
  }> {
    const { userId, type, contextData } = request;
    const results: { email?: NotificationResult; whatsapp?: NotificationResult } = {};

    try {
      // Check notification limit before sending
      const limitCheck = await this.planLimitsService.checkLimit({
        userId,
        resource: 'NOTIFICATION',
      });

      if (!limitCheck.allowed) {
        this.logger.warn(
          `Notification limit reached for user ${userId}: ${limitCheck.current}/${limitCheck.max}`,
        );
        return results; // Silently skip - don't fail the calling operation
      }

      // Get user preferences
      const preferences = await this.getOrCreatePreferences(userId);

      // Check if this notification type is enabled
      const preferenceKey = NOTIFICATION_TYPE_PREFERENCE_MAP[type] as keyof NotificationPreferences;
      if (!preferences[preferenceKey]) {
        this.logger.debug(
          `Notification type ${type} is disabled for user ${userId}`,
        );
        return results;
      }

      // Render template
      const template = renderTemplate(type, contextData);

      // Extract recipient info from context
      const clientEmail = 'clientEmail' in contextData ? contextData.clientEmail : undefined;
      const clientPhone = 'clientPhone' in contextData ? contextData.clientPhone : undefined;

      // Send via enabled channels
      const channelPromises: Promise<void>[] = [];

      // Email channel
      if (preferences.defaultChannelEmail && clientEmail) {
        channelPromises.push(
          this.sendViaChannel(
            NotificationChannel.EMAIL,
            {
              to: clientEmail,
              subject: template.subject,
              body: template.body,
              htmlBody: template.htmlBody,
            },
            request,
          ).then((result) => {
            results.email = result;
          }),
        );
      }

      // WhatsApp channel
      if (preferences.defaultChannelWhatsApp && clientPhone) {
        channelPromises.push(
          this.sendViaChannel(
            NotificationChannel.WHATSAPP,
            {
              to: clientPhone,
              body: template.body,
            },
            request,
          ).then((result) => {
            results.whatsapp = result;
          }),
        );
      }

      await Promise.all(channelPromises);

      return results;
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    message: NotificationMessage,
    request: SendNotificationRequest,
  ): Promise<NotificationResult> {
    let result: NotificationResult;

    try {
      // Select channel service
      switch (channel) {
        case NotificationChannel.EMAIL:
          result = await this.emailChannel.send(message);
          break;
        case NotificationChannel.WHATSAPP:
          // Configure Z-API credentials for this user before sending
          try {
            const zapiCredentials = await this.zapiService.getCredentials(request.userId);
            this.whatsAppChannel.setUserContext(zapiCredentials);
            result = await this.whatsAppChannel.send(message);
          } finally {
            // Always clear the context after sending
            this.whatsAppChannel.clearUserContext();
          }
          break;
        default:
          result = { success: false, error: `Unknown channel: ${channel}` };
      }

      // Log notification
      await this.logNotification({
        userId: request.userId,
        clientId: request.clientId,
        workOrderId: request.workOrderId,
        quoteId: request.quoteId,
        clientPaymentId: request.clientPaymentId,
        channel,
        type: request.type,
        recipient: message.to,
        subject: message.subject,
        body: message.body,
        payload: request.contextData as object,
        status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        errorMessage: result.error,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed notification
      await this.logNotification({
        userId: request.userId,
        clientId: request.clientId,
        workOrderId: request.workOrderId,
        quoteId: request.quoteId,
        clientPaymentId: request.clientPaymentId,
        channel,
        type: request.type,
        recipient: message.to,
        subject: message.subject,
        body: message.body,
        payload: request.contextData as object,
        status: NotificationStatus.FAILED,
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Log notification to database
   */
  private async logNotification(data: {
    userId: string;
    clientId?: string;
    workOrderId?: string;
    quoteId?: string;
    clientPaymentId?: string;
    channel: NotificationChannel;
    type: NotificationType;
    recipient: string;
    subject?: string;
    body: string;
    payload?: object;
    status: NotificationStatus;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.notificationLog.create({
        data: {
          userId: data.userId,
          clientId: data.clientId || null,
          workOrderId: data.workOrderId || null,
          quoteId: data.quoteId || null,
          clientPaymentId: data.clientPaymentId || null,
          channel: data.channel,
          type: data.type,
          recipient: data.recipient,
          subject: data.subject || null,
          body: data.body,
          payload: data.payload || undefined,
          status: data.status,
          errorMessage: data.errorMessage || null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get or create user notification preferences
   */
  async getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.prisma.notificationPreferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await this.prisma.notificationPreferences.create({
        data: { userId },
      });
    }

    return preferences;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    data: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<NotificationPreferences> {
    // Ensure preferences exist
    await this.getOrCreatePreferences(userId);

    return this.prisma.notificationPreferences.update({
      where: { userId },
      data,
    });
  }

  /**
   * Get notification logs for a user
   */
  async getNotificationLogs(
    userId: string,
    options?: {
      clientId?: string;
      type?: NotificationType;
      channel?: NotificationChannel;
      status?: NotificationStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    const {
      clientId,
      type,
      channel,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options || {};

    const where = {
      userId,
      ...(clientId && { clientId }),
      ...(type && { type }),
      ...(channel && { channel }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          client: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string) {
    const [
      totalSent,
      totalFailed,
      byChannel,
      byType,
      last7Days,
    ] = await Promise.all([
      // Total sent
      this.prisma.notificationLog.count({
        where: { userId, status: NotificationStatus.SENT },
      }),
      // Total failed
      this.prisma.notificationLog.count({
        where: { userId, status: NotificationStatus.FAILED },
      }),
      // By channel
      this.prisma.notificationLog.groupBy({
        by: ['channel'],
        where: { userId },
        _count: { id: true },
      }),
      // By type
      this.prisma.notificationLog.groupBy({
        by: ['type'],
        where: { userId },
        _count: { id: true },
      }),
      // Last 7 days
      this.prisma.notificationLog.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalSent,
      totalFailed,
      successRate: totalSent + totalFailed > 0
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
        : 0,
      byChannel: byChannel.reduce(
        (acc, item) => ({ ...acc, [item.channel]: item._count.id }),
        {} as Record<string, number>,
      ),
      byType: byType.reduce(
        (acc, item) => ({ ...acc, [item.type]: item._count.id }),
        {} as Record<string, number>,
      ),
      last7Days,
    };
  }
}
