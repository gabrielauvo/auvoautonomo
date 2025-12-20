import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationMessage,
  NotificationResult,
} from '../notifications.types';
import { NotificationChannelBase } from './notification-channel.interface';

/**
 * Email Channel Service
 *
 * Handles sending notifications via email.
 * Currently implements a mock/stub that logs to console.
 * Can be replaced with real providers like SendGrid, AWS SES, etc.
 */
@Injectable()
export class EmailChannelService extends NotificationChannelBase {
  private readonly logger = new Logger(EmailChannelService.name);
  readonly channel = NotificationChannel.EMAIL;

  /**
   * Send email notification
   *
   * In production, replace this with actual email provider integration
   * (SendGrid, AWS SES, Mailgun, etc.)
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

      // Log the email (mock implementation - only detailed in development)
      if (process.env.NODE_ENV !== 'production') {
        this.logger.log('========================================');
        this.logger.log('📧 EMAIL NOTIFICATION (MOCK)');
        this.logger.log('========================================');
        this.logger.log(`To: ${this.maskEmail(message.to)}`);
        this.logger.log(`Subject: ${message.subject || '(no subject)'}`);
        this.logger.log('----------------------------------------');
        this.logger.log(`Body: [${message.body.length} characters]`);
        this.logger.log('========================================');
      } else {
        this.logger.debug(`Sending email to ${this.maskEmail(message.to)}`);
      }

      // In production, this would be something like:
      // const result = await this.sendgrid.send({
      //   to: message.to,
      //   from: process.env.EMAIL_FROM,
      //   subject: message.subject,
      //   text: message.body,
      //   html: message.htmlBody,
      // });

      // Simulate async operation
      await this.simulateNetworkDelay();

      // Generate mock message ID
      const messageId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Email sent successfully. MessageId: ${messageId}`);

      return {
        success: true,
        messageId,
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
   * Simulate network delay for mock implementation
   */
  private async simulateNetworkDelay(): Promise<void> {
    // Simulate 100-500ms delay
    const delay = Math.random() * 400 + 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
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
