import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ScheduleActivityType = 'WORK_ORDER' | 'QUOTE_VISIT';
export type ScheduleActivityStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELED'
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export class ScheduleActivityClientDto {
  @ApiProperty({ description: 'ID do cliente' })
  id: string;

  @ApiProperty({ description: 'Nome do cliente' })
  name: string;

  @ApiPropertyOptional({ description: 'Telefone do cliente' })
  phone?: string;
}

export class ScheduleActivityDto {
  @ApiProperty({ description: 'ID único da atividade (workOrderId ou quoteId)' })
  id: string;

  @ApiProperty({
    description: 'Tipo da atividade',
    enum: ['WORK_ORDER', 'QUOTE_VISIT'],
    example: 'WORK_ORDER',
  })
  type: ScheduleActivityType;

  @ApiProperty({ description: 'Título/descrição curta da atividade' })
  title: string;

  @ApiProperty({ description: 'Status da atividade' })
  status: ScheduleActivityStatus;

  @ApiProperty({ description: 'Data/hora de início agendada' })
  scheduledStart: Date;

  @ApiPropertyOptional({ description: 'Data/hora de término agendada' })
  scheduledEnd?: Date;

  @ApiProperty({ description: 'Dados do cliente' })
  client: ScheduleActivityClientDto;

  @ApiPropertyOptional({ description: 'Endereço da atividade' })
  address?: string;

  @ApiPropertyOptional({ description: 'Valor total da atividade' })
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Duração em minutos' })
  durationMinutes?: number;
}

export class ScheduleDayResponseDto {
  @ApiProperty({ description: 'Data consultada no formato YYYY-MM-DD' })
  date: string;

  @ApiProperty({
    description: 'Lista de atividades do dia',
    type: [ScheduleActivityDto],
  })
  activities: ScheduleActivityDto[];

  @ApiProperty({ description: 'Total de atividades no dia' })
  totalCount: number;

  @ApiProperty({ description: 'Total de Work Orders no dia' })
  workOrdersCount: number;

  @ApiProperty({ description: 'Total de visitas de orçamento no dia' })
  quoteVisitsCount: number;
}
