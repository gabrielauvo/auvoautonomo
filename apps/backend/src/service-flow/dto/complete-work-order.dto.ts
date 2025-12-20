import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class CompleteWorkOrderDto {
  @IsOptional()
  @IsBoolean()
  skipChecklistValidation?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
