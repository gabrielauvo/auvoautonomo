import { IsString, IsOptional, IsDateString, IsArray } from 'class-validator';

export class ConvertToWorkOrderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsDateString()
  scheduledStartTime?: string;

  @IsOptional()
  @IsDateString()
  scheduledEndTime?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentIds?: string[];
}
