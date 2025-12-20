import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsSyncService } from './products-sync.service';
import { ProductsSyncController } from './products-sync.controller';

@Module({
  controllers: [ProductsController, ProductsSyncController],
  providers: [ProductsService, ProductsSyncService],
  exports: [ProductsService, ProductsSyncService],
})
export class ProductsModule {}
