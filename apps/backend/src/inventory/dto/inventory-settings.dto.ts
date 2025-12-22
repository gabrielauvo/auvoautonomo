import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { WorkOrderStatus } from '@prisma/client';

export class UpdateInventorySettingsDto {
  @ApiPropertyOptional({
    description: 'Se o controle de estoque está habilitado',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Em qual status da OS fazer a baixa automática',
    enum: WorkOrderStatus,
  })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  deductOnStatus?: WorkOrderStatus;

  @ApiPropertyOptional({
    description: 'Se permite estoque negativo',
  })
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @ApiPropertyOptional({
    description: 'Se deve deduzir apenas uma vez por OS',
  })
  @IsOptional()
  @IsBoolean()
  deductOnlyOncePerWorkOrder?: boolean;
}

export class InventorySettingsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty({ enum: WorkOrderStatus })
  deductOnStatus: WorkOrderStatus;

  @ApiProperty()
  allowNegativeStock: boolean;

  @ApiProperty()
  deductOnlyOncePerWorkOrder: boolean;

  @ApiProperty()
  featureEnabled: boolean; // From plan limits

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
