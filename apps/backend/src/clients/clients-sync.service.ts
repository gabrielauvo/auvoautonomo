import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import {
  SyncPullQueryDto,
  SyncPullResponseDto,
  SyncPushBodyDto,
  SyncPushResponseDto,
  MutationAction,
  MutationStatus,
  SyncScope,
  SyncClientItemDto,
  MutationResultDto,
} from './dto/sync-clients.dto';

@Injectable()
export class ClientsSyncService {
  private readonly logger = new Logger(ClientsSyncService.name);

  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
  ) {}

  // =============================================================================
  // PULL - Delta Sync with Cursor Pagination
  // =============================================================================

  async pull(
    userId: string,
    query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    const limit = Math.min(query.limit || 100, 500); // Max 500 per page
    const since = query.since ? new Date(query.since) : null;
    const scope = query.scope || SyncScope.ALL;

    // Decode cursor if provided
    let cursorData: { updatedAt: Date; id: string } | null = null;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf-8'),
        );
        cursorData = {
          updatedAt: new Date(decoded.updatedAt),
          id: decoded.id,
        };
      } catch (e) {
        this.logger.warn(`Invalid cursor: ${query.cursor}`);
      }
    }

    // Build where clause
    const where: any = { userId };

    // Apply scope filter
    if (scope === SyncScope.RECENT) {
      // Last 90 days of activity
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      where.OR = [
        { updatedAt: { gte: ninetyDaysAgo } },
        { createdAt: { gte: ninetyDaysAgo } },
      ];
    } else if (scope === SyncScope.ASSIGNED) {
      // Clients with work orders in last 90 days or next 30 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      where.workOrders = {
        some: {
          OR: [
            { scheduledDate: { gte: ninetyDaysAgo, lte: thirtyDaysFromNow } },
            { createdAt: { gte: ninetyDaysAgo } },
          ],
        },
      };
    }

    // Apply since filter (delta sync)
    if (since) {
      where.updatedAt = { gte: since };
    }

    // Apply cursor pagination (keyset pagination)
    if (cursorData) {
      where.OR = [
        { updatedAt: { gt: cursorData.updatedAt } },
        {
          updatedAt: cursorData.updatedAt,
          id: { gt: cursorData.id },
        },
      ];
    }

    // Get total count for this query
    const total = await this.prisma.client.count({
      where: { userId, ...(since ? { updatedAt: { gte: since } } : {}) },
    });

    // Fetch clients with cursor-based pagination
    const clients = await this.prisma.client.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1, // Fetch one extra to check if there are more
    });

    // Check if there are more records
    const hasMore = clients.length > limit;
    const items = hasMore ? clients.slice(0, limit) : clients;

    // Build next cursor
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          updatedAt: lastItem.updatedAt.toISOString(),
          id: lastItem.id,
        }),
      ).toString('base64');
    }

    // Transform to response format
    // IMPORTANT: technicianId = userId (same user who owns the client)
    // isActive = !deletedAt (client is active if not soft deleted)
    const responseItems: SyncClientItemDto[] = items.map((client) => ({
      id: client.id,
      technicianId: client.userId, // Maps to technicianId on mobile
      name: client.name,
      email: client.email || undefined,
      phone: client.phone || undefined,
      address: client.address || undefined,
      city: client.city || undefined,
      state: client.state || undefined,
      zipCode: client.zipCode || undefined,
      taxId: client.taxId || undefined,
      notes: client.notes || undefined,
      isActive: !client.deletedAt, // Active if not soft deleted
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      deletedAt: client.deletedAt?.toISOString() || undefined,
    }));

    return {
      items: responseItems,
      nextCursor,
      serverTime: new Date().toISOString(),
      hasMore,
      total,
    };
  }

  // =============================================================================
  // PUSH - Process Mutations with Idempotency
  // =============================================================================

  async push(
    userId: string,
    body: SyncPushBodyDto,
  ): Promise<SyncPushResponseDto> {
    const results: MutationResultDto[] = [];

    for (const mutation of body.mutations) {
      try {
        // Check if mutation was already processed (idempotency)
        const existingMutation = await this.prisma.processedMutation.findUnique(
          {
            where: { mutationId: mutation.mutationId },
          },
        );

        if (existingMutation) {
          // Return cached result
          results.push({
            mutationId: mutation.mutationId,
            status: existingMutation.status as MutationStatus,
            record: existingMutation.resultData as unknown as SyncClientItemDto | undefined,
          });
          continue;
        }

        // Process mutation based on action
        let result: MutationResultDto;

        switch (mutation.action) {
          case MutationAction.CREATE:
            result = await this.processCreate(userId, mutation);
            break;
          case MutationAction.UPDATE:
            result = await this.processUpdate(userId, mutation);
            break;
          case MutationAction.DELETE:
            result = await this.processDelete(userId, mutation);
            break;
          default:
            result = {
              mutationId: mutation.mutationId,
              status: MutationStatus.REJECTED,
              error: `Unknown action: ${mutation.action}`,
            };
        }

        // Store processed mutation for idempotency
        await this.prisma.processedMutation.create({
          data: {
            mutationId: mutation.mutationId,
            userId,
            entity: 'client',
            entityId: result.record?.id || mutation.record.id || '',
            action: mutation.action,
            status: result.status,
            resultData: result.record as any,
          },
        });

        results.push(result);
      } catch (error) {
        this.logger.error(
          `Error processing mutation ${mutation.mutationId}: ${error.message}`,
        );
        results.push({
          mutationId: mutation.mutationId,
          status: MutationStatus.REJECTED,
          error: error.message,
        });
      }
    }

    return {
      results,
      serverTime: new Date().toISOString(),
    };
  }

  // =============================================================================
  // Private Methods - Process Individual Mutations
  // =============================================================================

  private async processCreate(
    userId: string,
    mutation: any,
  ): Promise<MutationResultDto> {
    // Check plan limit
    try {
      await this.planLimitsService.checkLimitOrThrow({
        userId,
        resource: 'CLIENT',
      });
    } catch (error) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client limit reached for current plan',
      };
    }

    const client = await this.prisma.client.create({
      data: {
        id: mutation.record.id, // Use client-provided ID if exists
        userId,
        name: mutation.record.name,
        email: mutation.record.email,
        phone: mutation.record.phone,
        address: mutation.record.address,
        city: mutation.record.city,
        state: mutation.record.state,
        zipCode: mutation.record.zipCode,
        taxId: mutation.record.taxId,
        notes: mutation.record.notes,
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncClientItem(client),
    };
  }

  private async processUpdate(
    userId: string,
    mutation: any,
  ): Promise<MutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client ID is required for update',
      };
    }

    // Find existing client
    const existing = await this.prisma.client.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client not found',
      };
    }

    // Last-write-wins conflict resolution
    const clientUpdatedAt = new Date(mutation.clientUpdatedAt);
    if (existing.updatedAt > clientUpdatedAt) {
      // Server has newer data, return server version
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Server has newer version',
        record: this.toSyncClientItem(existing),
      };
    }

    // Apply update (only non-null fields)
    const updateData: any = {};
    if (mutation.record.name !== undefined)
      updateData.name = mutation.record.name;
    if (mutation.record.email !== undefined)
      updateData.email = mutation.record.email;
    if (mutation.record.phone !== undefined)
      updateData.phone = mutation.record.phone;
    if (mutation.record.address !== undefined)
      updateData.address = mutation.record.address;
    if (mutation.record.city !== undefined)
      updateData.city = mutation.record.city;
    if (mutation.record.state !== undefined)
      updateData.state = mutation.record.state;
    if (mutation.record.zipCode !== undefined)
      updateData.zipCode = mutation.record.zipCode;
    if (mutation.record.taxId !== undefined)
      updateData.taxId = mutation.record.taxId;
    if (mutation.record.notes !== undefined)
      updateData.notes = mutation.record.notes;

    const client = await this.prisma.client.update({
      where: { id: mutation.record.id },
      data: updateData,
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncClientItem(client),
    };
  }

  private async processDelete(
    userId: string,
    mutation: any,
  ): Promise<MutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client ID is required for delete',
      };
    }

    // Find existing client
    const existing = await this.prisma.client.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client not found',
      };
    }

    // Soft delete
    const client = await this.prisma.client.update({
      where: { id: mutation.record.id },
      data: { deletedAt: new Date() },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncClientItem(client),
    };
  }

  private toSyncClientItem(client: any): SyncClientItemDto {
    return {
      id: client.id,
      technicianId: client.userId, // Maps to technicianId on mobile
      name: client.name,
      email: client.email || undefined,
      phone: client.phone || undefined,
      address: client.address || undefined,
      city: client.city || undefined,
      state: client.state || undefined,
      zipCode: client.zipCode || undefined,
      taxId: client.taxId || undefined,
      notes: client.notes || undefined,
      isActive: !client.deletedAt, // Active if not soft deleted
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
      deletedAt: client.deletedAt?.toISOString() || undefined,
    };
  }
}
