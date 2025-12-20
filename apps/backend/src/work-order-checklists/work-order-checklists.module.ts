import { Module } from '@nestjs/common';
import { WorkOrderChecklistsService } from './work-order-checklists.service';
import { WorkOrderChecklistsController } from './work-order-checklists.controller';

@Module({
  controllers: [WorkOrderChecklistsController],
  providers: [WorkOrderChecklistsService],
  exports: [WorkOrderChecklistsService],
})
export class WorkOrderChecklistsModule {}
