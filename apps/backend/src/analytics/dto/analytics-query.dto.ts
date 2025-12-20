import { IsOptional, IsDateString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum GroupByPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class AnalyticsPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RevenueByPeriodDto extends AnalyticsPeriodDto {
  @IsOptional()
  @IsEnum(GroupByPeriod)
  groupBy?: GroupByPeriod = GroupByPeriod.DAY;
}

export class TopEntitiesDto extends AnalyticsPeriodDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
