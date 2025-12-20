import { Module } from '@nestjs/common';
import { CnpjLookupService } from './cnpj-lookup.service';
import { CnpjLookupController } from './cnpj-lookup.controller';

@Module({
  controllers: [CnpjLookupController],
  providers: [CnpjLookupService],
  exports: [CnpjLookupService],
})
export class CnpjLookupModule {}
