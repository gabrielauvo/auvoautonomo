import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';

export class InventoryBalanceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  itemId: string;

  @ApiProperty()
  itemName: string;

  @ApiPropertyOptional()
  itemSku?: string;

  @ApiProperty()
  itemUnit: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class InventoryBalanceListResponseDto {
  @ApiProperty({ type: [InventoryBalanceResponseDto] })
  items: InventoryBalanceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalSkus: number;

  @ApiProperty()
  totalQuantity: number;
}

export class UpdateBalanceDto {
  @ApiProperty({ description: 'Novo saldo do produto' })
  @IsNumber()
  @Min(0, { message: 'Saldo não pode ser negativo (se allowNegativeStock for false)' })
  quantity: number;

  @ApiPropertyOptional({ description: 'Observação sobre o ajuste' })
  @IsOptional()
  @IsString()
  notes?: string;
}
