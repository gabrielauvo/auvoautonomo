import { Module } from '@nestjs/common';
import { AsaasIntegrationController } from './asaas-integration.controller';
import { AsaasIntegrationService } from './asaas-integration.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';

@Module({
  controllers: [AsaasIntegrationController],
  providers: [AsaasIntegrationService, AsaasHttpClient],
  exports: [AsaasIntegrationService, AsaasHttpClient],
})
export class AsaasIntegrationModule {}
