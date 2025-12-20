import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientPaymentsService } from './client-payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientPaymentsController {
  constructor(private readonly clientPaymentsService: ClientPaymentsService) {}

  /**
   * POST /clients/:clientId/sync-asaas
   * Sync client with Asaas customer
   */
  @Post(':clientId/sync-asaas')
  async syncCustomer(@Request() req, @Param('clientId') clientId: string) {
    const customerId = await this.clientPaymentsService.syncCustomer(req.user.userId, clientId);
    return {
      message: 'Client synced with Asaas successfully',
      asaasCustomerId: customerId,
    };
  }

  /**
   * POST /clients/:clientId/payments
   * Create payment for client
   */
  @Post(':clientId/payments')
  async createPayment(@Request() req, @Param('clientId') clientId: string, @Body() dto: CreatePaymentDto) {
    try {
      return await this.clientPaymentsService.createPayment(req.user.userId, {
        ...dto,
        clientId,
      });
    } catch (error) {
      // Propagate user-friendly error messages from Asaas
      if (error instanceof Error && error.message) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * GET /clients/payments
   * List all payments (optionally filtered by client)
   */
  @Get('payments')
  async listPayments(@Request() req, @Query('clientId') clientId?: string) {
    return this.clientPaymentsService.listPayments(req.user.userId, clientId);
  }

  /**
   * GET /clients/payments/:paymentId
   * Get payment by ID
   */
  @Get('payments/:paymentId')
  async getPayment(@Request() req, @Param('paymentId') paymentId: string) {
    return this.clientPaymentsService.getPayment(req.user.userId, paymentId);
  }
}
