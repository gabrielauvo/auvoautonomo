import { Module } from '@nestjs/common';
import { WorkOrderTypesController } from './work-order-types.controller';
import { WorkOrderTypesService } from './work-order-types.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [WorkOrderTypesController],
  providers: [WorkOrderTypesService],
  exports: [WorkOrderTypesService],
})
export class WorkOrderTypesModule {}
