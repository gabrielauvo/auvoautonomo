import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsISO8601,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderDto {
  @ApiProperty({
    description: 'ID do cliente',
    example: 'uuid-client-id',
  })
  @IsUUID('4', { message: 'ID do cliente inválido' })
  @IsNotEmpty({ message: 'Cliente é obrigatório' })
  clientId: string;

  @ApiProperty({
    description: 'ID do orçamento (opcional, se OS veio de um orçamento aprovado)',
    example: 'uuid-quote-id',
    required: false,
  })
  @IsUUID('4', { message: 'ID do orçamento inválido' })
  @IsOptional()
  quoteId?: string;

  @ApiProperty({
    description: 'Título da ordem de serviço',
    example: 'Manutenção ar-condicionado sala 3',
  })
  @IsString({ message: 'Título deve ser um texto' })
  @IsNotEmpty({ message: 'Título é obrigatório' })
  title: string;

  @ApiProperty({
    description: 'Descrição detalhada do serviço',
    example: 'Limpeza completa do ar-condicionado, troca de filtros e verificação de gás',
    required: false,
  })
  @IsString({ message: 'Descrição deve ser um texto' })
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Data agendada (ISO 8601)',
    example: '2025-12-15',
    required: false,
  })
  @IsISO8601({}, { message: 'Data agendada deve estar no formato válido' })
  @IsOptional()
  scheduledDate?: string;

  @ApiProperty({
    description: 'Horário de início agendado (ISO 8601)',
    example: '2025-12-15T08:00:00Z',
    required: false,
  })
  @IsISO8601({}, { message: 'Horário de início deve estar no formato válido' })
  @IsOptional()
  scheduledStartTime?: string;

  @ApiProperty({
    description: 'Horário de término agendado (ISO 8601)',
    example: '2025-12-15T12:00:00Z',
    required: false,
  })
  @IsISO8601({}, { message: 'Horário de término deve estar no formato válido' })
  @IsOptional()
  scheduledEndTime?: string;

  @ApiProperty({
    description: 'Endereço do serviço (se diferente do endereço do cliente)',
    example: 'Rua Exemplo, 123 - Sala 301 - São Paulo/SP',
    required: false,
  })
  @IsString({ message: 'Endereço deve ser um texto' })
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Observações gerais',
    example: 'Cliente solicitou visita pela manhã',
    required: false,
  })
  @IsString({ message: 'Observações deve ser um texto' })
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'IDs dos equipamentos vinculados',
    example: ['uuid-equipment-1', 'uuid-equipment-2'],
    required: false,
    type: [String],
  })
  @IsArray({ message: 'Equipamentos deve ser uma lista' })
  @IsUUID('4', { each: true, message: 'ID do equipamento inválido' })
  @IsOptional()
  equipmentIds?: string[];

  @ApiProperty({
    description: 'ID do template de checklist para vincular à OS',
    example: 'uuid-checklist-template-id',
    required: false,
  })
  @IsUUID('4', { message: 'ID do template de checklist inválido' })
  @IsOptional()
  checklistTemplateId?: string;
}
