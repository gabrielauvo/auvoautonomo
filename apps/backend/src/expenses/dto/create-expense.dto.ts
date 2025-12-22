import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsDateString,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExpenseStatus, ExpensePaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @ApiProperty({
    description: 'Descrição da despesa',
    example: 'Compra de materiais para manutenção',
  })
  @IsString({ message: 'Descrição deve ser um texto' })
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  @MaxLength(500, { message: 'Descrição deve ter no máximo 500 caracteres' })
  description: string;

  @ApiProperty({
    description: 'Valor da despesa',
    example: 150.50,
  })
  @IsNumber({}, { message: 'Valor deve ser um número' })
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Data de vencimento',
    example: '2025-01-15',
  })
  @IsDateString({}, { message: 'Data de vencimento deve ser uma data válida' })
  dueDate: string;

  @ApiProperty({
    description: 'ID do fornecedor',
    required: false,
    example: 'uuid-do-fornecedor',
  })
  @IsUUID('4', { message: 'ID do fornecedor inválido' })
  @IsOptional()
  supplierId?: string;

  @ApiProperty({
    description: 'ID da categoria',
    required: false,
    example: 'uuid-da-categoria',
  })
  @IsUUID('4', { message: 'ID da categoria inválido' })
  @IsOptional()
  categoryId?: string;

  @ApiProperty({
    description: 'ID da Ordem de Serviço vinculada',
    required: false,
    example: 'uuid-da-os',
  })
  @IsUUID('4', { message: 'ID da OS inválido' })
  @IsOptional()
  workOrderId?: string;

  @ApiProperty({
    description: 'Status da despesa',
    enum: ExpenseStatus,
    default: ExpenseStatus.PENDING,
    required: false,
  })
  @IsEnum(ExpenseStatus, { message: 'Status inválido' })
  @IsOptional()
  status?: ExpenseStatus;

  @ApiProperty({
    description: 'Método de pagamento',
    enum: ExpensePaymentMethod,
    required: false,
  })
  @IsEnum(ExpensePaymentMethod, { message: 'Método de pagamento inválido' })
  @IsOptional()
  paymentMethod?: ExpensePaymentMethod;

  @ApiProperty({
    description: 'Data de pagamento (obrigatória se status=PAID)',
    required: false,
    example: '2025-01-10',
  })
  @IsDateString({}, { message: 'Data de pagamento deve ser uma data válida' })
  @IsOptional()
  paidAt?: string;

  @ApiProperty({
    description: 'Observações adicionais',
    required: false,
    example: 'Pagamento em 2x',
  })
  @IsString({ message: 'Observações deve ser um texto' })
  @IsOptional()
  @MaxLength(1000, { message: 'Observações deve ter no máximo 1000 caracteres' })
  notes?: string;

  @ApiProperty({
    description: 'Número da nota fiscal',
    required: false,
    example: 'NF-123456',
  })
  @IsString({ message: 'Número da nota fiscal deve ser um texto' })
  @IsOptional()
  @MaxLength(100, { message: 'Número da nota fiscal deve ter no máximo 100 caracteres' })
  invoiceNumber?: string;
}
