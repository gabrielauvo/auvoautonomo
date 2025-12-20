import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChecklistTemplatesService } from './checklist-templates.service';
import { CreateChecklistTemplateDto } from './dto/create-template.dto';
import { UpdateChecklistTemplateDto } from './dto/update-template.dto';
import {
  CreateChecklistSectionDto,
  UpdateChecklistSectionDto,
} from './dto/create-section.dto';
import {
  CreateChecklistQuestionDto,
  UpdateChecklistQuestionDto,
  ReorderQuestionsDto,
} from './dto/create-question.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Checklist Templates')
@ApiBearerAuth('JWT-auth')
@Controller('checklist-templates')
@UseGuards(JwtAuthGuard)
export class ChecklistTemplatesController {
  constructor(private readonly service: ChecklistTemplatesService) {}

  // ============================================
  // TEMPLATE ENDPOINTS
  // ============================================

  @Post()
  @ApiOperation({ summary: 'Criar novo template de checklist' })
  @ApiBody({ type: CreateChecklistTemplateDto })
  @ApiResponse({ status: 201, description: 'Template criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  create(@CurrentUser() user: any, @Body() dto: CreateChecklistTemplateDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os templates do usuário' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Incluir templates inativos',
  })
  @ApiQuery({
    name: 'includeDetails',
    required: false,
    type: Boolean,
    description: 'Incluir sections e questions completas (para sync mobile)',
  })
  @ApiResponse({ status: 200, description: 'Lista de templates' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  findAll(
    @CurrentUser() user: any,
    @Query('includeInactive') includeInactive?: string,
    @Query('includeDetails') includeDetails?: string,
  ) {
    return this.service.findAll(
      user.id,
      includeInactive === 'true',
      includeDetails === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar template por ID com seções e perguntas' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiBody({ type: UpdateChecklistTemplateDto })
  @ApiResponse({ status: 200, description: 'Template atualizado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Excluir template (sem instâncias vinculadas)' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Template excluído' })
  @ApiResponse({
    status: 400,
    description: 'Template possui instâncias vinculadas',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicar template existente' })
  @ApiParam({ name: 'id', description: 'UUID do template original' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do novo template' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Template duplicado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  duplicate(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('name') name?: string,
  ) {
    return this.service.duplicate(user.id, id, name);
  }

  @Get(':id/snapshot')
  @ApiOperation({ summary: 'Gerar snapshot do template para instância' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiResponse({ status: 200, description: 'Snapshot gerado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  getSnapshot(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getTemplateSnapshot(user.id, id);
  }

  // ============================================
  // SECTIONS ENDPOINTS
  // ============================================

  @Post(':id/sections')
  @ApiOperation({ summary: 'Adicionar seção ao template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiBody({ type: CreateChecklistSectionDto })
  @ApiResponse({ status: 201, description: 'Seção criada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  createSection(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Body() dto: CreateChecklistSectionDto,
  ) {
    return this.service.createSection(user.id, templateId, dto);
  }

  @Put(':id/sections/:sectionId')
  @ApiOperation({ summary: 'Atualizar seção' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'sectionId', description: 'UUID da seção' })
  @ApiBody({ type: UpdateChecklistSectionDto })
  @ApiResponse({ status: 200, description: 'Seção atualizada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template ou seção não encontrado' })
  updateSection(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateChecklistSectionDto,
  ) {
    return this.service.updateSection(user.id, templateId, sectionId, dto);
  }

  @Delete(':id/sections/:sectionId')
  @ApiOperation({ summary: 'Remover seção (perguntas são mantidas sem seção)' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'sectionId', description: 'UUID da seção' })
  @ApiResponse({ status: 200, description: 'Seção removida' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template ou seção não encontrado' })
  removeSection(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.service.removeSection(user.id, templateId, sectionId);
  }

  @Patch(':id/sections/reorder')
  @ApiOperation({ summary: 'Reordenar seções' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sectionIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs das seções na nova ordem',
        },
      },
      required: ['sectionIds'],
    },
  })
  @ApiResponse({ status: 200, description: 'Seções reordenadas' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  reorderSections(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Body('sectionIds') sectionIds: string[],
  ) {
    return this.service.reorderSections(user.id, templateId, sectionIds);
  }

  // ============================================
  // QUESTIONS ENDPOINTS
  // ============================================

  @Post(':id/questions')
  @ApiOperation({ summary: 'Adicionar pergunta ao template' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiBody({ type: CreateChecklistQuestionDto })
  @ApiResponse({ status: 201, description: 'Pergunta criada' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  createQuestion(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Body() dto: CreateChecklistQuestionDto,
  ) {
    return this.service.createQuestion(user.id, templateId, dto);
  }

  @Put(':id/questions/:questionId')
  @ApiOperation({ summary: 'Atualizar pergunta' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'questionId', description: 'UUID da pergunta' })
  @ApiBody({ type: UpdateChecklistQuestionDto })
  @ApiResponse({ status: 200, description: 'Pergunta atualizada' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Template ou pergunta não encontrado',
  })
  updateQuestion(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateChecklistQuestionDto,
  ) {
    return this.service.updateQuestion(user.id, templateId, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  @ApiOperation({ summary: 'Remover pergunta' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'questionId', description: 'UUID da pergunta' })
  @ApiResponse({ status: 200, description: 'Pergunta removida' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Template ou pergunta não encontrado',
  })
  removeQuestion(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Param('questionId') questionId: string,
  ) {
    return this.service.removeQuestion(user.id, templateId, questionId);
  }

  @Patch(':id/questions/reorder')
  @ApiOperation({ summary: 'Reordenar perguntas' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiBody({ type: ReorderQuestionsDto })
  @ApiResponse({ status: 200, description: 'Perguntas reordenadas' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  reorderQuestions(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.service.reorderQuestions(user.id, templateId, dto);
  }

  @Patch(':id/questions/:questionId/move')
  @ApiOperation({ summary: 'Mover pergunta para outra seção' })
  @ApiParam({ name: 'id', description: 'UUID do template' })
  @ApiParam({ name: 'questionId', description: 'UUID da pergunta' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          nullable: true,
          description: 'UUID da seção destino (null para sem seção)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Pergunta movida' })
  @ApiResponse({ status: 400, description: 'Seção inválida' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Template ou pergunta não encontrado',
  })
  moveQuestion(
    @CurrentUser() user: any,
    @Param('id') templateId: string,
    @Param('questionId') questionId: string,
    @Body('sectionId') sectionId: string | null,
  ) {
    return this.service.moveQuestionToSection(
      user.id,
      templateId,
      questionId,
      sectionId,
    );
  }
}
