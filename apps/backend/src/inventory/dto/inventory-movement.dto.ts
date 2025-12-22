import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { InventoryMovementType, InventoryMovementSource } from '@prisma/client';

export class CreateMovementDto {
  @ApiProperty({ description: 'ID do produto' })
  @IsString()
  itemId: string;

  @ApiProperty({
    description: 'Tipo de movimentação',
    enum: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
  })
  @IsEnum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
  type: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

  @ApiProperty({
    description: 'Quantidade a movimentar (sempre positiva)',
  })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ description: 'Observação sobre a movimentação' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryMovementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  itemId: string;

  @ApiPropertyOptional()
  itemName?: string;

  @ApiPropertyOptional()
  itemSku?: string;

  @ApiProperty({ enum: InventoryMovementType })
  type: InventoryMovementType;

  @ApiProperty({ enum: InventoryMovementSource })
  source: InventoryMovementSource;

  @ApiProperty({ description: 'Quantidade (positivo = entrada, negativo = saída)' })
  quantity: number;

  @ApiProperty({ description: 'Saldo após a movimentação' })
  balanceAfter: number;

  @ApiPropertyOptional()
  sourceId?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiPropertyOptional()
  createdBy?: string;

  @ApiProperty()
  createdAt: Date;
}

export class MovementListQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por produto' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo',
    enum: InventoryMovementType,
  })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;

  @ApiPropertyOptional({
    description: 'Filtrar por fonte',
    enum: InventoryMovementSource,
  })
  @IsOptional()
  @IsEnum(InventoryMovementSource)
  source?: InventoryMovementSource;

  @ApiPropertyOptional({ description: 'Data inicial' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data final' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Limite de registros', default: 50 })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset para paginação', default: 0 })
  @IsOptional()
  @IsNumber()
  offset?: number;
}

export class MovementListResponseDto {
  @ApiProperty({ type: [InventoryMovementResponseDto] })
  items: InventoryMovementResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  offset: number;
}
