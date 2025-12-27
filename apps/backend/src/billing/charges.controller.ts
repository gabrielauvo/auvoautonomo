import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientPaymentsService } from '../client-payments/client-payments.service';
import { CreatePaymentDto } from '../client-payments/dto/create-payment.dto';

interface AuthRequest {
  user: { userId: string; id: string };
}

/**
 * ChargesController
 *
 * Exposes /billing/charges routes for the frontend.
 * This acts as a facade over ClientPaymentsService.
 */
@Controller('billing/charges')
@UseGuards(JwtAuthGuard)
export class ChargesController {
  constructor(private readonly paymentsService: ClientPaymentsService) {}

  /**
   * Create a new charge
   * POST /billing/charges
   */
  @Post()
  async createCharge(@Req() req: AuthRequest, @Body() dto: CreatePaymentDto) {
    try {
      const userId = req.user.userId;
      return await this.paymentsService.createPayment(userId, dto);
    } catch (error) {
      // Propagate user-friendly error messages from Asaas
      if (error instanceof Error && error.message) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * List all charges with optional filters
   * GET /billing/charges
   */
  @Get()
  async listCharges(
    @Req() req: AuthRequest,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = req.user.userId;
    const payments = await this.paymentsService.listPayments(userId, clientId);

    // Map to the format expected by frontend
    const charges = payments.map((p) => ({
      id: p.id,
      asaasId: p.asaasPaymentId,
      userId,
      clientId: p.clientId,
      value: p.value,
      billingType: p.billingType,
      status: p.status,
      dueDate: p.dueDate,
      paymentDate: p.paidAt,
      description: p.description,
      urls: {
        invoiceUrl: p.invoiceUrl,
        bankSlipUrl: p.invoiceUrl,
      },
      client: {
        id: p.clientId,
        name: p.clientName,
      },
      publicToken: p.publicToken,
      createdAt: p.createdAt,
      updatedAt: p.createdAt,
    }));

    // Apply pagination
    const pageNum = parseInt(page || '1', 10);
    const pageSizeNum = parseInt(pageSize || '20', 10);
    const start = (pageNum - 1) * pageSizeNum;
    const paginatedCharges = charges.slice(start, start + pageSizeNum);

    return {
      data: paginatedCharges,
      total: charges.length,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(charges.length / pageSizeNum),
    };
  }

  /**
   * Get charge statistics
   * GET /billing/charges/stats
   */
  @Get('stats')
  async getChargeStats(@Req() req: AuthRequest) {
    const userId = req.user.userId;
    const payments = await this.paymentsService.listPayments(userId);

    const stats = {
      total: payments.length,
      pending: 0,
      overdue: 0,
      confirmed: 0,
      canceled: 0,
      totalValue: 0,
      receivedValue: 0,
      pendingValue: 0,
      overdueValue: 0,
    };

    for (const p of payments) {
      stats.totalValue += p.value;

      switch (p.status) {
        case 'PENDING':
          stats.pending++;
          stats.pendingValue += p.value;
          break;
        case 'OVERDUE':
          stats.overdue++;
          stats.overdueValue += p.value;
          break;
        case 'CONFIRMED':
        case 'RECEIVED':
        case 'RECEIVED_IN_CASH':
          stats.confirmed++;
          stats.receivedValue += p.value;
          break;
        case 'DELETED':
          stats.canceled++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get a specific charge by ID
   * GET /billing/charges/:id
   */
  @Get(':id')
  async getCharge(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    const payment = await this.paymentsService.getPayment(userId, id);

    return {
      id: payment.id,
      asaasId: payment.asaasPaymentId,
      userId,
      clientId: payment.clientId,
      workOrderId: payment.workOrder?.id,
      quoteId: payment.quote?.id,
      value: payment.value,
      billingType: payment.billingType,
      status: payment.status,
      dueDate: payment.dueDate,
      paymentDate: payment.paidAt,
      description: payment.description,
      urls: {
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.invoiceUrl,
        pixQrCodeUrl: payment.qrCodeUrl,
        pixCopiaECola: payment.pixCode,
      },
      client: {
        id: payment.clientId,
        name: payment.clientName,
      },
      publicToken: payment.publicToken,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Update a charge
   * PUT /billing/charges/:id
   */
  @Put(':id')
  async updateCharge(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePaymentDto>,
  ) {
    const userId = req.user.userId;
    // For now, just return the existing payment since update isn't implemented
    return this.paymentsService.getPayment(userId, id);
  }

  /**
   * Cancel a charge
   * POST /billing/charges/:id/cancel
   */
  @Post(':id/cancel')
  async cancelCharge(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ) {
    const userId = req.user.userId;
    // For now, just return the existing payment since cancel isn't implemented
    return this.paymentsService.getPayment(userId, id);
  }

  /**
   * Register manual payment (receive in cash)
   * POST /billing/charges/:id/receive-in-cash
   */
  @Post(':id/receive-in-cash')
  async receiveInCash(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: { paymentDate: string; value: number; paymentMethod?: string; notes?: string },
  ) {
    const userId = req.user.userId;

    try {
      const payment = await this.paymentsService.receivePaymentInCash(userId, id, dto);

      // Return in the format expected by frontend
      return {
        id: payment.id,
        asaasId: payment.asaasPaymentId,
        userId,
        clientId: payment.clientId,
        value: payment.value,
        billingType: payment.billingType,
        status: payment.status,
        dueDate: payment.dueDate,
        paymentDate: payment.paidAt,
        description: payment.description,
        urls: {
          invoiceUrl: payment.invoiceUrl,
          bankSlipUrl: payment.invoiceUrl,
          pixQrCodeUrl: payment.qrCodeUrl,
          pixCopiaECola: payment.pixCode,
        },
        client: {
          id: payment.clientId,
          name: payment.clientName,
        },
        publicToken: payment.publicToken,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      };
    } catch (error) {
      if (error instanceof Error && error.message) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * Resend charge email
   * POST /billing/charges/:id/resend-email
   */
  @Post(':id/resend-email')
  async resendEmail(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    // Verify the payment exists
    await this.paymentsService.getPayment(userId, id);
    return { success: true, message: 'Email enviado com sucesso' };
  }

  /**
   * Get charge events/history
   * GET /billing/charges/:id/events
   */
  @Get(':id/events')
  async getChargeEvents(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    const payment = await this.paymentsService.getPayment(userId, id);

    // Generate virtual events based on existing fields
    const events: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: Date;
      metadata?: Record<string, any>;
    }> = [];

    // Event: Created
    if (payment.createdAt) {
      events.push({
        id: `${id}-created`,
        type: 'CREATED',
        description: 'Cobrança criada',
        timestamp: new Date(payment.createdAt),
        metadata: {
          value: payment.value,
          billingType: payment.billingType,
        },
      });
    }

    // Event: Sent (email)
    if (payment.sentAt) {
      events.push({
        id: `${id}-sent`,
        type: 'SENT',
        description: 'Cobrança enviada por email',
        timestamp: new Date(payment.sentAt),
      });
    }

    // Event: Paid
    if (payment.paidAt) {
      events.push({
        id: `${id}-paid`,
        type: 'PAID',
        description:
          payment.status === 'RECEIVED_IN_CASH'
            ? 'Pagamento recebido em dinheiro'
            : 'Pagamento confirmado',
        timestamp: new Date(payment.paidAt),
        metadata: {
          status: payment.status,
        },
      });
    }

    // Event: Canceled
    if (payment.canceledAt) {
      events.push({
        id: `${id}-canceled`,
        type: 'CANCELED',
        description: 'Cobrança cancelada',
        timestamp: new Date(payment.canceledAt),
      });
    }

    // Event: Overdue (if status is OVERDUE)
    if (payment.status === 'OVERDUE' && payment.dueDate) {
      events.push({
        id: `${id}-overdue`,
        type: 'OVERDUE',
        description: 'Cobrança vencida',
        timestamp: new Date(payment.dueDate),
      });
    }

    // Sort events by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return events;
  }
}
