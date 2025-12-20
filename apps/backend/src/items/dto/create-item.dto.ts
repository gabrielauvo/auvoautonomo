import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
  IsUUID,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ItemType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BUNDLE = 'BUNDLE',
}

export class CreateItemDto {
  @ApiProperty({
    description: 'Item name',
    example: 'Serviço de Manutenção',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Manutenção preventiva de equipamentos',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Item type (PRODUCT, SERVICE, or BUNDLE)',
    enum: ItemType,
    example: ItemType.SERVICE,
    default: ItemType.PRODUCT,
  })
  @IsEnum(ItemType)
  @IsOptional()
  type?: ItemType;

  @ApiProperty({
    description: 'Category ID',
    example: 'uuid-category-id',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'SKU (Stock Keeping Unit)',
    example: 'SRV-001',
    required: false,
  })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiProperty({
    description: 'Base price (selling price)',
    example: 150.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'Base price must be greater than or equal to 0' })
  basePrice: number;

  @ApiProperty({
    description: 'Cost price (optional)',
    example: 80.0,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Cost price must be greater than or equal to 0' })
  costPrice?: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'hora',
    default: 'UN',
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiProperty({
    description: 'Default duration in minutes (for services)',
    example: 60,
    required: false,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  defaultDurationMinutes?: number;

  @ApiProperty({
    description: 'Whether the item is active',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
