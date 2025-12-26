/**
 * Quote Tool DTOs
 */

import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchDto, GetByIdDto, WriteOperationDto, PaginatedResponse } from './common.dto';

// ============================================================================
// Enums
// ============================================================================

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CONVERTED = 'CONVERTED',
}

export enum QuoteItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

// ============================================================================
// quotes.search
// ============================================================================

export class QuotesSearchDto extends SearchDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}

export interface QuoteSummary {
  id: string;
  title: string;
  status: QuoteStatus;
  totalValue: number;
  customerName: string;
  createdAt: Date;
}

export interface QuotesSearchResult extends PaginatedResponse<QuoteSummary> {
  quotes: QuoteSummary[];
}

// ============================================================================
// quotes.get
// ============================================================================

export class QuotesGetDto extends GetByIdDto {}

export interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  type: QuoteItemType;
}

export interface QuoteDetail {
  id: string;
  title: string;
  description: string | null;
  status: QuoteStatus;
  totalValue: number;
  validUntil: Date | null;
  customer: {
    id: string;
    name: string;
  };
  items: QuoteItem[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// quotes.create
// ============================================================================

export class QuoteItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsEnum(QuoteItemType)
  type?: QuoteItemType = QuoteItemType.SERVICE;
}

export class QuotesCreateDto extends WriteOperationDto {
  @IsUUID('4')
  customerId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}

export interface QuoteCreateResult {
  id: string;
  title: string;
  status: QuoteStatus;
  totalValue: number;
  customerName: string;
  validUntil: Date | null;
  createdAt: Date;
}
