import { Module } from '@nestjs/common';
import { StripeIntegrationController } from './stripe-integration.controller';
import { StripeIntegrationService } from './stripe-integration.service';

@Module({
  controllers: [StripeIntegrationController],
  providers: [StripeIntegrationService],
  exports: [StripeIntegrationService],
})
export class StripeIntegrationModule {}
