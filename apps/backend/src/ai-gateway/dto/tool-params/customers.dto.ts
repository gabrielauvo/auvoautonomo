/**
 * Customer Tool DTOs
 */

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SearchDto, GetByIdDto, WriteOperationDto, PaginatedResponse } from './common.dto';

// ============================================================================
// customers.search
// ============================================================================

export class CustomersSearchDto extends SearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  query: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasOverduePayments?: boolean;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  isDelinquent: boolean;
  createdAt: Date;
}

export interface CustomersSearchResult extends PaginatedResponse<CustomerSummary> {
  customers: CustomerSummary[];
}

// ============================================================================
// customers.get
// ============================================================================

export class CustomersGetDto extends GetByIdDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includePayments?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeWorkOrders?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeQuotes?: boolean = false;
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  isDelinquent: boolean;
  createdAt: Date;
  updatedAt: Date;
  payments?: PaymentSummary[];
  workOrders?: WorkOrderSummary[];
  quotes?: QuoteSummary[];
}

interface PaymentSummary {
  id: string;
  value: number;
  status: string;
  dueDate: Date;
}

interface WorkOrderSummary {
  id: string;
  title: string;
  status: string;
  scheduledDate: Date | null;
}

interface QuoteSummary {
  id: string;
  title: string;
  status: string;
  totalValue: number;
}

// ============================================================================
// customers.create
// ============================================================================

export class CustomersCreateDto extends WriteOperationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,11}$/, {
    message: 'Phone must contain 10-11 digits (DDD + number)',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{11}$|^[0-9]{14}$/, {
    message: 'TaxId must be 11 digits (CPF) or 14 digits (CNPJ)',
  })
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'State must be 2 uppercase letters (UF)',
  })
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{8}$/, {
    message: 'ZipCode must be 8 digits',
  })
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export interface CustomerCreateResult {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}
