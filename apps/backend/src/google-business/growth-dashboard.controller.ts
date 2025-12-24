import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
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
import { GetUserId } from '../auth/decorators/get-user-id.decorator';
import { GrowthDashboardService } from './growth-dashboard.service';
import { GoogleMetricsService } from './google-metrics.service';
import { GrowthInsightsService } from './growth-insights.service';
import {
  DashboardQueryDto,
  DashboardDataDto,
  DashboardSummaryDto,
  TimeSeriesDto,
  ConversionFunnelDto,
} from './dto/growth-dashboard.dto';
import { GrowthInsightDto } from './dto/growth-insight.dto';

@ApiTags('growth-dashboard')
@Controller('growth-dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GrowthDashboardController {
  constructor(
    private readonly dashboardService: GrowthDashboardService,
    private readonly metricsService: GoogleMetricsService,
    private readonly insightsService: GrowthInsightsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get complete dashboard data' })
  @ApiResponse({ status: 200, type: DashboardDataDto })
  getDashboard(
    @GetUserId() userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardDataDto> {
    return this.dashboardService.getDashboardData(userId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary only (for mobile)' })
  @ApiResponse({ status: 200, type: DashboardSummaryDto })
  getSummary(
    @GetUserId() userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummaryOnly(userId, query);
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Get time series data only' })
  @ApiResponse({ status: 200, type: TimeSeriesDto })
  async getTimeSeries(
    @GetUserId() userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<TimeSeriesDto> {
    const { summary, timeSeries } = await this.dashboardService.getDashboardData(userId, query);
    return timeSeries;
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get conversion funnel data' })
  @ApiResponse({ status: 200, type: ConversionFunnelDto })
  async getFunnel(
    @GetUserId() userId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<ConversionFunnelDto> {
    const { conversionFunnel } = await this.dashboardService.getDashboardData(userId, query);
    return conversionFunnel;
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get growth insights' })
  @ApiResponse({ status: 200, type: [GrowthInsightDto] })
  getInsights(@GetUserId() userId: string): Promise<GrowthInsightDto[]> {
    return this.insightsService.getActiveInsights(userId);
  }

  @Post('sync')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Trigger manual sync of Google Business metrics' })
  @ApiResponse({ status: 204, description: 'Sync started' })
  async triggerSync(@GetUserId() userId: string): Promise<void> {
    await this.metricsService.triggerSync(userId);
  }

  @Post('insights/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark insight as read' })
  @ApiResponse({ status: 204 })
  async markInsightRead(
    @GetUserId() userId: string,
    @Query('id') id: string,
  ): Promise<void> {
    await this.insightsService.markAsRead(userId, id);
  }

  @Post('insights/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Dismiss an insight' })
  @ApiResponse({ status: 204 })
  async dismissInsight(
    @GetUserId() userId: string,
    @Query('id') id: string,
  ): Promise<void> {
    await this.insightsService.dismiss(userId, id);
  }
}
