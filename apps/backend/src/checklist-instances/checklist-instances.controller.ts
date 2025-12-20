import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { ChecklistInstancesService } from './checklist-instances.service';
import { ChecklistAttachmentsService } from './checklist-attachments.service';
import {
  CreateChecklistInstanceDto,
  AttachChecklistsToWorkOrderDto,
  UpdateInstanceStatusDto,
  SubmitAnswerDto,
  BatchSubmitAnswersDto,
  SyncOfflineAnswersDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChecklistAttachmentType } from '@prisma/client';

@ApiTags('Checklist Instances')
@ApiBearerAuth('JWT-auth')
@Controller('checklist-instances')
@UseGuards(JwtAuthGuard)
export class ChecklistInstancesController {
  constructor(
    private readonly service: ChecklistInstancesService,
    private readonly attachmentsService: ChecklistAttachmentsService,
  ) {}

  // ============================================
  // INSTANCE ENDPOINTS
  // ============================================

  @Post()
  @ApiOperation({ summary: 'Criar nova instância de checklist para Work Order' })
  @ApiBody({ type: CreateChecklistInstanceDto })
  @ApiResponse({ status: 201, description: 'Instância criada' })
  @ApiResponse({ status: 400, description: 'Já existe instância deste template' })
  @ApiResponse({ status: 404, description: 'Work Order ou Template não encontrado' })
  create(
    @CurrentUser() user: any,
    @Body() dto: CreateChecklistInstanceDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Post('work-orders/:workOrderId/attach')
  @ApiOperation({ summary: 'Anexar múltiplos checklists a uma Work Order' })
  @ApiParam({ name: 'workOrderId', description: 'UUID da Work Order' })
  @ApiBody({ type: AttachChecklistsToWorkOrderDto })
  @ApiResponse({ status: 200, description: 'Checklists anexados' })
  @ApiResponse({ status: 404, description: 'Work Order não encontrada' })
  attachToWorkOrder(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: AttachChecklistsToWorkOrderDto,
  ) {
    return this.service.attachToWorkOrder(user.id, workOrderId, dto);
  }

  @Get('work-orders/:workOrderId')
  @ApiOperation({ summary: 'Listar checklists de uma Work Order' })
  @ApiParam({ name: 'workOrderId', description: 'UUID da Work Order' })
  @ApiResponse({ status: 200, description: 'Lista de instâncias' })
  @ApiResponse({ status: 404, description: 'Work Order não encontrada' })
  findByWorkOrder(
    @CurrentUser() user: any,
    @Param('workOrderId') workOrderId: string,
  ) {
    return this.service.findByWorkOrder(user.id, workOrderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar instância por ID' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Instância encontrada' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Get(':id/full')
  @ApiOperation({ summary: 'Buscar instância com snapshot completo e respostas' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Instância com snapshot e respostas' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  getWithSnapshot(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getInstanceWithSnapshot(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da instância' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiBody({ type: UpdateInstanceStatusDto })
  @ApiResponse({ status: 200, description: 'Status atualizado' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateInstanceStatusDto,
  ) {
    return this.service.updateStatus(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover instância de checklist' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Instância removida' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  // ============================================
  // ANSWER ENDPOINTS
  // ============================================

  @Post(':id/answers')
  @ApiOperation({ summary: 'Submeter resposta para uma pergunta' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiBody({ type: SubmitAnswerDto })
  @ApiResponse({ status: 200, description: 'Resposta submetida' })
  @ApiResponse({ status: 400, description: 'Checklist já finalizado ou pergunta inválida' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  submitAnswer(
    @CurrentUser() user: any,
    @Param('id') instanceId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.service.submitAnswer(user.id, instanceId, dto);
  }

  @Post(':id/answers/batch')
  @ApiOperation({ summary: 'Submeter múltiplas respostas de uma vez' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiBody({ type: BatchSubmitAnswersDto })
  @ApiResponse({ status: 200, description: 'Respostas submetidas' })
  @ApiResponse({ status: 400, description: 'Checklist já finalizado' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  submitBatchAnswers(
    @CurrentUser() user: any,
    @Param('id') instanceId: string,
    @Body() dto: BatchSubmitAnswersDto,
  ) {
    return this.service.submitBatchAnswers(user.id, instanceId, dto);
  }

  @Get(':id/answers')
  @ApiOperation({ summary: 'Listar respostas da instância' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Lista de respostas' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  getAnswers(@CurrentUser() user: any, @Param('id') instanceId: string) {
    return this.service.getAnswers(user.id, instanceId);
  }

  // ============================================
  // ATTACHMENT ENDPOINTS
  // ============================================

  @Post('answers/:answerId/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de anexo para uma resposta' })
  @ApiParam({ name: 'answerId', description: 'UUID da resposta' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['PHOTO', 'SIGNATURE', 'FILE'] },
      },
      required: ['file', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Anexo enviado' })
  @ApiResponse({ status: 400, description: 'Arquivo inválido' })
  @ApiResponse({ status: 404, description: 'Resposta não encontrada' })
  uploadAttachment(
    @CurrentUser() user: any,
    @Param('answerId') answerId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: ChecklistAttachmentType,
  ) {
    return this.attachmentsService.uploadAttachment(
      user.id,
      answerId,
      file as any,
      type || ChecklistAttachmentType.PHOTO,
    );
  }

  @Post('answers/:answerId/attachments/base64')
  @ApiOperation({ summary: 'Upload de anexo em base64 (para assinaturas)' })
  @ApiParam({ name: 'answerId', description: 'UUID da resposta' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Dados em base64' },
        type: { type: 'string', enum: ['PHOTO', 'SIGNATURE', 'FILE'] },
        fileName: { type: 'string' },
      },
      required: ['data', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'Anexo enviado' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 404, description: 'Resposta não encontrada' })
  uploadBase64Attachment(
    @CurrentUser() user: any,
    @Param('answerId') answerId: string,
    @Body('data') data: string,
    @Body('type') type: ChecklistAttachmentType,
    @Body('fileName') fileName?: string,
  ) {
    return this.attachmentsService.uploadFromBase64(
      user.id,
      answerId,
      data,
      type,
      fileName,
    );
  }

  @Get('answers/:answerId/attachments')
  @ApiOperation({ summary: 'Listar anexos de uma resposta' })
  @ApiParam({ name: 'answerId', description: 'UUID da resposta' })
  @ApiResponse({ status: 200, description: 'Lista de anexos' })
  @ApiResponse({ status: 404, description: 'Resposta não encontrada' })
  getAttachments(
    @CurrentUser() user: any,
    @Param('answerId') answerId: string,
  ) {
    return this.attachmentsService.getAttachments(user.id, answerId);
  }

  @Get(':id/attachments')
  @ApiOperation({ summary: 'Listar todos os anexos de uma instância' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Lista de anexos' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  getInstanceAttachments(
    @CurrentUser() user: any,
    @Param('id') instanceId: string,
  ) {
    return this.attachmentsService.getAttachmentsByInstance(user.id, instanceId);
  }

  @Get('attachments/:attachmentId/download')
  @ApiOperation({ summary: 'Download de anexo' })
  @ApiParam({ name: 'attachmentId', description: 'UUID do anexo' })
  @ApiQuery({ name: 'thumbnail', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Arquivo' })
  @ApiResponse({ status: 404, description: 'Anexo não encontrado' })
  async downloadAttachment(
    @CurrentUser() user: any,
    @Param('attachmentId') attachmentId: string,
    @Query('thumbnail') thumbnail: string,
    @Res() res: Response,
  ) {
    const { buffer, mimeType, fileName } =
      await this.attachmentsService.getAttachmentBuffer(
        user.id,
        attachmentId,
        thumbnail === 'true',
      );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Delete('attachments/:attachmentId')
  @ApiOperation({ summary: 'Excluir anexo' })
  @ApiParam({ name: 'attachmentId', description: 'UUID do anexo' })
  @ApiResponse({ status: 200, description: 'Anexo excluído' })
  @ApiResponse({ status: 404, description: 'Anexo não encontrado' })
  deleteAttachment(
    @CurrentUser() user: any,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentsService.deleteAttachment(user.id, attachmentId);
  }

  // ============================================
  // SYNC & VALIDATION ENDPOINTS
  // ============================================

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar respostas offline' })
  @ApiBody({ type: SyncOfflineAnswersDto })
  @ApiResponse({ status: 200, description: 'Respostas sincronizadas' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  syncOffline(
    @CurrentUser() user: any,
    @Body() dto: SyncOfflineAnswersDto,
  ) {
    return this.service.syncOfflineAnswers(user.id, dto);
  }

  @Get(':id/sync/pending')
  @ApiOperation({ summary: 'Listar anexos pendentes de sincronização' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Anexos pendentes' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  getPendingSync(
    @CurrentUser() user: any,
    @Param('id') instanceId: string,
  ) {
    return this.attachmentsService.syncPendingAttachments(user.id, instanceId);
  }

  @Patch('attachments/:attachmentId/synced')
  @ApiOperation({ summary: 'Marcar anexo como sincronizado' })
  @ApiParam({ name: 'attachmentId', description: 'UUID do anexo' })
  @ApiResponse({ status: 200, description: 'Anexo marcado como sincronizado' })
  @ApiResponse({ status: 404, description: 'Anexo não encontrado' })
  markAsSynced(
    @CurrentUser() user: any,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachmentsService.markAsSynced(user.id, attachmentId);
  }

  @Get(':id/validate')
  @ApiOperation({ summary: 'Validar respostas da instância' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Resultado da validação' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  validate(@CurrentUser() user: any, @Param('id') instanceId: string) {
    return this.service.validateAnswers(user.id, instanceId);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Finalizar checklist (validação automática)' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Checklist finalizado' })
  @ApiResponse({ status: 400, description: 'Perguntas obrigatórias não respondidas' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  complete(@CurrentUser() user: any, @Param('id') instanceId: string) {
    return this.service.completeChecklist(user.id, instanceId);
  }

  @Post(':id/reopen')
  @ApiOperation({ summary: 'Reabrir checklist finalizado para edição' })
  @ApiParam({ name: 'id', description: 'UUID da instância' })
  @ApiResponse({ status: 200, description: 'Checklist reaberto' })
  @ApiResponse({ status: 400, description: 'Checklist não está finalizado ou OS não está em andamento' })
  @ApiResponse({ status: 404, description: 'Instância não encontrada' })
  reopen(@CurrentUser() user: any, @Param('id') instanceId: string) {
    return this.service.reopenChecklist(user.id, instanceId);
  }
}
