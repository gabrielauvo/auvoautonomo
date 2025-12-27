import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { EmailChannelService } from './channels/email-channel.service';
import { WhatsAppChannelService } from './channels/whatsapp-channel.service';
import { ZApiService } from './channels/zapi.service';

/**
 * Notifications Module
 *
 * Global module that provides notification services across the application.
 * Includes email and WhatsApp channels, template rendering, and preference management.
 * Z-API integration for WhatsApp (BYOC - each user configures their own credentials).
 */
@Global()
@Module({
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [
    NotificationsService,
    EmailChannelService,
    WhatsAppChannelService,
    ZApiService,
  ],
  exports: [NotificationsService, ZApiService],
})
export class NotificationsModule {}
