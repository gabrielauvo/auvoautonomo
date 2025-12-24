import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsDateString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DemandEventSource, DemandActionType, DemandPeriodType } from '@prisma/client';

export class DemandEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DemandEventSource })
  source: DemandEventSource;

  @ApiProperty({ enum: DemandActionType })
  actionType: DemandActionType;

  @ApiProperty()
  occurredAt: Date;

  @ApiProperty({ enum: DemandPeriodType })
  periodType: DemandPeriodType;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty()
  value: number;

  @ApiPropertyOptional()
  dimensions?: Record<string, unknown>;
}

export class DemandEventQueryDto {
  @ApiPropertyOptional({ enum: DemandEventSource })
  @IsEnum(DemandEventSource)
  @IsOptional()
  source?: DemandEventSource;

  @ApiPropertyOptional({ enum: DemandActionType })
  @IsEnum(DemandActionType)
  @IsOptional()
  actionType?: DemandActionType;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ enum: DemandPeriodType })
  @IsEnum(DemandPeriodType)
  @IsOptional()
  periodType?: DemandPeriodType;
}

export class MetricsSummaryDto {
  @ApiProperty({ description: 'Total calls (click-to-call)' })
  totalCalls: number;

  @ApiProperty({ description: 'Total route requests' })
  totalRoutes: number;

  @ApiProperty({ description: 'Total website clicks' })
  totalWebsiteClicks: number;

  @ApiProperty({ description: 'Total WhatsApp clicks (from tracking)' })
  totalWhatsAppClicks: number;

  @ApiProperty({ description: 'Total profile views' })
  totalProfileViews: number;

  @ApiProperty({ description: 'Total search impressions' })
  totalSearchImpressions: number;

  @ApiProperty({ description: 'Total maps impressions' })
  totalMapsImpressions: number;

  @ApiProperty({ description: 'Period start date' })
  periodStart: Date;

  @ApiProperty({ description: 'Period end date' })
  periodEnd: Date;

  @ApiProperty({ description: 'Comparison with previous period (percentage)' })
  comparison: {
    calls: number | null;
    routes: number | null;
    websiteClicks: number | null;
    whatsAppClicks: number | null;
    profileViews: number | null;
  };
}

export class DailyMetricsDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  calls: number;

  @ApiProperty()
  routes: number;

  @ApiProperty()
  websiteClicks: number;

  @ApiProperty()
  whatsAppClicks: number;

  @ApiProperty()
  profileViews: number;

  @ApiProperty()
  searchImpressions: number;

  @ApiProperty()
  mapsImpressions: number;
}

export class MetricsTimeSeriesDto {
  @ApiProperty({ type: [DailyMetricsDto] })
  data: DailyMetricsDto[];

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty({ enum: DemandPeriodType })
  granularity: DemandPeriodType;
}
