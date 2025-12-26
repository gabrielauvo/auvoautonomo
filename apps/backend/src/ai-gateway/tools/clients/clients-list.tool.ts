/**
 * Clients List Tool
 * Lists clients for the authenticated user with search and filters
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface ClientsListParams {
  search?: string;
  limit?: number;
  offset?: number;
  hasOverduePayments?: boolean;
}

interface ClientSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  isDelinquent: boolean;
  createdAt: Date;
}

@Injectable()
export class ClientsListTool extends BaseTool<ClientsListParams, ClientSummary[]> {
  readonly metadata: ToolMetadata = {
    name: 'clients.list',
    description:
      'Lista os clientes do usuário. Pode buscar por nome, email ou telefone, e filtrar por clientes com pagamentos atrasados.',
    actionType: AiActionType.READ,
    parametersSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Busca por nome, email ou telefone',
        },
        limit: {
          type: 'integer',
          description: 'Número máximo de resultados (padrão: 20, máximo: 100)',
          default: 20,
          maximum: 100,
        },
        offset: {
          type: 'integer',
          description: 'Número de resultados para pular (paginação)',
          default: 0,
        },
        hasOverduePayments: {
          type: 'boolean',
          description: 'Filtrar apenas clientes com pagamentos atrasados',
        },
      },
    },
  };

  async validate(params: ClientsListParams): Promise<true | string> {
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 100)) {
      return 'O limite deve ser entre 1 e 100';
    }
    if (params.offset !== undefined && params.offset < 0) {
      return 'O offset não pode ser negativo';
    }
    return true;
  }

  async execute(
    params: ClientsListParams,
    context: ToolContext,
  ): Promise<ToolResult<ClientSummary[]>> {
    const { search, limit = 20, offset = 0, hasOverduePayments } = params;

    const clients = await this.prisma.client.findMany({
      where: {
        userId: context.userId, // CRITICAL: Multi-tenant filter
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
        ...(hasOverduePayments && { isDelinquent: true }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        isDelinquent: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    });

    return {
      success: true,
      data: clients,
      affectedEntities: clients.map((c) => ({
        type: 'client',
        id: c.id,
        action: 'read' as const,
      })),
    };
  }
}
