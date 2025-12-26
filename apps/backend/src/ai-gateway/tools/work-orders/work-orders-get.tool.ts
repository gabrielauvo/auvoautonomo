/**
 * Work Orders Get Tool
 * Gets detailed information about a specific work order
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface WorkOrdersGetParams {
  workOrderId: string;
}

interface WorkOrderDetail {
  id: string;
  title: string;
  description: string | null;
  client: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  status: string;
  scheduledDate: Date | null;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  executionStart: Date | null;
  executionEnd: Date | null;
  address: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalValue: number | null;
  createdAt: Date;
}

@Injectable()
export class WorkOrdersGetTool extends BaseTool<WorkOrdersGetParams, WorkOrderDetail> {
  readonly metadata: ToolMetadata = {
    name: 'workOrders.get',
    description:
      'Obtém detalhes completos de uma ordem de serviço, incluindo itens e informações do cliente.',
    actionType: AiActionType.READ,
    parametersSchema: {
      type: 'object',
      required: ['workOrderId'],
      properties: {
        workOrderId: {
          type: 'string',
          format: 'uuid',
          description: 'ID da ordem de serviço',
        },
      },
    },
  };

  async validate(params: WorkOrdersGetParams): Promise<true | string> {
    if (!params.workOrderId) {
      return 'O ID da ordem de serviço é obrigatório';
    }
    return true;
  }

  async execute(
    params: WorkOrdersGetParams,
    context: ToolContext,
  ): Promise<ToolResult<WorkOrderDetail>> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: params.workOrderId,
        userId: context.userId, // CRITICAL: Multi-tenant filter
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        items: {
          select: {
            id: true,
            name: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workOrder) {
      return {
        success: false,
        error: 'Ordem de serviço não encontrada',
      };
    }

    const result: WorkOrderDetail = {
      id: workOrder.id,
      title: workOrder.title,
      description: workOrder.description,
      client: workOrder.client,
      status: workOrder.status,
      scheduledDate: workOrder.scheduledDate,
      scheduledStartTime: workOrder.scheduledStartTime,
      scheduledEndTime: workOrder.scheduledEndTime,
      executionStart: workOrder.executionStart,
      executionEnd: workOrder.executionEnd,
      address: workOrder.address,
      notes: workOrder.notes,
      items: workOrder.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      totalValue: workOrder.totalValue ? Number(workOrder.totalValue) : null,
      createdAt: workOrder.createdAt,
    };

    return {
      success: true,
      data: result,
      affectedEntities: [{ type: 'workOrder', id: workOrder.id, action: 'read' }],
    };
  }
}
