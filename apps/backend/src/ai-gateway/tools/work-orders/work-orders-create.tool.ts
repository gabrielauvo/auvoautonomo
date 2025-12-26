/**
 * Work Orders Create Tool
 * Creates a new work order for a client
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';
import { Decimal } from '@prisma/client/runtime/library';

interface WorkOrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  type?: 'PRODUCT' | 'SERVICE';
}

interface WorkOrdersCreateParams {
  clientId: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  address?: string;
  notes?: string;
  items?: WorkOrderItem[];
}

interface CreatedWorkOrder {
  id: string;
  title: string;
  clientName: string;
  status: string;
  scheduledDate: Date | null;
  totalValue: number | null;
}

@Injectable()
export class WorkOrdersCreateTool extends BaseTool<WorkOrdersCreateParams, CreatedWorkOrder> {
  readonly metadata: ToolMetadata = {
    name: 'workOrders.create',
    description:
      'Cria uma nova ordem de serviço para um cliente. Requer confirmação antes da execução.',
    actionType: AiActionType.CREATE,
    parametersSchema: {
      type: 'object',
      required: ['clientId', 'title'],
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do cliente',
        },
        title: {
          type: 'string',
          description: 'Título da ordem de serviço',
          minLength: 2,
          maxLength: 255,
        },
        description: {
          type: 'string',
          description: 'Descrição detalhada do serviço',
        },
        scheduledDate: {
          type: 'string',
          format: 'date',
          description: 'Data agendada (YYYY-MM-DD)',
        },
        scheduledStartTime: {
          type: 'string',
          format: 'time',
          description: 'Horário inicial (HH:MM)',
        },
        scheduledEndTime: {
          type: 'string',
          format: 'time',
          description: 'Horário final (HH:MM)',
        },
        address: {
          type: 'string',
          description: 'Endereço do serviço (se diferente do cliente)',
        },
        notes: {
          type: 'string',
          description: 'Observações adicionais',
        },
        items: {
          type: 'array',
          description: 'Itens/serviços da OS',
          items: {
            type: 'object',
            required: ['name', 'quantity', 'unitPrice'],
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number', minimum: 0.001 },
              unitPrice: { type: 'number', minimum: 0 },
              type: { type: 'string', enum: ['PRODUCT', 'SERVICE'] },
            },
          },
        },
      },
    },
  };

  async validate(params: WorkOrdersCreateParams, context: ToolContext): Promise<true | string> {
    if (!params.clientId) {
      return 'O ID do cliente é obrigatório';
    }

    // Verify client ownership
    const isOwner = await this.verifyOwnership('client', params.clientId, context.userId);
    if (!isOwner) {
      return 'Cliente não encontrado';
    }

    if (!params.title || params.title.trim().length < 2) {
      return 'O título deve ter pelo menos 2 caracteres';
    }

    if (params.scheduledDate && isNaN(Date.parse(params.scheduledDate))) {
      return 'Data agendada inválida';
    }

    // Check entity limit
    const canCreate = await this.checkEntityLimit(context.userId, 'workOrders');
    if (!canCreate) {
      return 'Você atingiu o limite de ordens de serviço do seu plano. Faça upgrade para continuar.';
    }

    return true;
  }

  async execute(
    params: WorkOrdersCreateParams,
    context: ToolContext,
  ): Promise<ToolResult<CreatedWorkOrder>> {
    const {
      clientId,
      title,
      description,
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      address,
      notes,
      items = [],
    } = params;

    // Calculate total value if items provided
    let totalValue: Decimal | null = null;
    const itemsWithTotals = items.map((item) => ({
      name: item.name.trim(),
      type: item.type || 'SERVICE',
      unit: 'UN',
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      discountValue: new Decimal(0),
      totalPrice: new Decimal(item.quantity * item.unitPrice),
    }));

    if (itemsWithTotals.length > 0) {
      totalValue = itemsWithTotals.reduce(
        (sum, item) => sum.plus(item.totalPrice),
        new Decimal(0),
      );
    }

    // Parse scheduled date/time
    let parsedScheduledDate: Date | null = null;
    let parsedStartTime: Date | null = null;
    let parsedEndTime: Date | null = null;

    if (scheduledDate) {
      parsedScheduledDate = new Date(scheduledDate);
      parsedScheduledDate.setHours(0, 0, 0, 0);

      if (scheduledStartTime) {
        const [hours, minutes] = scheduledStartTime.split(':').map(Number);
        parsedStartTime = new Date(parsedScheduledDate);
        parsedStartTime.setHours(hours, minutes, 0, 0);
      }

      if (scheduledEndTime) {
        const [hours, minutes] = scheduledEndTime.split(':').map(Number);
        parsedEndTime = new Date(parsedScheduledDate);
        parsedEndTime.setHours(hours, minutes, 0, 0);
      }
    }

    // Get client info
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true, address: true },
    });

    // Create work order with items
    const workOrder = await this.prisma.workOrder.create({
      data: {
        userId: context.userId,
        clientId,
        title: title.trim(),
        description: description?.trim() || null,
        status: 'SCHEDULED',
        scheduledDate: parsedScheduledDate,
        scheduledStartTime: parsedStartTime,
        scheduledEndTime: parsedEndTime,
        address: address?.trim() || client?.address || null,
        notes: notes?.trim() || null,
        totalValue,
        ...(itemsWithTotals.length > 0 && {
          items: {
            create: itemsWithTotals,
          },
        }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledDate: true,
        totalValue: true,
      },
    });

    return {
      success: true,
      data: {
        id: workOrder.id,
        title: workOrder.title,
        clientName: client?.name || 'Cliente',
        status: workOrder.status,
        scheduledDate: workOrder.scheduledDate,
        totalValue: workOrder.totalValue ? Number(workOrder.totalValue) : null,
      },
      affectedEntities: [{ type: 'workOrder', id: workOrder.id, action: 'created' }],
    };
  }
}
