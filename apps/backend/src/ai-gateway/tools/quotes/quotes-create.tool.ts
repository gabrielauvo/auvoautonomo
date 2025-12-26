/**
 * Quotes Create Tool
 * Creates a new quote for a client
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';
import { Decimal } from '@prisma/client/runtime/library';

interface QuoteItem {
  name: string;
  quantity: number;
  unitPrice: number;
  type?: 'PRODUCT' | 'SERVICE';
}

interface QuotesCreateParams {
  clientId: string;
  items: QuoteItem[];
  discountValue?: number;
  notes?: string;
  validUntilDays?: number;
}

interface CreatedQuote {
  id: string;
  clientName: string;
  totalValue: number;
  itemCount: number;
  validUntil: Date | null;
}

@Injectable()
export class QuotesCreateTool extends BaseTool<QuotesCreateParams, CreatedQuote> {
  readonly metadata: ToolMetadata = {
    name: 'quotes.create',
    description:
      'Cria um novo orçamento para um cliente. Requer confirmação antes da execução.',
    actionType: AiActionType.CREATE,
    parametersSchema: {
      type: 'object',
      required: ['clientId', 'items'],
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do cliente',
        },
        items: {
          type: 'array',
          description: 'Itens do orçamento',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'quantity', 'unitPrice'],
            properties: {
              name: {
                type: 'string',
                description: 'Nome do produto ou serviço',
              },
              quantity: {
                type: 'number',
                description: 'Quantidade',
                minimum: 0.001,
              },
              unitPrice: {
                type: 'number',
                description: 'Preço unitário',
                minimum: 0,
              },
              type: {
                type: 'string',
                enum: ['PRODUCT', 'SERVICE'],
                description: 'Tipo do item',
                default: 'PRODUCT',
              },
            },
          },
        },
        discountValue: {
          type: 'number',
          description: 'Valor do desconto (em reais)',
          minimum: 0,
        },
        notes: {
          type: 'string',
          description: 'Observações do orçamento',
        },
        validUntilDays: {
          type: 'integer',
          description: 'Dias de validade do orçamento (padrão: 30)',
          default: 30,
          minimum: 1,
          maximum: 365,
        },
      },
    },
  };

  async validate(params: QuotesCreateParams, context: ToolContext): Promise<true | string> {
    if (!params.clientId) {
      return 'O ID do cliente é obrigatório';
    }

    // Verify client ownership
    const isOwner = await this.verifyOwnership('client', params.clientId, context.userId);
    if (!isOwner) {
      return 'Cliente não encontrado';
    }

    if (!params.items || params.items.length === 0) {
      return 'O orçamento deve ter pelo menos um item';
    }

    for (const item of params.items) {
      if (!item.name || item.name.trim().length < 1) {
        return 'Todos os itens devem ter um nome';
      }
      if (item.quantity <= 0) {
        return 'A quantidade deve ser maior que zero';
      }
      if (item.unitPrice < 0) {
        return 'O preço unitário não pode ser negativo';
      }
    }

    // Check entity limit
    const canCreate = await this.checkEntityLimit(context.userId, 'quotes');
    if (!canCreate) {
      return 'Você atingiu o limite de orçamentos do seu plano. Faça upgrade para continuar.';
    }

    return true;
  }

  async execute(
    params: QuotesCreateParams,
    context: ToolContext,
  ): Promise<ToolResult<CreatedQuote>> {
    const { clientId, items, discountValue = 0, notes, validUntilDays = 30 } = params;

    // Calculate totals
    const itemsWithTotals = items.map((item) => ({
      name: item.name.trim(),
      type: item.type || 'PRODUCT',
      unit: 'UN',
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      discountValue: new Decimal(0),
      totalPrice: new Decimal(item.quantity * item.unitPrice),
    }));

    const subtotal = itemsWithTotals.reduce(
      (sum, item) => sum.plus(item.totalPrice),
      new Decimal(0),
    );
    const totalValue = subtotal.minus(new Decimal(discountValue));

    // Calculate valid until date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validUntilDays);

    // Get client name
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true },
    });

    // Create quote with items in a transaction
    const quote = await this.prisma.quote.create({
      data: {
        userId: context.userId,
        clientId,
        status: 'DRAFT',
        discountValue: new Decimal(discountValue),
        totalValue,
        notes: notes?.trim() || null,
        validUntil,
        items: {
          create: itemsWithTotals,
        },
      },
      select: {
        id: true,
        totalValue: true,
        validUntil: true,
        items: {
          select: { id: true },
        },
      },
    });

    return {
      success: true,
      data: {
        id: quote.id,
        clientName: client?.name || 'Cliente',
        totalValue: Number(quote.totalValue),
        itemCount: quote.items.length,
        validUntil: quote.validUntil,
      },
      affectedEntities: [{ type: 'quote', id: quote.id, action: 'created' }],
    };
  }
}
