import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChecklistSectionDto {
  @ApiProperty({
    description: 'Título da seção',
    example: 'Inspeção Visual',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Descrição da seção',
    example: 'Verifique os itens visuais do equipamento',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ordem da seção no template',
    example: 1,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

export class UpdateChecklistSectionDto {
  @ApiPropertyOptional({
    description: 'Título da seção',
    example: 'Inspeção Visual',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Descrição da seção',
    example: 'Verifique os itens visuais do equipamento',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ordem da seção no template',
    example: 1,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
