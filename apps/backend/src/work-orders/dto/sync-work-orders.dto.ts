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

export enum SyncWorkOrderScope {
  ALL = 'all',
  ASSIGNED = 'assigned', // Only work orders assigned to this technician
  DATE_RANGE = 'date_range', // Within date range (default: -30 to +60 days)
}

export enum WorkOrderMutationAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  UPDATE_STATUS = 'update_status', // Special action for status changes
}

export enum WorkOrderMutationStatus {
  APPLIED = 'applied',
  REJECTED = 'rejected',
}

export enum WorkOrderStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

// =============================================================================
// PULL DTOs
// =============================================================================

export class SyncWorkOrderPullQueryDto {
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
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Scope of work orders to sync',
    enum: SyncWorkOrderScope,
    default: SyncWorkOrderScope.DATE_RANGE,
  })
  @IsOptional()
  @IsEnum(SyncWorkOrderScope)
  scope?: SyncWorkOrderScope;

  @ApiPropertyOptional({
    description: 'Start date for date range scope (ISO format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range scope (ISO format)',
    example: '2024-03-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// DTO para itens de catálogo da OS (snapshot denormalizado)
export class SyncWorkOrderItemDetailDto {
  @ApiProperty({ description: 'Work Order Item ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Work Order ID' })
  workOrderId: string;

  @ApiPropertyOptional({ description: 'Original catalog item ID' })
  itemId?: string;

  @ApiPropertyOptional({ description: 'Original quote item ID' })
  quoteItemId?: string;

  @ApiProperty({ description: 'Item name (snapshot)' })
  name: string;

  @ApiProperty({ description: 'Item type (PRODUCT or SERVICE)' })
  type: string;

  @ApiProperty({ description: 'Unit (UN, M, KG, etc.)' })
  unit: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  unitPrice: number;

  @ApiProperty({ description: 'Discount value' })
  discountValue: number;

  @ApiProperty({ description: 'Total price (quantity * unitPrice - discountValue)' })
  totalPrice: number;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: string;
}

export class SyncWorkOrderItemDto {
  @ApiProperty({ description: 'Work Order ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Technician/User ID (maps to technicianId on mobile)' })
  technicianId: string;

  @ApiProperty({ description: 'Client ID' })
  clientId: string;

  @ApiPropertyOptional({ description: 'Quote ID (if originated from quote)' })
  quoteId?: string;

  @ApiPropertyOptional({ description: 'Work Order Type ID' })
  workOrderTypeId?: string;

  @ApiProperty({ description: 'Work order title' })
  title: string;

  @ApiPropertyOptional({ description: 'Work order description' })
  description?: string;

  @ApiProperty({ description: 'Work order status', enum: WorkOrderStatus })
  status: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Scheduled date (date only)' })
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Scheduled start time (full datetime)' })
  scheduledStartTime?: string;

  @ApiPropertyOptional({ description: 'Scheduled end time (full datetime)' })
  scheduledEndTime?: string;

  @ApiPropertyOptional({ description: 'Execution start time' })
  executionStart?: string;

  @ApiPropertyOptional({ description: 'Execution end time' })
  executionEnd?: string;

  @ApiPropertyOptional({ description: 'Service address' })
  address?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Total value' })
  totalValue?: number;

  @ApiProperty({ description: 'Whether work order is active (not deleted)', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Deleted at timestamp (soft delete)' })
  deletedAt?: string;

  // Denormalized client data for offline display
  @ApiPropertyOptional({ description: 'Client name (denormalized)' })
  clientName?: string;

  @ApiPropertyOptional({ description: 'Client phone (denormalized)' })
  clientPhone?: string;

  @ApiPropertyOptional({ description: 'Client address (denormalized)' })
  clientAddress?: string;

  // Work order type data (denormalized)
  @ApiPropertyOptional({ description: 'Work order type name (denormalized)' })
  workOrderTypeName?: string;

  @ApiPropertyOptional({ description: 'Work order type color (denormalized)' })
  workOrderTypeColor?: string;

  // Work order items (catalog items snapshot)
  @ApiPropertyOptional({
    description: 'Work order items (products/services)',
    type: [SyncWorkOrderItemDetailDto],
  })
  items?: SyncWorkOrderItemDetailDto[];
}

export class SyncWorkOrderPullResponseDto {
  @ApiProperty({
    description: 'Array of work order records',
    type: [SyncWorkOrderItemDto],
  })
  items: SyncWorkOrderItemDto[];

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

export class WorkOrderMutationRecordDto {
  @ApiPropertyOptional({ description: 'Work Order ID (required for update/delete)' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'Client ID' })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Work order title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Work order description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Work order status', enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiPropertyOptional({ description: 'Scheduled date' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Scheduled start time' })
  @IsOptional()
  @IsDateString()
  scheduledStartTime?: string;

  @ApiPropertyOptional({ description: 'Scheduled end time' })
  @IsOptional()
  @IsDateString()
  scheduledEndTime?: string;

  @ApiPropertyOptional({ description: 'Execution start time' })
  @IsOptional()
  @IsDateString()
  executionStart?: string;

  @ApiPropertyOptional({ description: 'Execution end time' })
  @IsOptional()
  @IsDateString()
  executionEnd?: string;

  @ApiPropertyOptional({ description: 'Service address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Work Order Type ID' })
  @IsOptional()
  @IsUUID()
  workOrderTypeId?: string;
}

export class WorkOrderMutationDto {
  @ApiProperty({
    description: 'Unique mutation ID generated by client for idempotency. Format: {entityId}-{operation}-{localMutationId}',
    example: '550e8400-e29b-41d4-a716-446655440000-update-123',
  })
  @IsString()
  mutationId: string;

  @ApiProperty({
    description: 'Mutation action',
    enum: WorkOrderMutationAction,
  })
  @IsEnum(WorkOrderMutationAction)
  action: WorkOrderMutationAction;

  @ApiProperty({
    description: 'Work order record data',
    type: WorkOrderMutationRecordDto,
  })
  @ValidateNested()
  @Type(() => WorkOrderMutationRecordDto)
  record: WorkOrderMutationRecordDto;

  @ApiProperty({
    description: 'Client-side updatedAt for conflict resolution',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  clientUpdatedAt: string;
}

export class SyncWorkOrderPushBodyDto {
  @ApiProperty({
    description: 'Array of mutations to apply',
    type: [WorkOrderMutationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderMutationDto)
  mutations: WorkOrderMutationDto[];
}

export class WorkOrderMutationResultDto {
  @ApiProperty({ description: 'Mutation ID from request' })
  mutationId: string;

  @ApiProperty({
    description: 'Result status',
    enum: WorkOrderMutationStatus,
  })
  status: WorkOrderMutationStatus;

  @ApiPropertyOptional({
    description: 'Server record after mutation (for applied mutations)',
    type: SyncWorkOrderItemDto,
  })
  record?: SyncWorkOrderItemDto;

  @ApiPropertyOptional({
    description: 'Error message (for rejected mutations)',
  })
  error?: string;
}

export class SyncWorkOrderPushResponseDto {
  @ApiProperty({
    description: 'Results for each mutation',
    type: [WorkOrderMutationResultDto],
  })
  results: WorkOrderMutationResultDto[];

  @ApiProperty({
    description: 'Server time for reference',
  })
  serverTime: string;
}
