import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { AddQuoteItemDto, QuoteItemType } from './dto/add-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { QuoteStatus } from './dto/update-quote-status.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, QuoteSentContext, QuoteApprovedContext } from '../notifications/notifications.types';
import { ItemType } from '@prisma/client';
import { DomainEventsService } from '../domain-events/domain-events.service';

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private planLimitsService: PlanLimitsService,
    private domainEventsService: DomainEventsService,
  ) {}

  async create(userId: string, createQuoteDto: CreateQuoteDto) {
    // Check plan limit before creating
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'QUOTE',
    });

    // Verify that the client belongs to the user
    const client = await this.prisma.client.findFirst({
      where: {
        id: createQuoteDto.clientId,
        userId,
      },
    });

    if (!client) {
      throw new ForbiddenException(
        `Client with ID ${createQuoteDto.clientId} not found or does not belong to you`,
      );
    }

    // Separate items from catalog and manual items
    const catalogItemDtos = createQuoteDto.items.filter((item) => item.itemId);
    const manualItemDtos = createQuoteDto.items.filter((item) => !item.itemId);

    // Fetch catalog items to get their details for snapshot
    const itemIds = catalogItemDtos.map((item) => item.itemId!).filter(Boolean);
    const catalogItems = itemIds.length > 0
      ? await this.prisma.item.findMany({
          where: {
            id: { in: itemIds },
            userId,
          },
        })
      : [];

    if (catalogItems.length !== itemIds.length) {
      throw new BadRequestException('One or more catalog items not found or do not belong to you');
    }

    // Create a map for quick lookup
    const itemsMap = new Map(catalogItems.map((item) => [item.id, item]));

    // Process catalog items
    const catalogQuoteItems = catalogItemDtos.map((dtoItem) => {
      const catalogItem = itemsMap.get(dtoItem.itemId!);
      if (!catalogItem) {
        throw new BadRequestException(`Item ${dtoItem.itemId} not found`);
      }

      const quantity = new Decimal(dtoItem.quantity);
      const unitPrice = dtoItem.unitPrice !== undefined
        ? new Decimal(dtoItem.unitPrice)
        : catalogItem.basePrice;
      const discountValue = new Decimal(0);
      const totalPrice = quantity.mul(unitPrice).sub(discountValue);

      // SNAPSHOT: Copy item details at creation time
      return {
        itemId: dtoItem.itemId,
        name: catalogItem.name,
        type: catalogItem.type,
        unit: catalogItem.unit,
        quantity,
        unitPrice,
        discountValue,
        totalPrice,
      };
    });

    // Process manual items
    const manualQuoteItems = manualItemDtos.map((dtoItem) => {
      if (!dtoItem.name || !dtoItem.unit || dtoItem.unitPrice === undefined) {
        throw new BadRequestException(
          'For manual items, name, unit, and unitPrice are required',
        );
      }

      const quantity = new Decimal(dtoItem.quantity);
      const unitPrice = new Decimal(dtoItem.unitPrice);
      const discountValue = new Decimal(0);
      const totalPrice = quantity.mul(unitPrice).sub(discountValue);

      return {
        itemId: null, // Manual items don't have a catalog reference
        name: dtoItem.name,
        type: (dtoItem.type as ItemType) || ItemType.SERVICE,
        unit: dtoItem.unit,
        quantity,
        unitPrice,
        discountValue,
        totalPrice,
      };
    });

    // Combine all quote items
    const quoteItems = [...catalogQuoteItems, ...manualQuoteItems];

    // Calculate total
    const itemsTotal = quoteItems.reduce(
      (sum, item) => sum.add(item.totalPrice),
      new Decimal(0),
    );

    const discountValue = new Decimal(createQuoteDto.discountValue || 0);
    let totalValue = itemsTotal.sub(discountValue);

    // Ensure total is not negative
    if (totalValue.lessThan(0)) {
      throw new BadRequestException(
        'Discount value cannot be greater than items total',
      );
    }

    // Create quote with items (including snapshot data)
    return this.prisma.quote.create({
      data: {
        userId,
        clientId: createQuoteDto.clientId,
        status: 'DRAFT',
        discountValue,
        totalValue,
        notes: createQuoteDto.notes,
        items: {
          create: quoteItems,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  async findAll(userId: string, clientId?: string, status?: QuoteStatus) {
    const where: any = { userId };

    if (clientId) {
      // Verify that the client belongs to the user
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, userId },
      });

      if (!client) {
        throw new ForbiddenException(
          `Client with ID ${clientId} not found or does not belong to you`,
        );
      }

      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.quote.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const quote = await this.prisma.quote.findFirst({
      where: { id, userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                description: true,
                type: true,
                unit: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    return quote;
  }

  async update(userId: string, id: string, updateQuoteDto: UpdateQuoteDto) {
    const quote = await this.findOne(userId, id);

    const updateData: any = {};

    if (updateQuoteDto.notes !== undefined) {
      updateData.notes = updateQuoteDto.notes;
    }

    if (updateQuoteDto.validUntil !== undefined) {
      updateData.validUntil = new Date(updateQuoteDto.validUntil);
    }

    // If discount changes, recalculate total
    if (updateQuoteDto.discountValue !== undefined) {
      const discountValue = new Decimal(updateQuoteDto.discountValue);

      // Calculate items total
      const itemsTotal = quote.items.reduce(
        (sum, item) => sum.add(new Decimal(item.totalPrice.toString())),
        new Decimal(0),
      );

      const newTotal = itemsTotal.sub(discountValue);

      if (newTotal.lessThan(0)) {
        throw new BadRequestException(
          'Discount value cannot be greater than items total',
        );
      }

      updateData.discountValue = discountValue;
      updateData.totalValue = newTotal;
    }

    return this.prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.quote.delete({
      where: { id },
    });
  }

  /**
   * Add item to quote
   * Supports two modes:
   * 1. From catalog: provide itemId to snapshot from the catalog
   * 2. Manual: provide name, type, unit, unitPrice directly (no itemId)
   */
  async addItem(userId: string, quoteId: string, dto: AddQuoteItemDto) {
    const quote = await this.findOne(userId, quoteId);

    let name: string;
    let type: ItemType;
    let unit: string;
    let unitPrice: Decimal;
    let itemId: string | null = null;

    if (dto.itemId) {
      // Mode 1: From catalog - snapshot item details
      const catalogItem = await this.prisma.item.findFirst({
        where: {
          id: dto.itemId,
          userId,
        },
      });

      if (!catalogItem) {
        throw new BadRequestException(
          `Item with ID ${dto.itemId} not found or does not belong to you`,
        );
      }

      itemId = dto.itemId;
      name = catalogItem.name;
      type = catalogItem.type;
      unit = catalogItem.unit;
      // Use override price if provided, otherwise use catalog price
      unitPrice = dto.unitPrice !== undefined
        ? new Decimal(dto.unitPrice)
        : catalogItem.basePrice;
    } else {
      // Mode 2: Manual item - use provided values
      if (!dto.name || !dto.unit || dto.unitPrice === undefined) {
        throw new BadRequestException(
          'For manual items, name, unit, and unitPrice are required',
        );
      }

      name = dto.name;
      type = (dto.type as ItemType) || ItemType.PRODUCT;
      unit = dto.unit;
      unitPrice = new Decimal(dto.unitPrice);
    }

    const quantity = new Decimal(dto.quantity);
    const discountValue = dto.discountValue ? new Decimal(dto.discountValue) : new Decimal(0);
    const totalPrice = quantity.mul(unitPrice).sub(discountValue);

    // Add item to quote with SNAPSHOT data
    await this.prisma.quoteItem.create({
      data: {
        quoteId,
        itemId,
        name,
        type,
        unit,
        quantity,
        unitPrice,
        discountValue,
        totalPrice,
      },
    });

    // Recalculate quote total
    await this.recalculateQuoteTotal(quoteId);

    return this.findOne(userId, quoteId);
  }

  async updateItem(
    userId: string,
    quoteId: string,
    itemId: string,
    dto: UpdateQuoteItemDto,
  ) {
    const quote = await this.findOne(userId, quoteId);

    const quoteItem = await this.prisma.quoteItem.findFirst({
      where: {
        id: itemId,
        quoteId,
      },
    });

    if (!quoteItem) {
      throw new NotFoundException(`Quote item with ID ${itemId} not found`);
    }

    // Recalculate totalPrice
    const quantity = new Decimal(dto.quantity);
    const unitPrice = new Decimal(quoteItem.unitPrice.toString());
    const discountValue = new Decimal(quoteItem.discountValue.toString());
    const totalPrice = quantity.mul(unitPrice).sub(discountValue);

    // Update item
    await this.prisma.quoteItem.update({
      where: { id: itemId },
      data: {
        quantity,
        totalPrice,
      },
    });

    // Recalculate quote total
    await this.recalculateQuoteTotal(quoteId);

    return this.findOne(userId, quoteId);
  }

  async removeItem(userId: string, quoteId: string, itemId: string) {
    const quote = await this.findOne(userId, quoteId);

    const quoteItem = await this.prisma.quoteItem.findFirst({
      where: {
        id: itemId,
        quoteId,
      },
    });

    if (!quoteItem) {
      throw new NotFoundException(`Quote item with ID ${itemId} not found`);
    }

    // Remove item
    await this.prisma.quoteItem.delete({
      where: { id: itemId },
    });

    // Recalculate quote total
    await this.recalculateQuoteTotal(quoteId);

    return this.findOne(userId, quoteId);
  }

  async updateStatus(userId: string, id: string, newStatus: QuoteStatus) {
    const quote = await this.findOne(userId, id);

    // Validate status transition
    this.validateStatusTransition(quote.status as QuoteStatus, newStatus);

    // Prepare update data - set sentAt when status changes to SENT
    const updateData: any = { status: newStatus };
    if (newStatus === QuoteStatus.SENT && !quote.sentAt) {
      updateData.sentAt = new Date();
    }

    const updatedQuote = await this.prisma.quote.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    // Send notifications based on status change
    await this.sendStatusChangeNotification(userId, updatedQuote, newStatus);

    // Create domain event for push notification
    const eventTypeMap: Record<string, string> = {
      [QuoteStatus.SENT]: 'quote.sent',
      [QuoteStatus.APPROVED]: 'quote.approved',
      [QuoteStatus.REJECTED]: 'quote.rejected',
      [QuoteStatus.EXPIRED]: 'quote.expired',
    };

    const eventType = eventTypeMap[newStatus] || 'quote.updated';

    await this.domainEventsService.createEvent({
      type: eventType as any,
      entity: 'quote',
      entityId: id,
      targetUserId: userId,
      payload: {
        status: newStatus,
        clientName: updatedQuote.client.name,
        totalValue: Number(updatedQuote.totalValue),
      },
    });

    return updatedQuote;
  }

  /**
   * Send notification when quote status changes
   */
  private async sendStatusChangeNotification(
    userId: string,
    quote: any,
    newStatus: QuoteStatus,
  ): Promise<void> {
    try {
      if (newStatus === QuoteStatus.SENT) {
        const context: QuoteSentContext = {
          clientName: quote.client.name,
          clientEmail: quote.client.email,
          clientPhone: quote.client.phone,
          quoteId: quote.id,
          quoteNumber: quote.id.substring(0, 8).toUpperCase(),
          totalValue: Number(quote.totalValue),
          items: quote.items.map((qi: any) => ({
            name: qi.name, // Use snapshot name
            quantity: Number(qi.quantity),
            unitPrice: Number(qi.unitPrice),
          })),
        };

        await this.notificationsService.sendNotification({
          userId,
          clientId: quote.client.id,
          quoteId: quote.id,
          type: NotificationType.QUOTE_SENT,
          contextData: context,
        });

        this.logger.log(`Quote sent notification triggered for quote ${quote.id}`);
      } else if (newStatus === QuoteStatus.APPROVED) {
        const context: QuoteApprovedContext = {
          clientName: quote.client.name,
          clientEmail: quote.client.email,
          clientPhone: quote.client.phone,
          quoteId: quote.id,
          quoteNumber: quote.id.substring(0, 8).toUpperCase(),
          totalValue: Number(quote.totalValue),
        };

        await this.notificationsService.sendNotification({
          userId,
          clientId: quote.client.id,
          quoteId: quote.id,
          type: NotificationType.QUOTE_APPROVED,
          contextData: context,
        });

        this.logger.log(`Quote approved notification triggered for quote ${quote.id}`);
      }
    } catch (error) {
      // Log error but don't fail the status update
      this.logger.error(
        `Failed to send quote notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private validateStatusTransition(currentStatus: QuoteStatus, newStatus: QuoteStatus) {
    const validTransitions: Record<QuoteStatus, QuoteStatus[]> = {
      [QuoteStatus.DRAFT]: [QuoteStatus.SENT, QuoteStatus.EXPIRED],
      [QuoteStatus.SENT]: [QuoteStatus.APPROVED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED],
      [QuoteStatus.APPROVED]: [QuoteStatus.EXPIRED],
      [QuoteStatus.REJECTED]: [QuoteStatus.EXPIRED],
      [QuoteStatus.EXPIRED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async recalculateQuoteTotal(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    // Calculate items total
    const itemsTotal = quote.items.reduce(
      (sum, item) => sum.add(new Decimal(item.totalPrice.toString())),
      new Decimal(0),
    );

    const discountValue = new Decimal(quote.discountValue.toString());
    const totalValue = itemsTotal.sub(discountValue);

    // Ensure total is not negative
    if (totalValue.lessThan(0)) {
      throw new BadRequestException(
        'Total cannot be negative after removing item. Adjust discount first.',
      );
    }

    await this.prisma.quote.update({
      where: { id: quoteId },
      data: { totalValue },
    });
  }
}
