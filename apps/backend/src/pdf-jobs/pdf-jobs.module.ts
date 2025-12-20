import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { PdfJobsLocalService } from './pdf-jobs-local.service';
import { PdfJobsLocalController } from './pdf-jobs-local.controller';

/**
 * PDF Jobs Module - Local Mode
 *
 * This module provides synchronous PDF generation without Redis.
 * Perfect for development and testing.
 *
 * For production with async processing, configure:
 * - REDIS_HOST environment variable
 * - Use PdfJobsService with BullMQ
 */
@Module({
  imports: [PrismaModule, PdfModule, FileStorageModule],
  controllers: [PdfJobsLocalController],
  providers: [PdfJobsLocalService],
  exports: [PdfJobsLocalService],
})
export class PdfJobsModule implements OnModuleInit {
  private readonly logger = new Logger('PdfJobsModule');

  onModuleInit() {
    this.logger.log(
      'PDF Jobs module running in LOCAL MODE (synchronous processing). ' +
      'PDFs will be generated immediately on request.',
    );
  }
}
