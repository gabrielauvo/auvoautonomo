import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [FileStorageModule, SettingsModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
