import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { AsaasIntegrationService } from '../asaas-integration/asaas-integration.service';

/**
 * PublicPaymentController
 *
 * Endpoints públicos (sem autenticação) para clientes finais
 * visualizarem e interagirem com suas cobranças.
 *
 * Acesso via token único gerado para cada cobrança.
 */
@ApiTags('Public Payments')
@Controller('public/payments')
export class PublicPaymentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasClient: AsaasHttpClient,
    private readonly asaasIntegration: AsaasIntegrationService,
  ) {}

  /**
   * Get payment details by public token
   * GET /public/payments/:token
   */
  @Get(':token')
  @ApiOperation({ summary: 'Get payment details by public token' })
  @ApiParam({ name: 'token', description: 'Public token for the payment' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentByToken(@Param('token') token: string) {
    const payment = await this.prisma.clientPayment.findUnique({
      where: { publicToken: token },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            taxId: true,
            address: true,
            city: true,
            state: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            companyName: true,
            companyLogoUrl: true,
          },
        },
        quote: {
          select: {
            id: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Cobrança não encontrada');
    }

    // Format response for public consumption
    return {
      id: payment.id,
      status: payment.status,
      value: payment.value.toNumber(),
      billingType: payment.billingType,
      dueDate: payment.dueDate,
      description: payment.description,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      // Payment URLs
      invoiceUrl: payment.asaasInvoiceUrl,
      pixQrCodeUrl: payment.asaasQrCodeUrl,
      pixCode: payment.asaasPixCode,
      // Client info (the person who needs to pay)
      client: {
        name: payment.client.name,
        email: payment.client.email,
        phone: payment.client.phone,
        taxId: this.maskTaxId(payment.client.taxId),
        location: payment.client.city && payment.client.state
          ? `${payment.client.city} - ${payment.client.state}`
          : null,
      },
      // Company info (who is charging)
      company: {
        name: payment.user.companyName || payment.user.name,
        logoUrl: payment.user.companyLogoUrl,
        phone: payment.user.phone,
        email: payment.user.email,
      },
      // Reference info
      reference: payment.workOrder
        ? { type: 'workOrder', id: payment.workOrder.id, title: payment.workOrder.title }
        : payment.quote
          ? { type: 'quote', id: payment.quote.id }
          : null,
    };
  }

  /**
   * Generate/refresh PIX QR code for a payment
   * POST /public/payments/:token/pix
   */
  @Post(':token/pix')
  @ApiOperation({ summary: 'Get or generate PIX QR code for payment' })
  @ApiParam({ name: 'token', description: 'Public token for the payment' })
  @ApiResponse({ status: 200, description: 'PIX QR code data' })
  @ApiResponse({ status: 400, description: 'Payment cannot be paid via PIX' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPixData(@Param('token') token: string) {
    const payment = await this.prisma.clientPayment.findUnique({
      where: { publicToken: token },
    });

    if (!payment) {
      throw new NotFoundException('Cobrança não encontrada');
    }

    // Check if payment can be paid
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DELETED', 'REFUNDED'].includes(payment.status)) {
      throw new BadRequestException('Esta cobrança já foi paga ou cancelada');
    }

    // If we already have PIX data, return it
    if (payment.asaasPixCode && payment.asaasQrCodeUrl) {
      return {
        pixCode: payment.asaasPixCode,
        qrCodeUrl: payment.asaasQrCodeUrl,
        qrCodeBase64: null, // Would need to fetch from Asaas if needed
      };
    }

    // For BOLETO payments, we need to get PIX data from Asaas
    // This requires fetching the payment details from Asaas API
    try {
      const { apiKey, environment } = await this.asaasIntegration.getApiKey(payment.userId);
      const asaasPayment = await this.asaasClient.getPayment(apiKey, environment, payment.asaasPaymentId);

      if (asaasPayment.pixTransaction?.qrCode) {
        // Update local cache
        await this.prisma.clientPayment.update({
          where: { id: payment.id },
          data: {
            asaasPixCode: asaasPayment.pixTransaction.qrCode.payload,
            asaasQrCodeUrl: asaasPayment.pixTransaction.qrCode.encodedImage,
          },
        });

        return {
          pixCode: asaasPayment.pixTransaction.qrCode.payload,
          qrCodeUrl: asaasPayment.pixTransaction.qrCode.encodedImage,
          qrCodeBase64: asaasPayment.pixTransaction.qrCode.encodedImage,
        };
      }

      throw new BadRequestException('PIX não disponível para esta cobrança');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Não foi possível obter os dados do PIX');
    }
  }

  /**
   * Get boleto data for a payment
   * POST /public/payments/:token/boleto
   */
  @Post(':token/boleto')
  @ApiOperation({ summary: 'Get boleto data for payment' })
  @ApiParam({ name: 'token', description: 'Public token for the payment' })
  @ApiResponse({ status: 200, description: 'Boleto data' })
  @ApiResponse({ status: 400, description: 'Payment cannot be paid via boleto' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getBoletoData(@Param('token') token: string) {
    const payment = await this.prisma.clientPayment.findUnique({
      where: { publicToken: token },
    });

    if (!payment) {
      throw new NotFoundException('Cobrança não encontrada');
    }

    // Check if payment can be paid
    if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DELETED', 'REFUNDED'].includes(payment.status)) {
      throw new BadRequestException('Esta cobrança já foi paga ou cancelada');
    }

    if (payment.asaasInvoiceUrl) {
      return {
        invoiceUrl: payment.asaasInvoiceUrl,
        bankSlipUrl: payment.asaasInvoiceUrl,
      };
    }

    // Try to fetch from Asaas
    try {
      const { apiKey, environment } = await this.asaasIntegration.getApiKey(payment.userId);
      const asaasPayment = await this.asaasClient.getPayment(apiKey, environment, payment.asaasPaymentId);

      const invoiceUrl = asaasPayment.invoiceUrl || asaasPayment.bankSlipUrl;

      if (invoiceUrl) {
        // Update local cache
        await this.prisma.clientPayment.update({
          where: { id: payment.id },
          data: { asaasInvoiceUrl: invoiceUrl },
        });

        return {
          invoiceUrl,
          bankSlipUrl: invoiceUrl,
        };
      }

      throw new BadRequestException('Boleto não disponível para esta cobrança');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Não foi possível obter os dados do boleto');
    }
  }

  /**
   * Mask tax ID for privacy (show only first and last digits)
   * Example: 123.456.789-00 -> 1**.***.**9-00
   */
  private maskTaxId(taxId: string | null | undefined): string | null {
    if (!taxId) return null;

    // Remove non-numeric characters
    const digits = taxId.replace(/\D/g, '');

    if (digits.length === 11) {
      // CPF: show first 3 and last 2 digits
      return `${digits.substring(0, 3)}.***.***-${digits.substring(9)}`;
    } else if (digits.length === 14) {
      // CNPJ: show first 2 and last 2 digits
      return `${digits.substring(0, 2)}.***.***/${digits.substring(8, 12)}-${digits.substring(12)}`;
    }

    return taxId;
  }
}
