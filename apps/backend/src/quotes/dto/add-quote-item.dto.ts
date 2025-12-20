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

export enum QuoteItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

/**
 * DTO for adding an item to a quote
 *
 * Supports two modes:
 * 1. From catalog: provide itemId to snapshot from the catalog
 * 2. Manual: provide name, type, unit, unitPrice directly (no itemId)
 */
export class AddQuoteItemDto {
  /**
   * Item ID from the catalog (optional)
   * If provided, name/type/unit/unitPrice will be snapshotted from catalog
   */
  @IsOptional()
  @IsUUID()
  itemId?: string;

  /**
   * Manual item name (required if itemId is not provided)
   */
  @ValidateIf((o) => !o.itemId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  /**
   * Manual item type (optional, defaults to PRODUCT)
   */
  @IsOptional()
  @IsEnum(QuoteItemType)
  type?: QuoteItemType;

  /**
   * Manual item unit (required if itemId is not provided)
   */
  @ValidateIf((o) => !o.itemId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  /**
   * Quantity of the item
   */
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'Quantity must be greater than 0' })
  quantity: number;

  /**
   * Unit price override (optional if itemId is provided, required otherwise)
   * If itemId is provided and this is set, it overrides the catalog price
   */
  @ValidateIf((o) => !o.itemId)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  /**
   * Discount value for this item (optional)
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;
}
