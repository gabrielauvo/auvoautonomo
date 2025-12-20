import {
  IsUUID,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ChecklistItemType } from '../../checklist-templates/dto/checklist-item-type.enum';

export class AnswerDto {
  @ApiProperty({
    description: 'Template item ID being answered',
    example: 'uuid-item-id',
  })
  @IsUUID()
  @IsNotEmpty()
  templateItemId: string;

  @ApiProperty({
    description: 'Answer type (must match item type)',
    enum: ChecklistItemType,
    example: ChecklistItemType.BOOLEAN,
  })
  @IsEnum(ChecklistItemType)
  @IsNotEmpty()
  type: ChecklistItemType;

  @ApiProperty({
    description: 'Text answer (if type is TEXT)',
    example: 'Filtro substituído com sucesso',
    required: false,
  })
  @IsString()
  @IsOptional()
  valueText?: string;

  @ApiProperty({
    description: 'Numeric answer (if type is NUMERIC)',
    example: 220.5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  valueNumber?: number;

  @ApiProperty({
    description: 'Boolean answer (if type is BOOLEAN)',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  valueBoolean?: boolean;

  @ApiProperty({
    description: 'Photo URL (if type is PHOTO)',
    example: 'https://example.com/photo.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  valuePhoto?: string;

  @ApiProperty({
    description: 'Selected option (if type is SELECT)',
    example: 'Sim',
    required: false,
  })
  @IsString()
  @IsOptional()
  valueSelect?: string;
}

export class SubmitAnswersDto {
  @ApiProperty({
    description: 'Array of answers',
    type: [AnswerDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
