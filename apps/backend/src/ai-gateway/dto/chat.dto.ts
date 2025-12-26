/**
 * AI Gateway DTOs
 */

import { IsString, IsOptional, IsUUID, MaxLength, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatRequestDto {
  @ApiPropertyOptional({
    description: 'ID da conversa existente. Se não fornecido, uma nova conversa será criada.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  conversationId?: string;

  @ApiProperty({
    description: 'Mensagem do usuário para o AI Copilot',
    example: 'Liste meus clientes com pagamentos pendentes',
    maxLength: 4000,
  })
  @IsString()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional({
    description: 'Contexto adicional fornecido pelo cliente',
    example: { currentPage: 'dashboard', selectedClientId: '123' },
  })
  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}

export class ConfirmPlanDto {
  @ApiProperty({
    description: 'ID do plano a ser confirmado',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  planId: string;
}

export class RejectPlanDto {
  @ApiProperty({
    description: 'ID do plano a ser rejeitado',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  planId: string;
}

export class GetConversationDto {
  @ApiProperty({
    description: 'ID da conversa',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  conversationId: string;
}

// Response DTOs (for documentation)

export class PlanActionResponseDto {
  @ApiProperty({ example: 'action_123' })
  id: string;

  @ApiProperty({ example: 'Criar cliente "João Silva"' })
  description: string;

  @ApiProperty({ example: 'CREATE' })
  type: string;

  @ApiProperty({ example: true })
  requiresConfirmation: boolean;
}

export class PlanResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Criar novo cliente e gerar cobrança' })
  summary: string;

  @ApiProperty({ type: [PlanActionResponseDto] })
  actions: PlanActionResponseDto[];

  @ApiProperty({ example: false })
  hasPaymentActions: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  expiresAt: Date;
}

export class TokenUsageDto {
  @ApiProperty({ example: 150 })
  input: number;

  @ApiProperty({ example: 100 })
  output: number;

  @ApiProperty({ example: 250 })
  total: number;
}

export class ChatResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  conversationId: string;

  @ApiProperty({ example: 'Encontrei 5 clientes com pagamentos pendentes.' })
  message: string;

  @ApiPropertyOptional({ type: PlanResponseDto })
  plan?: PlanResponseDto;

  @ApiPropertyOptional({
    description: 'Dados retornados por operações de leitura',
    example: { clients: [{ id: '123', name: 'João' }] },
  })
  data?: unknown;

  @ApiPropertyOptional({ type: TokenUsageDto })
  tokenUsage?: TokenUsageDto;
}

export class PlanExecutionResultDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  planId: string;

  @ApiProperty({ example: 'COMPLETED', enum: ['COMPLETED', 'FAILED'] })
  status: string;

  @ApiProperty({
    example: [
      { actionId: 'action_1', success: true, result: { id: '123' } },
      { actionId: 'action_2', success: false, error: 'Client not found' },
    ],
  })
  results: Array<{
    actionId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}

export class ConversationSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: 'Gerenciamento de clientes' })
  title?: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'COMPLETED', 'EXPIRED'] })
  status: string;

  @ApiProperty({ example: 15 })
  messageCount: number;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  lastMessageAt?: Date;

  @ApiProperty({ example: '2024-01-15T09:00:00.000Z' })
  createdAt: Date;
}
