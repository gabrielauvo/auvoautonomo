import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// =============================================================================
// ENUMS
// =============================================================================

export enum SyncScope {
  ALL = 'all',
  RECENT = 'recent',
  ACTIVE_ONLY = 'active_only',
}

// =============================================================================
// QUERY DTOs
// =============================================================================

export class SyncPullQueryDto {
  @ApiPropertyOptional({
    description: 'ISO timestamp for delta sync - only items updated after this time',
  })
  @IsOptional()
  @IsString()
  since?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (base64 encoded)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page (max 500)',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Scope of sync',
    enum: SyncScope,
    default: SyncScope.ALL,
  })
  @IsOptional()
  @IsEnum(SyncScope)
  scope?: SyncScope;
}

// =============================================================================
// CATEGORY DTOs
// =============================================================================

export class SyncCategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  technicianId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  color?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  itemCount: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class SyncCategoriesPullResponseDto {
  @ApiProperty({ type: [SyncCategoryDto] })
  items: SyncCategoryDto[];

  @ApiPropertyOptional()
  nextCursor?: string | null;

  @ApiProperty()
  serverTime: string;

  @ApiProperty()
  hasMore: boolean;

  @ApiProperty()
  total: number;
}

// =============================================================================
// ITEM DTOs
// =============================================================================

export class SyncBundleItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  itemId: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty()
  itemType: string;

  @ApiProperty()
  itemUnit: string;

  @ApiProperty()
  itemBasePrice: number;

  @ApiProperty()
  quantity: number;
}

export class SyncItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  technicianId: string;

  @ApiPropertyOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  categoryName?: string;

  @ApiPropertyOptional()
  categoryColor?: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ['PRODUCT', 'SERVICE', 'BUNDLE'] })
  type: string;

  @ApiPropertyOptional()
  sku?: string;

  @ApiProperty()
  unit: string;

  @ApiProperty()
  basePrice: number;

  @ApiPropertyOptional()
  costPrice?: number;

  @ApiPropertyOptional()
  defaultDurationMinutes?: number;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ type: [SyncBundleItemDto] })
  bundleItems?: SyncBundleItemDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class SyncItemsPullResponseDto {
  @ApiProperty({ type: [SyncItemDto] })
  items: SyncItemDto[];

  @ApiPropertyOptional()
  nextCursor?: string | null;

  @ApiProperty()
  serverTime: string;

  @ApiProperty()
  hasMore: boolean;

  @ApiProperty()
  total: number;
}

// =============================================================================
// MUTATION DTOs (for mobile sync push)
// =============================================================================

export enum MutationAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum MutationStatus {
  APPLIED = 'applied',
  REJECTED = 'rejected',
}

export enum ItemTypeEnum {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

// Category Mutation
export class CategoryMutationRecordDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryMutationDto {
  @ApiProperty()
  @IsString()
  mutationId: string;

  @ApiProperty({ enum: MutationAction })
  @IsEnum(MutationAction)
  action: MutationAction;

  @ApiProperty({ type: CategoryMutationRecordDto })
  @ValidateNested()
  @Type(() => CategoryMutationRecordDto)
  record: CategoryMutationRecordDto;

  @ApiProperty()
  @IsString()
  clientUpdatedAt: string;
}

export class SyncCategoriesPushBodyDto {
  @ApiProperty({ type: [CategoryMutationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryMutationDto)
  mutations: CategoryMutationDto[];
}

export class CategoryMutationResultDto {
  @ApiProperty()
  mutationId: string;

  @ApiProperty({ enum: MutationStatus })
  status: MutationStatus;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional({ type: SyncCategoryDto })
  record?: SyncCategoryDto;
}

export class SyncCategoriesPushResponseDto {
  @ApiProperty({ type: [CategoryMutationResultDto] })
  results: CategoryMutationResultDto[];

  @ApiProperty()
  serverTime: string;
}

// Item Mutation
export class ItemMutationBundleItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  itemId: string;

  @ApiProperty()
  @IsNumber()
  quantity: number;
}

export class ItemMutationRecordDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ItemTypeEnum })
  @IsEnum(ItemTypeEnum)
  type: ItemTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty()
  @IsString()
  unit: string;

  @ApiProperty()
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [ItemMutationBundleItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemMutationBundleItemDto)
  bundleItems?: ItemMutationBundleItemDto[];
}

export class ItemMutationDto {
  @ApiProperty()
  @IsString()
  mutationId: string;

  @ApiProperty({ enum: MutationAction })
  @IsEnum(MutationAction)
  action: MutationAction;

  @ApiProperty({ type: ItemMutationRecordDto })
  @ValidateNested()
  @Type(() => ItemMutationRecordDto)
  record: ItemMutationRecordDto;

  @ApiProperty()
  @IsString()
  clientUpdatedAt: string;
}

export class SyncItemsPushBodyDto {
  @ApiProperty({ type: [ItemMutationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemMutationDto)
  mutations: ItemMutationDto[];
}

export class ItemMutationResultDto {
  @ApiProperty()
  mutationId: string;

  @ApiProperty({ enum: MutationStatus })
  status: MutationStatus;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional({ type: SyncItemDto })
  record?: SyncItemDto;
}

export class SyncItemsPushResponseDto {
  @ApiProperty({ type: [ItemMutationResultDto] })
  results: ItemMutationResultDto[];

  @ApiProperty()
  serverTime: string;
}
