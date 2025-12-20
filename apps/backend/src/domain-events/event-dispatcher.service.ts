import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DomainEventsService } from './domain-events.service';
import { PushService } from './push.service';
import { EventPayload } from './types';

@Injectable()
export class EventDispatcherService implements OnModuleInit {
  private readonly logger = new Logger(EventDispatcherService.name);
  private isProcessing = false;

  constructor(
    private domainEventsService: DomainEventsService,
    private pushService: PushService,
  ) {}

  onModuleInit() {
    this.logger.log('Event Dispatcher initialized');
    // Process any pending events on startup
    this.processPendingEvents();
  }

  /**
   * Process pending events every 10 seconds
   */
  @Cron('*/10 * * * * *')
  async processPendingEvents() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const events = await this.domainEventsService.getPendingEvents(50);

      if (events.length === 0) {
        return;
      }

      this.logger.log(`Processing ${events.length} pending events`);

      for (const event of events) {
        await this.dispatchEvent(event);
      }
    } catch (error) {
      this.logger.error(`Error processing events: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Dispatch a single event
   */
  private async dispatchEvent(event: any) {
    try {
      const payload = event.payload as EventPayload;

      // Build notification
      const notification = this.pushService.buildNotification(
        event.type,
        payload,
      );

      // Send push notification
      const result = await this.pushService.sendToUser(
        event.targetUserId,
        notification,
      );

      if (result.sent > 0 || result.failed === 0) {
        // Mark as sent (even if no devices, the event was processed)
        await this.domainEventsService.markAsSent(event.id);
        this.logger.debug(
          `Event ${event.id} dispatched: ${result.sent} sent, ${result.failed} failed`,
        );
      } else {
        // All sends failed
        await this.domainEventsService.markAsFailed(
          event.id,
          'All push notifications failed',
        );
      }
    } catch (error) {
      this.logger.error(`Failed to dispatch event ${event.id}: ${error.message}`);
      await this.domainEventsService.markAsFailed(event.id, error.message);
    }
  }

  /**
   * Clean up old events every day at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupOldEvents() {
    this.logger.log('Running daily event cleanup');
    await this.domainEventsService.cleanupOldEvents(7);
  }

  /**
   * Manually trigger event processing (for testing/admin)
   */
  async triggerProcessing() {
    this.isProcessing = false;
    await this.processPendingEvents();
  }

  /**
   * Get dispatcher status
   */
  async getStatus() {
    const stats = await this.domainEventsService.getStats();
    return {
      isProcessing: this.isProcessing,
      ...stats,
    };
  }
}
