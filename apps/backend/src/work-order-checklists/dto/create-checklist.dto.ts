import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderChecklistDto {
  @ApiProperty({
    description: 'Checklist template ID to use',
    example: 'uuid-template-id',
  })
  @IsUUID()
  @IsNotEmpty()
  templateId: string;
}
