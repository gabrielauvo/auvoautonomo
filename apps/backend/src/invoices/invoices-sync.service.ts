import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SyncPullQueryDto,
  SyncInvoicesPullResponseDto,
  SyncInvoicesPushBodyDto,
  SyncInvoicesPushResponseDto,
  MutationAction,
  MutationStatus,
  SyncScope,
  SyncInvoiceDto,
  InvoiceMutationResultDto,
  InvoiceStatus,
} from './dto/sync-invoices.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoicesSyncService {
  private readonly logger = new Logger(InvoicesSyncService.name);

  constructor(private prisma: PrismaService) {}

  // =============================================================================
  // PULL - Delta Sync with Cursor Pagination
  // =============================================================================

  async pull(
    userId: string,
    query: SyncPullQueryDto,
  ): Promise<SyncInvoicesPullResponseDto> {
    const limit = Math.min(query.limit || 100, 500);
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
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      where.OR = [
        { updatedAt: { gte: ninetyDaysAgo } },
        { createdAt: { gte: ninetyDaysAgo } },
      ];
    }

    // Apply since filter (delta sync)
    if (since) {
      where.updatedAt = { gte: since };
    }

    // Apply cursor pagination
    if (cursorData) {
      where.OR = [
        { updatedAt: { gt: cursorData.updatedAt } },
        {
          updatedAt: cursorData.updatedAt,
          id: { gt: cursorData.id },
        },
      ];
    }

    // Get total count
    const total = await this.prisma.invoice.count({
      where: { userId, ...(since ? { updatedAt: { gte: since } } : {}) },
    });

    // Fetch invoices
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    // Check if there are more records
    const hasMore = invoices.length > limit;
    const items = hasMore ? invoices.slice(0, limit) : invoices;

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
    const responseItems: SyncInvoiceDto[] = items.map((invoice) =>
      this.toSyncInvoiceDto(invoice),
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
    body: SyncInvoicesPushBodyDto,
  ): Promise<SyncInvoicesPushResponseDto> {
    const results: InvoiceMutationResultDto[] = [];

    for (const mutation of body.mutations) {
      try {
        // Check if mutation was already processed (idempotency)
        const existingMutation = await this.prisma.processedMutation.findUnique(
          {
            where: { mutationId: mutation.mutationId },
          },
        );

        if (existingMutation) {
          results.push({
            mutationId: mutation.mutationId,
            status: existingMutation.status as MutationStatus,
            record: existingMutation.resultData as unknown as SyncInvoiceDto | undefined,
          });
          continue;
        }

        let result: InvoiceMutationResultDto;

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
            entity: 'invoice',
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
  ): Promise<InvoiceMutationResultDto> {
    // Verify client belongs to user
    const client = await this.prisma.client.findFirst({
      where: {
        id: mutation.record.clientId,
        userId,
      },
    });

    if (!client) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Client not found or does not belong to you',
      };
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(userId);

    // Calculate total
    const subtotal = new Decimal(mutation.record.subtotal || 0);
    const tax = new Decimal(mutation.record.tax || 0);
    const discount = new Decimal(mutation.record.discount || 0);
    const total = subtotal.add(tax).sub(discount);

    // DueDate is required, default to 30 days from now if not provided
    const dueDate = mutation.record.dueDate
      ? new Date(mutation.record.dueDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        id: mutation.record.id,
        userId,
        clientId: mutation.record.clientId,
        workOrderId: mutation.record.workOrderId || null,
        invoiceNumber,
        status: mutation.record.status || InvoiceStatus.PENDING,
        subtotal,
        tax,
        discount,
        total,
        dueDate,
        paidDate: mutation.record.paidAt
          ? new Date(mutation.record.paidAt)
          : null,
        notes: mutation.record.notes,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncInvoiceDto(invoice),
    };
  }

  private async processUpdate(
    userId: string,
    mutation: any,
  ): Promise<InvoiceMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Invoice ID is required for update',
      };
    }

    // Find existing invoice
    const existing = await this.prisma.invoice.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Invoice not found',
      };
    }

    // Last-write-wins conflict resolution
    const clientUpdatedAt = new Date(mutation.clientUpdatedAt);
    if (existing.updatedAt > clientUpdatedAt) {
      const serverInvoice = await this.prisma.invoice.findFirst({
        where: { id: mutation.record.id },
        include: {
          client: { select: { id: true, name: true } },
        },
      });
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Server has newer version',
        record: serverInvoice ? this.toSyncInvoiceDto(serverInvoice) : undefined,
      };
    }

    // Apply update
    const updateData: any = {};
    if (mutation.record.status !== undefined)
      updateData.status = mutation.record.status;
    if (mutation.record.subtotal !== undefined)
      updateData.subtotal = new Decimal(mutation.record.subtotal);
    if (mutation.record.tax !== undefined)
      updateData.tax = new Decimal(mutation.record.tax);
    if (mutation.record.discount !== undefined)
      updateData.discount = new Decimal(mutation.record.discount);
    if (mutation.record.dueDate !== undefined)
      updateData.dueDate = new Date(mutation.record.dueDate);
    if (mutation.record.paidAt !== undefined)
      updateData.paidDate = mutation.record.paidAt
        ? new Date(mutation.record.paidAt)
        : null;
    if (mutation.record.notes !== undefined)
      updateData.notes = mutation.record.notes;

    // Recalculate total if values changed
    if (
      updateData.subtotal !== undefined ||
      updateData.tax !== undefined ||
      updateData.discount !== undefined
    ) {
      const subtotal = updateData.subtotal || new Decimal(existing.subtotal.toString());
      const tax = updateData.tax || new Decimal(existing.tax.toString());
      const discount = updateData.discount || new Decimal(existing.discount.toString());
      updateData.total = subtotal.add(tax).sub(discount);
    }

    const invoice = await this.prisma.invoice.update({
      where: { id: mutation.record.id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncInvoiceDto(invoice),
    };
  }

  private async processDelete(
    userId: string,
    mutation: any,
  ): Promise<InvoiceMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Invoice ID is required for delete',
      };
    }

    const existing = await this.prisma.invoice.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Invoice not found',
      };
    }

    // Hard delete (Invoice schema doesn't have deletedAt)
    await this.prisma.invoice.delete({
      where: { id: mutation.record.id },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncInvoiceDto(existing),
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private async generateInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}`;

    // Get the last invoice number for this year
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        userId,
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0', 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  private toSyncInvoiceDto(invoice: any): SyncInvoiceDto {
    return {
      id: invoice.id,
      technicianId: invoice.userId,
      clientId: invoice.clientId,
      clientName: invoice.client?.name,
      workOrderId: invoice.workOrderId || undefined,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status as InvoiceStatus,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      dueDate: invoice.dueDate?.toISOString() || undefined,
      paidAt: invoice.paidDate?.toISOString() || undefined,
      notes: invoice.notes || undefined,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
