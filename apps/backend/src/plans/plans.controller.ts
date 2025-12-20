import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PlansService } from './plans.service';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private plansService: PlansService) {}

  @Get()
  async getAllPlans() {
    return this.plansService.getAllPlans();
  }

  @Get('my-plan')
  async getMyPlan(@CurrentUser() user: any) {
    return this.plansService.getUserPlan(user.id);
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: any) {
    return this.plansService.getCurrentUsage(user.id);
  }
}
