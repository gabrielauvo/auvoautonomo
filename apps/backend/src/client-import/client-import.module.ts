import { Module } from '@nestjs/common';
import { ClientImportController } from './client-import.controller';
import { ClientImportService } from './client-import.service';
import { ExcelParserService } from './excel-parser.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [ClientImportController],
  providers: [ClientImportService, ExcelParserService],
  exports: [ClientImportService],
})
export class ClientImportModule {}
