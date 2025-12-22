import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateWorkOrderTypeDto {
  @ApiProperty({
    description: 'Nome do tipo de ordem de serviço',
    example: 'Manutenção Preventiva',
    maxLength: 100,
  })
  @IsString({ message: 'Nome deve ser um texto' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Descrição do tipo de ordem de serviço',
    example: 'Manutenção preventiva programada para equipamentos',
    required: false,
    maxLength: 500,
  })
  @IsString({ message: 'Descrição deve ser um texto' })
  @IsOptional()
  @MaxLength(500, { message: 'Descrição deve ter no máximo 500 caracteres' })
  description?: string;

  @ApiProperty({
    description: 'Cor em formato hexadecimal para identificação visual',
    example: '#7C3AED',
    required: false,
  })
  @IsString({ message: 'Cor deve ser um texto' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Cor deve estar no formato hexadecimal (#RRGGBB)',
  })
  color?: string;
}
