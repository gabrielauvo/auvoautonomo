import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AddEquipmentDto } from './dto/add-equipment.dto';
import { AddWorkOrderItemDto } from './dto/add-work-order-item.dto';
import { UpdateWorkOrderItemDto } from './dto/update-work-order-item.dto';
import { WorkOrderStatus } from './dto/update-work-order-status.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, WorkOrderCreatedContext, WorkOrderCompletedContext } from '../notifications/notifications.types';
import { Decimal } from '@prisma/client/runtime/library';
import { ItemType, ChecklistInstanceStatus, WorkOrderStatus as PrismaWorkOrderStatus } from '@prisma/client';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private planLimitsService: PlanLimitsService,
    private domainEventsService: DomainEventsService,
    private inventoryService: InventoryService,
  ) {}

  async create(userId: string, createWorkOrderDto: CreateWorkOrderDto) {
    // Check plan limit before creating
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'WORK_ORDER',
    });

    // Verify that the client belongs to the user
    const client = await this.prisma.client.findFirst({
      where: {
        id: createWorkOrderDto.clientId,
        userId,
      },
    });

    if (!client) {
      throw new ForbiddenException(
        `Client with ID ${createWorkOrderDto.clientId} not found or does not belong to you`,
      );
    }

    // If quoteId is provided, verify it belongs to the user and client
    let quoteItems: any[] = [];
    let quoteTotalValue: Decimal | null = null;

    if (createWorkOrderDto.quoteId) {
      const quote = await this.prisma.quote.findFirst({
        where: {
          id: createWorkOrderDto.quoteId,
          userId,
          clientId: createWorkOrderDto.clientId,
        },
        include: {
          items: true,
        },
      });

      if (!quote) {
        throw new ForbiddenException(
          `Quote with ID ${createWorkOrderDto.quoteId} not found or does not belong to you and this client`,
        );
      }

      // Verify quote is approved
      if (quote.status !== 'APPROVED') {
        throw new BadRequestException(
          `Quote must be APPROVED to create a work order. Current status: ${quote.status}`,
        );
      }

      // Check if quote already has a work order
      const existingWO = await this.prisma.workOrder.findFirst({
        where: { quoteId: createWorkOrderDto.quoteId },
      });

      if (existingWO) {
        throw new BadRequestException(
          `Quote ${createWorkOrderDto.quoteId} already has a work order`,
        );
      }

      // Store quote items and total for later use
      quoteItems = quote.items;
      quoteTotalValue = quote.totalValue;
    }

    // Verify equipments belong to user and client (if provided)
    if (createWorkOrderDto.equipmentIds && createWorkOrderDto.equipmentIds.length > 0) {
      const equipments = await this.prisma.equipment.findMany({
        where: {
          id: { in: createWorkOrderDto.equipmentIds },
          userId,
          clientId: createWorkOrderDto.clientId,
        },
      });

      if (equipments.length !== createWorkOrderDto.equipmentIds.length) {
        throw new BadRequestException(
          'One or more equipments not found or do not belong to you and this client',
        );
      }
    }

    // Prepare data
    const data: any = {
      userId,
      clientId: createWorkOrderDto.clientId,
      title: createWorkOrderDto.title,
      status: 'SCHEDULED',
    };

    if (createWorkOrderDto.quoteId) data.quoteId = createWorkOrderDto.quoteId;
    if (createWorkOrderDto.description) data.description = createWorkOrderDto.description;
    if (createWorkOrderDto.scheduledDate) {
      data.scheduledDate = new Date(createWorkOrderDto.scheduledDate);
    }
    if (createWorkOrderDto.scheduledStartTime) {
      data.scheduledStartTime = new Date(createWorkOrderDto.scheduledStartTime);
    }
    if (createWorkOrderDto.scheduledEndTime) {
      data.scheduledEndTime = new Date(createWorkOrderDto.scheduledEndTime);
    }
    if (createWorkOrderDto.address) data.address = createWorkOrderDto.address;
    if (createWorkOrderDto.notes) data.notes = createWorkOrderDto.notes;
    if (createWorkOrderDto.workOrderTypeId) data.workOrderTypeId = createWorkOrderDto.workOrderTypeId;

    // Set totalValue from quote if available
    if (quoteTotalValue !== null) {
      data.totalValue = quoteTotalValue;
    }

    // Create work order with equipments
    if (createWorkOrderDto.equipmentIds && createWorkOrderDto.equipmentIds.length > 0) {
      data.equipments = {
        create: createWorkOrderDto.equipmentIds.map((equipmentId) => ({
          equipmentId,
        })),
      };
    }

    // Copy items from quote if available (SNAPSHOT pattern)
    if (quoteItems.length > 0) {
      data.items = {
        create: quoteItems.map((qi) => ({
          quoteItemId: qi.id,
          itemId: qi.itemId,
          name: qi.name,
          type: qi.type,
          unit: qi.unit,
          quantity: qi.quantity,
          unitPrice: qi.unitPrice,
          discountValue: qi.discountValue,
          totalPrice: qi.totalPrice,
        })),
      };
    }

    const workOrder = await this.prisma.workOrder.create({
      data,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        quote: {
          select: {
            id: true,
            totalValue: true,
            status: true,
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
        equipments: {
          include: {
            equipment: {
              select: {
                id: true,
                type: true,
                brand: true,
                model: true,
              },
            },
          },
        },
      },
    });

    // Create checklist instance if checklistTemplateId is provided
    if (createWorkOrderDto.checklistTemplateId) {
      await this.createChecklistInstanceFromTemplate(
        userId,
        workOrder.id,
        createWorkOrderDto.checklistTemplateId,
      );
    }

    // Send notification for work order creation
    await this.sendWorkOrderCreatedNotification(userId, workOrder);

    // Create domain event for push notification
    await this.domainEventsService.createEvent({
      type: 'work_order.created',
      entity: 'work_order',
      entityId: workOrder.id,
      targetUserId: userId,
      payload: {
        title: workOrder.title,
        status: workOrder.status,
        clientName: workOrder.client.name,
        scheduledDate: workOrder.scheduledDate?.toISOString(),
      },
    });

    return workOrder;
  }

  async findAll(
    userId: string,
    clientId?: string,
    status?: WorkOrderStatus,
    startDate?: string,
    endDate?: string,
  ) {
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

    // Filter by date range
    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) {
        where.scheduledDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.scheduledDate.lte = new Date(endDate);
      }
    }

    return this.prisma.workOrder.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        workOrderType: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            equipments: true,
            items: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
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
        quote: {
          select: {
            id: true,
            totalValue: true,
            discountValue: true,
            status: true,
          },
        },
        workOrderType: {
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
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
        equipments: {
          include: {
            equipment: {
              select: {
                id: true,
                type: true,
                brand: true,
                model: true,
                serialNumber: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID ${id} not found`);
    }

    return workOrder;
  }

  async update(userId: string, id: string, updateWorkOrderDto: UpdateWorkOrderDto) {
    const workOrder = await this.findOne(userId, id);

    // Cannot update if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot update work order with status ${workOrder.status}`,
      );
    }

    const updateData: any = {};

    if (updateWorkOrderDto.title !== undefined) updateData.title = updateWorkOrderDto.title;
    if (updateWorkOrderDto.description !== undefined) {
      updateData.description = updateWorkOrderDto.description;
    }
    if (updateWorkOrderDto.scheduledDate !== undefined) {
      updateData.scheduledDate = updateWorkOrderDto.scheduledDate
        ? new Date(updateWorkOrderDto.scheduledDate)
        : null;
    }
    if (updateWorkOrderDto.scheduledStartTime !== undefined) {
      updateData.scheduledStartTime = updateWorkOrderDto.scheduledStartTime
        ? new Date(updateWorkOrderDto.scheduledStartTime)
        : null;
    }
    if (updateWorkOrderDto.scheduledEndTime !== undefined) {
      updateData.scheduledEndTime = updateWorkOrderDto.scheduledEndTime
        ? new Date(updateWorkOrderDto.scheduledEndTime)
        : null;
    }
    if (updateWorkOrderDto.executionStart !== undefined) {
      updateData.executionStart = updateWorkOrderDto.executionStart
        ? new Date(updateWorkOrderDto.executionStart)
        : null;
    }
    if (updateWorkOrderDto.executionEnd !== undefined) {
      updateData.executionEnd = updateWorkOrderDto.executionEnd
        ? new Date(updateWorkOrderDto.executionEnd)
        : null;
    }
    if (updateWorkOrderDto.address !== undefined) updateData.address = updateWorkOrderDto.address;
    if (updateWorkOrderDto.notes !== undefined) updateData.notes = updateWorkOrderDto.notes;
    if (updateWorkOrderDto.workOrderTypeId !== undefined) {
      updateData.workOrderTypeId = updateWorkOrderDto.workOrderTypeId;
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        quote: {
          select: {
            id: true,
            totalValue: true,
          },
        },
        equipments: {
          include: {
            equipment: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const workOrder = await this.findOne(userId, id);

    // Cannot delete if status is IN_PROGRESS or DONE
    if (workOrder.status === 'IN_PROGRESS' || workOrder.status === 'DONE') {
      throw new BadRequestException(
        `Cannot delete work order with status ${workOrder.status}. Cancel it instead.`,
      );
    }

    return this.prisma.workOrder.delete({
      where: { id },
    });
  }

  async updateStatus(userId: string, id: string, newStatus: WorkOrderStatus) {
    const workOrder = await this.findOne(userId, id);

    // Validate status transition
    this.validateStatusTransition(workOrder.status as WorkOrderStatus, newStatus);

    // If transitioning to DONE, validate checklists are complete
    if (newStatus === WorkOrderStatus.DONE) {
      await this.validateChecklistsComplete(id);
    }

    // If transitioning to IN_PROGRESS and executionStart not set, set it now
    const updateData: any = { status: newStatus };
    if (newStatus === WorkOrderStatus.IN_PROGRESS && !workOrder.executionStart) {
      updateData.executionStart = new Date();
    }

    // If transitioning to DONE and executionEnd not set, set it now
    if (newStatus === WorkOrderStatus.DONE && !workOrder.executionEnd) {
      updateData.executionEnd = new Date();
    }

    const updatedWorkOrder = await this.prisma.workOrder.update({
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
        equipments: {
          include: {
            equipment: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        },
      },
    });

    // Send notification when work order is completed
    if (newStatus === WorkOrderStatus.DONE) {
      await this.sendWorkOrderCompletedNotification(userId, updatedWorkOrder);
    }

    // Process inventory deduction based on configured status
    await this.processInventoryDeduction(userId, id, newStatus as unknown as PrismaWorkOrderStatus);

    // Create domain event for push notification
    const eventType = newStatus === WorkOrderStatus.DONE
      ? 'work_order.completed'
      : newStatus === WorkOrderStatus.CANCELED
        ? 'work_order.cancelled'
        : 'work_order.status_changed';

    await this.domainEventsService.createEvent({
      type: eventType,
      entity: 'work_order',
      entityId: id,
      targetUserId: userId,
      payload: {
        title: updatedWorkOrder.title,
        status: newStatus,
        clientName: updatedWorkOrder.client.name,
      },
    });

    return updatedWorkOrder;
  }

  async addEquipment(userId: string, workOrderId: string, addEquipmentDto: AddEquipmentDto) {
    const workOrder = await this.findOne(userId, workOrderId);

    // Cannot add equipment if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot add equipment to work order with status ${workOrder.status}`,
      );
    }

    // Verify equipment belongs to user and same client
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: addEquipmentDto.equipmentId,
        userId,
        clientId: workOrder.clientId,
      },
    });

    if (!equipment) {
      throw new BadRequestException(
        `Equipment with ID ${addEquipmentDto.equipmentId} not found or does not belong to you and this client`,
      );
    }

    // Check if equipment is already linked
    const existing = await this.prisma.workOrderEquipment.findFirst({
      where: {
        workOrderId,
        equipmentId: addEquipmentDto.equipmentId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Equipment ${addEquipmentDto.equipmentId} is already linked to this work order`,
      );
    }

    // Create link
    await this.prisma.workOrderEquipment.create({
      data: {
        workOrderId,
        equipmentId: addEquipmentDto.equipmentId,
      },
    });

    return this.findOne(userId, workOrderId);
  }

  async removeEquipment(userId: string, workOrderId: string, equipmentId: string) {
    const workOrder = await this.findOne(userId, workOrderId);

    // Cannot remove equipment if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot remove equipment from work order with status ${workOrder.status}`,
      );
    }

    const link = await this.prisma.workOrderEquipment.findFirst({
      where: {
        workOrderId,
        equipmentId,
      },
    });

    if (!link) {
      throw new NotFoundException(
        `Equipment ${equipmentId} is not linked to this work order`,
      );
    }

    await this.prisma.workOrderEquipment.delete({
      where: { id: link.id },
    });

    return this.findOne(userId, workOrderId);
  }

  // ==================== WORK ORDER ITEMS ====================

  /**
   * Add item to work order
   * Supports two modes:
   * 1. From catalog: provide itemId to snapshot from the catalog
   * 2. Manual: provide name, type, unit, unitPrice directly (no itemId)
   */
  async addItem(userId: string, workOrderId: string, dto: AddWorkOrderItemDto) {
    const workOrder = await this.findOne(userId, workOrderId);

    // Cannot add items if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot add items to work order with status ${workOrder.status}`,
      );
    }

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

    // Add item to work order with SNAPSHOT data
    await this.prisma.workOrderItem.create({
      data: {
        workOrderId,
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

    // Recalculate work order total
    await this.recalculateWorkOrderTotal(workOrderId);

    return this.findOne(userId, workOrderId);
  }

  async updateItem(
    userId: string,
    workOrderId: string,
    itemId: string,
    dto: UpdateWorkOrderItemDto,
  ) {
    const workOrder = await this.findOne(userId, workOrderId);

    // Cannot update items if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot update items in work order with status ${workOrder.status}`,
      );
    }

    const workOrderItem = await this.prisma.workOrderItem.findFirst({
      where: {
        id: itemId,
        workOrderId,
      },
    });

    if (!workOrderItem) {
      throw new NotFoundException(`Work order item with ID ${itemId} not found`);
    }

    // Recalculate totalPrice
    const quantity = new Decimal(dto.quantity);
    const unitPrice = new Decimal(workOrderItem.unitPrice.toString());
    const discountValue = new Decimal(workOrderItem.discountValue.toString());
    const totalPrice = quantity.mul(unitPrice).sub(discountValue);

    // Update item
    await this.prisma.workOrderItem.update({
      where: { id: itemId },
      data: {
        quantity,
        totalPrice,
      },
    });

    // Recalculate work order total
    await this.recalculateWorkOrderTotal(workOrderId);

    return this.findOne(userId, workOrderId);
  }

  async removeItem(userId: string, workOrderId: string, itemId: string) {
    const workOrder = await this.findOne(userId, workOrderId);

    // Cannot remove items if status is DONE or CANCELED
    if (workOrder.status === 'DONE' || workOrder.status === 'CANCELED') {
      throw new BadRequestException(
        `Cannot remove items from work order with status ${workOrder.status}`,
      );
    }

    const workOrderItem = await this.prisma.workOrderItem.findFirst({
      where: {
        id: itemId,
        workOrderId,
      },
    });

    if (!workOrderItem) {
      throw new NotFoundException(`Work order item with ID ${itemId} not found`);
    }

    // Remove item
    await this.prisma.workOrderItem.delete({
      where: { id: itemId },
    });

    // Recalculate work order total
    await this.recalculateWorkOrderTotal(workOrderId);

    return this.findOne(userId, workOrderId);
  }

  /**
   * Recalculate work order total value based on items
   */
  private async recalculateWorkOrderTotal(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { items: true },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID ${workOrderId} not found`);
    }

    // Calculate items total
    const totalValue = workOrder.items.reduce(
      (sum, item) => sum.add(new Decimal(item.totalPrice.toString())),
      new Decimal(0),
    );

    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { totalValue },
    });
  }

  private validateStatusTransition(currentStatus: WorkOrderStatus, newStatus: WorkOrderStatus) {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      [WorkOrderStatus.SCHEDULED]: [
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.IN_PROGRESS]: [
        WorkOrderStatus.DONE,
        WorkOrderStatus.CANCELED,
      ],
      [WorkOrderStatus.DONE]: [
        WorkOrderStatus.IN_PROGRESS, // Permite reabrir OS concluída
      ],
      [WorkOrderStatus.CANCELED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Validate that all required checklist items are answered
   * Throws BadRequestException if any required item is unanswered
   */
  private async validateChecklistsComplete(workOrderId: string) {
    // Check new checklist instances first
    const incompleteInstances = await this.prisma.checklistInstance.findMany({
      where: {
        workOrderId,
        status: { not: 'COMPLETED' },
      },
      select: { id: true, status: true },
    });

    if (incompleteInstances.length > 0) {
      throw new BadRequestException(
        incompleteInstances.length === 1
          ? `Existe 1 checklist incompleto. Complete todos os checklists antes de finalizar a ordem de serviço.`
          : `Existem ${incompleteInstances.length} checklists incompletos. Complete todos os checklists antes de finalizar a ordem de serviço.`,
      );
    }

    // Check legacy checklists (simplified - just require at least one answer)
    const legacyChecklists = await this.prisma.workOrderChecklist.findMany({
      where: { workOrderId },
      include: {
        answers: true,
      },
    });

    for (const checklist of legacyChecklists) {
      if (checklist.answers.length === 0) {
        throw new BadRequestException(
          `O checklist "${checklist.title}" não possui respostas. ` +
          `Complete todos os checklists antes de finalizar a ordem de serviço.`,
        );
      }
    }
  }

  /**
   * Send notification when work order is created
   */
  private async sendWorkOrderCreatedNotification(
    userId: string,
    workOrder: any,
  ): Promise<void> {
    try {
      const context: WorkOrderCreatedContext = {
        clientName: workOrder.client.name,
        clientEmail: workOrder.client.email,
        clientPhone: workOrder.client.phone,
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.id.substring(0, 8).toUpperCase(),
        title: workOrder.title,
        scheduledDate: workOrder.scheduledDate
          ? new Date(workOrder.scheduledDate).toLocaleDateString('pt-BR')
          : undefined,
        scheduledTime: workOrder.scheduledStartTime
          ? new Date(workOrder.scheduledStartTime).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : undefined,
        address: workOrder.address || undefined,
      };

      await this.notificationsService.sendNotification({
        userId,
        clientId: workOrder.client.id,
        workOrderId: workOrder.id,
        type: NotificationType.WORK_ORDER_CREATED,
        contextData: context,
      });

      this.logger.log(`Work order created notification triggered for WO ${workOrder.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send work order created notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Send notification when work order is completed
   */
  private async sendWorkOrderCompletedNotification(
    userId: string,
    workOrder: any,
  ): Promise<void> {
    try {
      const context: WorkOrderCompletedContext = {
        clientName: workOrder.client.name,
        clientEmail: workOrder.client.email,
        clientPhone: workOrder.client.phone,
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.id.substring(0, 8).toUpperCase(),
        title: workOrder.title,
        completedAt: new Date().toLocaleString('pt-BR'),
      };

      await this.notificationsService.sendNotification({
        userId,
        clientId: workOrder.client.id,
        workOrderId: workOrder.id,
        type: NotificationType.WORK_ORDER_COMPLETED,
        contextData: context,
      });

      this.logger.log(`Work order completed notification triggered for WO ${workOrder.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send work order completed notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Create a checklist instance from a template when creating a work order
   */
  private async createChecklistInstanceFromTemplate(
    userId: string,
    workOrderId: string,
    templateId: string,
  ): Promise<void> {
    try {
      // Find the template with sections and questions
      const template = await this.prisma.checklistTemplate.findFirst({
        where: {
          id: templateId,
          userId,
          isActive: true,
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
          },
          questions: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!template) {
        this.logger.warn(
          `Checklist template ${templateId} not found or inactive for user ${userId}`,
        );
        return;
      }

      // Create snapshot of template data
      const templateVersionSnapshot = {
        id: template.id,
        name: template.name,
        description: template.description,
        sections: template.sections.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          order: s.order,
        })),
        questions: template.questions.map((q) => ({
          id: q.id,
          sectionId: q.sectionId,
          type: q.type,
          title: q.title,
          description: q.description,
          placeholder: q.placeholder,
          isRequired: q.isRequired,
          order: q.order,
          options: q.options,
          validations: q.validations,
          conditionalLogic: q.conditionalLogic,
          metadata: q.metadata,
        })),
      };

      // Create the checklist instance with snapshot of template data
      await this.prisma.checklistInstance.create({
        data: {
          workOrderId,
          templateId,
          status: ChecklistInstanceStatus.PENDING,
          templateVersionSnapshot,
        },
      });

      this.logger.log(
        `Checklist instance created from template ${templateId} for work order ${workOrderId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create checklist instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - allow work order creation to continue even if checklist fails
    }
  }

  /**
   * Process inventory deduction when work order reaches configured status
   * This is called after status update and handles:
   * - Checking if inventory feature is enabled
   * - Comparing new status with configured deductOnStatus
   * - Calling inventory service to perform deduction
   */
  private async processInventoryDeduction(
    userId: string,
    workOrderId: string,
    newStatus: PrismaWorkOrderStatus,
  ): Promise<void> {
    try {
      // Get inventory settings for user
      const settings = await this.prisma.inventorySettings.findUnique({
        where: { userId },
      });

      // Skip if inventory not enabled or settings not configured
      if (!settings?.isEnabled) {
        return;
      }

      // Check if current status matches configured deduction status
      if (settings.deductOnStatus !== newStatus) {
        return;
      }

      // Perform deduction
      const result = await this.inventoryService.deductForWorkOrder(
        userId,
        workOrderId,
      );

      if (result.deducted) {
        this.logger.log(
          `Inventory deducted for WO ${workOrderId}: ${result.message}`,
        );
      } else {
        this.logger.debug(
          `Inventory deduction skipped for WO ${workOrderId}: ${result.message}`,
        );
      }
    } catch (error) {
      // Log error but don't throw - inventory deduction failure shouldn't block status update
      this.logger.error(
        `Failed to process inventory deduction for WO ${workOrderId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
