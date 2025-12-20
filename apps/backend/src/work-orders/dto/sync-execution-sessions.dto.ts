import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ExecutionSessionTypeDto {
  WORK = 'WORK',
  PAUSE = 'PAUSE',
}

export class SyncExecutionSessionDto {
  @ApiProperty({ description: 'ID local da sessão (para idempotência)' })
  @IsString()
  @IsNotEmpty()
  localId: string;

  @ApiProperty({ description: 'ID da Work Order' })
  @IsString()
  @IsNotEmpty()
  workOrderId: string;

  @ApiProperty({ description: 'Tipo da sessão', enum: ExecutionSessionTypeDto })
  @IsEnum(ExecutionSessionTypeDto)
  sessionType: ExecutionSessionTypeDto;

  @ApiProperty({ description: 'Data/hora de início' })
  @IsDateString()
  startedAt: string;

  @ApiPropertyOptional({ description: 'Data/hora de fim' })
  @IsDateString()
  @IsOptional()
  endedAt?: string;

  @ApiPropertyOptional({ description: 'Duração em segundos' })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({ description: 'Motivo da pausa (quando sessionType = PAUSE)' })
  @IsString()
  @IsOptional()
  pauseReason?: string;

  @ApiPropertyOptional({ description: 'Notas adicionais' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SyncExecutionSessionsRequestDto {
  @ApiProperty({
    description: 'ID da Work Order',
  })
  @IsString()
  @IsNotEmpty()
  workOrderId: string;

  @ApiProperty({
    description: 'Lista de sessões para sincronizar',
    type: [SyncExecutionSessionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncExecutionSessionDto)
  sessions: SyncExecutionSessionDto[];
}

export class SyncExecutionSessionResultDto {
  localId: string;
  serverId?: string;
  status: 'created' | 'updated' | 'exists' | 'error';
  error?: string;
}

export class SyncExecutionSessionsResponseDto {
  results: SyncExecutionSessionResultDto[];
  serverTime: string;
}
