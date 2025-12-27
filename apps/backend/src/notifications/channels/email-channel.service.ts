import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  NotificationChannel,
  NotificationMessage,
  NotificationResult,
} from '../notifications.types';
import { NotificationChannelBase } from './notification-channel.interface';

/**
 * Email Channel Service
 *
 * Handles sending notifications via email using Resend.
 */
@Injectable()
export class EmailChannelService extends NotificationChannelBase {
  private readonly logger = new Logger(EmailChannelService.name);
  private readonly resend: Resend | null = null;
  readonly channel = NotificationChannel.EMAIL;

  constructor() {
    super();
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured - emails will not be sent');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  /**
   * Send email notification using Resend
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      // Validate recipient
      if (!this.validateRecipient(message.to)) {
        return {
          success: false,
          error: `Invalid email address: ${message.to}`,
        };
      }

      // Check if Resend is configured
      if (!this.resend) {
        this.logger.warn('RESEND_API_KEY not configured - skipping email send');
        return {
          success: false,
          error: 'Email service not configured',
        };
      }

      const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
      const fromName = process.env.EMAIL_FROM_NAME || 'Auvo';

      this.logger.log(`Sending email to ${this.maskEmail(message.to)}`);
      this.logger.debug(`Subject: ${message.subject || '(no subject)'}`);

      // Send email via Resend
      const { data, error } = await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [message.to],
        subject: message.subject || 'Notificação',
        html: message.htmlBody || message.body,
        text: message.body,
      });

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`);
        return {
          success: false,
          error: error.message,
        };
      }

      this.logger.log(`Email sent successfully. MessageId: ${data?.id}`);

      return {
        success: true,
        messageId: data?.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate email format
   */
  validateRecipient(email: string): boolean {
    if (!email) return false;

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Mask email for logging (privacy)
   * e.g., "john@example.com" -> "j***@e***.com"
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***.***';

    const [domainName, ...domainParts] = domain.split('.');
    const maskedLocal = local.charAt(0) + '***';
    const maskedDomain = domainName.charAt(0) + '***';

    return `${maskedLocal}@${maskedDomain}.${domainParts.join('.')}`;
  }
}
