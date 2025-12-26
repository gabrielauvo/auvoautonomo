/**
 * AI Gateway Controller
 * REST API endpoints for AI Copilot
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AiGatewayService } from './services/ai-gateway.service';
import {
  ChatRequestDto,
  ChatResponseDto,
  ConfirmPlanDto,
  RejectPlanDto,
  PlanExecutionResultDto,
  ConversationSummaryDto,
} from './dto/chat.dto';

interface AuthUser {
  id: string;
  email: string;
}

@ApiTags('AI Copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiGatewayController {
  constructor(private readonly aiGatewayService: AiGatewayService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar mensagem para o AI Copilot',
    description:
      'Envia uma mensagem para o AI Copilot e recebe uma resposta. Para operações de escrita, um plano de confirmação é retornado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resposta do AI Copilot',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Rate limit excedido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  async chat(
    @GetUser() user: AuthUser,
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
  ): Promise<any> {
    return this.aiGatewayService.chat(user.id, dto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('plans/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar um plano de ação',
    description:
      'Confirma e executa um plano de ação pendente. O plano deve estar no status PENDING_CONFIRMATION e não pode estar expirado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado da execução do plano',
    type: PlanExecutionResultDto,
  })
  @ApiResponse({ status: 400, description: 'Plano expirado' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async confirmPlan(
    @GetUser() user: AuthUser,
    @Body() dto: ConfirmPlanDto,
    @Req() req: Request,
  ): Promise<PlanExecutionResultDto> {
    return this.aiGatewayService.confirmPlan(user.id, dto.planId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('plans/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rejeitar um plano de ação',
    description: 'Rejeita um plano de ação pendente. O plano não será executado.',
  })
  @ApiResponse({ status: 200, description: 'Plano rejeitado com sucesso' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  async rejectPlan(
    @GetUser() user: AuthUser,
    @Body() dto: RejectPlanDto,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    await this.aiGatewayService.rejectPlan(user.id, dto.planId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true };
  }

  @Get('plans/pending')
  @ApiOperation({
    summary: 'Listar planos pendentes',
    description: 'Retorna todos os planos de ação pendentes de confirmação do usuário.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de planos pendentes',
  })
  async getPendingPlans(@GetUser() user: AuthUser) {
    return this.aiGatewayService.getPendingPlans(user.id);
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Listar conversas recentes',
    description: 'Retorna as conversas mais recentes do usuário.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número máximo de conversas (padrão: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de conversas',
    type: [ConversationSummaryDto],
  })
  async getConversations(
    @GetUser() user: AuthUser,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    return this.aiGatewayService.getRecentConversations(user.id, limit || 10);
  }

  @Get('conversations/:conversationId')
  @ApiOperation({
    summary: 'Obter conversa com mensagens',
    description: 'Retorna uma conversa específica com todas as suas mensagens.',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'ID da conversa',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversa com mensagens',
  })
  @ApiResponse({ status: 404, description: 'Conversa não encontrada' })
  async getConversation(
    @GetUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiGatewayService.getConversation(user.id, conversationId);
  }
}
