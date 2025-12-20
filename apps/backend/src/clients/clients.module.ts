import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsSyncService } from './clients-sync.service';
import { ClientsController } from './clients.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsSyncService],
  exports: [ClientsService, ClientsSyncService],
})
export class ClientsModule {}
