import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsDateString,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// =============================================================================
// ENUMS
// =============================================================================

export enum SyncScope {
  ALL = 'all',
  RECENT = 'recent',
}

export enum MutationAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum MutationStatus {
  APPLIED = 'applied',
  REJECTED = 'rejected',
}

// =============================================================================
// QUOTE ITEM DTOs
// =============================================================================

export class SyncQuoteItemDto {
  @ApiProperty({ description: 'Quote Item ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Quote ID' })
  quoteId: string;

  @ApiPropertyOptional({ description: 'Catalog Item ID (null for manual items)' })
  itemId?: string;

  @ApiProperty({ description: 'Item name (snapshot)' })
  name: string;

  @ApiProperty({ description: 'Item type' })
  type: string;

  @ApiProperty({ description: 'Unit' })
  unit: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  unitPrice: number;

  @ApiProperty({ description: 'Discount value' })
  discountValue: number;

  @ApiProperty({ description: 'Total price' })
  totalPrice: number;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: string;
}

// =============================================================================
// PULL DTOs
// =============================================================================

export class SyncPullQueryDto {
  @ApiPropertyOptional({
    description: 'ISO date string - only return records updated after this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  since?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64 encoded updatedAt+id)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of records to return per page',
    example: 100,
    default: 100,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Scope of quotes to sync',
    enum: SyncScope,
    default: SyncScope.ALL,
  })
  @IsOptional()
  @IsEnum(SyncScope)
  scope?: SyncScope;
}

export class SyncQuoteSignatureDto {
  @ApiProperty({ description: 'Signature ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Signer name' })
  signerName: string;

  @ApiPropertyOptional({ description: 'Signer document (CPF/RG)' })
  signerDocument?: string;

  @ApiPropertyOptional({ description: 'Signer role' })
  signerRole?: string;

  @ApiPropertyOptional({ description: 'Signature image URL' })
  signatureImageUrl?: string;

  @ApiPropertyOptional({ description: 'Signature image base64 (for upload)' })
  signatureImageBase64?: string;

  @ApiProperty({ description: 'Signed at timestamp' })
  signedAt: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: string;
}

export class SyncQuoteDto {
  @ApiProperty({ description: 'Quote ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Technician/User ID' })
  technicianId: string;

  @ApiProperty({ description: 'Client ID' })
  clientId: string;

  @ApiPropertyOptional({ description: 'Client name (denormalized)' })
  clientName?: string;

  @ApiProperty({ description: 'Quote status' })
  status: string;

  @ApiProperty({ description: 'Discount value' })
  discountValue: number;

  @ApiProperty({ description: 'Total value' })
  totalValue: number;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Sent at timestamp' })
  sentAt?: string;

  @ApiPropertyOptional({ description: 'Visit scheduled at' })
  visitScheduledAt?: string;

  @ApiProperty({ description: 'Quote items', type: [SyncQuoteItemDto] })
  items: SyncQuoteItemDto[];

  @ApiPropertyOptional({ description: 'Signature (if quote is approved)', type: SyncQuoteSignatureDto })
  signature?: SyncQuoteSignatureDto;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: string;
}

export class SyncQuotesPullResponseDto {
  @ApiProperty({
    description: 'Array of quote records',
    type: [SyncQuoteDto],
  })
  items: SyncQuoteDto[];

  @ApiPropertyOptional({
    description: 'Cursor for next page (null if no more pages)',
  })
  nextCursor: string | null;

  @ApiProperty({
    description: 'Server time for next sync',
  })
  serverTime: string;

  @ApiProperty({
    description: 'Whether there are more records',
  })
  hasMore: boolean;

  @ApiProperty({
    description: 'Total count of records matching the query',
  })
  total: number;
}

// =============================================================================
// PUSH DTOs
// =============================================================================

export class QuoteItemMutationDto {
  @ApiPropertyOptional({ description: 'Quote Item ID' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Catalog Item ID' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiProperty({ description: 'Item name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Item type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Unit' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNumber()
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Discount value' })
  @IsOptional()
  @IsNumber()
  discountValue?: number;
}

export class QuoteSignatureMutationDto {
  @ApiPropertyOptional({ description: 'Signature ID' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Signer name' })
  @IsString()
  signerName: string;

  @ApiPropertyOptional({ description: 'Signer document (CPF/RG)' })
  @IsOptional()
  @IsString()
  signerDocument?: string;

  @ApiPropertyOptional({ description: 'Signer role' })
  @IsOptional()
  @IsString()
  signerRole?: string;

  @ApiProperty({ description: 'Signature image base64' })
  @IsString()
  signatureImageBase64: string;

  @ApiPropertyOptional({ description: 'Signed at timestamp' })
  @IsOptional()
  @IsDateString()
  signedAt?: string;
}

export class QuoteMutationRecordDto {
  @ApiPropertyOptional({ description: 'Quote ID (required for update/delete)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ description: 'Client ID' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Quote status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Discount value' })
  @IsOptional()
  @IsNumber()
  discountValue?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Visit scheduled at' })
  @IsOptional()
  @IsDateString()
  visitScheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Quote items',
    type: [QuoteItemMutationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemMutationDto)
  items?: QuoteItemMutationDto[];

  @ApiPropertyOptional({
    description: 'Signature data (for approving quotes)',
    type: QuoteSignatureMutationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteSignatureMutationDto)
  signature?: QuoteSignatureMutationDto;
}

export class QuoteMutationDto {
  @ApiProperty({
    description: 'Unique mutation ID generated by client for idempotency. Format: {entityId}-{operation}-{localMutationId}',
  })
  @IsString()
  mutationId: string;

  @ApiProperty({
    description: 'Mutation action',
    enum: MutationAction,
  })
  @IsEnum(MutationAction)
  action: MutationAction;

  @ApiProperty({
    description: 'Quote record data',
    type: QuoteMutationRecordDto,
  })
  @ValidateNested()
  @Type(() => QuoteMutationRecordDto)
  record: QuoteMutationRecordDto;

  @ApiProperty({
    description: 'Client-side updatedAt for conflict resolution',
  })
  @IsDateString()
  clientUpdatedAt: string;
}

export class SyncQuotesPushBodyDto {
  @ApiProperty({
    description: 'Array of mutations to apply',
    type: [QuoteMutationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteMutationDto)
  mutations: QuoteMutationDto[];
}

export class QuoteMutationResultDto {
  @ApiProperty({ description: 'Mutation ID from request' })
  mutationId: string;

  @ApiProperty({
    description: 'Result status',
    enum: MutationStatus,
  })
  status: MutationStatus;

  @ApiPropertyOptional({
    description: 'Server record after mutation',
    type: SyncQuoteDto,
  })
  record?: SyncQuoteDto;

  @ApiPropertyOptional({
    description: 'Error message (for rejected mutations)',
  })
  error?: string;
}

export class SyncQuotesPushResponseDto {
  @ApiProperty({
    description: 'Results for each mutation',
    type: [QuoteMutationResultDto],
  })
  results: QuoteMutationResultDto[];

  @ApiProperty({
    description: 'Server time for reference',
  })
  serverTime: string;
}
