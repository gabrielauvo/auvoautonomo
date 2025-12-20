import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  UpdateNotificationPreferencesDto,
  NotificationLogsQueryDto,
} from './dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationPreferencesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Returns user notification preferences',
  })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.notificationsService.getOrCreatePreferences(userId);
  }

  @Put('preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
  })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get notification logs' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated notification logs',
  })
  async getLogs(
    @CurrentUser('id') userId: string,
    @Query() query: NotificationLogsQueryDto,
  ) {
    return this.notificationsService.getNotificationLogs(userId, {
      clientId: query.clientId,
      type: query.type,
      channel: query.channel,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns notification statistics',
  })
  async getStats(@CurrentUser('id') userId: string) {
    return this.notificationsService.getNotificationStats(userId);
  }
}
