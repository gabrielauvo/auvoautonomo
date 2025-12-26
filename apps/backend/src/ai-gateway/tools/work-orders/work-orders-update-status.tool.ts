/**
 * Work Orders Update Status Tool
 * Updates the status of a work order
 */

import { Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface WorkOrdersUpdateStatusParams {
  workOrderId: string;
  status: WorkOrderStatus;
  notes?: string;
}

interface UpdatedWorkOrder {
  id: string;
  title: string;
  previousStatus: string;
  newStatus: string;
}

@Injectable()
export class WorkOrdersUpdateStatusTool extends BaseTool<WorkOrdersUpdateStatusParams, UpdatedWorkOrder> {
  readonly metadata: ToolMetadata = {
    name: 'workOrders.updateStatus',
    description:
      'Atualiza o status de uma ordem de serviço (ex: SCHEDULED, IN_PROGRESS, DONE, CANCELED). Requer confirmação.',
    actionType: AiActionType.UPDATE,
    parametersSchema: {
      type: 'object',
      required: ['workOrderId', 'status'],
      properties: {
        workOrderId: {
          type: 'string',
          format: 'uuid',
          description: 'ID da ordem de serviço',
        },
        status: {
          type: 'string',
          enum: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'],
          description: 'Novo status da OS',
        },
        notes: {
          type: 'string',
          description: 'Observações sobre a mudança de status',
        },
      },
    },
  };

  async validate(params: WorkOrdersUpdateStatusParams, context: ToolContext): Promise<true | string> {
    if (!params.workOrderId) {
      return 'O ID da ordem de serviço é obrigatório';
    }

    if (!params.status) {
      return 'O novo status é obrigatório';
    }

    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELED'];
    if (!validStatuses.includes(params.status)) {
      return `Status inválido. Use: ${validStatuses.join(', ')}`;
    }

    // Verify ownership
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: params.workOrderId,
        userId: context.userId, // CRITICAL: Multi-tenant filter
      },
      select: { id: true, status: true },
    });

    if (!workOrder) {
      return 'Ordem de serviço não encontrada';
    }

    // Validate status transitions
    const currentStatus = workOrder.status;
    const newStatus = params.status;

    // Define valid transitions
    const validTransitions: Record<string, string[]> = {
      SCHEDULED: ['IN_PROGRESS', 'CANCELED'],
      IN_PROGRESS: ['DONE', 'SCHEDULED', 'CANCELED'],
      DONE: ['IN_PROGRESS'], // Can reopen
      CANCELED: ['SCHEDULED'], // Can reschedule
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return `Não é possível mudar de ${currentStatus} para ${newStatus}`;
    }

    return true;
  }

  async execute(
    params: WorkOrdersUpdateStatusParams,
    context: ToolContext,
  ): Promise<ToolResult<UpdatedWorkOrder>> {
    const { workOrderId, status, notes } = params;

    // Get current state
    const currentWorkOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        userId: context.userId,
      },
      select: { id: true, title: true, status: true, notes: true },
    });

    if (!currentWorkOrder) {
      return {
        success: false,
        error: 'Ordem de serviço não encontrada',
      };
    }

    const previousStatus = currentWorkOrder.status;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status,
    };

    // Set execution timestamps based on status change
    if (status === 'IN_PROGRESS' && previousStatus === 'SCHEDULED') {
      updateData.executionStart = new Date();
    } else if (status === 'DONE' && previousStatus === 'IN_PROGRESS') {
      updateData.executionEnd = new Date();
    }

    // Append notes if provided
    if (notes) {
      const existingNotes = currentWorkOrder.notes || '';
      const timestamp = new Date().toLocaleString('pt-BR');
      updateData.notes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;
    }

    // Update work order
    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    return {
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        previousStatus,
        newStatus: updated.status,
      },
      affectedEntities: [{ type: 'workOrder', id: updated.id, action: 'updated' }],
    };
  }
}
