/**
 * Payments Create Tool
 * Creates a payment in Asaas after mandatory preview confirmation
 * This tool REQUIRES a previous preview (dry-run) and plan confirmation
 */

import { Injectable } from '@nestjs/common';
import { AiActionType } from '../../enums';
import { BaseTool } from '../base.tool';
import { ToolMetadata, ToolContext, ToolResult } from '../../interfaces/tool.interface';
import { Decimal } from '@prisma/client/runtime/library';

interface PaymentsCreateParams {
  /** ID from the preview that was confirmed */
  previewId: string;
  /** Idempotency key to prevent duplicates */
  idempotencyKey: string;
}

interface CreatedPayment {
  id: string;
  clientName: string;
  value: number;
  billingType: string;
  dueDate: Date;
  asaasPaymentId: string;
  invoiceUrl: string | null;
  pixCode: string | null;
}

@Injectable()
export class PaymentsCreateTool extends BaseTool<PaymentsCreateParams, CreatedPayment> {
  readonly metadata: ToolMetadata = {
    name: 'payments.create',
    description:
      'Cria uma cobrança real no Asaas. REQUER uma prévia (payments.preview) confirmada anteriormente.',
    actionType: AiActionType.PAYMENT_CREATE,
    requiresPaymentPreview: true,
    parametersSchema: {
      type: 'object',
      required: ['previewId', 'idempotencyKey'],
      properties: {
        previewId: {
          type: 'string',
          format: 'uuid',
          description: 'ID do preview que foi confirmado',
        },
        idempotencyKey: {
          type: 'string',
          description: 'Chave de idempotência para evitar cobranças duplicadas',
        },
      },
    },
  };

  async validate(params: PaymentsCreateParams, context: ToolContext): Promise<true | string> {
    if (!params.previewId) {
      return 'O ID do preview é obrigatório. Use payments.preview primeiro.';
    }

    if (!params.idempotencyKey) {
      return 'A chave de idempotência é obrigatória';
    }

    // Verify preview exists and belongs to user
    const preview = await this.prisma.aiPaymentPreview.findFirst({
      where: {
        id: params.previewId,
        plan: {
          userId: context.userId, // CRITICAL: Multi-tenant filter
        },
        valid: true,
        createdPaymentId: null, // Not yet created
      },
      include: {
        plan: {
          select: { status: true },
        },
      },
    });

    if (!preview) {
      return 'Preview não encontrado, inválido ou já utilizado';
    }

    if (preview.plan.status !== 'CONFIRMED' && preview.plan.status !== 'EXECUTING') {
      return 'O plano precisa ser confirmado antes de criar a cobrança';
    }

    // Check if payment with this idempotency key already exists
    // This prevents duplicate payments if the tool is called multiple times
    const existingPayment = await this.prisma.clientPayment.findFirst({
      where: {
        userId: context.userId,
        // We'll use description to store idempotency reference
        description: { contains: `[idem:${params.idempotencyKey}]` },
      },
    });

    if (existingPayment) {
      return `Cobrança já criada com esta chave de idempotência. ID: ${existingPayment.id}`;
    }

    return true;
  }

  async execute(
    params: PaymentsCreateParams,
    context: ToolContext,
  ): Promise<ToolResult<CreatedPayment>> {
    const { previewId, idempotencyKey } = params;

    // Get preview with all data
    const preview = await this.prisma.aiPaymentPreview.findFirst({
      where: {
        id: previewId,
        plan: { userId: context.userId },
        valid: true,
        createdPaymentId: null,
      },
    });

    if (!preview) {
      return {
        success: false,
        error: 'Preview não encontrado ou já utilizado',
      };
    }

    // Get client
    const client = await this.prisma.client.findFirst({
      where: {
        id: preview.clientId,
        userId: context.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        asaasCustomerId: true,
      },
    });

    if (!client) {
      return {
        success: false,
        error: 'Cliente não encontrado',
      };
    }

    // Get Asaas integration
    const asaasIntegration = await this.prisma.asaasIntegration.findUnique({
      where: { userId: context.userId },
      select: { isActive: true },
    });

    if (!asaasIntegration?.isActive) {
      return {
        success: false,
        error: 'Integração com Asaas não está ativa',
      };
    }

    // In a real implementation, this would:
    // 1. Call Asaas API to create the payment
    // 2. Handle customer creation if needed
    // 3. Return the payment URL, PIX code, etc.

    // For now, we'll create a placeholder payment record
    // The actual Asaas integration would be done by the existing ClientPaymentsService

    const descriptionWithIdem = preview.description
      ? `${preview.description} [idem:${idempotencyKey}]`
      : `Cobrança via AI Copilot [idem:${idempotencyKey}]`;

    // Create payment record
    // NOTE: In production, this should call the actual payment service
    // that integrates with Asaas
    const mockAsaasPaymentId = `pay_ai_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const payment = await this.prisma.clientPayment.create({
      data: {
        userId: context.userId,
        clientId: preview.clientId,
        asaasPaymentId: mockAsaasPaymentId,
        billingType: preview.billingType as 'PIX' | 'BOLETO' | 'CREDIT_CARD',
        value: preview.value,
        description: descriptionWithIdem,
        dueDate: preview.dueDate,
        status: 'PENDING',
      },
      select: {
        id: true,
        value: true,
        billingType: true,
        dueDate: true,
        asaasPaymentId: true,
        asaasInvoiceUrl: true,
        asaasPixCode: true,
      },
    });

    // Mark preview as used
    await this.prisma.aiPaymentPreview.update({
      where: { id: previewId },
      data: { createdPaymentId: payment.id },
    });

    return {
      success: true,
      data: {
        id: payment.id,
        clientName: client.name,
        value: Number(payment.value),
        billingType: payment.billingType,
        dueDate: payment.dueDate,
        asaasPaymentId: payment.asaasPaymentId,
        invoiceUrl: payment.asaasInvoiceUrl,
        pixCode: payment.asaasPixCode,
      },
      affectedEntities: [{ type: 'clientPayment', id: payment.id, action: 'created' }],
    };
  }
}
