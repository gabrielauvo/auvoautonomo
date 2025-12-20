import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateChecklistSectionDto } from './create-section.dto';
import { CreateChecklistQuestionDto } from './create-question.dto';

export class CreateChecklistTemplateDto {
  @ApiProperty({
    description: 'Nome do template',
    example: 'Checklist de Manutenção Preventiva - Ar Condicionado',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Descrição do template',
    example: 'Checklist completo para manutenção preventiva de ar-condicionado Split',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Se o template está ativo',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Seções do template (criação em batch)',
    type: [CreateChecklistSectionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistSectionDto)
  @IsOptional()
  sections?: CreateChecklistSectionDto[];

  @ApiPropertyOptional({
    description: 'Perguntas do template (criação em batch)',
    type: [CreateChecklistQuestionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistQuestionDto)
  @IsOptional()
  questions?: CreateChecklistQuestionDto[];
}
