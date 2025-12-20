import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuoteDto {
  @ApiProperty({
    description: 'Discount value to apply to the quote',
    example: 75.0,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Discount cannot be negative' })
  discountValue?: number;

  @ApiProperty({
    description: 'Additional notes for the quote',
    example: 'Desconto aprovado pela gerência',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
