import { IsOptional, IsString, IsDateString } from 'class-validator';

export class OverviewQueryDto {
  @IsOptional()
  @IsString()
  period?: 'current_month' | 'last_month' | 'current_year' | 'custom';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
