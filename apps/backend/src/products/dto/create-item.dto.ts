import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  MaxLength,
  IsUUID,
} from 'class-validator';

export enum ItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

export class CreateItemDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(ItemType)
  type: ItemType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @IsString()
  @MaxLength(20)
  unit: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDurationMinutes?: number;
}
