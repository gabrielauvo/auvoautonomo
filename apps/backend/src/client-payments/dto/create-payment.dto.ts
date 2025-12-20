import { IsString, IsEnum, IsNumber, IsDateString, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { PaymentBillingType } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsEnum(PaymentBillingType)
  @IsNotEmpty()
  billingType: PaymentBillingType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  value: number;

  @IsDateString()
  @IsNotEmpty()
  dueDate: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  quoteId?: string;

  @IsString()
  @IsOptional()
  workOrderId?: string;
}
