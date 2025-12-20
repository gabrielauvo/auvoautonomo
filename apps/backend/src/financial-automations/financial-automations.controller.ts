import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FinancialAutomationsService } from './financial-automations.service';
import { UpdateAutomationSettingsDto } from './dto/update-automation-settings.dto';

@Controller('financial/automations')
@UseGuards(JwtAuthGuard)
export class FinancialAutomationsController {
  constructor(
    private readonly financialAutomationsService: FinancialAutomationsService,
  ) {}

  /**
   * Get automation settings for current user
   * GET /financial/automations/settings
   */
  @Get('settings')
  async getSettings(@CurrentUser('id') userId: string) {
    return this.financialAutomationsService.getOrCreateSettings(userId);
  }

  /**
   * Update automation settings for current user
   * PUT /financial/automations/settings
   */
  @Put('settings')
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAutomationSettingsDto,
  ) {
    return this.financialAutomationsService.updateSettings(userId, dto);
  }

  /**
   * Manually trigger daily automations (for testing/debugging)
   * POST /financial/automations/run
   *
   * In production, this should be called via CRON job, not exposed as API.
   * Consider adding admin-only guard in production.
   */
  @Post('run')
  async runAutomations() {
    return this.financialAutomationsService.runDailyAutomations();
  }
}
