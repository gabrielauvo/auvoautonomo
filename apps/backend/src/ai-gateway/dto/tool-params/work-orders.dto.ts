/**
 * Work Order Tool DTOs
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

export enum WorkOrderStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

export enum ItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
}

// ============================================================================
// workOrders.search
// ============================================================================

export class WorkOrdersSearchDto extends SearchDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @IsOptional()
  @IsDateString()
  scheduledDateFrom?: string;

  @IsOptional()
  @IsDateString()
  scheduledDateTo?: string;
}

export interface WorkOrderSummary {
  id: string;
  title: string;
  status: WorkOrderStatus;
  scheduledDate: Date | null;
  totalValue: number;
  customerName: string;
}

export interface WorkOrdersSearchResult extends PaginatedResponse<WorkOrderSummary> {
  workOrders: WorkOrderSummary[];
}

// ============================================================================
// workOrders.get
// ============================================================================

export class WorkOrdersGetDto extends GetByIdDto {}

export interface WorkOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  type: ItemType;
}

export interface WorkOrderDetail {
  id: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  scheduledDate: Date | null;
  completedAt: Date | null;
  totalValue: number;
  customer: {
    id: string;
    name: string;
  };
  items: WorkOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// workOrders.create
// ============================================================================

export class WorkOrderItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType = ItemType.SERVICE;
}

export class WorkOrdersCreateDto extends WriteOperationDto {
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
  scheduledDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkOrderItemDto)
  items: WorkOrderItemDto[];
}

export interface WorkOrderCreateResult {
  id: string;
  title: string;
  status: WorkOrderStatus;
  totalValue: number;
  customerName: string;
  createdAt: Date;
}

// ============================================================================
// workOrders.updateStatus
// ============================================================================

export class WorkOrdersUpdateStatusDto extends WriteOperationDto {
  @IsUUID('4')
  id: string;

  @IsEnum(WorkOrderStatus)
  status: WorkOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export interface WorkOrderUpdateStatusResult {
  id: string;
  title: string;
  previousStatus: WorkOrderStatus;
  newStatus: WorkOrderStatus;
  updatedAt: Date;
}
