/**
 * Quotes List Tool
 * Lists quotes for the authenticated user with filters
 */

import { Injectable } from '@nestjs/common';
import { QuoteStatus } from '@prisma/client';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface QuotesListParams {
  clientId?: string;
  status?: QuoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

interface QuoteSummary {
  id: string;
  clientName: string;
  status: string;
  totalValue: number;
  validUntil: Date | null;
  createdAt: Date;
}

@Injectable()
export class QuotesListTool extends BaseTool<QuotesListParams, QuoteSummary[]> {
  readonly metadata: ToolMetadata = {
    name: 'quotes.list',
    description:
      'Lista os orçamentos do usuário. Pode filtrar por cliente, status ou buscar por texto.',
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
          enum: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'],
          description: 'Filtrar por status do orçamento',
        },
        search: {
          type: 'string',
          description: 'Buscar por nome do cliente',
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

  async validate(params: QuotesListParams): Promise<true | string> {
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 100)) {
      return 'O limite deve ser entre 1 e 100';
    }
    if (params.status && !['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(params.status)) {
      return 'Status inválido';
    }
    return true;
  }

  async execute(
    params: QuotesListParams,
    context: ToolContext,
  ): Promise<ToolResult<QuoteSummary[]>> {
    const { clientId, status, search, limit = 20, offset = 0 } = params;

    const quotes = await this.prisma.quote.findMany({
      where: {
        userId: context.userId, // CRITICAL: Multi-tenant filter
        ...(clientId && { clientId }),
        ...(status && { status }),
        ...(search && {
          client: {
            name: { contains: search, mode: 'insensitive' },
          },
        }),
      },
      include: {
        client: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const result: QuoteSummary[] = quotes.map((q) => ({
      id: q.id,
      clientName: q.client.name,
      status: q.status,
      totalValue: Number(q.totalValue),
      validUntil: q.validUntil,
      createdAt: q.createdAt,
    }));

    return {
      success: true,
      data: result,
      affectedEntities: quotes.map((q) => ({
        type: 'quote',
        id: q.id,
        action: 'read' as const,
      })),
    };
  }
}
