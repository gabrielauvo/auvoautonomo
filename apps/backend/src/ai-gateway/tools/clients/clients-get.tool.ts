/**
 * Clients Get Tool
 * Gets a single client by ID with detailed information
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface ClientsGetParams {
  clientId: string;
  includePayments?: boolean;
  includeQuotes?: boolean;
  includeWorkOrders?: boolean;
}

interface ClientDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  taxId: string | null;
  notes: string | null;
  isDelinquent: boolean;
  createdAt: Date;
  payments?: Array<{
    id: string;
    value: number;
    status: string;
    dueDate: Date;
  }>;
  quotes?: Array<{
    id: string;
    status: string;
    totalValue: number;
    createdAt: Date;
  }>;
  workOrders?: Array<{
    id: string;
    title: string;
    status: string;
    scheduledDate: Date | null;
  }>;
}

@Injectable()
export class ClientsGetTool extends BaseTool<ClientsGetParams, ClientDetail> {
  readonly metadata: ToolMetadata = {
    name: 'clients.get',
    description:
      'Obtém detalhes de um cliente específico, opcionalmente incluindo pagamentos, orçamentos e ordens de serviço.',
    actionType: AiActionType.READ,
    parametersSchema: {
      type: 'object',
      required: ['clientId'],
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do cliente',
        },
        includePayments: {
          type: 'boolean',
          description: 'Incluir últimos pagamentos do cliente',
          default: false,
        },
        includeQuotes: {
          type: 'boolean',
          description: 'Incluir últimos orçamentos do cliente',
          default: false,
        },
        includeWorkOrders: {
          type: 'boolean',
          description: 'Incluir últimas ordens de serviço do cliente',
          default: false,
        },
      },
    },
  };

  async validate(params: ClientsGetParams): Promise<true | string> {
    if (!params.clientId) {
      return 'O ID do cliente é obrigatório';
    }
    return true;
  }

  async execute(
    params: ClientsGetParams,
    context: ToolContext,
  ): Promise<ToolResult<ClientDetail>> {
    const { clientId, includePayments, includeQuotes, includeWorkOrders } = params;

    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        userId: context.userId, // CRITICAL: Multi-tenant filter
        deletedAt: null,
      },
      include: {
        ...(includePayments && {
          payments: {
            select: {
              id: true,
              value: true,
              status: true,
              dueDate: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        }),
        ...(includeQuotes && {
          quotes: {
            select: {
              id: true,
              status: true,
              totalValue: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        }),
        ...(includeWorkOrders && {
          workOrders: {
            select: {
              id: true,
              title: true,
              status: true,
              scheduledDate: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        }),
      },
    });

    if (!client) {
      return {
        success: false,
        error: 'Cliente não encontrado',
      };
    }

    const result: ClientDetail = {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      state: client.state,
      zipCode: client.zipCode,
      taxId: client.taxId,
      notes: client.notes,
      isDelinquent: client.isDelinquent,
      createdAt: client.createdAt,
    };

    if (includePayments && 'payments' in client) {
      result.payments = (client.payments as any[]).map((p) => ({
        id: p.id,
        value: Number(p.value),
        status: p.status,
        dueDate: p.dueDate,
      }));
    }

    if (includeQuotes && 'quotes' in client) {
      result.quotes = (client.quotes as any[]).map((q) => ({
        id: q.id,
        status: q.status,
        totalValue: Number(q.totalValue),
        createdAt: q.createdAt,
      }));
    }

    if (includeWorkOrders && 'workOrders' in client) {
      result.workOrders = (client.workOrders as any[]).map((w) => ({
        id: w.id,
        title: w.title,
        status: w.status,
        scheduledDate: w.scheduledDate,
      }));
    }

    return {
      success: true,
      data: result,
      affectedEntities: [{ type: 'client', id: client.id, action: 'read' }],
    };
  }
}
