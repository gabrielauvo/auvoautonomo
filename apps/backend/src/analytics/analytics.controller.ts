import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsPeriodDto,
  RevenueByPeriodDto,
  TopEntitiesDto,
} from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/overview
   * Dashboard overview with key metrics
   */
  @Get('overview')
  getOverview(
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsPeriodDto,
  ) {
    return this.analyticsService.getOverview(
      userId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/quotes-funnel
   * Quotes conversion funnel
   */
  @Get('quotes-funnel')
  getQuotesFunnel(
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsPeriodDto,
  ) {
    return this.analyticsService.getQuotesFunnel(
      userId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/work-orders
   * Work orders productivity analytics
   */
  @Get('work-orders')
  getWorkOrdersAnalytics(
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsPeriodDto,
  ) {
    return this.analyticsService.getWorkOrdersAnalytics(
      userId,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/revenue-by-period
   * Revenue breakdown by day/week/month
   */
  @Get('revenue-by-period')
  getRevenueByPeriod(
    @CurrentUser('id') userId: string,
    @Query() query: RevenueByPeriodDto,
  ) {
    return this.analyticsService.getRevenueByPeriod(
      userId,
      query.groupBy,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/top-clients
   * Top clients by revenue
   */
  @Get('top-clients')
  getTopClients(
    @CurrentUser('id') userId: string,
    @Query() query: TopEntitiesDto,
  ) {
    return this.analyticsService.getTopClients(
      userId,
      query.limit,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/top-services
   * Top services by revenue
   */
  @Get('top-services')
  getTopServices(
    @CurrentUser('id') userId: string,
    @Query() query: TopEntitiesDto,
  ) {
    return this.analyticsService.getTopServices(
      userId,
      query.limit,
      query.startDate,
      query.endDate,
    );
  }

  /**
   * GET /analytics/delinquency
   * Delinquency analysis
   */
  @Get('delinquency')
  getDelinquency(
    @CurrentUser('id') userId: string,
    @Query() query: AnalyticsPeriodDto,
  ) {
    return this.analyticsService.getDelinquency(
      userId,
      query.startDate,
      query.endDate,
    );
  }
}
