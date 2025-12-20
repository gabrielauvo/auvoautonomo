import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsCpfCnpj } from '../../common/validators';

export class CreateClientDto {
  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João Silva',
  })
  @IsString({ message: 'Nome deve ser um texto' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @ApiProperty({
    description: 'Email do cliente',
    example: 'joao@example.com',
    required: false,
  })
  @IsEmail({}, { message: 'Email inválido' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Telefone do cliente (formato brasileiro)',
    example: '(11) 99999-9999',
  })
  @IsString({ message: 'Telefone deve ser um texto' })
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^[\d\s()+-]+$/, { message: 'Telefone deve conter apenas números, espaços e caracteres válidos como (), + e -' })
  phone: string;

  @ApiProperty({
    description: 'Endereço do cliente',
    example: 'Rua das Flores, 123',
    required: false,
  })
  @IsString({ message: 'Endereço deve ser um texto' })
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Cidade',
    example: 'São Paulo',
    required: false,
  })
  @IsString({ message: 'Cidade deve ser um texto' })
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Estado (UF)',
    example: 'SP',
    required: false,
  })
  @IsString({ message: 'Estado deve ser um texto' })
  @IsOptional()
  state?: string;

  @ApiProperty({
    description: 'CEP',
    example: '01234-567',
    required: false,
  })
  @IsString({ message: 'CEP deve ser um texto' })
  @IsOptional()
  zipCode?: string;

  @ApiProperty({
    description: 'CPF ou CNPJ (apenas números ou formatado)',
    example: '12345678900 ou 12345678000190',
  })
  @IsString({ message: 'CPF/CNPJ deve ser um texto' })
  @IsNotEmpty({ message: 'CPF/CNPJ é obrigatório' })
  @IsCpfCnpj({ message: 'CPF ou CNPJ inválido' })
  taxId: string;

  @ApiProperty({
    description: 'Observações sobre o cliente',
    example: 'Cliente VIP, prefere atendimento pela manhã',
    required: false,
  })
  @IsString({ message: 'Observações deve ser um texto' })
  @IsOptional()
  notes?: string;
}
