import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkOrderTypesService, WorkOrderTypeFilters } from './work-order-types.service';
import { CreateWorkOrderTypeDto, UpdateWorkOrderTypeDto } from './dto';

@ApiTags('Work Order Types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('work-order-types')
export class WorkOrderTypesController {
  constructor(private readonly workOrderTypesService: WorkOrderTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar um novo tipo de ordem de serviço' })
  @ApiResponse({ status: 201, description: 'Tipo criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 403, description: 'Recurso não disponível no plano' })
  @ApiResponse({ status: 409, description: 'Nome já existe' })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWorkOrderTypeDto,
  ) {
    return this.workOrderTypesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tipos de ordem de serviço' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Buscar por nome ou descrição',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filtrar por status ativo/inativo',
  })
  @ApiQuery({
    name: 'updatedSince',
    required: false,
    description: 'Filtrar por data de atualização (ISO 8601) - para sincronização',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limite de resultados (padrão: 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset para paginação (padrão: 0)',
  })
  @ApiResponse({ status: 200, description: 'Lista de tipos' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('updatedSince') updatedSince?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: WorkOrderTypeFilters = {
      search,
      updatedSince,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };

    // Parse isActive boolean
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    return this.workOrderTypesService.findAll(userId, filters);
  }

  @Get('sync')
  @ApiOperation({ summary: 'Obter dados para sincronização (mobile app)' })
  @ApiQuery({
    name: 'updatedSince',
    required: false,
    description: 'Timestamp ISO 8601 da última sincronização',
  })
  @ApiResponse({ status: 200, description: 'Dados de sincronização' })
  getSyncData(
    @CurrentUser('id') userId: string,
    @Query('updatedSince') updatedSince?: string,
  ) {
    return this.workOrderTypesService.getSyncData(userId, updatedSince);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar tipo de ordem de serviço por ID' })
  @ApiResponse({ status: 200, description: 'Tipo encontrado' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workOrderTypesService.findOne(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar tipo de ordem de serviço' })
  @ApiResponse({ status: 200, description: 'Tipo atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 403, description: 'Recurso não disponível no plano' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  @ApiResponse({ status: 409, description: 'Nome já existe' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderTypeDto,
  ) {
    return this.workOrderTypesService.update(userId, id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativar tipo de ordem de serviço' })
  @ApiResponse({ status: 200, description: 'Tipo desativado com sucesso' })
  @ApiResponse({ status: 403, description: 'Recurso não disponível no plano' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  deactivate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workOrderTypesService.deactivate(userId, id);
  }

  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reativar tipo de ordem de serviço' })
  @ApiResponse({ status: 200, description: 'Tipo reativado com sucesso' })
  @ApiResponse({ status: 403, description: 'Recurso não disponível no plano' })
  @ApiResponse({ status: 404, description: 'Tipo não encontrado' })
  reactivate(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.workOrderTypesService.reactivate(userId, id);
  }
}
