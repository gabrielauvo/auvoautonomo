import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus } from '@prisma/client';

/**
 * Notifications Controller
 *
 * Endpoints for web notifications:
 * - List notifications with pagination
 * - Get unread count
 * - Mark as read (single or all)
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /notifications
   * List user notifications with pagination
   */
  @Get()
  async listNotifications(
    @CurrentUser('id') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('unreadOnly') unreadOnly: string = 'false',
  ) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const onlyUnread = unreadOnly === 'true';

    const where = {
      userId,
      status: NotificationStatus.SENT,
      ...(onlyUnread && { readAt: null }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        select: {
          id: true,
          type: true,
          channel: true,
          subject: true,
          body: true,
          payload: true,
          readAt: true,
          createdAt: true,
          client: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.count({
        where: { userId, status: NotificationStatus.SENT, readAt: null },
      }),
    ]);

    return {
      data: notifications.map((n) => ({
        ...n,
        isRead: !!n.readAt,
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        unreadCount,
      },
    };
  }

  /**
   * GET /notifications/unread-count
   * Get count of unread notifications (lightweight endpoint for polling)
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.prisma.notificationLog.count({
      where: {
        userId,
        status: NotificationStatus.SENT,
        readAt: null,
      },
    });

    return { unreadCount: count };
  }

  /**
   * PATCH /notifications/:id/read
   * Mark single notification as read
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    const notification = await this.prisma.notificationLog.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return { success: false, message: 'Notification not found' };
    }

    if (notification.readAt) {
      return { success: true, message: 'Already read' };
    }

    await this.prisma.notificationLog.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  /**
   * POST /notifications/mark-all-read
   * Mark all notifications as read
   */
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser('id') userId: string) {
    const result = await this.prisma.notificationLog.updateMany({
      where: {
        userId,
        status: NotificationStatus.SENT,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { success: true, count: result.count };
  }
}
