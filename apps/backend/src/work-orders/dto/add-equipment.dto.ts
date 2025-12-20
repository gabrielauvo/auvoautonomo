import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddEquipmentDto {
  @ApiProperty({
    description: 'Equipment ID to link to the work order',
    example: 'uuid-equipment-id',
  })
  @IsUUID()
  @IsNotEmpty()
  equipmentId: string;
}
