import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChecklistQuestionType, ChecklistInstanceStatus } from '@prisma/client';

export class CreateChecklistInstanceDto {
  @ApiProperty({
    description: 'ID da Work Order',
  })
  @IsString()
  @IsNotEmpty()
  workOrderId: string;

  @ApiProperty({
    description: 'ID do template de checklist',
  })
  @IsString()
  @IsNotEmpty()
  templateId: string;
}

export class AttachChecklistsToWorkOrderDto {
  @ApiProperty({
    description: 'IDs dos templates para anexar',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  templateIds: string[];
}

export class UpdateInstanceStatusDto {
  @ApiProperty({
    description: 'Novo status da instância',
    enum: ChecklistInstanceStatus,
  })
  @IsEnum(ChecklistInstanceStatus)
  @IsNotEmpty()
  status: ChecklistInstanceStatus;
}

// DTO for attachment in sync payload
export class SyncAttachmentDto {
  @ApiProperty({
    description: 'Dados em base64 (pode incluir prefixo data:...)',
  })
  @IsString()
  @IsNotEmpty()
  data: string;

  @ApiPropertyOptional({
    description: 'Tipo do anexo: PHOTO, SIGNATURE, DOCUMENT',
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Nome do arquivo',
  })
  @IsString()
  @IsOptional()
  fileName?: string;
}

// DTO for submitting a single answer
export class SubmitAnswerDto {
  @ApiProperty({
    description: 'ID da pergunta',
  })
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    description: 'Tipo da pergunta (deve corresponder ao template)',
    enum: ChecklistQuestionType,
  })
  @IsEnum(ChecklistQuestionType)
  @IsNotEmpty()
  type: ChecklistQuestionType;

  @ApiPropertyOptional({
    description: 'Valor texto para TEXT_SHORT, TEXT_LONG',
  })
  @IsString()
  @IsOptional()
  valueText?: string;

  @ApiPropertyOptional({
    description: 'Valor numérico para NUMBER, RATING, SCALE',
  })
  @IsNumber()
  @IsOptional()
  valueNumber?: number;

  @ApiPropertyOptional({
    description: 'Valor booleano para CHECKBOX',
  })
  @IsBoolean()
  @IsOptional()
  valueBoolean?: boolean;

  @ApiPropertyOptional({
    description: 'Valor data para DATE, TIME, DATETIME',
  })
  @IsDateString()
  @IsOptional()
  valueDate?: string;

  @ApiPropertyOptional({
    description: 'Valor JSON para SELECT, MULTI_SELECT, etc',
  })
  @IsOptional()
  valueJson?: any;

  @ApiPropertyOptional({
    description: 'ID local para sincronização offline',
  })
  @IsString()
  @IsOptional()
  localId?: string;

  @ApiPropertyOptional({
    description: 'Informações do dispositivo',
  })
  @IsString()
  @IsOptional()
  deviceInfo?: string;

  @ApiPropertyOptional({
    description: 'Anexos em base64 (fotos, assinaturas)',
    type: [SyncAttachmentDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncAttachmentDto)
  @IsOptional()
  attachments?: SyncAttachmentDto[];
}

// DTO for batch answer submission
export class BatchSubmitAnswersDto {
  @ApiProperty({
    description: 'Lista de respostas para submeter',
    type: [SubmitAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];

  @ApiPropertyOptional({
    description: 'Informações do dispositivo (aplica a todas)',
  })
  @IsString()
  @IsOptional()
  deviceInfo?: string;
}

// DTO for syncing offline answers
export class SyncOfflineAnswersDto {
  @ApiProperty({
    description: 'ID da instância',
  })
  @IsString()
  @IsNotEmpty()
  instanceId: string;

  @ApiProperty({
    description: 'Respostas offline para sincronizar',
    type: [SubmitAnswerDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];

  @ApiPropertyOptional({
    description: 'Timestamp de quando os dados foram coletados offline',
  })
  @IsDateString()
  @IsOptional()
  collectedAt?: string;

  @ApiPropertyOptional({
    description: 'Informações do dispositivo',
  })
  @IsString()
  @IsOptional()
  deviceInfo?: string;

  // Campos opcionais para criar instância automaticamente se não existir
  @ApiPropertyOptional({
    description: 'ID da Work Order (para criar instância automaticamente)',
  })
  @IsString()
  @IsOptional()
  workOrderId?: string;

  @ApiPropertyOptional({
    description: 'ID do template (para criar instância automaticamente)',
  })
  @IsString()
  @IsOptional()
  templateId?: string;
}
