import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { EmailChannelService } from './channels/email-channel.service';
import { WhatsAppChannelService } from './channels/whatsapp-channel.service';

/**
 * Notifications Module
 *
 * Global module that provides notification services across the application.
 * Includes email and WhatsApp channels, template rendering, and preference management.
 */
@Global()
@Module({
  controllers: [NotificationPreferencesController],
  providers: [
    NotificationsService,
    EmailChannelService,
    WhatsAppChannelService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
