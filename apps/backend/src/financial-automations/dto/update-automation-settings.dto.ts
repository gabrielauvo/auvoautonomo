import {
  IsBoolean,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateAutomationSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  @ArrayMaxSize(5)
  paymentReminderDaysBefore?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(90, { each: true })
  @ArrayMaxSize(10)
  paymentReminderDaysAfter?: number[];

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  autoMarkOverdueAsDelinquentAfterDays?: number | null;

  @IsOptional()
  @IsBoolean()
  enableQuoteFollowUp?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(30, { each: true })
  @ArrayMaxSize(5)
  quoteFollowUpDays?: number[];

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(365)
  autoCancelPaymentAfterDays?: number | null;
}
