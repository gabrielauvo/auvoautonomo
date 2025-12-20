import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuoteItemDto {
  @ApiProperty({
    description: 'New quantity for the item',
    example: 5.0,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001, { message: 'Quantity must be greater than 0' })
  quantity: number;
}
