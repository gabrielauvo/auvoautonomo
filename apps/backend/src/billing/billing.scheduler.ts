import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AsaasBillingService } from './asaas-billing.service';
import { SubscriptionService } from './subscription.service';

/**
 * Billing Scheduler
 *
 * Handles scheduled billing tasks:
 * 1. Process overdue accounts - check for retry and blocking
 * 2. Process expired subscriptions - downgrade to FREE
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    private readonly asaasBillingService: AsaasBillingService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  onModuleInit() {
    this.logger.log('Billing Scheduler initialized');
  }

  /**
   * Process overdue accounts daily at 06:00
   * - Retry card payments for overdue accounts
   * - Block accounts after 15 days of non-payment
   */
  @Cron('0 6 * * *') // Every day at 06:00
  async processOverdueAccounts() {
    this.logger.log('Starting scheduled overdue accounts processing...');

    try {
      const result = await this.asaasBillingService.processOverdueAccounts();

      this.logger.log('Overdue accounts processing completed', {
        processed: result.processed,
        blocked: result.blocked,
        retried: result.retried,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Overdue accounts processing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Process expired subscriptions daily at 00:30
   * - Downgrade subscriptions marked for cancellation at period end
   */
  @Cron('30 0 * * *') // Every day at 00:30
  async processExpiredSubscriptions() {
    this.logger.log('Starting scheduled expired subscriptions processing...');

    try {
      const count = await this.subscriptionService.processExpiredSubscriptions();

      this.logger.log(`Expired subscriptions processed: ${count} downgraded`);

      return { processed: count };
    } catch (error) {
      this.logger.error(
        `Expired subscriptions processing failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Manual trigger for testing - process overdue accounts
   */
  async triggerOverdueProcessing() {
    return this.processOverdueAccounts();
  }

  /**
   * Manual trigger for testing - process expired subscriptions
   */
  async triggerExpiredProcessing() {
    return this.processExpiredSubscriptions();
  }
}
