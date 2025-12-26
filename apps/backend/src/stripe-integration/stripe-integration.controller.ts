import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StripeIntegrationService } from './stripe-integration.service';
import { ConnectStripeDto } from './dto/connect-stripe.dto';

@Controller('integrations/stripe')
@UseGuards(JwtAuthGuard)
export class StripeIntegrationController {
  constructor(private readonly stripeIntegrationService: StripeIntegrationService) {}

  /**
   * POST /integrations/stripe/connect
   * Connect user's Stripe account
   */
  @Post('connect')
  async connect(@Request() req, @Body() dto: ConnectStripeDto) {
    return this.stripeIntegrationService.connect(req.user.userId, dto);
  }

  /**
   * GET /integrations/stripe/status
   * Get Stripe integration status
   */
  @Get('status')
  async getStatus(@Request() req) {
    return this.stripeIntegrationService.getStatus(req.user.userId);
  }

  /**
   * DELETE /integrations/stripe/disconnect
   * Disconnect Stripe integration
   */
  @Delete('disconnect')
  async disconnect(@Request() req) {
    return this.stripeIntegrationService.disconnect(req.user.userId);
  }
}
