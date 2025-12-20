import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesPublicService } from './quotes-public.service';
import { QuotesController } from './quotes.controller';
import { QuotesPublicController } from './quotes-public.controller';
import { QuotesSyncService } from './quotes-sync.service';
import { QuotesSyncController } from './quotes-sync.controller';
import { DomainEventsModule } from '../domain-events/domain-events.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [DomainEventsModule, FileStorageModule],
  controllers: [QuotesController, QuotesPublicController, QuotesSyncController],
  providers: [QuotesService, QuotesPublicService, QuotesSyncService],
  exports: [QuotesService, QuotesPublicService, QuotesSyncService],
})
export class QuotesModule {}
