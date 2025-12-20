import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { AttachmentType } from '../file-storage/dto/upload-file.dto';
import { createHash } from 'crypto';
import {
  SyncPullQueryDto,
  SyncQuotesPullResponseDto,
  SyncQuotesPushBodyDto,
  SyncQuotesPushResponseDto,
  MutationAction,
  MutationStatus,
  SyncScope,
  SyncQuoteDto,
  SyncQuoteItemDto,
  SyncQuoteSignatureDto,
  QuoteMutationResultDto,
} from './dto/sync-quotes.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { ItemType } from '@prisma/client';

@Injectable()
export class QuotesSyncService {
  private readonly logger = new Logger(QuotesSyncService.name);

  private readonly apiUrl: string;

  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
    @Inject(forwardRef(() => FileStorageService))
    private fileStorageService: FileStorageService,
  ) {
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
  }

  private buildFileUrl(publicUrl: string | null): string | null {
    if (!publicUrl) return null;
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return publicUrl;
    }
    return `${this.apiUrl}${publicUrl.startsWith('/') ? '' : '/'}${publicUrl}`;
  }

  // =============================================================================
  // PULL - Delta Sync with Cursor Pagination
  // =============================================================================

  async pull(
    userId: string,
    query: SyncPullQueryDto,
  ): Promise<SyncQuotesPullResponseDto> {
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
    const total = await this.prisma.quote.count({
      where: { userId, ...(since ? { updatedAt: { gte: since } } : {}) },
    });

    // Fetch quotes with cursor-based pagination
    const quotes = await this.prisma.quote.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        signatures: {
          include: {
            attachment: {
              select: {
                id: true,
                publicUrl: true,
              },
            },
          },
          orderBy: {
            signedAt: 'desc',
          },
          take: 1, // Only the most recent signature
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1, // Fetch one extra to check if there are more
    });

    // Check if there are more records
    const hasMore = quotes.length > limit;
    const items = hasMore ? quotes.slice(0, limit) : quotes;

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
    const responseItems: SyncQuoteDto[] = items.map((quote) =>
      this.toSyncQuoteDto(quote),
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
    body: SyncQuotesPushBodyDto,
  ): Promise<SyncQuotesPushResponseDto> {
    const results: QuoteMutationResultDto[] = [];

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
            record: existingMutation.resultData as unknown as SyncQuoteDto | undefined,
          });
          continue;
        }

        // Process mutation based on action
        let result: QuoteMutationResultDto;

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
            entity: 'quote',
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
  ): Promise<QuoteMutationResultDto> {
    // Check plan limit
    try {
      await this.planLimitsService.checkLimitOrThrow({
        userId,
        resource: 'QUOTE',
      });
    } catch (error) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Quote limit reached for current plan',
      };
    }

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

    // Process items if provided
    const quoteItems = this.processQuoteItems(mutation.record.items || []);

    // Calculate totals
    const itemsTotal = quoteItems.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Decimal(0),
    );
    const discountValue = new Decimal(mutation.record.discountValue || 0);
    const totalValue = itemsTotal.sub(discountValue);

    // Create quote with items
    const quote = await this.prisma.quote.create({
      data: {
        id: mutation.record.id, // Use client-provided ID if exists
        userId,
        clientId: mutation.record.clientId,
        status: mutation.record.status || 'DRAFT',
        discountValue,
        totalValue,
        notes: mutation.record.notes,
        visitScheduledAt: mutation.record.visitScheduledAt
          ? new Date(mutation.record.visitScheduledAt)
          : null,
        items: {
          create: quoteItems.map((item) => ({
            id: item.id,
            itemId: item.itemId,
            name: item.name,
            type: item.type,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountValue: item.discountValue,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncQuoteDto(quote),
    };
  }

  private async processUpdate(
    userId: string,
    mutation: any,
  ): Promise<QuoteMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Quote ID is required for update',
      };
    }

    // Find existing quote
    const existing = await this.prisma.quote.findFirst({
      where: { id: mutation.record.id, userId },
      include: { items: true, signatures: true },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Quote not found',
      };
    }

    // Last-write-wins conflict resolution
    const clientUpdatedAt = new Date(mutation.clientUpdatedAt);
    if (existing.updatedAt > clientUpdatedAt) {
      // Server has newer data, return server version
      const serverQuote = await this.prisma.quote.findFirst({
        where: { id: mutation.record.id },
        include: {
          client: { select: { id: true, name: true } },
          items: { orderBy: { createdAt: 'asc' } },
          signatures: {
            include: { attachment: { select: { id: true, publicUrl: true } } },
            orderBy: { signedAt: 'desc' },
            take: 1,
          },
        },
      });
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Server has newer version',
        record: serverQuote ? this.toSyncQuoteDto(serverQuote) : undefined,
      };
    }

    // Process signature if provided (from mobile app)
    let signatureId: string | null = null;
    if (mutation.record.signature && !existing.signatures.length) {
      try {
        signatureId = await this.processSignature(
          userId,
          mutation.record.id,
          existing.clientId,
          mutation.record.signature,
        );
      } catch (error) {
        this.logger.error(`Failed to process signature: ${error.message}`);
      }
    }

    // Apply update within transaction
    const quote = await this.prisma.$transaction(async (tx) => {
      // Update quote fields
      const updateData: any = {};
      if (mutation.record.status !== undefined)
        updateData.status = mutation.record.status;
      if (mutation.record.discountValue !== undefined)
        updateData.discountValue = new Decimal(mutation.record.discountValue);
      if (mutation.record.notes !== undefined)
        updateData.notes = mutation.record.notes;
      if (mutation.record.visitScheduledAt !== undefined)
        updateData.visitScheduledAt = mutation.record.visitScheduledAt
          ? new Date(mutation.record.visitScheduledAt)
          : null;

      // Handle items update if provided
      if (mutation.record.items) {
        // Delete existing items
        await tx.quoteItem.deleteMany({
          where: { quoteId: mutation.record.id },
        });

        // Create new items
        const quoteItems = this.processQuoteItems(mutation.record.items);
        for (const item of quoteItems) {
          await tx.quoteItem.create({
            data: {
              id: item.id,
              quoteId: mutation.record.id,
              itemId: item.itemId,
              name: item.name,
              type: item.type,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountValue: item.discountValue,
              totalPrice: item.totalPrice,
            },
          });
        }

        // Recalculate totals
        const itemsTotal = quoteItems.reduce(
          (sum, item) => sum.add(item.totalPrice),
          new Decimal(0),
        );
        const discountValue =
          updateData.discountValue ||
          new Decimal(existing.discountValue.toString());
        updateData.totalValue = itemsTotal.sub(discountValue);
      } else if (updateData.discountValue !== undefined) {
        // Only discount changed, recalculate total
        const itemsTotal = existing.items.reduce(
          (sum, item) => sum.add(new Decimal(item.totalPrice.toString())),
          new Decimal(0),
        );
        updateData.totalValue = itemsTotal.sub(updateData.discountValue);
      }

      return tx.quote.update({
        where: { id: mutation.record.id },
        data: updateData,
        include: {
          client: { select: { id: true, name: true } },
          items: { orderBy: { createdAt: 'asc' } },
          signatures: {
            include: { attachment: { select: { id: true, publicUrl: true } } },
            orderBy: { signedAt: 'desc' },
            take: 1,
          },
        },
      });
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncQuoteDto(quote),
    };
  }

  /**
   * Process signature from mobile app sync
   */
  private async processSignature(
    userId: string,
    quoteId: string,
    clientId: string,
    signatureData: {
      signerName: string;
      signerDocument?: string;
      signerRole?: string;
      signatureImageBase64: string;
      signedAt?: string;
    },
  ): Promise<string> {
    // Upload signature image
    const attachment = await this.fileStorageService.uploadFromBase64(
      userId,
      signatureData.signatureImageBase64,
      {
        type: AttachmentType.SIGNATURE,
        quoteId,
        clientId,
        description: `Assinatura de aceite - ${signatureData.signerName}`,
        category: 'QUOTE_SIGNATURE',
      },
    );

    // Create hash for integrity
    const hashData = JSON.stringify({
      quoteId,
      signerName: signatureData.signerName,
      signerDocument: signatureData.signerDocument,
      signedAt: signatureData.signedAt || new Date().toISOString(),
      attachmentId: attachment.id,
    });
    const hash = createHash('sha256').update(hashData).digest('hex');

    // Create signature record
    const signature = await this.prisma.signature.create({
      data: {
        userId,
        clientId,
        quoteId,
        attachmentId: attachment.id,
        signerName: signatureData.signerName,
        signerDocument: signatureData.signerDocument,
        signerRole: signatureData.signerRole || 'Cliente',
        hash,
        signedAt: signatureData.signedAt ? new Date(signatureData.signedAt) : new Date(),
      },
    });

    this.logger.log(`Signature ${signature.id} created for quote ${quoteId} via sync`);

    return signature.id;
  }

  private async processDelete(
    userId: string,
    mutation: any,
  ): Promise<QuoteMutationResultDto> {
    if (!mutation.record.id) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Quote ID is required for delete',
      };
    }

    // Find existing quote
    const existing = await this.prisma.quote.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Quote not found',
      };
    }

    // Mark as expired (Quote schema doesn't have deletedAt)
    const quote = await this.prisma.quote.update({
      where: { id: mutation.record.id },
      data: { status: 'EXPIRED' },
      include: {
        client: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncQuoteDto(quote),
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private processQuoteItems(items: any[]): {
    id?: string;
    itemId: string | null;
    name: string;
    type: ItemType;
    unit: string;
    quantity: Decimal;
    unitPrice: Decimal;
    discountValue: Decimal;
    totalPrice: Decimal;
  }[] {
    return items.map((item) => {
      const quantity = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice);
      const discountValue = new Decimal(item.discountValue || 0);
      const totalPrice = quantity.mul(unitPrice).sub(discountValue);

      return {
        id: item.id,
        itemId: item.itemId || null,
        name: item.name,
        type: (item.type as ItemType) || ItemType.SERVICE,
        unit: item.unit || 'un',
        quantity,
        unitPrice,
        discountValue,
        totalPrice,
      };
    });
  }

  private toSyncQuoteDto(quote: any): SyncQuoteDto {
    // Get the first signature if exists
    const signature = quote.signatures?.[0];

    return {
      id: quote.id,
      technicianId: quote.userId,
      clientId: quote.clientId,
      clientName: quote.client?.name,
      status: quote.status,
      discountValue: Number(quote.discountValue),
      totalValue: Number(quote.totalValue),
      notes: quote.notes || undefined,
      sentAt: quote.sentAt?.toISOString() || undefined,
      visitScheduledAt: quote.visitScheduledAt?.toISOString() || undefined,
      items: (quote.items || []).map((item: any) => this.toSyncQuoteItemDto(item)),
      signature: signature ? this.toSyncSignatureDto(signature) : undefined,
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    };
  }

  private toSyncSignatureDto(signature: any): SyncQuoteSignatureDto {
    return {
      id: signature.id,
      signerName: signature.signerName,
      signerDocument: signature.signerDocument || undefined,
      signerRole: signature.signerRole || undefined,
      signatureImageUrl: this.buildFileUrl(signature.attachment?.publicUrl) || undefined,
      signedAt: signature.signedAt?.toISOString() || new Date().toISOString(),
      createdAt: signature.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  private toSyncQuoteItemDto(item: any): SyncQuoteItemDto {
    return {
      id: item.id,
      quoteId: item.quoteId,
      itemId: item.itemId || undefined,
      name: item.name,
      type: item.type,
      unit: item.unit,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountValue: Number(item.discountValue),
      totalPrice: Number(item.totalPrice),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
