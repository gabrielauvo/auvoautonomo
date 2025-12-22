import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseCategoryDto {
  @ApiProperty({
    description: 'Nome da categoria de despesa',
    example: 'Materiais',
  })
  @IsString({ message: 'Nome deve ser um texto' })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({
    description: 'Cor da categoria em formato hexadecimal',
    example: '#FF5733',
    required: false,
  })
  @IsString({ message: 'Cor deve ser um texto' })
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Cor deve estar em formato hexadecimal válido (ex: #FF5733)',
  })
  color?: string;
}
