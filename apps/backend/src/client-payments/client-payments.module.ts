import { Module } from '@nestjs/common';
import { ClientPaymentsController } from './client-payments.controller';
import { ClientPaymentsService } from './client-payments.service';
import { PublicPaymentController } from './public-payment.controller';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { AsaasIntegrationModule } from '../asaas-integration/asaas-integration.module';
import { DomainEventsModule } from '../domain-events/domain-events.module';

@Module({
  imports: [AsaasIntegrationModule, DomainEventsModule],
  controllers: [ClientPaymentsController, PublicPaymentController],
  providers: [ClientPaymentsService, AsaasHttpClient],
  exports: [ClientPaymentsService],
})
export class ClientPaymentsModule {}
