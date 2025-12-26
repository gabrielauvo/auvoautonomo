import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RegionalController } from './regional.controller';
import { RegionalService } from './regional.service';
import { RegionalDataService } from './regional-data.service';

@Module({
  imports: [PrismaModule],
  controllers: [RegionalController],
  providers: [RegionalService, RegionalDataService],
  exports: [RegionalService, RegionalDataService],
})
export class RegionalModule {}
