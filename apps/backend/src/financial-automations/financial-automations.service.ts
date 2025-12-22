import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AsaasIntegrationService } from '../asaas-integration/asaas-integration.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import {
  FinancialAutomationSettings,
  NotificationType,
  PaymentStatus,
  QuoteStatus,
} from '@prisma/client';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';
import {
  DailyAutomationResult,
  AutomationRunStats,
  PaymentReminderContext,
  QuoteFollowUpContext,
  DEFAULT_AUTOMATION_SETTINGS,
} from './financial-automations.types';

@Injectable()
export class FinancialAutomationsService {
  private readonly logger = new Logger(FinancialAutomationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly asaasIntegrationService: AsaasIntegrationService,
    private readonly asaasClient: AsaasHttpClient,
  ) {}

  /**
   * Get or create automation settings for a user
   */
  async getOrCreateSettings(userId: string): Promise<FinancialAutomationSettings> {
    let settings = await this.prisma.financialAutomationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.financialAutomationSettings.create({
        data: {
          userId,
          ...DEFAULT_AUTOMATION_SETTINGS,
        },
      });
      this.logger.log(`Created default automation settings for user ${userId}`);
    }

    return settings;
  }

  /**
   * Update automation settings for a user
   */
  async updateSettings(
    userId: string,
    dto: UpdateAutomationSettingsDto,
  ): Promise<FinancialAutomationSettings> {
    // Ensure settings exist
    await this.getOrCreateSettings(userId);

    // Sanitize arrays: remove duplicates and sort
    const sanitizedData: any = { ...dto };

    if (dto.paymentReminderDaysBefore) {
      sanitizedData.paymentReminderDaysBefore = [...new Set(dto.paymentReminderDaysBefore)].sort(
        (a, b) => b - a,
      );
    }

    if (dto.paymentReminderDaysAfter) {
      sanitizedData.paymentReminderDaysAfter = [...new Set(dto.paymentReminderDaysAfter)].sort(
        (a, b) => a - b,
      );
    }

    if (dto.quoteFollowUpDays) {
      sanitizedData.quoteFollowUpDays = [...new Set(dto.quoteFollowUpDays)].sort((a, b) => a - b);
    }

    return this.prisma.financialAutomationSettings.update({
      where: { userId },
      data: sanitizedData,
    });
  }

  /**
   * Run all daily automations for all users
   * This should be called once per day (e.g., at 03:00 via CRON)
   */
  async runDailyAutomations(): Promise<DailyAutomationResult> {
    const runAt = new Date();
    this.logger.log('Starting daily financial automations...');

    const result: DailyAutomationResult = {
      runAt,
      usersProcessed: 0,
      results: {
        paymentRemindersBeforeDue: { processed: 0, successful: 0, failed: 0 },
        paymentRemindersAfterDue: { processed: 0, successful: 0, failed: 0 },
        delinquentClients: { processed: 0, successful: 0, failed: 0 },
        quoteFollowUps: { processed: 0, successful: 0, failed: 0 },
        autoCancelPayments: { processed: 0, successful: 0, failed: 0 },
      },
      errors: [],
    };

    try {
      // Get all users with active automations
      const activeSettings = await this.prisma.financialAutomationSettings.findMany({
        where: { isEnabled: true },
        include: { user: { select: { id: true, email: true } } },
      });

      result.usersProcessed = activeSettings.length;
      this.logger.log(`Processing automations for ${activeSettings.length} users`);

      for (const settings of activeSettings) {
        try {
          // Process each automation type for this user
          const beforeDueStats = await this.processPaymentRemindersBeforeDue(settings);
          this.mergeStats(result.results.paymentRemindersBeforeDue, beforeDueStats);

          const afterDueStats = await this.processPaymentRemindersAfterDue(settings);
          this.mergeStats(result.results.paymentRemindersAfterDue, afterDueStats);

          const delinquentStats = await this.processDelinquentClients(settings);
          this.mergeStats(result.results.delinquentClients, delinquentStats);

          const followUpStats = await this.processQuoteFollowUps(settings);
          this.mergeStats(result.results.quoteFollowUps, followUpStats);

          const cancelStats = await this.processAutoCancelPayments(settings);
          this.mergeStats(result.results.autoCancelPayments, cancelStats);
        } catch (error) {
          const errorMsg = `Error processing user ${settings.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      this.logger.log('Daily financial automations completed', {
        usersProcessed: result.usersProcessed,
        results: result.results,
        errorsCount: result.errors.length,
      });

      return result;
    } catch (error) {
      const errorMsg = `Failed to run daily automations: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Process payment reminders BEFORE due date (D-X)
   */
  async processPaymentRemindersBeforeDue(
    settings: FinancialAutomationSettings,
  ): Promise<AutomationRunStats> {
    const stats: AutomationRunStats = { processed: 0, successful: 0, failed: 0 };

    if (!settings.paymentReminderDaysBefore?.length) {
      return stats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const daysBeforeDue of settings.paymentReminderDaysBefore) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysBeforeDue);

      // Find payments due on target date that haven't received this reminder
      const payments = await this.prisma.clientPayment.findMany({
        where: {
          userId: settings.userId,
          status: PaymentStatus.PENDING,
          dueDate: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          workOrder: { select: { id: true } },
          quote: { select: { id: true } },
        },
      });

      for (const payment of payments) {
        stats.processed++;

        // Check if reminder was already sent for this day
        const existingReminder = await this.prisma.notificationLog.findFirst({
          where: {
            userId: settings.userId,
            clientPaymentId: payment.id,
            type: NotificationType.PAYMENT_REMINDER_BEFORE_DUE,
            payload: {
              path: ['daysBeforeDue'],
              equals: daysBeforeDue,
            },
          },
        });

        if (existingReminder) {
          this.logger.debug(
            `Skipping reminder D-${daysBeforeDue} for payment ${payment.id} - already sent`,
          );
          continue;
        }

        try {
          // Fetch user to get company Pix key info
          const user = await this.prisma.user.findUnique({
            where: { id: settings.userId },
            select: {
              pixKey: true,
              pixKeyType: true,
              pixKeyOwnerName: true,
              pixKeyEnabled: true,
            },
          });

          const context: PaymentReminderContext = {
            clientName: payment.client.name,
            clientEmail: payment.client.email || undefined,
            clientPhone: payment.client.phone || undefined,
            paymentId: payment.id,
            value: Number(payment.value),
            dueDate: payment.dueDate.toISOString().split('T')[0],
            daysUntilDue: daysBeforeDue,
            paymentLink: payment.asaasInvoiceUrl || undefined,
            pixCode: payment.asaasPixCode || undefined,
            workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
            quoteNumber: payment.quote?.id?.substring(0, 8).toUpperCase(),
            // Include company Pix key if enabled
            companyPixKey: user?.pixKeyEnabled && user?.pixKey ? user.pixKey : undefined,
            companyPixKeyType: user?.pixKeyEnabled && user?.pixKeyType ? user.pixKeyType : undefined,
            companyPixKeyOwnerName: user?.pixKeyEnabled && user?.pixKeyOwnerName ? user.pixKeyOwnerName : undefined,
          };

          await this.notificationsService.sendNotification({
            userId: settings.userId,
            clientId: payment.client.id,
            clientPaymentId: payment.id,
            type: NotificationType.PAYMENT_REMINDER_BEFORE_DUE,
            contextData: {
              ...context,
              daysBeforeDue, // Include in payload for deduplication
            } as any,
          });

          stats.successful++;
          this.logger.log(
            `Sent D-${daysBeforeDue} payment reminder for payment ${payment.id}`,
          );
        } catch (error) {
          stats.failed++;
          this.logger.error(
            `Failed to send D-${daysBeforeDue} reminder for payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }
    }

    return stats;
  }

  /**
   * Process payment reminders AFTER due date (D+X) - overdue payments
   */
  async processPaymentRemindersAfterDue(
    settings: FinancialAutomationSettings,
  ): Promise<AutomationRunStats> {
    const stats: AutomationRunStats = { processed: 0, successful: 0, failed: 0 };

    if (!settings.paymentReminderDaysAfter?.length) {
      return stats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const daysAfterDue of settings.paymentReminderDaysAfter) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysAfterDue);

      // Find payments that were due X days ago (now overdue)
      const payments = await this.prisma.clientPayment.findMany({
        where: {
          userId: settings.userId,
          status: PaymentStatus.OVERDUE,
          dueDate: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          workOrder: { select: { id: true } },
          quote: { select: { id: true } },
        },
      });

      for (const payment of payments) {
        stats.processed++;

        // Check if reminder was already sent for this day
        const existingReminder = await this.prisma.notificationLog.findFirst({
          where: {
            userId: settings.userId,
            clientPaymentId: payment.id,
            type: NotificationType.PAYMENT_REMINDER_AFTER_DUE,
            payload: {
              path: ['daysAfterDue'],
              equals: daysAfterDue,
            },
          },
        });

        if (existingReminder) {
          this.logger.debug(
            `Skipping reminder D+${daysAfterDue} for payment ${payment.id} - already sent`,
          );
          continue;
        }

        try {
          // Fetch user to get company Pix key info
          const user = await this.prisma.user.findUnique({
            where: { id: settings.userId },
            select: {
              pixKey: true,
              pixKeyType: true,
              pixKeyOwnerName: true,
              pixKeyEnabled: true,
            },
          });

          const context: PaymentReminderContext = {
            clientName: payment.client.name,
            clientEmail: payment.client.email || undefined,
            clientPhone: payment.client.phone || undefined,
            paymentId: payment.id,
            value: Number(payment.value),
            dueDate: payment.dueDate.toISOString().split('T')[0],
            daysOverdue: daysAfterDue,
            paymentLink: payment.asaasInvoiceUrl || undefined,
            pixCode: payment.asaasPixCode || undefined,
            workOrderNumber: payment.workOrder?.id?.substring(0, 8).toUpperCase(),
            quoteNumber: payment.quote?.id?.substring(0, 8).toUpperCase(),
            // Include company Pix key if enabled
            companyPixKey: user?.pixKeyEnabled && user?.pixKey ? user.pixKey : undefined,
            companyPixKeyType: user?.pixKeyEnabled && user?.pixKeyType ? user.pixKeyType : undefined,
            companyPixKeyOwnerName: user?.pixKeyEnabled && user?.pixKeyOwnerName ? user.pixKeyOwnerName : undefined,
          };

          await this.notificationsService.sendNotification({
            userId: settings.userId,
            clientId: payment.client.id,
            clientPaymentId: payment.id,
            type: NotificationType.PAYMENT_REMINDER_AFTER_DUE,
            contextData: {
              ...context,
              daysAfterDue, // Include in payload for deduplication
            } as any,
          });

          stats.successful++;
          this.logger.log(
            `Sent D+${daysAfterDue} overdue reminder for payment ${payment.id}`,
          );
        } catch (error) {
          stats.failed++;
          this.logger.error(
            `Failed to send D+${daysAfterDue} reminder for payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }
    }

    return stats;
  }

  /**
   * Mark clients as delinquent after X days of overdue payments
   */
  async processDelinquentClients(
    settings: FinancialAutomationSettings,
  ): Promise<AutomationRunStats> {
    const stats: AutomationRunStats = { processed: 0, successful: 0, failed: 0 };

    if (!settings.autoMarkOverdueAsDelinquentAfterDays) {
      return stats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(
      thresholdDate.getDate() - settings.autoMarkOverdueAsDelinquentAfterDays,
    );

    // Find clients with overdue payments older than threshold
    const clientsWithOverdue = await this.prisma.client.findMany({
      where: {
        userId: settings.userId,
        isDelinquent: false,
        payments: {
          some: {
            status: PaymentStatus.OVERDUE,
            dueDate: {
              lt: thresholdDate,
            },
          },
        },
      },
      include: {
        payments: {
          where: {
            status: PaymentStatus.OVERDUE,
            dueDate: { lt: thresholdDate },
          },
          select: { id: true, value: true, dueDate: true },
        },
      },
    });

    for (const client of clientsWithOverdue) {
      stats.processed++;

      try {
        await this.prisma.client.update({
          where: { id: client.id },
          data: {
            isDelinquent: true,
            delinquentAt: new Date(),
          },
        });

        stats.successful++;
        this.logger.log(
          `Marked client ${client.id} (${client.name}) as delinquent - ${client.payments.length} overdue payments`,
        );
      } catch (error) {
        stats.failed++;
        this.logger.error(
          `Failed to mark client ${client.id} as delinquent: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    return stats;
  }

  /**
   * Process quote follow-ups for quotes that haven't been responded
   */
  async processQuoteFollowUps(
    settings: FinancialAutomationSettings,
  ): Promise<AutomationRunStats> {
    const stats: AutomationRunStats = { processed: 0, successful: 0, failed: 0 };

    if (!settings.enableQuoteFollowUp || !settings.quoteFollowUpDays?.length) {
      return stats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const daysSinceSent of settings.quoteFollowUpDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - daysSinceSent);

      // Find quotes sent X days ago that are still in SENT status
      const quotes = await this.prisma.quote.findMany({
        where: {
          userId: settings.userId,
          status: QuoteStatus.SENT,
          sentAt: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      for (const quote of quotes) {
        stats.processed++;

        // Check if follow-up was already sent for this day
        const existingFollowUp = await this.prisma.notificationLog.findFirst({
          where: {
            userId: settings.userId,
            quoteId: quote.id,
            type: NotificationType.QUOTE_FOLLOW_UP,
            payload: {
              path: ['daysSinceSent'],
              equals: daysSinceSent,
            },
          },
        });

        if (existingFollowUp) {
          this.logger.debug(
            `Skipping D+${daysSinceSent} follow-up for quote ${quote.id} - already sent`,
          );
          continue;
        }

        try {
          const context: QuoteFollowUpContext = {
            clientName: quote.client.name,
            clientEmail: quote.client.email || undefined,
            clientPhone: quote.client.phone || undefined,
            quoteId: quote.id,
            quoteNumber: quote.id.substring(0, 8).toUpperCase(),
            totalValue: Number(quote.totalValue),
            daysSinceSent,
          };

          await this.notificationsService.sendNotification({
            userId: settings.userId,
            clientId: quote.client.id,
            quoteId: quote.id,
            type: NotificationType.QUOTE_FOLLOW_UP,
            contextData: {
              ...context,
              daysSinceSent, // Include in payload for deduplication
            } as any,
          });

          stats.successful++;
          this.logger.log(
            `Sent D+${daysSinceSent} follow-up for quote ${quote.id}`,
          );
        } catch (error) {
          stats.failed++;
          this.logger.error(
            `Failed to send D+${daysSinceSent} follow-up for quote ${quote.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }
    }

    return stats;
  }

  /**
   * Auto-cancel payments that have been overdue for too long
   */
  async processAutoCancelPayments(
    settings: FinancialAutomationSettings,
  ): Promise<AutomationRunStats> {
    const stats: AutomationRunStats = { processed: 0, successful: 0, failed: 0 };

    if (!settings.autoCancelPaymentAfterDays) {
      return stats;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thresholdDate = new Date(today);
    thresholdDate.setDate(thresholdDate.getDate() - settings.autoCancelPaymentAfterDays);

    // Find overdue payments older than threshold
    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId: settings.userId,
        status: PaymentStatus.OVERDUE,
        dueDate: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
        asaasPaymentId: true,
        value: true,
        dueDate: true,
      },
    });

    for (const payment of payments) {
      stats.processed++;

      try {
        // Try to cancel in Asaas
        try {
          const { apiKey, environment } = await this.asaasIntegrationService.getApiKey(
            settings.userId,
          );
          await this.asaasClient.deletePayment(apiKey, environment, payment.asaasPaymentId);
          this.logger.log(`Cancelled payment ${payment.asaasPaymentId} in Asaas`);
        } catch (asaasError) {
          // Log but continue - payment might already be cancelled or Asaas integration inactive
          this.logger.warn(
            `Could not cancel payment in Asaas: ${asaasError instanceof Error ? asaasError.message : 'Unknown'}`,
          );
        }

        // Update local status regardless of Asaas result
        await this.prisma.clientPayment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.DELETED,
            canceledAt: new Date(),
          },
        });

        stats.successful++;
        this.logger.log(
          `Auto-cancelled payment ${payment.id} after ${settings.autoCancelPaymentAfterDays} days overdue`,
        );
      } catch (error) {
        stats.failed++;
        this.logger.error(
          `Failed to auto-cancel payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    return stats;
  }

  /**
   * Helper to merge stats
   */
  private mergeStats(target: AutomationRunStats, source: AutomationRunStats): void {
    target.processed += source.processed;
    target.successful += source.successful;
    target.failed += source.failed;
  }
}
