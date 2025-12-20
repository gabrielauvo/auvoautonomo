import { Module } from '@nestjs/common';
import { FinancialAutomationsService } from './financial-automations.service';
import { FinancialAutomationsController } from './financial-automations.controller';
import { FinancialAutomationsScheduler } from './financial-automations.scheduler';
import { AsaasIntegrationModule } from '../asaas-integration/asaas-integration.module';

@Module({
  imports: [AsaasIntegrationModule],
  controllers: [FinancialAutomationsController],
  providers: [FinancialAutomationsService, FinancialAutomationsScheduler],
  exports: [FinancialAutomationsService, FinancialAutomationsScheduler],
})
export class FinancialAutomationsModule {}
