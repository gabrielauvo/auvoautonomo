import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { PaymentStatus, PaymentBillingType } from '@prisma/client';

export class PaymentsQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentBillingType)
  billingType?: PaymentBillingType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  dateField?: 'paidAt' | 'dueDate';

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  workOrderId?: string;

  @IsOptional()
  @IsString()
  quoteId?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'dueDate' | 'paidAt' | 'value';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
