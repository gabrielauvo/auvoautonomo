/**
 * Billing Tool DTOs
 */

import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchDto, GetByIdDto, WriteOperationDto, PaginatedResponse } from './common.dto';

// ============================================================================
// Enums
// ============================================================================

export enum ChargeStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  RECEIVED = 'RECEIVED',
  OVERDUE = 'OVERDUE',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum BillingType {
  PIX = 'PIX',
  BOLETO = 'BOLETO',
  CREDIT_CARD = 'CREDIT_CARD',
}

// ============================================================================
// billing.getCharge
// ============================================================================

export class BillingGetChargeDto extends GetByIdDto {}

export interface ChargeDetail {
  id: string;
  externalId: string | null;
  status: ChargeStatus;
  billingType: BillingType;
  value: number;
  netValue: number | null;
  dueDate: Date;
  paymentDate: Date | null;
  description: string | null;
  invoiceUrl: string | null;
  pixQrCode: string | null;
  boletoBarCode: string | null;
  customer: {
    id: string;
    name: string;
  };
  createdAt: Date;
}

// ============================================================================
// billing.searchCharges
// ============================================================================

export class BillingSearchChargesDto extends SearchDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsEnum(ChargeStatus)
  status?: ChargeStatus;

  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overdueOnly?: boolean = false;
}

export interface ChargeSummary {
  id: string;
  status: ChargeStatus;
  billingType: BillingType;
  value: number;
  dueDate: Date;
  customerName: string;
  isOverdue: boolean;
}

export interface ChargesSearchResult extends PaginatedResponse<ChargeSummary> {
  charges: ChargeSummary[];
  totalValue: number;
}

// ============================================================================
// billing.previewCharge
// ============================================================================

export class BillingPreviewChargeDto {
  @IsUUID('4')
  customerId: string;

  @IsNumber()
  @Min(5)
  @Max(100000)
  @Type(() => Number)
  value: number;

  @IsEnum(BillingType)
  billingType: BillingType;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export interface ChargePreviewData {
  customerId: string;
  customerName: string;
  billingType: BillingType;
  value: number;
  dueDate: Date;
  description: string | null;
}

export interface ChargePreviewResult {
  previewId: string;
  valid: boolean;
  preview: ChargePreviewData;
  warnings: string[];
  errors: string[];
  customerHasPaymentProfile: boolean;
  expiresAt: Date;
}

// ============================================================================
// billing.createCharge
// ============================================================================

export class BillingCreateChargeDto extends WriteOperationDto {
  @IsUUID('4')
  previewId: string;
}

export interface ChargeCreateResult {
  id: string;
  externalId: string;
  status: ChargeStatus;
  billingType: BillingType;
  value: number;
  dueDate: Date;
  invoiceUrl: string;
  pixQrCode: string | null;
  boletoBarCode: string | null;
  createdAt: Date;
}
