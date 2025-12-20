import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { ChargesController } from './charges.controller';
import { SubscriptionService } from './subscription.service';
import { PlanLimitsService } from './plan-limits.service';
import { AsaasBillingService } from './asaas-billing.service';
import { BillingScheduler } from './billing.scheduler';
import { ClientPaymentsModule } from '../client-payments/client-payments.module';

/**
 * BillingModule handles all subscription and plan limit functionality
 *
 * This module is marked as Global so that PlanLimitsService can be
 * easily injected into other modules (Client, Quote, WorkOrder, Payment)
 * without needing to import BillingModule everywhere.
 */
@Global()
@Module({
  imports: [ConfigModule, forwardRef(() => ClientPaymentsModule)],
  controllers: [BillingController, BillingWebhookController, ChargesController],
  providers: [
    SubscriptionService,
    PlanLimitsService,
    AsaasBillingService,
    BillingScheduler,
  ],
  exports: [
    SubscriptionService,
    PlanLimitsService,
    AsaasBillingService,
  ],
})
export class BillingModule {}
