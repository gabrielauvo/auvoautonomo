import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsBoolean,
  IsOptional,
  IsObject,
  IsArray,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ChecklistItemType, ItemCondition } from './checklist-item-type.enum';

export class CreateChecklistTemplateItemDto {
  @ApiProperty({
    description: 'Item order in the template',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  order: number;

  @ApiProperty({
    description: 'Question label',
    example: 'O filtro está limpo?',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'Item type',
    enum: ChecklistItemType,
    example: ChecklistItemType.BOOLEAN,
  })
  @IsEnum(ChecklistItemType)
  @IsNotEmpty()
  type: ChecklistItemType;

  @ApiProperty({
    description: 'Options for SELECT type (required if type is SELECT)',
    example: ['Sim', 'Não', 'Não aplicável'],
    required: false,
    type: [String],
  })
  @ValidateIf((o) => o.type === ChecklistItemType.SELECT)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @ApiProperty({
    description: 'Whether this item is required',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiProperty({
    description: 'Conditional logic for displaying this item',
    example: {
      dependsOnItemId: 'item-uuid',
      operator: 'EQUALS',
      value: true,
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  condition?: ItemCondition;
}
