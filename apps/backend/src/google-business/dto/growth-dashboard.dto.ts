import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsEnum } from 'class-validator';
import { DemandPeriodType } from '@prisma/client';

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    enum: ['7d', '30d', '90d', 'custom'],
    description: 'Preset period',
  })
  @IsOptional()
  period?: '7d' | '30d' | '90d' | 'custom';
}

export class KpiCardDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  value: number;

  @ApiPropertyOptional()
  previousValue?: number;

  @ApiProperty({ description: 'Percentage change from previous period' })
  change: number | null;

  @ApiProperty({ enum: ['up', 'down', 'neutral'] })
  trend: 'up' | 'down' | 'neutral';

  @ApiPropertyOptional()
  unit?: string;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: KpiCardDto })
  totalActions: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  calls: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  routes: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  websiteClicks: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  whatsappClicks: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  profileViews: KpiCardDto;

  @ApiProperty({ type: KpiCardDto })
  impressions: KpiCardDto;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;
}

export class TimeSeriesPointDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  calls: number;

  @ApiProperty()
  routes: number;

  @ApiProperty()
  websiteClicks: number;

  @ApiProperty()
  whatsappClicks: number;

  @ApiProperty()
  profileViews: number;

  @ApiProperty()
  impressions: number;

  @ApiProperty()
  totalActions: number;
}

export class TimeSeriesDto {
  @ApiProperty({ type: [TimeSeriesPointDto] })
  data: TimeSeriesPointDto[];

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;
}

export class ChannelBreakdownDto {
  @ApiProperty()
  channel: string;

  @ApiProperty()
  icon: string;

  @ApiProperty()
  clicks: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty()
  color: string;
}

export class ConversionFunnelStageDto {
  @ApiProperty()
  stage: string;

  @ApiProperty()
  value: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty()
  dropoff: number;
}

export class ConversionFunnelDto {
  @ApiProperty({ type: [ConversionFunnelStageDto] })
  stages: ConversionFunnelStageDto[];

  @ApiProperty()
  overallConversionRate: number;
}

export class DashboardDataDto {
  @ApiProperty({ type: DashboardSummaryDto })
  summary: DashboardSummaryDto;

  @ApiProperty({ type: TimeSeriesDto })
  timeSeries: TimeSeriesDto;

  @ApiProperty({ type: [ChannelBreakdownDto] })
  channelBreakdown: ChannelBreakdownDto[];

  @ApiProperty({ type: ConversionFunnelDto })
  conversionFunnel: ConversionFunnelDto;

  @ApiProperty()
  lastSyncAt: Date | null;

  @ApiProperty()
  isGoogleConnected: boolean;
}
