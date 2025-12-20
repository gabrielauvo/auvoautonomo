import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkOrderItemDto {
  @ApiProperty({
    description: 'New quantity',
    example: 3,
    minimum: 0.001,
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: 'Quantity must be greater than 0' })
  quantity: number;
}
