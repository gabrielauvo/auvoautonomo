import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AsaasIntegrationService } from './asaas-integration.service';
import { ConnectAsaasDto } from './dto/connect-asaas.dto';

@Controller('integrations/asaas')
@UseGuards(JwtAuthGuard)
export class AsaasIntegrationController {
  constructor(private readonly asaasIntegrationService: AsaasIntegrationService) {}

  /**
   * POST /integrations/asaas/connect
   * Connect user's Asaas account
   */
  @Post('connect')
  async connect(@Request() req, @Body() dto: ConnectAsaasDto) {
    return this.asaasIntegrationService.connect(req.user.userId, dto);
  }

  /**
   * GET /integrations/asaas/status
   * Get Asaas integration status
   */
  @Get('status')
  async getStatus(@Request() req) {
    return this.asaasIntegrationService.getStatus(req.user.userId);
  }

  /**
   * DELETE /integrations/asaas/disconnect
   * Disconnect Asaas integration
   */
  @Delete('disconnect')
  async disconnect(@Request() req) {
    return this.asaasIntegrationService.disconnect(req.user.userId);
  }
}
