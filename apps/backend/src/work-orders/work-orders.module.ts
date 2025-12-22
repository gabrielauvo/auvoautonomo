import { Module, forwardRef } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersSyncService } from './work-orders-sync.service';
import { WorkOrdersPublicService } from './work-orders-public.service';
import { WorkOrderExecutionSessionsService } from './work-order-execution-sessions.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersPublicController } from './work-orders-public.controller';
import { DomainEventsModule } from '../domain-events/domain-events.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [DomainEventsModule, forwardRef(() => InventoryModule)],
  controllers: [WorkOrdersController, WorkOrdersPublicController],
  providers: [
    WorkOrdersService,
    WorkOrdersSyncService,
    WorkOrdersPublicService,
    WorkOrderExecutionSessionsService,
  ],
  exports: [
    WorkOrdersService,
    WorkOrdersSyncService,
    WorkOrdersPublicService,
    WorkOrderExecutionSessionsService,
  ],
})
export class WorkOrdersModule {}
