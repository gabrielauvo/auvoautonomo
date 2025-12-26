import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PlansModule } from '../plans/plans.module';
import { RegionalModule } from '../regional/regional.module';

@Module({
  imports: [PlansModule, RegionalModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
