import { Module } from '@nestjs/common';
import { MercadoPagoIntegrationController } from './mercadopago-integration.controller';
import { MercadoPagoIntegrationService } from './mercadopago-integration.service';

@Module({
  controllers: [MercadoPagoIntegrationController],
  providers: [MercadoPagoIntegrationService],
  exports: [MercadoPagoIntegrationService],
})
export class MercadoPagoIntegrationModule {}
