import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationMessage,
  NotificationResult,
} from '../notifications.types';
import { NotificationChannelBase } from './notification-channel.interface';

/**
 * WhatsApp Channel Service
 *
 * Handles sending notifications via WhatsApp/SMS.
 * Currently implements a mock/stub that logs to console.
 * Can be replaced with real providers like Twilio, Gupshup, MessageBird, etc.
 */
@Injectable()
export class WhatsAppChannelService extends NotificationChannelBase {
  private readonly logger = new Logger(WhatsAppChannelService.name);
  readonly channel = NotificationChannel.WHATSAPP;

  /**
   * Send WhatsApp/SMS notification
   *
   * In production, replace this with actual provider integration
   * (Twilio, Gupshup, MessageBird, etc.)
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      // Validate recipient
      if (!this.validateRecipient(message.to)) {
        return {
          success: false,
          error: `Invalid phone number: ${message.to}`,
        };
      }

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(message.to);

      // Log the WhatsApp message (mock implementation - only detailed in development)
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log('========================================');
        this.logger.log('📱 WHATSAPP NOTIFICATION (MOCK)');
        this.logger.log('========================================');
        this.logger.log(`To: ${this.maskPhone(normalizedPhone)}`);
        this.logger.log('----------------------------------------');
        this.logger.log(`Message: [${message.body.length} characters]`);
        this.logger.log('========================================');
      } else {
        this.logger.debug(`Sending WhatsApp to ${this.maskPhone(normalizedPhone)}`);
      }

      // In production, this would be something like:
      // const result = await this.twilio.messages.create({
      //   from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      //   to: `whatsapp:${normalizedPhone}`,
      //   body: message.body,
      // });

      // Or for SMS:
      // const result = await this.twilio.messages.create({
      //   from: process.env.TWILIO_SMS_NUMBER,
      //   to: normalizedPhone,
      //   body: message.body,
      // });

      // Simulate async operation
      await this.simulateNetworkDelay();

      // Generate mock message ID
      const messageId = `whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`WhatsApp message sent successfully. MessageId: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send WhatsApp message: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate phone number format
   */
  validateRecipient(phone: string): boolean {
    if (!phone) return false;

    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // Brazilian phone numbers: 10-11 digits (with DDD)
    // International: 11-15 digits (with country code)
    return digits.length >= 10 && digits.length <= 15;
  }

  /**
   * Normalize phone number to E.164 format
   */
  normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // If Brazilian number without country code, add +55
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }

    return '+' + digits;
  }

  /**
   * Simulate network delay for mock implementation
   */
  private async simulateNetworkDelay(): Promise<void> {
    // Simulate 100-500ms delay
    const delay = Math.random() * 400 + 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Mask phone number for logging (privacy)
   * e.g., "+5511999999999" -> "+55119****9999"
   */
  private maskPhone(phone: string): string {
    if (phone.length < 8) return '****';
    return phone.substring(0, 6) + '****' + phone.substring(phone.length - 4);
  }
}
