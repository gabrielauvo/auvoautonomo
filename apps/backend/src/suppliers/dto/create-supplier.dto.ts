import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsCpfCnpj } from '../../common/validators';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Nome do fornecedor',
    example: 'Fornecedor ABC Ltda',
  })
  @IsString({ message: 'Nome deve ser um texto' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @ApiProperty({
    description: 'CPF ou CNPJ do fornecedor',
    example: '12345678000190',
    required: false,
  })
  @IsString({ message: 'CPF/CNPJ deve ser um texto' })
  @IsOptional()
  @IsCpfCnpj({ message: 'CPF ou CNPJ inválido' })
  document?: string;

  @ApiProperty({
    description: 'Email do fornecedor',
    example: 'contato@fornecedor.com',
    required: false,
  })
  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Telefone do fornecedor',
    example: '(11) 99999-9999',
    required: false,
  })
  @IsString({ message: 'Telefone deve ser um texto' })
  @IsOptional()
  @Matches(/^[\d\s()+-]*$/, { message: 'Telefone deve conter apenas números, espaços e caracteres válidos como (), + e -' })
  phone?: string;

  @ApiProperty({
    description: 'Endereço do fornecedor',
    example: 'Rua das Indústrias, 500',
    required: false,
  })
  @IsString({ message: 'Endereço deve ser um texto' })
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Observações sobre o fornecedor',
    example: 'Entrega apenas nas terças e quintas',
    required: false,
  })
  @IsString({ message: 'Observações deve ser um texto' })
  @IsOptional()
  notes?: string;
}
