import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfProcessor, PDF_QUEUE_NAME } from './pdf.processor';
import { PdfGenerator } from '../generators/pdf.generator';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PDF_QUEUE_NAME,
    }),
    StorageModule,
  ],
  providers: [PdfProcessor, PdfGenerator],
})
export class ProcessorsModule {}
