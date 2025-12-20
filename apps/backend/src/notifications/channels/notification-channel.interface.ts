import {
  NotificationChannel,
  NotificationMessage,
  NotificationResult,
} from '../notifications.types';

/**
 * Interface for notification channels
 *
 * All channel implementations must implement this interface
 */
export abstract class NotificationChannelBase {
  abstract readonly channel: NotificationChannel;

  /**
   * Send a notification through this channel
   */
  abstract send(message: NotificationMessage): Promise<NotificationResult>;

  /**
   * Validate the recipient format
   */
  abstract validateRecipient(recipient: string): boolean;

  /**
   * Get the channel name
   */
  getChannelName(): string {
    return this.channel;
  }
}
