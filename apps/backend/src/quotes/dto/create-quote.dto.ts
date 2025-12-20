import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuoteItemDto {
  @ApiProperty({
    description: 'ID do item do catálogo (opcional para itens manuais)',
    example: 'uuid-item-id',
    required: false,
  })
  @IsUUID('4', { message: 'ID do item inválido' })
  @IsOptional()
  itemId?: string;

  @ApiProperty({
    description: 'Nome do item (obrigatório para itens manuais)',
    example: 'Mão de obra adicional',
    required: false,
  })
  @IsString({ message: 'Nome deve ser um texto' })
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Tipo do item (obrigatório para itens manuais)',
    example: 'SERVICE',
    enum: ['PRODUCT', 'SERVICE', 'BUNDLE'],
    required: false,
  })
  @IsString({ message: 'Tipo deve ser um texto' })
  @IsOptional()
  type?: 'PRODUCT' | 'SERVICE' | 'BUNDLE';

  @ApiProperty({
    description: 'Unidade (obrigatório para itens manuais)',
    example: 'un',
    required: false,
  })
  @IsString({ message: 'Unidade deve ser um texto' })
  @IsOptional()
  unit?: string;

  @ApiProperty({
    description: 'Preço unitário (obrigatório para itens manuais)',
    example: 150.0,
    required: false,
  })
  @IsNumber({}, { message: 'Preço unitário deve ser um número' })
  @IsOptional()
  @Min(0, { message: 'Preço unitário não pode ser negativo' })
  unitPrice?: number;

  @ApiProperty({
    description: 'Quantidade do item',
    example: 2.5,
    minimum: 0.001,
  })
  @IsNumber({}, { message: 'Quantidade deve ser um número' })
  @Min(0.001, { message: 'Quantidade deve ser maior que 0' })
  quantity: number;
}

export class CreateQuoteDto {
  @ApiProperty({
    description: 'ID do cliente',
    example: 'uuid-client-id',
  })
  @IsUUID('4', { message: 'ID do cliente inválido' })
  @IsNotEmpty({ message: 'Cliente é obrigatório' })
  clientId: string;

  @ApiProperty({
    description: 'Lista de itens do orçamento',
    type: [CreateQuoteItemDto],
    example: [
      { itemId: 'uuid-item-1', quantity: 2 },
      { itemId: 'uuid-item-2', quantity: 1.5 },
    ],
  })
  @IsArray({ message: 'Itens deve ser uma lista' })
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];

  @ApiProperty({
    description: 'Valor de desconto a aplicar',
    example: 50.0,
    minimum: 0,
    required: false,
    default: 0,
  })
  @IsNumber({}, { message: 'Desconto deve ser um número' })
  @IsOptional()
  @Min(0, { message: 'Desconto não pode ser negativo' })
  discountValue?: number;

  @ApiProperty({
    description: 'Observações do orçamento',
    example: 'Cliente solicitou desconto especial',
    required: false,
  })
  @IsString({ message: 'Observações deve ser um texto' })
  @IsOptional()
  notes?: string;
}
