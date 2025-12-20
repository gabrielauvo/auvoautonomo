import { IsOptional, IsString, IsDateString } from 'class-validator';

export class RevenueByDayQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RevenueByClientQueryDto {
  @IsOptional()
  @IsString()
  period?: 'current_month' | 'last_month' | 'current_year' | 'all_time';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
