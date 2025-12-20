import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsEnum,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChecklistQuestionType } from '@prisma/client';
import {
  QuestionOption,
  QuestionValidation,
  QuestionMetadata,
  ConditionalLogic,
} from './checklist-item-type.enum';

export class QuestionOptionDto implements QuestionOption {
  @ApiProperty({ description: 'Valor da opção', example: 'option_1' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ description: 'Label exibido', example: 'Opção 1' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Ordem da opção', example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

export class CreateChecklistQuestionDto {
  @ApiProperty({
    description: 'Tipo da pergunta',
    enum: ChecklistQuestionType,
    example: ChecklistQuestionType.TEXT_SHORT,
  })
  @IsEnum(ChecklistQuestionType)
  @IsNotEmpty()
  type: ChecklistQuestionType;

  @ApiProperty({
    description: 'Título/label da pergunta',
    example: 'O filtro está limpo?',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    description: 'Descrição/instrução adicional',
    example: 'Verifique se não há sujeira visível',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Placeholder do campo',
    example: 'Digite sua resposta...',
  })
  @IsString()
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Se a pergunta é obrigatória',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Ordem da pergunta',
    example: 1,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'ID da seção (opcional)',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({
    description: 'Índice da seção na criação do template (usado quando sectionId ainda não existe)',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sectionOrder?: number;

  @ApiPropertyOptional({
    description: 'Opções para SELECT/MULTI_SELECT',
    type: [QuestionOptionDto],
    example: [
      { value: 'sim', label: 'Sim', order: 0 },
      { value: 'nao', label: 'Não', order: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @IsOptional()
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({
    description: 'Regras de validação',
    example: { min: 0, max: 100, minLength: 10 },
  })
  @IsObject()
  @IsOptional()
  validations?: QuestionValidation;

  @ApiPropertyOptional({
    description: 'Lógica condicional para mostrar/esconder',
    example: {
      rules: [
        {
          questionId: 'uuid',
          operator: 'EQUALS',
          value: 'sim',
          action: 'SHOW',
        },
      ],
      logic: 'AND',
    },
  })
  @IsObject()
  @IsOptional()
  conditionalLogic?: ConditionalLogic;

  @ApiPropertyOptional({
    description: 'Metadados específicos do tipo',
    example: { scaleMin: 1, scaleMax: 10, ratingType: 'stars' },
  })
  @IsObject()
  @IsOptional()
  metadata?: QuestionMetadata;
}

export class UpdateChecklistQuestionDto {
  @ApiPropertyOptional({
    description: 'Tipo da pergunta',
    enum: ChecklistQuestionType,
  })
  @IsEnum(ChecklistQuestionType)
  @IsOptional()
  type?: ChecklistQuestionType;

  @ApiPropertyOptional({
    description: 'Título/label da pergunta',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Descrição/instrução adicional',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Placeholder do campo',
  })
  @IsString()
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional({
    description: 'Se a pergunta é obrigatória',
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Ordem da pergunta',
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'ID da seção',
  })
  @IsString()
  @IsOptional()
  sectionId?: string;

  @ApiPropertyOptional({
    description: 'Opções para SELECT/MULTI_SELECT',
    type: [QuestionOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  @IsOptional()
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({
    description: 'Regras de validação',
  })
  @IsObject()
  @IsOptional()
  validations?: QuestionValidation;

  @ApiPropertyOptional({
    description: 'Lógica condicional',
  })
  @IsObject()
  @IsOptional()
  conditionalLogic?: ConditionalLogic;

  @ApiPropertyOptional({
    description: 'Metadados específicos do tipo',
  })
  @IsObject()
  @IsOptional()
  metadata?: QuestionMetadata;
}

export class ReorderQuestionsDto {
  @ApiProperty({
    description: 'Lista de IDs na nova ordem',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  questionIds: string[];
}
