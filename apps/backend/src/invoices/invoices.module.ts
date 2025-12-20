import { Module } from '@nestjs/common';
import { InvoicesSyncService } from './invoices-sync.service';
import { InvoicesSyncController } from './invoices-sync.controller';

@Module({
  controllers: [InvoicesSyncController],
  providers: [InvoicesSyncService],
  exports: [InvoicesSyncService],
})
export class InvoicesModule {}
