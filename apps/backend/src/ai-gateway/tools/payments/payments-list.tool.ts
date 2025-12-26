/**
 * Payments List Tool
 * Lists payments for the authenticated user with filters
 */

import { Injectable } from '@nestjs/common';
import { PaymentStatus, PaymentBillingType } from '@prisma/client';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface PaymentsListParams {
  clientId?: string;
  status?: PaymentStatus;
  billingType?: PaymentBillingType;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdueOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface PaymentSummary {
  id: string;
  clientName: string;
  value: number;
  status: string;
  billingType: string;
  dueDate: Date;
  paidAt: Date | null;
  isOverdue: boolean;
}

@Injectable()
export class PaymentsListTool extends BaseTool<PaymentsListParams, PaymentSummary[]> {
  readonly metadata: ToolMetadata = {
    name: 'payments.list',
    description:
      'Lista as cobranças do usuário. Pode filtrar por cliente, status, tipo de pagamento ou período de vencimento.',
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
          enum: ['PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED', 'CANCELED'],
          description: 'Filtrar por status do pagamento',
        },
        billingType: {
          type: 'string',
          enum: ['PIX', 'BOLETO', 'CREDIT_CARD'],
          description: 'Filtrar por tipo de cobrança',
        },
        dueDateFrom: {
          type: 'string',
          format: 'date',
          description: 'Data de vencimento inicial (YYYY-MM-DD)',
        },
        dueDateTo: {
          type: 'string',
          format: 'date',
          description: 'Data de vencimento final (YYYY-MM-DD)',
        },
        overdueOnly: {
          type: 'boolean',
          description: 'Mostrar apenas cobranças vencidas e não pagas',
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

  async validate(params: PaymentsListParams): Promise<true | string> {
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 100)) {
      return 'O limite deve ser entre 1 e 100';
    }
    if (params.dueDateFrom && isNaN(Date.parse(params.dueDateFrom))) {
      return 'Data inicial inválida';
    }
    if (params.dueDateTo && isNaN(Date.parse(params.dueDateTo))) {
      return 'Data final inválida';
    }
    return true;
  }

  async execute(
    params: PaymentsListParams,
    context: ToolContext,
  ): Promise<ToolResult<PaymentSummary[]>> {
    const {
      clientId,
      status,
      billingType,
      dueDateFrom,
      dueDateTo,
      overdueOnly,
      limit = 20,
      offset = 0,
    } = params;

    const now = new Date();

    const payments = await this.prisma.clientPayment.findMany({
      where: {
        userId: context.userId, // CRITICAL: Multi-tenant filter
        ...(clientId && { clientId }),
        ...(status && { status }),
        ...(billingType && { billingType }),
        ...(dueDateFrom && { dueDate: { gte: new Date(dueDateFrom) } }),
        ...(dueDateTo && { dueDate: { lte: new Date(dueDateTo) } }),
        ...(overdueOnly && {
          dueDate: { lt: now },
          status: { in: ['PENDING', 'OVERDUE'] },
        }),
      },
      include: {
        client: {
          select: { name: true },
        },
      },
      orderBy: { dueDate: 'desc' },
      take: limit,
      skip: offset,
    });

    const result: PaymentSummary[] = payments.map((p) => ({
      id: p.id,
      clientName: p.client.name,
      value: Number(p.value),
      status: p.status,
      billingType: p.billingType,
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      isOverdue: p.dueDate < now && ['PENDING', 'OVERDUE'].includes(p.status),
    }));

    return {
      success: true,
      data: result,
      affectedEntities: payments.map((p) => ({
        type: 'clientPayment',
        id: p.id,
        action: 'read' as const,
      })),
    };
  }
}
