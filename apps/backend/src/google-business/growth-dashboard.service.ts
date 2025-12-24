import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardQueryDto,
  DashboardDataDto,
  DashboardSummaryDto,
  TimeSeriesDto,
  TimeSeriesPointDto,
  ChannelBreakdownDto,
  ConversionFunnelDto,
  KpiCardDto,
} from './dto/growth-dashboard.dto';
import { DemandActionType, DemandEventSource, GoogleIntegrationStatus, QuoteStatus } from '@prisma/client';

@Injectable()
export class GrowthDashboardService {
  private readonly logger = new Logger(GrowthDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get complete dashboard data
   */
  async getDashboardData(userId: string, query: DashboardQueryDto): Promise<DashboardDataDto> {
    const { startDate, endDate } = this.getPeriodDates(query);
    const previousStart = new Date(startDate);
    const previousEnd = new Date(endDate);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    previousStart.setDate(previousStart.getDate() - periodDays);
    previousEnd.setDate(previousEnd.getDate() - periodDays);

    // Get Google integration status
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      select: { status: true, lastSyncAt: true },
    });

    const [summary, timeSeries, channelBreakdown, conversionFunnel] = await Promise.all([
      this.getSummary(userId, startDate, endDate, previousStart, previousEnd),
      this.getTimeSeries(userId, startDate, endDate),
      this.getChannelBreakdown(userId, startDate, endDate),
      this.getConversionFunnel(userId, startDate, endDate),
    ]);

    return {
      summary,
      timeSeries,
      channelBreakdown,
      conversionFunnel,
      lastSyncAt: integration?.lastSyncAt || null,
      isGoogleConnected: integration?.status === GoogleIntegrationStatus.CONNECTED,
    };
  }

  /**
   * Calculate period dates from query
   */
  private getPeriodDates(query: DashboardQueryDto): { startDate: Date; endDate: Date } {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    let startDate: Date;

    switch (query.period) {
      case '7d':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'custom':
        startDate = query.startDate ? new Date(query.startDate) : new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
    }

    startDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
  }

  /**
   * Build KPI card with comparison
   */
  private buildKpiCard(
    label: string,
    current: number,
    previous: number,
    unit?: string,
  ): KpiCardDto {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (change !== null) {
      trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    }

    return {
      label,
      value: current,
      previousValue: previous,
      change: change !== null ? Math.round(change * 10) / 10 : null,
      trend,
      unit,
    };
  }

  /**
   * Get summary metrics with comparison
   */
  async getSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
    previousStart: Date,
    previousEnd: Date,
  ): Promise<DashboardSummaryDto> {
    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getAggregatedMetrics(userId, startDate, endDate),
      this.getAggregatedMetrics(userId, previousStart, previousEnd),
    ]);

    const totalActionsCurrent =
      currentMetrics.calls +
      currentMetrics.routes +
      currentMetrics.websiteClicks +
      currentMetrics.whatsappClicks;
    const totalActionsPrevious =
      previousMetrics.calls +
      previousMetrics.routes +
      previousMetrics.websiteClicks +
      previousMetrics.whatsappClicks;

    return {
      totalActions: this.buildKpiCard('Total de Ações', totalActionsCurrent, totalActionsPrevious),
      calls: this.buildKpiCard('Ligações', currentMetrics.calls, previousMetrics.calls),
      routes: this.buildKpiCard('Rotas', currentMetrics.routes, previousMetrics.routes),
      websiteClicks: this.buildKpiCard('Cliques Site', currentMetrics.websiteClicks, previousMetrics.websiteClicks),
      whatsappClicks: this.buildKpiCard('Cliques WhatsApp', currentMetrics.whatsappClicks, previousMetrics.whatsappClicks),
      profileViews: this.buildKpiCard('Visualizações', currentMetrics.profileViews, previousMetrics.profileViews),
      impressions: this.buildKpiCard('Impressões', currentMetrics.impressions, previousMetrics.impressions),
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /**
   * Get aggregated metrics for a period
   */
  private async getAggregatedMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    calls: number;
    routes: number;
    websiteClicks: number;
    whatsappClicks: number;
    profileViews: number;
    impressions: number;
  }> {
    const result = await this.prisma.demandEvent.groupBy({
      by: ['actionType'],
      where: {
        userId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      _sum: { value: true },
    });

    const metrics: Record<string, number> = {};
    for (const row of result) {
      metrics[row.actionType] = row._sum.value || 0;
    }

    return {
      calls: metrics[DemandActionType.CALL] || 0,
      routes: metrics[DemandActionType.ROUTE] || 0,
      websiteClicks: (metrics[DemandActionType.WEBSITE_CLICK] || 0) + (metrics[DemandActionType.SITE_CLICK] || 0),
      whatsappClicks: metrics[DemandActionType.WHATSAPP_CLICK] || 0,
      profileViews: metrics[DemandActionType.PROFILE_VIEW] || 0,
      impressions: (metrics[DemandActionType.SEARCH_IMPRESSION] || 0) + (metrics[DemandActionType.MAPS_IMPRESSION] || 0),
    };
  }

  /**
   * Get time series data
   */
  async getTimeSeries(userId: string, startDate: Date, endDate: Date): Promise<TimeSeriesDto> {
    const events = await this.prisma.demandEvent.findMany({
      where: {
        userId,
        occurredAt: { gte: startDate, lte: endDate },
      },
      select: {
        occurredAt: true,
        actionType: true,
        value: true,
      },
      orderBy: { occurredAt: 'asc' },
    });

    // Group by date
    const dailyData: Record<string, {
      calls: number;
      routes: number;
      websiteClicks: number;
      whatsappClicks: number;
      profileViews: number;
      impressions: number;
    }> = {};

    for (const event of events) {
      const dateStr = event.occurredAt.toISOString().split('T')[0];
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = {
          calls: 0,
          routes: 0,
          websiteClicks: 0,
          whatsappClicks: 0,
          profileViews: 0,
          impressions: 0,
        };
      }

      const day = dailyData[dateStr];
      switch (event.actionType) {
        case DemandActionType.CALL:
          day.calls += event.value;
          break;
        case DemandActionType.ROUTE:
          day.routes += event.value;
          break;
        case DemandActionType.WEBSITE_CLICK:
        case DemandActionType.SITE_CLICK:
          day.websiteClicks += event.value;
          break;
        case DemandActionType.WHATSAPP_CLICK:
          day.whatsappClicks += event.value;
          break;
        case DemandActionType.PROFILE_VIEW:
          day.profileViews += event.value;
          break;
        case DemandActionType.SEARCH_IMPRESSION:
        case DemandActionType.MAPS_IMPRESSION:
          day.impressions += event.value;
          break;
      }
    }

    // Fill in missing dates
    const data: TimeSeriesPointDto[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayData = dailyData[dateStr] || {
        calls: 0,
        routes: 0,
        websiteClicks: 0,
        whatsappClicks: 0,
        profileViews: 0,
        impressions: 0,
      };

      data.push({
        date: dateStr,
        ...dayData,
        totalActions:
          dayData.calls +
          dayData.routes +
          dayData.websiteClicks +
          dayData.whatsappClicks,
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      data,
      periodStart: startDate,
      periodEnd: endDate,
    };
  }

  /**
   * Get channel breakdown
   */
  async getChannelBreakdown(userId: string, startDate: Date, endDate: Date): Promise<ChannelBreakdownDto[]> {
    const metrics = await this.getAggregatedMetrics(userId, startDate, endDate);

    const total =
      metrics.calls +
      metrics.routes +
      metrics.websiteClicks +
      metrics.whatsappClicks;

    if (total === 0) {
      return [];
    }

    const channels: ChannelBreakdownDto[] = [
      {
        channel: 'Ligações',
        icon: 'phone',
        clicks: metrics.calls,
        percentage: Math.round((metrics.calls / total) * 100),
        color: '#10B981', // green
      },
      {
        channel: 'WhatsApp',
        icon: 'message-circle',
        clicks: metrics.whatsappClicks,
        percentage: Math.round((metrics.whatsappClicks / total) * 100),
        color: '#25D366', // whatsapp green
      },
      {
        channel: 'Rotas',
        icon: 'map-pin',
        clicks: metrics.routes,
        percentage: Math.round((metrics.routes / total) * 100),
        color: '#3B82F6', // blue
      },
      {
        channel: 'Site',
        icon: 'globe',
        clicks: metrics.websiteClicks,
        percentage: Math.round((metrics.websiteClicks / total) * 100),
        color: '#8B5CF6', // purple
      },
    ];

    return channels.filter((c) => c.clicks > 0).sort((a, b) => b.clicks - a.clicks);
  }

  /**
   * Get conversion funnel
   */
  async getConversionFunnel(userId: string, startDate: Date, endDate: Date): Promise<ConversionFunnelDto> {
    const metrics = await this.getAggregatedMetrics(userId, startDate, endDate);

    // Get quotes data
    const quotes = await this.prisma.quote.findMany({
      where: {
        userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { status: true },
    });

    const totalQuotes = quotes.length;
    const approvedQuotes = quotes.filter((q) => q.status === QuoteStatus.APPROVED).length;

    const impressions = metrics.impressions;
    const views = metrics.profileViews;
    const actions = metrics.calls + metrics.routes + metrics.websiteClicks + metrics.whatsappClicks;

    const stages = [
      {
        stage: 'Impressões',
        value: impressions,
        percentage: 100,
        dropoff: 0,
      },
      {
        stage: 'Visualizações',
        value: views,
        percentage: impressions > 0 ? Math.round((views / impressions) * 100) : 0,
        dropoff: impressions > 0 ? Math.round(((impressions - views) / impressions) * 100) : 0,
      },
      {
        stage: 'Ações',
        value: actions,
        percentage: views > 0 ? Math.round((actions / views) * 100) : 0,
        dropoff: views > 0 ? Math.round(((views - actions) / views) * 100) : 0,
      },
      {
        stage: 'Orçamentos',
        value: totalQuotes,
        percentage: actions > 0 ? Math.round((totalQuotes / actions) * 100) : 0,
        dropoff: actions > 0 ? Math.round(((actions - totalQuotes) / actions) * 100) : 0,
      },
      {
        stage: 'Aprovados',
        value: approvedQuotes,
        percentage: totalQuotes > 0 ? Math.round((approvedQuotes / totalQuotes) * 100) : 0,
        dropoff: totalQuotes > 0 ? Math.round(((totalQuotes - approvedQuotes) / totalQuotes) * 100) : 0,
      },
    ];

    const overallConversionRate =
      impressions > 0 ? Math.round((approvedQuotes / impressions) * 10000) / 100 : 0;

    return {
      stages,
      overallConversionRate,
    };
  }

  /**
   * Get summary only (for mobile/quick view)
   */
  async getSummaryOnly(userId: string, query: DashboardQueryDto): Promise<DashboardSummaryDto> {
    const { startDate, endDate } = this.getPeriodDates(query);
    const previousStart = new Date(startDate);
    const previousEnd = new Date(endDate);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    previousStart.setDate(previousStart.getDate() - periodDays);
    previousEnd.setDate(previousEnd.getDate() - periodDays);

    return this.getSummary(userId, startDate, endDate, previousStart, previousEnd);
  }
}
