import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FinancialAutomationsService } from './financial-automations.service';

/**
 * Financial Automations Scheduler
 *
 * This service handles the scheduling of daily automation runs.
 *
 * In production, you have several options:
 *
 * 1. NestJS Schedule Module (@nestjs/schedule):
 *    - Add @Cron('0 3 * * *') decorator to runDaily() method
 *    - This runs at 03:00 every day
 *
 * 2. External CRON job:
 *    - Call POST /financial/automations/run via curl
 *    - Example: `0 3 * * * curl -X POST http://localhost:3000/financial/automations/run`
 *
 * 3. Cloud scheduler (AWS EventBridge, GCP Cloud Scheduler, etc.):
 *    - Configure to call the run endpoint at desired time
 *
 * 4. Worker process:
 *    - Run a separate worker that calls runDaily() on schedule
 *
 * For this implementation, we provide the runDaily() method that can be called
 * by any of the above mechanisms.
 */
@Injectable()
export class FinancialAutomationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(FinancialAutomationsScheduler.name);

  constructor(
    private readonly financialAutomationsService: FinancialAutomationsService,
  ) {}

  /**
   * Called when the module is initialized
   * Log that scheduler is ready
   */
  onModuleInit() {
    this.logger.log('Financial Automations Scheduler initialized');
    this.logger.log(
      'To run daily automations, call POST /financial/automations/run or configure a CRON job',
    );
  }

  /**
   * Run daily automations
   *
   * This method should be called once per day, ideally at a low-traffic time
   * (e.g., 03:00 AM).
   *
   * To use with @nestjs/schedule, add the package and use:
   * @Cron('0 3 * * *') // Every day at 03:00
   * async runDaily() { ... }
   */
  async runDaily() {
    this.logger.log('Starting scheduled daily automations run...');

    try {
      const result = await this.financialAutomationsService.runDailyAutomations();

      this.logger.log('Scheduled daily automations completed', {
        usersProcessed: result.usersProcessed,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Scheduled daily automations failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Run automations for a specific user (for testing)
   */
  async runForUser(userId: string) {
    this.logger.log(`Running automations for user ${userId}`);

    const settings = await this.financialAutomationsService.getOrCreateSettings(userId);

    if (!settings.isEnabled) {
      this.logger.warn(`Automations are disabled for user ${userId}`);
      return { message: 'Automations are disabled for this user' };
    }

    // The service methods expect settings object, so we call the main method
    // which will process only enabled users
    return this.financialAutomationsService.runDailyAutomations();
  }
}
