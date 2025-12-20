import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEquipmentDto {
  @ApiProperty({
    description: 'Client ID (owner of the equipment)',
    example: 'uuid-client-id',
  })
  @IsUUID()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Equipment type',
    example: 'Ar-condicionado Split 12000 BTUs',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Equipment brand',
    example: 'LG',
    required: false,
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({
    description: 'Equipment model',
    example: 'S4-Q12JA3WF',
    required: false,
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiProperty({
    description: 'Serial number',
    example: 'SN123456789',
    required: false,
  })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiProperty({
    description: 'Installation date (ISO 8601)',
    example: '2024-01-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  installationDate?: string;

  @ApiProperty({
    description: 'Warranty end date (ISO 8601)',
    example: '2026-01-15',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  warrantyEndDate?: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'Instalado na sala principal, necessita limpeza trimestral',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
