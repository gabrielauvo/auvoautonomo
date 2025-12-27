import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  passwordResetEmail,
  passwordResetText,
  welcomeEmail,
  welcomeText,
} from '../notifications/templates/email-templates';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isConfigured: boolean;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    this.isConfigured = !!apiKey;

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured. Email sending will be disabled.');
    } else {
      this.resend = new Resend(apiKey);
    }

    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'noreply@auvoautonomo.com';
    this.fromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Auvo Autônomo';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    this.logger.log(`Attempting to send email to: ${options.to}, subject: ${options.subject}`);
    this.logger.log(`Email config - isConfigured: ${this.isConfigured}, fromEmail: ${this.fromEmail}`);

    if (!this.isConfigured || !this.resend) {
      this.logger.warn('Email not sent - RESEND_API_KEY not configured');
      this.logger.debug(`Would send email to: ${options.to}`);
      this.logger.debug(`Subject: ${options.subject}`);
      return true;
    }

    try {
      this.logger.log(`Calling Resend API to send email...`);
      const result = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Resend API response: ${JSON.stringify(result)}`);

      if (result.error) {
        this.logger.error(`Failed to send email: ${result.error.message}`);
        this.logger.error(`Error details: ${JSON.stringify(result.error)}`);
        return false;
      }

      this.logger.log(`Email sent successfully to ${options.to}, id: ${result.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending email: ${error}`);
      this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      return false;
    }
  }

  /**
   * Send password reset email using professional template
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const html = passwordResetEmail(email, resetUrl, {
      companyName: this.fromName,
    });

    const text = passwordResetText(resetUrl);

    return this.sendEmail({
      to: email,
      subject: 'Redefinir sua senha - Auvo Autônomo',
      html,
      text,
    });
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = welcomeEmail(name, loginUrl, {
      companyName: this.fromName,
    });

    const text = welcomeText(name, loginUrl);

    return this.sendEmail({
      to: email,
      subject: 'Bem-vindo ao Auvo Autônomo!',
      html,
      text,
    });
  }
}
