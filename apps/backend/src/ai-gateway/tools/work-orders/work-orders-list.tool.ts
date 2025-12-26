/**
 * Work Orders List Tool
 * Lists work orders for the authenticated user with filters
 */

import { Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface WorkOrdersListParams {
  clientId?: string;
  status?: WorkOrderStatus;
  scheduledDateFrom?: string;
  scheduledDateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface WorkOrderSummary {
  id: string;
  title: string;
  clientName: string;
  status: string;
  scheduledDate: Date | null;
  totalValue: number | null;
  createdAt: Date;
}

@Injectable()
export class WorkOrdersListTool extends BaseTool<WorkOrdersListParams, WorkOrderSummary[]> {
  readonly metadata: ToolMetadata = {
    name: 'workOrders.list',
    description:
      'Lista as ordens de serviço do usuário. Pode filtrar por cliente, status ou período agendado.',
    actionType: AiActionType.READ,
    parametersSchema: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'Filtrar por cliente específico',
        },
        status: {
          type: 'string',
          enum: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'],
          description: 'Filtrar por status',
        },
        scheduledDateFrom: {
          type: 'string',
          format: 'date',
          description: 'Data inicial do período agendado (YYYY-MM-DD)',
        },
        scheduledDateTo: {
          type: 'string',
          format: 'date',
          description: 'Data final do período agendado (YYYY-MM-DD)',
        },
        search: {
          type: 'string',
          description: 'Buscar por título ou nome do cliente',
        },
        limit: {
          type: 'integer',
          description: 'Número máximo de resultados (padrão: 20)',
          default: 20,
          maximum: 100,
        },
        offset: {
          type: 'integer',
          description: 'Número de resultados para pular',
          default: 0,
        },
      },
    },
  };

  async validate(params: WorkOrdersListParams): Promise<true | string> {
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 100)) {
      return 'O limite deve ser entre 1 e 100';
    }
    if (params.status && !['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'].includes(params.status)) {
      return 'Status inválido';
    }
    if (params.scheduledDateFrom && isNaN(Date.parse(params.scheduledDateFrom))) {
      return 'Data inicial inválida';
    }
    if (params.scheduledDateTo && isNaN(Date.parse(params.scheduledDateTo))) {
      return 'Data final inválida';
    }
    return true;
  }

  async execute(
    params: WorkOrdersListParams,
    context: ToolContext,
  ): Promise<ToolResult<WorkOrderSummary[]>> {
    const { clientId, status, scheduledDateFrom, scheduledDateTo, search, limit = 20, offset = 0 } = params;

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        userId: context.userId, // CRITICAL: Multi-tenant filter
        ...(clientId && { clientId }),
        ...(status && { status }),
        ...(scheduledDateFrom && {
          scheduledDate: { gte: new Date(scheduledDateFrom) },
        }),
        ...(scheduledDateTo && {
          scheduledDate: { lte: new Date(scheduledDateTo) },
        }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { client: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        client: {
          select: { name: true },
        },
      },
      orderBy: { scheduledDate: 'desc' },
      take: limit,
      skip: offset,
    });

    const result: WorkOrderSummary[] = workOrders.map((wo) => ({
      id: wo.id,
      title: wo.title,
      clientName: wo.client.name,
      status: wo.status,
      scheduledDate: wo.scheduledDate,
      totalValue: wo.totalValue ? Number(wo.totalValue) : null,
      createdAt: wo.createdAt,
    }));

    return {
      success: true,
      data: result,
      affectedEntities: workOrders.map((wo) => ({
        type: 'workOrder',
        id: wo.id,
        action: 'read' as const,
      })),
    };
  }
}
