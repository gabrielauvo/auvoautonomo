import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationMessage,
  NotificationResult,
} from '../notifications.types';
import { NotificationChannelBase } from './notification-channel.interface';
import { ZApiService, ZApiCredentials } from './zapi.service';

/**
 * WhatsApp Channel Service
 *
 * Handles sending notifications via WhatsApp.
 * Uses Z-API when user has configured their credentials,
 * otherwise falls back to mock implementation (logs only).
 */
@Injectable()
export class WhatsAppChannelService extends NotificationChannelBase {
  private readonly logger = new Logger(WhatsAppChannelService.name);
  readonly channel = NotificationChannel.WHATSAPP;

  // Store credentials for Z-API (set before calling send)
  private zapiCredentials: ZApiCredentials | null = null;

  constructor(private readonly zapiService: ZApiService) {
    super();
  }

  /**
   * Set the user context for sending messages
   * Must be called before send() to enable Z-API integration
   */
  setUserContext(credentials: ZApiCredentials | null): void {
    this.zapiCredentials = credentials;
  }

  /**
   * Clear user context after sending
   */
  clearUserContext(): void {
    this.zapiCredentials = null;
  }

  /**
   * Send WhatsApp notification
   *
   * Uses Z-API if credentials are available, otherwise falls back to mock
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

      // Check if Z-API is configured
      if (this.zapiCredentials) {
        return await this.sendViaZApi(normalizedPhone, message.body);
      }

      // Fall back to mock implementation
      return await this.sendMock(normalizedPhone, message.body);
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
   * Send message via Z-API
   */
  private async sendViaZApi(phone: string, body: string): Promise<NotificationResult> {
    if (!this.zapiCredentials) {
      return {
        success: false,
        error: 'Z-API credentials not configured',
      };
    }

    this.logger.log(`Sending WhatsApp via Z-API to ${this.maskPhone(phone)}`);

    const result = await this.zapiService.sendText(this.zapiCredentials, {
      phone,
      message: body,
      delayTyping: 2, // Show typing indicator for 2 seconds
    });

    if (result.success) {
      this.logger.log(`Z-API message sent successfully. MessageId: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
      };
    }

    this.logger.error(`Z-API send failed: ${result.error}`);
    return {
      success: false,
      error: result.error,
    };
  }

  /**
   * Mock implementation - logs message to console
   */
  private async sendMock(phone: string, body: string): Promise<NotificationResult> {
    // Log the WhatsApp message (mock implementation - only detailed in development)
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log('========================================');
      this.logger.log('📱 WHATSAPP NOTIFICATION (MOCK)');
      this.logger.log('========================================');
      this.logger.log(`To: ${this.maskPhone(phone)}`);
      this.logger.log('----------------------------------------');
      this.logger.log(`Message: [${body.length} characters]`);
      this.logger.log('========================================');
    } else {
      this.logger.debug(`Mock WhatsApp to ${this.maskPhone(phone)}`);
    }

    // Simulate async operation
    await this.simulateNetworkDelay();

    // Generate mock message ID
    const messageId = `mock_whatsapp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`Mock WhatsApp message sent. MessageId: ${messageId}`);

    return {
      success: true,
      messageId,
    };
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
