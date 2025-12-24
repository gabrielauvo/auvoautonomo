import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlansModule } from './plans/plans.module';
import { ClientsModule } from './clients/clients.module';
import { ItemsModule } from './items/items.module';
import { ProductsModule } from './products/products.module';
import { EquipmentsModule } from './equipments/equipments.module';
import { QuotesModule } from './quotes/quotes.module';
import { WorkOrdersModule } from './work-orders/work-orders.module';
import { ChecklistTemplatesModule } from './checklist-templates/checklist-templates.module';
import { ChecklistInstancesModule } from './checklist-instances/checklist-instances.module';
import { WorkOrderChecklistsModule } from './work-order-checklists/work-order-checklists.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { AsaasIntegrationModule } from './asaas-integration/asaas-integration.module';
import { ClientPaymentsModule } from './client-payments/client-payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { FinancialDashboardModule } from './financial-dashboard/financial-dashboard.module';
import { ServiceFlowModule } from './service-flow/service-flow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FinancialAutomationsModule } from './financial-automations/financial-automations.module';
import { FileStorageModule } from './file-storage/file-storage.module';
import { PdfModule } from './pdf/pdf.module';
import { SignaturesModule } from './signatures/signatures.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { ScheduleModule } from './schedule/schedule.module';
import { PdfJobsModule } from './pdf-jobs/pdf-jobs.module';
import { ClientImportModule } from './client-import/client-import.module';
import { SettingsModule } from './settings/settings.module';
import { ReportsModule } from './reports/reports.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DevicesModule } from './devices/devices.module';
import { DomainEventsModule } from './domain-events/domain-events.module';
import { CnpjLookupModule } from './cnpj-lookup/cnpj-lookup.module';
import { HealthModule } from './health/health.module';
import { SecureLoggerModule } from './common/logging';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { WorkOrderTypesModule } from './work-order-types/work-order-types.module';
import { InventoryModule } from './inventory/inventory.module';
import { EmailModule } from './email/email.module';
import { ReferralModule } from './referral/referral.module';
import { GoogleBusinessModule } from './google-business/google-business.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global - Proteção contra ataques DDoS e brute force
    // Os limites são aplicados por IP e podem ser customizados por rota usando @Throttle()
    // NOTA: Limites aumentados para suportar sync após trabalho offline prolongado
    // O app mobile pode fazer muitas requisições de uma vez ao reconectar
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 50, // 50 requests por segundo (aumentado para sync burst)
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minuto
        limit: 500, // 500 requests por minuto (aumentado para sync offline)
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hora
        limit: 5000, // 5000 requests por hora (aumentado para trabalho intensivo)
      },
    ]),
    PrismaModule,
    EncryptionModule,
    EmailModule, // Global module for email sending
    BillingModule, // Global module - must be before modules that use PlanLimitsService
    AuthModule,
    PlansModule,
    ClientsModule,
    ItemsModule,
    ProductsModule,
    EquipmentsModule,
    QuotesModule,
    WorkOrdersModule,
    ChecklistTemplatesModule,
    ChecklistInstancesModule,
    WorkOrderChecklistsModule,
    AsaasIntegrationModule,
    ClientPaymentsModule,
    WebhooksModule,
    FinancialDashboardModule,
    ServiceFlowModule,
    NotificationsModule,
    FinancialAutomationsModule,
    FileStorageModule,
    PdfModule,
    SignaturesModule,
    AnalyticsModule,
    ScheduleModule,
    PdfJobsModule,
    ClientImportModule,
    SettingsModule,
    ReportsModule,
    InvoicesModule,
    DevicesModule,
    DomainEventsModule,
    CnpjLookupModule,
    HealthModule,
    SecureLoggerModule,
    SuppliersModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    WorkOrderTypesModule,
    InventoryModule,
    GoogleBusinessModule,
    ReferralModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Sentry global exception filter - captures all unhandled exceptions
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    // Aplicar ThrottlerGuard globalmente a todas as rotas
    // Controllers específicos podem sobrescrever com @Throttle() ou @SkipThrottle()
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
