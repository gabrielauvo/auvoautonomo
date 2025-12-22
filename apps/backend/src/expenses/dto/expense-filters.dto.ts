import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseStatus } from '@prisma/client';

export class ExpenseFiltersDto {
  @ApiProperty({
    description: 'Filtrar por status',
    enum: ExpenseStatus,
    required: false,
  })
  @IsEnum(ExpenseStatus, { message: 'Status inválido' })
  @IsOptional()
  status?: ExpenseStatus;

  @ApiProperty({
    description: 'Filtrar por fornecedor',
    required: false,
  })
  @IsUUID('4', { message: 'ID do fornecedor inválido' })
  @IsOptional()
  supplierId?: string;

  @ApiProperty({
    description: 'Filtrar por categoria',
    required: false,
  })
  @IsUUID('4', { message: 'ID da categoria inválido' })
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'Filtrar por Ordem de Serviço',
    required: false,
  })
  @IsUUID('4', { message: 'ID da OS inválido' })
  @IsOptional()
  workOrderId?: string;

  @ApiProperty({
    description: 'Data inicial do período (vencimento)',
    required: false,
    example: '2025-01-01',
  })
  @IsDateString({}, { message: 'Data inicial deve ser uma data válida' })
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'Data final do período (vencimento)',
    required: false,
    example: '2025-01-31',
  })
  @IsDateString({}, { message: 'Data final deve ser uma data válida' })
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Incluir despesas vencidas (calculado dinamicamente)',
    required: false,
    default: false,
  })
  @IsOptional()
  includeOverdue?: boolean;
}
