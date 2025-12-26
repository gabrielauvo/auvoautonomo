import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MercadoPagoIntegrationService } from './mercadopago-integration.service';
import { ConnectMercadoPagoDto } from './dto/connect-mercadopago.dto';

@Controller('integrations/mercadopago')
@UseGuards(JwtAuthGuard)
export class MercadoPagoIntegrationController {
  constructor(private readonly mercadoPagoIntegrationService: MercadoPagoIntegrationService) {}

  /**
   * POST /integrations/mercadopago/connect
   * Connect user's Mercado Pago account
   */
  @Post('connect')
  async connect(@Request() req, @Body() dto: ConnectMercadoPagoDto) {
    return this.mercadoPagoIntegrationService.connect(req.user.userId, dto);
  }

  /**
   * GET /integrations/mercadopago/status
   * Get Mercado Pago integration status
   */
  @Get('status')
  async getStatus(@Request() req) {
    return this.mercadoPagoIntegrationService.getStatus(req.user.userId);
  }

  /**
   * DELETE /integrations/mercadopago/disconnect
   * Disconnect Mercado Pago integration
   */
  @Delete('disconnect')
  async disconnect(@Request() req) {
    return this.mercadoPagoIntegrationService.disconnect(req.user.userId);
  }
}
