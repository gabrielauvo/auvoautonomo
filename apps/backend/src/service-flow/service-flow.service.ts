import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { ConvertToWorkOrderDto } from './dto/convert-to-work-order.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { GeneratePaymentDto } from './dto/generate-payment.dto';
import { QuoteStatus, WorkOrderStatus, PaymentStatus } from '@prisma/client';

export interface TimelineEvent {
  type: string;
  date: Date;
  data: Record<string, any>;
}

@Injectable()
export class ServiceFlowService {
  private readonly logger = new Logger(ServiceFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPaymentsService: ClientPaymentsService,
  ) {}

  // ============================================
  // CONVERT QUOTE TO WORK ORDER
  // POST /service-flow/quote/:quoteId/convert-to-work-order
  // ============================================

  async convertQuoteToWorkOrder(
    userId: string,
    quoteId: string,
    dto: ConvertToWorkOrderDto,
  ) {
    this.logger.log(`Converting quote ${quoteId} to work order for user ${userId}`);

    // 1. Verify quote exists and belongs to user
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, userId },
      include: {
        client: true,
        workOrder: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    // 2. Check quote is APPROVED
    if (quote.status !== QuoteStatus.APPROVED) {
      throw new BadRequestException(
        `Quote must be APPROVED to convert to work order. Current status: ${quote.status}`,
      );
    }

    // 3. Check quote doesn't already have a work order
    if (quote.workOrder) {
      throw new BadRequestException(
        `Quote ${quoteId} already has a work order: ${quote.workOrder.id}`,
      );
    }

    // 4. Validate equipments if provided
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      const equipments = await this.prisma.equipment.findMany({
        where: {
          id: { in: dto.equipmentIds },
          userId,
          clientId: quote.clientId,
        },
      });

      if (equipments.length !== dto.equipmentIds.length) {
        throw new BadRequestException(
          'One or more equipments not found or do not belong to this client',
        );
      }
    }

    // 5. Create work order
    const workOrderData: any = {
      userId,
      clientId: quote.clientId,
      quoteId: quote.id,
      title: dto.title,
      description: dto.description,
      status: WorkOrderStatus.SCHEDULED,
      address: dto.address || quote.client.address,
      notes: dto.notes,
    };

    if (dto.scheduledDate) {
      workOrderData.scheduledDate = new Date(dto.scheduledDate);
    }
    if (dto.scheduledStartTime) {
      workOrderData.scheduledStartTime = new Date(dto.scheduledStartTime);
    }
    if (dto.scheduledEndTime) {
      workOrderData.scheduledEndTime = new Date(dto.scheduledEndTime);
    }

    // Add equipments
    if (dto.equipmentIds && dto.equipmentIds.length > 0) {
      workOrderData.equipments = {
        create: dto.equipmentIds.map((equipmentId) => ({ equipmentId })),
      };
    }

    const workOrder = await this.prisma.workOrder.create({
      data: workOrderData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        quote: {
          select: {
            id: true,
            totalValue: true,
            status: true,
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

    this.logger.log(`Work order ${workOrder.id} created from quote ${quoteId}`);

    return workOrder;
  }

  // ============================================
  // COMPLETE WORK ORDER
  // POST /service-flow/work-order/:workOrderId/complete
  // ============================================

  async completeWorkOrder(
    userId: string,
    workOrderId: string,
    dto: CompleteWorkOrderDto,
  ) {
    this.logger.log(`Completing work order ${workOrderId} for user ${userId}`);

    // 1. Verify work order exists and belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        quote: true,
        checklists: {
          include: {
            answers: true,
          },
        },
        checklistInstances: {
          where: { status: { not: 'COMPLETED' } },
          select: { id: true, status: true },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID ${workOrderId} not found`);
    }

    // 2. Check work order is not already DONE or CANCELED
    if (workOrder.status === WorkOrderStatus.DONE) {
      throw new BadRequestException('Work order is already completed');
    }

    if (workOrder.status === WorkOrderStatus.CANCELED) {
      throw new BadRequestException('Cannot complete a canceled work order');
    }

    // 3. Validate checklists are complete (unless skipped)
    // Check new system instances
    if (!dto.skipChecklistValidation && workOrder.checklistInstances.length > 0) {
      const count = workOrder.checklistInstances.length;
      throw new BadRequestException(
        count === 1
          ? `Existe 1 checklist incompleto. Complete todos os checklists antes de finalizar a ordem de serviço.`
          : `Existem ${count} checklists incompletos. Complete todos os checklists antes de finalizar a ordem de serviço.`,
      );
    }

    // Legacy checklist validation (simplified - just check if has answers)
    if (!dto.skipChecklistValidation && workOrder.checklists.length > 0) {
      for (const checklist of workOrder.checklists) {
        if (checklist.answers.length === 0) {
          throw new BadRequestException(
            `O checklist "${checklist.title}" não possui respostas. ` +
            `Complete todos os checklists antes de finalizar a ordem de serviço.`,
          );
        }
      }
    }

    // 4. Update work order status
    const updateData: any = {
      status: WorkOrderStatus.DONE,
      executionEnd: new Date(),
    };

    if (dto.notes) {
      updateData.notes = workOrder.notes
        ? `${workOrder.notes}\n---\n${dto.notes}`
        : dto.notes;
    }

    // Set executionStart if not set
    if (!workOrder.executionStart) {
      updateData.executionStart = new Date();
    }

    const completedWorkOrder = await this.prisma.workOrder.update({
      where: { id: workOrderId },
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
        quote: {
          select: {
            id: true,
            totalValue: true,
          },
        },
      },
    });

    this.logger.log(`Work order ${workOrderId} completed`);

    // 5. Build payment suggestion
    const paymentSuggestion = {
      canGeneratePayment: true,
      suggestedValue: workOrder.quote?.totalValue?.toNumber() || null,
      hasQuote: !!workOrder.quote,
      quoteId: workOrder.quote?.id || null,
    };

    return {
      workOrder: completedWorkOrder,
      paymentSuggestion,
    };
  }

  // ============================================
  // GENERATE PAYMENT FROM WORK ORDER
  // POST /service-flow/work-order/:workOrderId/generate-payment
  // ============================================

  async generatePayment(
    userId: string,
    workOrderId: string,
    dto: GeneratePaymentDto,
  ) {
    this.logger.log(`Generating payment for work order ${workOrderId}`);

    // 1. Verify work order exists and belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        quote: true,
        payments: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID ${workOrderId} not found`);
    }

    // 2. Check work order is DONE
    if (workOrder.status !== WorkOrderStatus.DONE) {
      throw new BadRequestException(
        `Work order must be DONE to generate payment. Current status: ${workOrder.status}`,
      );
    }

    // 3. Determine value
    let value: number;

    if (dto.value !== undefined) {
      value = dto.value;
    } else if (workOrder.quote) {
      value = workOrder.quote.totalValue.toNumber();
    } else {
      throw new BadRequestException(
        'Value is required when work order has no associated quote',
      );
    }

    // 4. Check for existing pending payments
    const existingPending = workOrder.payments.find(
      (p) => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.CONFIRMED,
    );

    if (existingPending) {
      throw new BadRequestException(
        `Work order already has a pending payment: ${existingPending.id}`,
      );
    }

    // 5. Create payment via ClientPaymentsService
    const payment = await this.clientPaymentsService.createPayment(userId, {
      clientId: workOrder.clientId,
      workOrderId: workOrder.id,
      quoteId: workOrder.quoteId || undefined,
      billingType: dto.billingType,
      value,
      dueDate: dto.dueDate,
      description: dto.description || `Cobranca OS #${workOrder.id.slice(0, 8)}`,
    });

    this.logger.log(`Payment ${payment.id} generated for work order ${workOrderId}`);

    return payment;
  }

  // ============================================
  // CLIENT TIMELINE
  // GET /service-flow/client/:clientId/timeline
  // ============================================

  async getClientTimeline(userId: string, clientId: string): Promise<TimelineEvent[]> {
    this.logger.log(`Getting timeline for client ${clientId}`);

    // 1. Verify client belongs to user
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      throw new ForbiddenException(
        `Client with ID ${clientId} not found or does not belong to you`,
      );
    }

    const timeline: TimelineEvent[] = [];

    // 2. Get quotes
    const quotes = await this.prisma.quote.findMany({
      where: { clientId, userId },
      include: {
        items: {
          include: {
            item: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const quote of quotes) {
      // Quote created
      timeline.push({
        type: 'QUOTE_CREATED',
        date: quote.createdAt,
        data: {
          id: quote.id,
          status: quote.status,
          totalValue: quote.totalValue.toNumber(),
          itemsCount: quote.items.length,
        },
      });

      // Quote status changes (approximated by updatedAt if different from createdAt)
      if (quote.status === QuoteStatus.APPROVED && quote.updatedAt > quote.createdAt) {
        timeline.push({
          type: 'QUOTE_APPROVED',
          date: quote.updatedAt,
          data: {
            id: quote.id,
            totalValue: quote.totalValue.toNumber(),
          },
        });
      }

      if (quote.status === QuoteStatus.REJECTED && quote.updatedAt > quote.createdAt) {
        timeline.push({
          type: 'QUOTE_REJECTED',
          date: quote.updatedAt,
          data: { id: quote.id },
        });
      }
    }

    // 3. Get work orders
    const workOrders = await this.prisma.workOrder.findMany({
      where: { clientId, userId },
      include: {
        equipments: {
          include: {
            equipment: { select: { type: true, brand: true } },
          },
        },
        checklists: {
          select: { id: true, title: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const wo of workOrders) {
      // WO created
      timeline.push({
        type: 'WORK_ORDER_CREATED',
        date: wo.createdAt,
        data: {
          id: wo.id,
          title: wo.title,
          status: wo.status,
          quoteId: wo.quoteId,
          equipmentsCount: wo.equipments.length,
        },
      });

      // WO started
      if (wo.executionStart) {
        timeline.push({
          type: 'WORK_ORDER_STARTED',
          date: wo.executionStart,
          data: {
            id: wo.id,
            title: wo.title,
          },
        });
      }

      // WO completed
      if (wo.status === WorkOrderStatus.DONE && wo.executionEnd) {
        timeline.push({
          type: 'WORK_ORDER_COMPLETED',
          date: wo.executionEnd,
          data: {
            id: wo.id,
            title: wo.title,
          },
        });
      }

      // Checklists
      for (const checklist of wo.checklists) {
        timeline.push({
          type: 'CHECKLIST_CREATED',
          date: checklist.createdAt,
          data: {
            id: checklist.id,
            title: checklist.title,
            workOrderId: wo.id,
            workOrderTitle: wo.title,
          },
        });
      }
    }

    // 4. Get payments
    const payments = await this.prisma.clientPayment.findMany({
      where: { clientId, userId },
      orderBy: { createdAt: 'desc' },
    });

    for (const payment of payments) {
      // Payment created
      timeline.push({
        type: 'PAYMENT_CREATED',
        date: payment.createdAt,
        data: {
          id: payment.id,
          value: payment.value.toNumber(),
          billingType: payment.billingType,
          status: payment.status,
          dueDate: payment.dueDate,
          workOrderId: payment.workOrderId,
          quoteId: payment.quoteId,
        },
      });

      // Payment confirmed/received
      if (payment.paidAt) {
        timeline.push({
          type: 'PAYMENT_CONFIRMED',
          date: payment.paidAt,
          data: {
            id: payment.id,
            value: payment.value.toNumber(),
            billingType: payment.billingType,
          },
        });
      }

      // Payment overdue
      if (payment.status === PaymentStatus.OVERDUE) {
        timeline.push({
          type: 'PAYMENT_OVERDUE',
          date: payment.dueDate,
          data: {
            id: payment.id,
            value: payment.value.toNumber(),
          },
        });
      }
    }

    // 5. Sort by date descending
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    return timeline;
  }

  // ============================================
  // WORK ORDER TIMELINE
  // GET /service-flow/work-order/:workOrderId/timeline
  // ============================================

  async getWorkOrderTimeline(userId: string, workOrderId: string): Promise<TimelineEvent[]> {
    this.logger.log(`Getting timeline for work order ${workOrderId}`);

    // 1. Verify work order belongs to user
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
      include: {
        client: { select: { name: true } },
        checklists: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            createdAt: true,
          },
        },
        executionSessions: {
          select: {
            id: true,
            sessionType: true,
            startedAt: true,
            endedAt: true,
            pauseReason: true,
            notes: true,
          },
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!workOrder) {
      throw new ForbiddenException(
        `Work order with ID ${workOrderId} not found or does not belong to you`,
      );
    }

    const timeline: TimelineEvent[] = [];

    // 2. Work order created
    timeline.push({
      type: 'WORK_ORDER_CREATED',
      date: workOrder.createdAt,
      data: {
        id: workOrder.id,
        title: workOrder.title,
        status: 'SCHEDULED',
        clientName: workOrder.client?.name,
      },
    });

    // 3. Execution sessions (start, pause, resume)
    for (const session of workOrder.executionSessions) {
      if (session.sessionType === 'WORK') {
        // First work session = started, subsequent = resumed
        const existingWorkSessions = timeline.filter(
          (e) => e.type === 'WORK_ORDER_STARTED' || e.type === 'WORK_ORDER_RESUMED'
        );

        if (existingWorkSessions.length === 0) {
          timeline.push({
            type: 'WORK_ORDER_STARTED',
            date: session.startedAt,
            data: {
              id: workOrder.id,
              title: workOrder.title,
            },
          });
        } else {
          timeline.push({
            type: 'WORK_ORDER_RESUMED',
            date: session.startedAt,
            data: {
              id: workOrder.id,
              title: workOrder.title,
            },
          });
        }
      } else if (session.sessionType === 'PAUSE') {
        timeline.push({
          type: 'WORK_ORDER_PAUSED',
          date: session.startedAt,
          data: {
            id: workOrder.id,
            title: workOrder.title,
            reason: session.pauseReason || null,
          },
        });
      }
    }

    // 4. Work order completed or canceled
    if (workOrder.status === WorkOrderStatus.DONE && workOrder.executionEnd) {
      timeline.push({
        type: 'WORK_ORDER_COMPLETED',
        date: workOrder.executionEnd,
        data: {
          id: workOrder.id,
          title: workOrder.title,
        },
      });
    }

    if (workOrder.status === WorkOrderStatus.CANCELED) {
      timeline.push({
        type: 'WORK_ORDER_CANCELED',
        date: workOrder.updatedAt,
        data: {
          id: workOrder.id,
          title: workOrder.title,
        },
      });
    }

    // 5. Checklists
    for (const checklist of workOrder.checklists) {
      timeline.push({
        type: 'CHECKLIST_CREATED',
        date: checklist.createdAt,
        data: {
          id: checklist.id,
          title: checklist.title,
          workOrderId: workOrder.id,
        },
      });

      // If checklist was answered
      if (checklist.status === 'ANSWERED' && checklist.updatedAt > checklist.createdAt) {
        timeline.push({
          type: 'CHECKLIST_ANSWERED',
          date: checklist.updatedAt,
          data: {
            id: checklist.id,
            title: checklist.title,
            workOrderId: workOrder.id,
          },
        });
      }
    }

    // 6. Attachments
    for (const attachment of workOrder.attachments) {
      timeline.push({
        type: 'ATTACHMENT_ADDED',
        date: attachment.createdAt,
        data: {
          id: attachment.id,
          fileName: attachment.fileName,
          workOrderId: workOrder.id,
        },
      });
    }

    // 7. Get payments for this work order
    const payments = await this.prisma.clientPayment.findMany({
      where: { workOrderId, userId },
      orderBy: { createdAt: 'desc' },
    });

    for (const payment of payments) {
      timeline.push({
        type: 'PAYMENT_CREATED',
        date: payment.createdAt,
        data: {
          id: payment.id,
          value: payment.value.toNumber(),
          billingType: payment.billingType,
          status: payment.status,
          dueDate: payment.dueDate,
          workOrderId: payment.workOrderId,
        },
      });

      if (payment.paidAt) {
        timeline.push({
          type: 'PAYMENT_CONFIRMED',
          date: payment.paidAt,
          data: {
            id: payment.id,
            value: payment.value.toNumber(),
            billingType: payment.billingType,
          },
        });
      }

      if (payment.status === PaymentStatus.OVERDUE) {
        timeline.push({
          type: 'PAYMENT_OVERDUE',
          date: payment.dueDate,
          data: {
            id: payment.id,
            value: payment.value.toNumber(),
          },
        });
      }
    }

    // 8. Sort by date descending (newest first)
    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    return timeline;
  }

  // ============================================
  // WORK ORDER EXTRACT (FINANCIAL)
  // GET /service-flow/work-order/:workOrderId/extract
  // ============================================

  async getWorkOrderExtract(userId: string, workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, userId },
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
          include: {
            items: {
              include: {
                item: { select: { name: true } },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        checklists: {
          include: {
            _count: { select: { answers: true } },
          },
        },
        checklistInstances: {
          include: {
            template: { select: { name: true } },
            _count: { select: { answers: true } },
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

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID ${workOrderId} not found`);
    }

    // Calculate financial summary
    const totalQuoted = workOrder.quote?.totalValue?.toNumber() || 0;
    const totalPaid = workOrder.payments
      .filter((p) => p.status === PaymentStatus.RECEIVED || p.status === PaymentStatus.CONFIRMED)
      .reduce((sum, p) => sum + p.value.toNumber(), 0);
    const totalPending = workOrder.payments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.value.toNumber(), 0);

    return {
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        description: workOrder.description,
        status: workOrder.status,
        scheduledDate: workOrder.scheduledDate,
        executionStart: workOrder.executionStart,
        executionEnd: workOrder.executionEnd,
        createdAt: workOrder.createdAt,
      },
      client: workOrder.client,
      quote: workOrder.quote
        ? {
            id: workOrder.quote.id,
            totalValue: workOrder.quote.totalValue.toNumber(),
            discountValue: workOrder.quote.discountValue.toNumber(),
            status: workOrder.quote.status,
            items: workOrder.quote.items.map((qi) => ({
              name: qi.item?.name || 'Item removido',
              quantity: qi.quantity.toNumber(),
              unitPrice: qi.unitPrice.toNumber(),
              totalPrice: qi.totalPrice.toNumber(),
            })),
          }
        : null,
      payments: workOrder.payments.map((p) => ({
        id: p.id,
        value: p.value.toNumber(),
        billingType: p.billingType,
        status: p.status,
        dueDate: p.dueDate,
        paidAt: p.paidAt,
        invoiceUrl: p.asaasInvoiceUrl,
      })),
      checklists: [
        // Legacy checklists
        ...workOrder.checklists.map((c) => ({
          id: c.id,
          title: c.title,
          answersCount: c._count.answers,
          isLegacy: true,
        })),
        // New checklist instances
        ...workOrder.checklistInstances.map((i) => ({
          id: i.id,
          title: i.template.name,
          answersCount: i._count.answers,
          status: i.status,
          isLegacy: false,
        })),
      ],
      equipments: workOrder.equipments.map((e) => e.equipment),
      financialSummary: {
        totalQuoted,
        totalPaid,
        totalPending,
        balance: totalQuoted - totalPaid,
      },
    };
  }
}
