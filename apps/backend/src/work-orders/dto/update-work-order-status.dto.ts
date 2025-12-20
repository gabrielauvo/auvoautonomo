import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum WorkOrderStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELED = 'CANCELED',
}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({
    description: 'New status for the work order',
    enum: WorkOrderStatus,
    example: WorkOrderStatus.IN_PROGRESS,
  })
  @IsEnum(WorkOrderStatus)
  @IsNotEmpty()
  status: WorkOrderStatus;
}
