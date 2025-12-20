import { Module } from '@nestjs/common';
import { ChecklistInstancesService } from './checklist-instances.service';
import { ChecklistInstancesController } from './checklist-instances.controller';
import { ChecklistAttachmentsService } from './checklist-attachments.service';
import { ChecklistTemplatesModule } from '../checklist-templates/checklist-templates.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [ChecklistTemplatesModule, FileStorageModule],
  controllers: [ChecklistInstancesController],
  providers: [ChecklistInstancesService, ChecklistAttachmentsService],
  exports: [ChecklistInstancesService, ChecklistAttachmentsService],
})
export class ChecklistInstancesModule {}
