import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainEventStatus, Prisma } from '@prisma/client';
import {
  DomainEventType,
  EntityType,
  EventPayload,
  ActionType,
} from './types';

export interface CreateEventOptions {
  type: DomainEventType;
  entity: EntityType;
  entityId: string;
  targetUserId: string;
  payload?: Partial<EventPayload>;
}

@Injectable()
export class DomainEventsService {
  private readonly logger = new Logger(DomainEventsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new domain event
   * Events are stored in the database and processed by the dispatcher
   */
  async createEvent(options: CreateEventOptions) {
    const { type, entity, entityId, targetUserId, payload } = options;

    // Build full payload
    const fullPayload: EventPayload = {
      eventType: type,
      entity,
      entityId,
      action: this.extractAction(type),
      scopeHint: this.determineScopeHint(type),
      timestamp: new Date().toISOString(),
      ...payload,
    } as EventPayload;

    // Create event in database
    const event = await this.prisma.domainEvent.create({
      data: {
        type,
        entity,
        entityId,
        targetUserId,
        payload: fullPayload as unknown as Prisma.InputJsonValue,
        status: DomainEventStatus.PENDING,
      },
    });

    this.logger.log(
      `Created domain event: ${type} for user ${targetUserId} (event ${event.id})`,
    );

    return event;
  }

  /**
   * Create events for multiple users
   */
  async createEventsForUsers(
    userIds: string[],
    options: Omit<CreateEventOptions, 'targetUserId'>,
  ) {
    const events = await Promise.all(
      userIds.map((userId) =>
        this.createEvent({ ...options, targetUserId: userId }),
      ),
    );

    return events;
  }

  /**
   * Get pending events for dispatch
   */
  async getPendingEvents(limit: number = 100) {
    return this.prisma.domainEvent.findMany({
      where: {
        status: DomainEventStatus.PENDING,
        retryCount: { lt: 3 }, // Max 3 retries
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        targetUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Mark event as sent
   */
  async markAsSent(eventId: string) {
    return this.prisma.domainEvent.update({
      where: { id: eventId },
      data: {
        status: DomainEventStatus.SENT,
        dispatchedAt: new Date(),
      },
    });
  }

  /**
   * Mark event as failed
   */
  async markAsFailed(eventId: string, error: string) {
    const event = await this.prisma.domainEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) return null;

    const newRetryCount = event.retryCount + 1;
    const newStatus =
      newRetryCount >= 3 ? DomainEventStatus.FAILED : DomainEventStatus.PENDING;

    return this.prisma.domainEvent.update({
      where: { id: eventId },
      data: {
        status: newStatus,
        retryCount: newRetryCount,
        lastError: error,
      },
    });
  }

  /**
   * Clean up old events
   */
  async cleanupOldEvents(olderThanDays: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.domainEvent.deleteMany({
      where: {
        OR: [
          {
            status: DomainEventStatus.SENT,
            createdAt: { lt: cutoffDate },
          },
          {
            status: DomainEventStatus.FAILED,
            createdAt: { lt: cutoffDate },
          },
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} old domain events`);
    return result.count;
  }

  /**
   * Get event statistics
   */
  async getStats() {
    const [pending, sent, failed, total] = await Promise.all([
      this.prisma.domainEvent.count({
        where: { status: DomainEventStatus.PENDING },
      }),
      this.prisma.domainEvent.count({
        where: { status: DomainEventStatus.SENT },
      }),
      this.prisma.domainEvent.count({
        where: { status: DomainEventStatus.FAILED },
      }),
      this.prisma.domainEvent.count(),
    ]);

    return { pending, sent, failed, total };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private extractAction(type: DomainEventType): ActionType {
    if (type.includes('.created')) return 'create';
    if (type.includes('.updated')) return 'update';
    if (type.includes('.deleted')) return 'delete';
    return 'status_change';
  }

  private determineScopeHint(type: DomainEventType): 'single' | 'list' | 'full' {
    // Full sync required for bulk operations
    if (type === 'sync.full_required') return 'full';

    // Single entity sync for most operations
    if (
      type.includes('.created') ||
      type.includes('.updated') ||
      type.includes('.deleted')
    ) {
      return 'single';
    }

    // Status changes might affect list views
    return 'list';
  }
}
