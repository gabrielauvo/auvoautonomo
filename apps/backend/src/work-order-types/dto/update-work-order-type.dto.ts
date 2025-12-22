import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkOrderTypeDto } from './create-work-order-type.dto';

export class UpdateWorkOrderTypeDto extends PartialType(
  CreateWorkOrderTypeDto,
) {
  @ApiProperty({
    description: 'Indica se o tipo está ativo',
    example: true,
    required: false,
  })
  @IsBoolean({ message: 'isActive deve ser um valor booleano' })
  @IsOptional()
  isActive?: boolean;
}
