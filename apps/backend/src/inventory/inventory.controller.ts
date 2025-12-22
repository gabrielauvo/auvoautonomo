import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import {
  UpdateInventorySettingsDto,
  InventorySettingsResponseDto,
  InventoryBalanceResponseDto,
  InventoryBalanceListResponseDto,
  UpdateBalanceDto,
  CreateMovementDto,
  InventoryMovementResponseDto,
  MovementListQueryDto,
  MovementListResponseDto,
} from './dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ============================================================================
  // Settings
  // ============================================================================

  @Get('settings')
  @ApiOperation({ summary: 'Obter configurações de estoque' })
  @ApiResponse({
    status: 200,
    description: 'Configurações retornadas',
    type: InventorySettingsResponseDto,
  })
  async getSettings(@Request() req): Promise<InventorySettingsResponseDto> {
    return this.inventoryService.getSettings(req.user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Atualizar configurações de estoque' })
  @ApiResponse({
    status: 200,
    description: 'Configurações atualizadas',
    type: InventorySettingsResponseDto,
  })
  async updateSettings(
    @Request() req,
    @Body() dto: UpdateInventorySettingsDto,
  ): Promise<InventorySettingsResponseDto> {
    return this.inventoryService.updateSettings(req.user.id, dto);
  }

  // ============================================================================
  // Balances
  // ============================================================================

  @Get('balances')
  @ApiOperation({ summary: 'Listar saldos de todos os produtos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de saldos',
    type: InventoryBalanceListResponseDto,
  })
  async getBalances(@Request() req): Promise<InventoryBalanceListResponseDto> {
    return this.inventoryService.getBalances(req.user.id);
  }

  @Get('balances/:itemId')
  @ApiOperation({ summary: 'Obter saldo de um produto' })
  @ApiParam({ name: 'itemId', description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description: 'Saldo do produto',
    type: InventoryBalanceResponseDto,
  })
  async getBalance(
    @Request() req,
    @Param('itemId') itemId: string,
  ): Promise<InventoryBalanceResponseDto> {
    return this.inventoryService.getBalance(req.user.id, itemId);
  }

  @Put('balances/:itemId')
  @ApiOperation({ summary: 'Atualizar saldo de um produto (ajuste direto)' })
  @ApiParam({ name: 'itemId', description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description: 'Saldo atualizado',
    type: InventoryBalanceResponseDto,
  })
  async updateBalance(
    @Request() req,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBalanceDto,
  ): Promise<InventoryBalanceResponseDto> {
    return this.inventoryService.updateBalance(req.user.id, itemId, dto);
  }

  @Post('balances/:itemId/initial')
  @ApiOperation({ summary: 'Definir estoque inicial de um produto (não exige módulo ativo)' })
  @ApiParam({ name: 'itemId', description: 'ID do produto' })
  @ApiResponse({
    status: 201,
    description: 'Estoque inicial definido',
    type: InventoryBalanceResponseDto,
  })
  async setInitialStock(
    @Request() req,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBalanceDto,
  ): Promise<InventoryBalanceResponseDto> {
    return this.inventoryService.setInitialStock(req.user.id, itemId, dto.quantity, dto.notes);
  }

  // ============================================================================
  // Movements
  // ============================================================================

  @Post('movements')
  @ApiOperation({ summary: 'Criar movimentação de estoque' })
  @ApiResponse({
    status: 201,
    description: 'Movimentação criada',
    type: InventoryMovementResponseDto,
  })
  async createMovement(
    @Request() req,
    @Body() dto: CreateMovementDto,
  ): Promise<InventoryMovementResponseDto> {
    return this.inventoryService.createMovement(req.user.id, dto);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Listar movimentações de estoque' })
  @ApiQuery({ name: 'itemId', required: false, description: 'Filtrar por produto' })
  @ApiQuery({ name: 'type', required: false, description: 'Filtrar por tipo' })
  @ApiQuery({ name: 'source', required: false, description: 'Filtrar por fonte' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Data inicial' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Data final' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset' })
  @ApiResponse({
    status: 200,
    description: 'Lista de movimentações',
    type: MovementListResponseDto,
  })
  async getMovements(
    @Request() req,
    @Query() query: MovementListQueryDto,
  ): Promise<MovementListResponseDto> {
    return this.inventoryService.getMovements(req.user.id, query);
  }

  // ============================================================================
  // Dashboard
  // ============================================================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Obter resumo do estoque (dashboard)' })
  @ApiResponse({
    status: 200,
    description: 'Resumo do estoque',
  })
  async getDashboard(@Request() req) {
    return this.inventoryService.getDashboard(req.user.id);
  }
}
