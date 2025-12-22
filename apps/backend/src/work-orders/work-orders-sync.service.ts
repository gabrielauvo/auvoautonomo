import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SyncWorkOrderPullQueryDto,
  SyncWorkOrderPullResponseDto,
  SyncWorkOrderPushBodyDto,
  SyncWorkOrderPushResponseDto,
  WorkOrderMutationAction,
  WorkOrderMutationStatus,
  SyncWorkOrderScope,
  SyncWorkOrderItemDto,
  SyncWorkOrderItemDetailDto,
  WorkOrderMutationResultDto,
  WorkOrderStatus,
} from './dto/sync-work-orders.dto';

// Valid status transitions
const VALID_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.SCHEDULED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELED],
  [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.DONE, WorkOrderStatus.CANCELED],
  [WorkOrderStatus.DONE]: [], // Terminal state
  [WorkOrderStatus.CANCELED]: [], // Terminal state
};

@Injectable()
export class WorkOrdersSyncService {
  private readonly logger = new Logger(WorkOrdersSyncService.name);

  constructor(private prisma: PrismaService) {}

  // =============================================================================
  // PULL - Delta Sync with Cursor Pagination
  // =============================================================================

  async pull(
    userId: string,
    query: SyncWorkOrderPullQueryDto,
  ): Promise<SyncWorkOrderPullResponseDto> {
    const limit = Math.min(query.limit || 100, 500); // Max 500 per page
    const since = query.since ? new Date(query.since) : null;
    const scope = query.scope || SyncWorkOrderScope.DATE_RANGE;

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
    if (scope === SyncWorkOrderScope.DATE_RANGE) {
      // Default: -30 days to +60 days from now
      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = query.endDate
        ? new Date(query.endDate)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      where.OR = [
        { scheduledDate: { gte: startDate, lte: endDate } },
        { scheduledStartTime: { gte: startDate, lte: endDate } },
        // Also include recently updated ones even if outside date range
        { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      ];
    } else if (scope === SyncWorkOrderScope.ASSIGNED) {
      // Only work orders assigned to this user (technician)
      // Already filtered by userId
    }
    // SyncWorkOrderScope.ALL - no additional filter

    // Apply since filter (delta sync)
    if (since) {
      if (where.OR) {
        // Combine with existing OR
        where.AND = [{ updatedAt: { gte: since } }];
      } else {
        where.updatedAt = { gte: since };
      }
    }

    // Apply cursor pagination (keyset pagination)
    if (cursorData) {
      const cursorCondition = {
        OR: [
          { updatedAt: { gt: cursorData.updatedAt } },
          {
            updatedAt: cursorData.updatedAt,
            id: { gt: cursorData.id },
          },
        ],
      };

      if (where.AND) {
        where.AND.push(cursorCondition);
      } else {
        where.AND = [cursorCondition];
      }
    }

    // Get total count for this query (simplified for performance)
    const total = await this.prisma.workOrder.count({
      where: { userId },
    });

    // Fetch work orders with cursor-based pagination
    const workOrders = await this.prisma.workOrder.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: {
        client: {
          select: {
            name: true,
            phone: true,
            address: true,
          },
        },
        workOrderType: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        items: true, // Include work order items for sync
      },
    });

    // Check if there are more records
    const hasMore = workOrders.length > limit;
    const items = hasMore ? workOrders.slice(0, limit) : workOrders;

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
    const responseItems: SyncWorkOrderItemDto[] = items.map((wo) =>
      this.toSyncWorkOrderItem(wo),
    );

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
    body: SyncWorkOrderPushBodyDto,
  ): Promise<SyncWorkOrderPushResponseDto> {
    const results: WorkOrderMutationResultDto[] = [];

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
            status: existingMutation.status as WorkOrderMutationStatus,
            record: existingMutation.resultData as unknown as SyncWorkOrderItemDto | undefined,
          });
          continue;
        }

        // Process mutation based on action
        let result: WorkOrderMutationResultDto;

        switch (mutation.action) {
          case WorkOrderMutationAction.CREATE:
            result = await this.processCreate(userId, mutation);
            break;
          case WorkOrderMutationAction.UPDATE:
            result = await this.processUpdate(userId, mutation);
            break;
          case WorkOrderMutationAction.UPDATE_STATUS:
            result = await this.processUpdateStatus(userId, mutation);
            break;
          case WorkOrderMutationAction.DELETE:
            result = await this.processDelete(userId, mutation);
            break;
          default:
            result = {
              mutationId: mutation.mutationId,
              status: WorkOrderMutationStatus.REJECTED,
              error: `Unknown action: ${mutation.action}`,
            };
        }

        // Store processed mutation for idempotency
        await this.prisma.processedMutation.create({
          data: {
            mutationId: mutation.mutationId,
            userId,
            entity: 'work_order',
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
          status: WorkOrderMutationStatus.REJECTED,
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
  ): Promise<WorkOrderMutationResultDto> {
    // Validate required fields
    if (!mutation.record.clientId || !mutation.record.title) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'clientId and title are required for create',
      };
    }

    // Verify client belongs to user
    const client = await this.prisma.client.findFirst({
      where: { id: mutation.record.clientId, userId },
    });

    if (!client) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Client not found or does not belong to you',
      };
    }

    const workOrder = await this.prisma.workOrder.create({
      data: {
        id: mutation.record.id,
        userId,
        clientId: mutation.record.clientId,
        title: mutation.record.title,
        description: mutation.record.description,
        status: mutation.record.status || WorkOrderStatus.SCHEDULED,
        scheduledDate: mutation.record.scheduledDate
          ? new Date(mutation.record.scheduledDate)
          : null,
        scheduledStartTime: mutation.record.scheduledStartTime
          ? new Date(mutation.record.scheduledStartTime)
          : null,
        scheduledEndTime: mutation.record.scheduledEndTime
          ? new Date(mutation.record.scheduledEndTime)
          : null,
        address: mutation.record.address,
        notes: mutation.record.notes,
        workOrderTypeId: mutation.record.workOrderTypeId || null,
      },
      include: {
        client: {
          select: { name: true, phone: true, address: true },
        },
        workOrderType: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: WorkOrderMutationStatus.APPLIED,
      record: this.toSyncWorkOrderItem(workOrder),
    };
  }

  private async processUpdate(
    userId: string,
    mutation: any,
  ): Promise<WorkOrderMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work Order ID is required for update',
      };
    }

    // Find existing work order
    const existing = await this.prisma.workOrder.findFirst({
      where: { id: mutation.record.id, userId },
      include: {
        client: {
          select: { name: true, phone: true, address: true },
        },
      },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work order not found',
      };
    }

    // Cannot update DONE or CANCELED work orders
    if (existing.status === 'DONE' || existing.status === 'CANCELED') {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Cannot update work order with status DONE or CANCELED',
        record: this.toSyncWorkOrderItem(existing),
      };
    }

    // Last-write-wins conflict resolution
    const clientUpdatedAt = new Date(mutation.clientUpdatedAt);
    if (existing.updatedAt > clientUpdatedAt) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Server has newer version',
        record: this.toSyncWorkOrderItem(existing),
      };
    }

    // Build update data (only non-undefined fields)
    const updateData: any = {};
    if (mutation.record.title !== undefined)
      updateData.title = mutation.record.title;
    if (mutation.record.description !== undefined)
      updateData.description = mutation.record.description;
    if (mutation.record.scheduledDate !== undefined)
      updateData.scheduledDate = mutation.record.scheduledDate
        ? new Date(mutation.record.scheduledDate)
        : null;
    if (mutation.record.scheduledStartTime !== undefined)
      updateData.scheduledStartTime = mutation.record.scheduledStartTime
        ? new Date(mutation.record.scheduledStartTime)
        : null;
    if (mutation.record.scheduledEndTime !== undefined)
      updateData.scheduledEndTime = mutation.record.scheduledEndTime
        ? new Date(mutation.record.scheduledEndTime)
        : null;
    if (mutation.record.executionStart !== undefined)
      updateData.executionStart = mutation.record.executionStart
        ? new Date(mutation.record.executionStart)
        : null;
    if (mutation.record.executionEnd !== undefined)
      updateData.executionEnd = mutation.record.executionEnd
        ? new Date(mutation.record.executionEnd)
        : null;
    if (mutation.record.address !== undefined)
      updateData.address = mutation.record.address;
    if (mutation.record.notes !== undefined)
      updateData.notes = mutation.record.notes;
    if (mutation.record.workOrderTypeId !== undefined)
      updateData.workOrderTypeId = mutation.record.workOrderTypeId;

    const workOrder = await this.prisma.workOrder.update({
      where: { id: mutation.record.id },
      data: updateData,
      include: {
        client: {
          select: { name: true, phone: true, address: true },
        },
        workOrderType: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: WorkOrderMutationStatus.APPLIED,
      record: this.toSyncWorkOrderItem(workOrder),
    };
  }

  private async processUpdateStatus(
    userId: string,
    mutation: any,
  ): Promise<WorkOrderMutationResultDto> {
    if (!mutation.record.id || !mutation.record.status) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work Order ID and status are required for status update',
      };
    }

    const newStatus = mutation.record.status as WorkOrderStatus;

    // Find existing work order
    const existing = await this.prisma.workOrder.findFirst({
      where: { id: mutation.record.id, userId },
      include: {
        client: {
          select: { name: true, phone: true, address: true },
        },
      },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work order not found',
      };
    }

    // Validate status transition
    const currentStatus = existing.status as WorkOrderStatus;
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!validTransitions.includes(newStatus)) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        record: this.toSyncWorkOrderItem(existing),
      };
    }

    // Build update data
    const updateData: any = { status: newStatus };

    // Set execution times based on status
    if (newStatus === WorkOrderStatus.IN_PROGRESS && !existing.executionStart) {
      updateData.executionStart = new Date();
    } else if (newStatus === WorkOrderStatus.DONE && !existing.executionEnd) {
      updateData.executionEnd = new Date();
    }

    const workOrder = await this.prisma.workOrder.update({
      where: { id: mutation.record.id },
      data: updateData,
      include: {
        client: {
          select: { name: true, phone: true, address: true },
        },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: WorkOrderMutationStatus.APPLIED,
      record: this.toSyncWorkOrderItem(workOrder),
    };
  }

  private async processDelete(
    userId: string,
    mutation: any,
  ): Promise<WorkOrderMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work Order ID is required for delete',
      };
    }

    // Find existing work order
    const existing = await this.prisma.workOrder.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Work order not found',
      };
    }

    // Cannot delete IN_PROGRESS or DONE work orders
    if (existing.status === 'IN_PROGRESS' || existing.status === 'DONE') {
      return {
        mutationId: mutation.mutationId,
        status: WorkOrderMutationStatus.REJECTED,
        error: 'Cannot delete work order with status IN_PROGRESS or DONE',
      };
    }

    // Hard delete (or soft delete if you prefer)
    await this.prisma.workOrder.delete({
      where: { id: mutation.record.id },
    });

    return {
      mutationId: mutation.mutationId,
      status: WorkOrderMutationStatus.APPLIED,
    };
  }

  private toSyncWorkOrderItem(workOrder: any): SyncWorkOrderItemDto {
    // Transform work order items to sync format
    const items: SyncWorkOrderItemDetailDto[] = (workOrder.items || []).map(
      (item: any) => ({
        id: item.id,
        workOrderId: item.workOrderId,
        itemId: item.itemId || undefined,
        quoteItemId: item.quoteItemId || undefined,
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discountValue: Number(item.discountValue || 0),
        totalPrice: Number(item.totalPrice),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }),
    );

    return {
      id: workOrder.id,
      technicianId: workOrder.userId,
      clientId: workOrder.clientId,
      quoteId: workOrder.quoteId || undefined,
      workOrderTypeId: workOrder.workOrderTypeId || undefined,
      title: workOrder.title,
      description: workOrder.description || undefined,
      status: workOrder.status as WorkOrderStatus,
      scheduledDate: workOrder.scheduledDate?.toISOString() || undefined,
      scheduledStartTime: workOrder.scheduledStartTime?.toISOString() || undefined,
      scheduledEndTime: workOrder.scheduledEndTime?.toISOString() || undefined,
      executionStart: workOrder.executionStart?.toISOString() || undefined,
      executionEnd: workOrder.executionEnd?.toISOString() || undefined,
      address: workOrder.address || undefined,
      notes: workOrder.notes || undefined,
      totalValue: workOrder.totalValue ? Number(workOrder.totalValue) : undefined,
      isActive: true, // WorkOrders don't have soft delete currently
      createdAt: workOrder.createdAt.toISOString(),
      updatedAt: workOrder.updatedAt.toISOString(),
      // Denormalized client data
      clientName: workOrder.client?.name,
      clientPhone: workOrder.client?.phone || undefined,
      clientAddress: workOrder.client?.address || undefined,
      // Work order type data
      workOrderTypeName: workOrder.workOrderType?.name || undefined,
      workOrderTypeColor: workOrder.workOrderType?.color || undefined,
      // Work order items
      items: items.length > 0 ? items : undefined,
    };
  }
}
