import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';
import {
  DemandEventSource,
  DemandActionType,
  DemandPeriodType,
  GoogleIntegrationStatus,
  Prisma,
} from '@prisma/client';

// Google Business Performance API
const GOOGLE_PERFORMANCE_API = 'https://businessprofileperformance.googleapis.com/v1';

interface GoogleMetricValue {
  value: string;
}

interface GoogleDailyMetric {
  date: {
    year: number;
    month: number;
    day: number;
  };
  metrics?: {
    BUSINESS_IMPRESSIONS_DESKTOP_MAPS?: GoogleMetricValue;
    BUSINESS_IMPRESSIONS_MOBILE_MAPS?: GoogleMetricValue;
    BUSINESS_IMPRESSIONS_DESKTOP_SEARCH?: GoogleMetricValue;
    BUSINESS_IMPRESSIONS_MOBILE_SEARCH?: GoogleMetricValue;
    CALL_CLICKS?: GoogleMetricValue;
    WEBSITE_CLICKS?: GoogleMetricValue;
    BUSINESS_DIRECTION_REQUESTS?: GoogleMetricValue;
    BUSINESS_CONVERSATIONS?: GoogleMetricValue;
    BUSINESS_BOOKINGS?: GoogleMetricValue;
  };
}

interface GooglePerformanceResponse {
  locationDailyMetrics?: GoogleDailyMetric[];
}

@Injectable()
export class GoogleMetricsService {
  private readonly logger = new Logger(GoogleMetricsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: GoogleOAuthService,
  ) {}

  /**
   * Cron job to sync Google Business metrics daily at 6 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async syncAllUsersMetrics(): Promise<void> {
    this.logger.log('Starting Google Business metrics sync for all users');

    const integrations = await this.prisma.googleIntegration.findMany({
      where: {
        status: GoogleIntegrationStatus.CONNECTED,
        googleLocationId: { not: null },
      },
      select: {
        userId: true,
        googleLocationId: true,
      },
    });

    this.logger.log(`Found ${integrations.length} connected integrations`);

    for (const integration of integrations) {
      try {
        await this.syncUserMetrics(integration.userId);
        this.logger.log(`Synced metrics for user ${integration.userId}`);
      } catch (error) {
        this.logger.error(
          `Failed to sync metrics for user ${integration.userId}: ${error.message}`,
        );
        // Continue with other users
      }
    }

    this.logger.log('Finished Google Business metrics sync');
  }

  /**
   * Sync metrics for a specific user
   */
  async syncUserMetrics(userId: string): Promise<void> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
    });

    if (!integration?.googleLocationId) {
      throw new Error('No location selected for integration');
    }

    try {
      const accessToken = await this.oauthService.getValidAccessToken(userId);

      // Fetch last 30 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const metrics = await this.fetchPerformanceMetrics(
        accessToken,
        integration.googleLocationId,
        startDate,
        endDate,
      );

      // Upsert metrics as demand events
      await this.upsertDemandEvents(userId, metrics);

      // Update sync status
      await this.oauthService.updateSyncStatus(userId, true);
    } catch (error) {
      await this.oauthService.updateSyncStatus(userId, false, error.message);
      throw error;
    }
  }

  /**
   * Fetch performance metrics from Google API
   */
  private async fetchPerformanceMetrics(
    accessToken: string,
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<GoogleDailyMetric[]> {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const params = new URLSearchParams({
      'dailyRange.startDate.year': startDate.getFullYear().toString(),
      'dailyRange.startDate.month': (startDate.getMonth() + 1).toString(),
      'dailyRange.startDate.day': startDate.getDate().toString(),
      'dailyRange.endDate.year': endDate.getFullYear().toString(),
      'dailyRange.endDate.month': (endDate.getMonth() + 1).toString(),
      'dailyRange.endDate.day': endDate.getDate().toString(),
    });

    const url = `${GOOGLE_PERFORMANCE_API}/${locationId}:getDailyMetricsTimeSeries?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to fetch performance metrics: ${error}`);
      throw new Error('Failed to fetch Google Business metrics');
    }

    const data: GooglePerformanceResponse = await response.json();
    return data.locationDailyMetrics || [];
  }

  /**
   * Upsert demand events from Google metrics
   * Uses idempotent upsert to prevent duplicates
   */
  private async upsertDemandEvents(
    userId: string,
    dailyMetrics: GoogleDailyMetric[],
  ): Promise<void> {
    interface EventData {
      userId: string;
      source: DemandEventSource;
      actionType: DemandActionType;
      occurredAt: Date;
      periodType: DemandPeriodType;
      periodStart: Date;
      periodEnd: Date;
      value: number;
      dimensions: Prisma.InputJsonValue;
    }
    const events: EventData[] = [];

    for (const dayMetric of dailyMetrics) {
      const date = new Date(
        dayMetric.date.year,
        dayMetric.date.month - 1,
        dayMetric.date.day,
      );
      const periodStart = new Date(date);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(date);
      periodEnd.setHours(23, 59, 59, 999);

      const metrics = dayMetric.metrics || {};

      // Map Google metrics to our action types
      const mappings: Array<{
        actionType: DemandActionType;
        value: number;
        dimensions?: Record<string, unknown>;
      }> = [
        {
          actionType: DemandActionType.CALL,
          value: parseInt(metrics.CALL_CLICKS?.value || '0', 10),
        },
        {
          actionType: DemandActionType.ROUTE,
          value: parseInt(metrics.BUSINESS_DIRECTION_REQUESTS?.value || '0', 10),
        },
        {
          actionType: DemandActionType.WEBSITE_CLICK,
          value: parseInt(metrics.WEBSITE_CLICKS?.value || '0', 10),
        },
        {
          actionType: DemandActionType.PROFILE_VIEW,
          value:
            parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS?.value || '0', 10) +
            parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS?.value || '0', 10),
          dimensions: {
            desktop: parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS?.value || '0', 10),
            mobile: parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS?.value || '0', 10),
          },
        },
        {
          actionType: DemandActionType.SEARCH_IMPRESSION,
          value:
            parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH?.value || '0', 10) +
            parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH?.value || '0', 10),
          dimensions: {
            desktop: parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH?.value || '0', 10),
            mobile: parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_SEARCH?.value || '0', 10),
          },
        },
        {
          actionType: DemandActionType.MAPS_IMPRESSION,
          value:
            parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS?.value || '0', 10) +
            parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS?.value || '0', 10),
          dimensions: {
            desktop: parseInt(metrics.BUSINESS_IMPRESSIONS_DESKTOP_MAPS?.value || '0', 10),
            mobile: parseInt(metrics.BUSINESS_IMPRESSIONS_MOBILE_MAPS?.value || '0', 10),
          },
        },
      ];

      for (const mapping of mappings) {
        if (mapping.value > 0) {
          events.push({
            userId,
            source: DemandEventSource.GOOGLE_BUSINESS,
            actionType: mapping.actionType,
            occurredAt: date,
            periodType: DemandPeriodType.DAY,
            periodStart,
            periodEnd,
            value: mapping.value,
            dimensions: (mapping.dimensions || {}) as Prisma.InputJsonValue,
          });
        }
      }
    }

    // Batch upsert using Prisma's upsert
    for (const event of events) {
      await this.prisma.demandEvent.upsert({
        where: {
          userId_source_actionType_periodType_periodStart_periodEnd: {
            userId: event.userId,
            source: event.source,
            actionType: event.actionType,
            periodType: event.periodType,
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
          },
        },
        create: event,
        update: {
          value: event.value,
          dimensions: event.dimensions,
        },
      });
    }

    this.logger.log(`Upserted ${events.length} demand events for user ${userId}`);
  }

  /**
   * Manual sync trigger
   */
  async triggerSync(userId: string): Promise<void> {
    await this.syncUserMetrics(userId);
  }

  /**
   * Get metrics for a user within a date range
   */
  async getMetrics(
    userId: string,
    startDate: Date,
    endDate: Date,
    actionTypes?: DemandActionType[],
    sources?: DemandEventSource[],
  ): Promise<Array<{
    date: Date;
    actionType: DemandActionType;
    source: DemandEventSource;
    value: number;
  }>> {
    const events = await this.prisma.demandEvent.findMany({
      where: {
        userId,
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(actionTypes?.length && { actionType: { in: actionTypes } }),
        ...(sources?.length && { source: { in: sources } }),
      },
      orderBy: {
        occurredAt: 'asc',
      },
    });

    return events.map((e) => ({
      date: e.occurredAt,
      actionType: e.actionType,
      source: e.source,
      value: e.value,
    }));
  }

  /**
   * Get aggregated metrics summary
   */
  async getMetricsSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<DemandActionType, number>> {
    const result = await this.prisma.demandEvent.groupBy({
      by: ['actionType'],
      where: {
        userId,
        occurredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        value: true,
      },
    });

    const summary: Record<string, number> = {};
    for (const row of result) {
      summary[row.actionType] = row._sum.value || 0;
    }

    return summary as Record<DemandActionType, number>;
  }
}
