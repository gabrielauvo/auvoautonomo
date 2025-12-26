/**
 * Quotes Get Tool
 * Gets detailed information about a specific quote
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';

interface QuotesGetParams {
  quoteId: string;
}

interface QuoteDetail {
  id: string;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  status: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  discountValue: number;
  totalValue: number;
  notes: string | null;
  validUntil: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class QuotesGetTool extends BaseTool<QuotesGetParams, QuoteDetail> {
  readonly metadata: ToolMetadata = {
    name: 'quotes.get',
    description:
      'Obtém detalhes completos de um orçamento, incluindo itens e informações do cliente.',
    actionType: AiActionType.READ,
    parametersSchema: {
      type: 'object',
      required: ['quoteId'],
      properties: {
        quoteId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do orçamento',
        },
      },
    },
  };

  async validate(params: QuotesGetParams): Promise<true | string> {
    if (!params.quoteId) {
      return 'O ID do orçamento é obrigatório';
    }
    return true;
  }

  async execute(
    params: QuotesGetParams,
    context: ToolContext,
  ): Promise<ToolResult<QuoteDetail>> {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: params.quoteId,
        userId: context.userId, // CRITICAL: Multi-tenant filter
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
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

    if (!quote) {
      return {
        success: false,
        error: 'Orçamento não encontrado',
      };
    }

    const result: QuoteDetail = {
      id: quote.id,
      client: quote.client,
      status: quote.status,
      items: quote.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      discountValue: Number(quote.discountValue),
      totalValue: Number(quote.totalValue),
      notes: quote.notes,
      validUntil: quote.validUntil,
      sentAt: quote.sentAt,
      createdAt: quote.createdAt,
    };

    return {
      success: true,
      data: result,
      affectedEntities: [{ type: 'quote', id: quote.id, action: 'read' }],
    };
  }
}
