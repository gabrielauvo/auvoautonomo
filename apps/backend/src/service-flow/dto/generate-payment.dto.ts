import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { PaymentBillingType } from '@prisma/client';

export class GeneratePaymentDto {
  @IsEnum(PaymentBillingType)
  billingType: PaymentBillingType;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  value?: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  description?: string;
}
