import {
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum WorkOrderItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

/**
 * DTO for adding an item to a work order
 *
 * Supports two modes:
 * 1. From catalog: provide itemId to snapshot from the catalog
 * 2. Manual: provide name, type, unit, unitPrice directly (no itemId)
 */
export class AddWorkOrderItemDto {
  /**
   * Item ID from the catalog (optional)
   * If provided, name/type/unit/unitPrice will be snapshotted from catalog
   */
  @ApiProperty({
    description: 'Item ID from catalog (optional)',
    example: 'uuid-item-id',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  /**
   * Manual item name (required if itemId is not provided)
   */
  @ApiProperty({
    description: 'Item name (required if itemId not provided)',
    example: 'Mão de obra adicional',
    required: false,
  })
  @ValidateIf((o) => !o.itemId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  /**
   * Manual item type (optional, defaults to PRODUCT)
   */
  @ApiProperty({
    description: 'Item type',
    enum: WorkOrderItemType,
    default: WorkOrderItemType.PRODUCT,
    required: false,
  })
  @IsOptional()
  @IsEnum(WorkOrderItemType)
  type?: WorkOrderItemType;

  /**
   * Manual item unit (required if itemId is not provided)
   */
  @ApiProperty({
    description: 'Unit of measurement (required if itemId not provided)',
    example: 'hora',
    required: false,
  })
  @ValidateIf((o) => !o.itemId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  /**
   * Quantity of the item
   */
  @ApiProperty({
    description: 'Quantity',
    example: 2,
    minimum: 0.001,
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'Quantity must be greater than 0' })
  quantity: number;

  /**
   * Unit price override (optional if itemId is provided, required otherwise)
   * If itemId is provided and this is set, it overrides the catalog price
   */
  @ApiProperty({
    description: 'Unit price (required if itemId not provided)',
    example: 100.0,
    required: false,
  })
  @ValidateIf((o) => !o.itemId)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /**
   * Discount value for this item (optional)
   */
  @ApiProperty({
    description: 'Discount value',
    example: 10.0,
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;
}
