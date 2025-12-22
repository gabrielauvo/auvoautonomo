import { IsString, IsOptional, IsISO8601, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkOrderDto {
  @ApiProperty({
    description: 'Work order title',
    example: 'Manutenção ar-condicionado sala 3 - URGENTE',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Detailed description of the service',
    example: 'Limpeza completa, troca de filtros, verificação de gás e teste de vazamentos',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled date (ISO 8601)',
    example: '2025-12-15',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  scheduledDate?: string;

  @ApiProperty({
    description: 'Scheduled start time (ISO 8601)',
    example: '2025-12-15T08:00:00Z',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  scheduledStartTime?: string;

  @ApiProperty({
    description: 'Scheduled end time (ISO 8601)',
    example: '2025-12-15T12:00:00Z',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  scheduledEndTime?: string;

  @ApiProperty({
    description: 'Execution start time (ISO 8601)',
    example: '2025-12-15T08:15:00Z',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  executionStart?: string;

  @ApiProperty({
    description: 'Execution end time (ISO 8601)',
    example: '2025-12-15T11:45:00Z',
    required: false,
  })
  @IsISO8601()
  @IsOptional()
  executionEnd?: string;

  @ApiProperty({
    description: 'Service address',
    example: 'Rua Exemplo, 123 - Sala 301 - São Paulo/SP',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'General notes/observations',
    example: 'Serviço concluído com sucesso. Cliente satisfeito.',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'ID do tipo de ordem de serviço',
    example: 'uuid-work-order-type-id',
    required: false,
  })
  @IsUUID('4', { message: 'ID do tipo de OS inválido' })
  @IsOptional()
  workOrderTypeId?: string | null;
}
