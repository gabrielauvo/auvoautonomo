/**
 * Payments Preview Tool (Dry-Run)
 * Creates a preview of a payment WITHOUT actually creating it in Asaas
 * This is MANDATORY before creating any payment
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult, PaymentPreviewData } from '../../interfaces/tool.interface';

interface PaymentsPreviewParams {
  clientId: string;
  value: number;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  dueDate: string;
  description?: string;
}

interface PaymentPreviewResult {
  valid: boolean;
  preview: PaymentPreviewData;
  warnings: string[];
  clientHasAsaasId: boolean;
}

@Injectable()
export class PaymentsPreviewTool extends BaseTool<PaymentsPreviewParams, PaymentPreviewResult> {
  readonly metadata: ToolMetadata = {
    name: 'payments.preview',
    description:
      'Cria uma prévia (dry-run) de uma cobrança sem criar no gateway de pagamento. Esta etapa é OBRIGATÓRIA antes de criar uma cobrança real.',
    actionType: AiActionType.READ, // Preview is a read operation
    parametersSchema: {
      type: 'object',
      required: ['clientId', 'value', 'billingType', 'dueDate'],
      properties: {
        clientId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do cliente',
        },
        value: {
          type: 'number',
          description: 'Valor da cobrança em reais',
          minimum: 0.01,
        },
        billingType: {
          type: 'string',
          enum: ['PIX', 'BOLETO', 'CREDIT_CARD'],
          description: 'Tipo de cobrança',
        },
        dueDate: {
          type: 'string',
          format: 'date',
          description: 'Data de vencimento (YYYY-MM-DD)',
        },
        description: {
          type: 'string',
          description: 'Descrição da cobrança',
        },
      },
    },
  };

  async validate(params: PaymentsPreviewParams, context: ToolContext): Promise<true | string> {
    if (!params.clientId) {
      return 'O ID do cliente é obrigatório';
    }

    if (!params.value || params.value <= 0) {
      return 'O valor deve ser maior que zero';
    }

    if (!params.billingType) {
      return 'O tipo de cobrança é obrigatório';
    }

    if (!['PIX', 'BOLETO', 'CREDIT_CARD'].includes(params.billingType)) {
      return 'Tipo de cobrança inválido. Use: PIX, BOLETO ou CREDIT_CARD';
    }

    if (!params.dueDate) {
      return 'A data de vencimento é obrigatória';
    }

    if (isNaN(Date.parse(params.dueDate))) {
      return 'Data de vencimento inválida';
    }

    // Verify client ownership
    const isOwner = await this.verifyOwnership('client', params.clientId, context.userId);
    if (!isOwner) {
      return 'Cliente não encontrado';
    }

    return true;
  }

  async execute(
    params: PaymentsPreviewParams,
    context: ToolContext,
  ): Promise<ToolResult<PaymentPreviewResult>> {
    const { clientId, value, billingType, dueDate, description } = params;
    const warnings: string[] = [];

    // Get client details
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        userId: context.userId, // CRITICAL: Multi-tenant filter
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        taxId: true,
        asaasCustomerId: true,
      },
    });

    if (!client) {
      return {
        success: false,
        error: 'Cliente não encontrado',
      };
    }

    // Check if user has Asaas integration
    const asaasIntegration = await this.prisma.asaasIntegration.findUnique({
      where: { userId: context.userId },
      select: { isActive: true },
    });

    if (!asaasIntegration?.isActive) {
      return {
        success: false,
        error: 'Integração com Asaas não está ativa. Configure a integração antes de criar cobranças.',
      };
    }

    // Validate due date
    const parsedDueDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (parsedDueDate < today) {
      warnings.push('A data de vencimento está no passado');
    }

    // Billing type specific validations
    if (billingType === 'BOLETO') {
      // Boleto requires at least 1 business day
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 1);
      if (parsedDueDate < minDate) {
        warnings.push('Boleto requer pelo menos 1 dia útil para vencimento');
      }
    }

    if (billingType === 'CREDIT_CARD') {
      if (!client.email) {
        warnings.push('Cobrança por cartão de crédito requer email do cliente');
      }
    }

    // Check if client has Asaas ID
    const clientHasAsaasId = !!client.asaasCustomerId;
    if (!clientHasAsaasId) {
      warnings.push('Cliente será cadastrado automaticamente no Asaas');

      // Validate required fields for Asaas customer creation
      if (!client.taxId) {
        warnings.push('CPF/CNPJ do cliente é recomendado para cadastro no Asaas');
      }
    }

    // Value validations
    if (value < 5) {
      warnings.push('Valor mínimo para cobrança no Asaas é R$ 5,00');
    }

    if (value > 50000) {
      warnings.push('Valores acima de R$ 50.000 podem requerer validação adicional');
    }

    // Check entity limit
    const canCreate = await this.checkEntityLimit(context.userId, 'payments');
    if (!canCreate) {
      return {
        success: false,
        error: 'Você atingiu o limite de cobranças do seu plano. Faça upgrade para continuar.',
      };
    }

    const preview: PaymentPreviewData = {
      clientId: client.id,
      clientName: client.name,
      billingType,
      value,
      dueDate: parsedDueDate,
      description: description?.trim() || undefined,
    };

    return {
      success: true,
      data: {
        valid: warnings.filter((w) => w.includes('requer')).length === 0,
        preview,
        warnings,
        clientHasAsaasId,
      },
    };
  }
}
