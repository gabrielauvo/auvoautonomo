import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Put,
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
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersSyncService } from './work-orders-sync.service';
import { WorkOrdersPublicService } from './work-orders-public.service';
import { WorkOrderExecutionSessionsService } from './work-order-execution-sessions.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { AddEquipmentDto } from './dto/add-equipment.dto';
import { AddWorkOrderItemDto } from './dto/add-work-order-item.dto';
import { UpdateWorkOrderItemDto } from './dto/update-work-order-item.dto';
import { UpdateWorkOrderStatusDto, WorkOrderStatus } from './dto/update-work-order-status.dto';
import {
  SyncWorkOrderPullQueryDto,
  SyncWorkOrderPullResponseDto,
  SyncWorkOrderPushBodyDto,
  SyncWorkOrderPushResponseDto,
} from './dto/sync-work-orders.dto';
import { SyncExecutionSessionsRequestDto } from './dto/sync-execution-sessions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Work Orders')
@ApiBearerAuth('JWT-auth')
@Controller('work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly workOrdersSyncService: WorkOrdersSyncService,
    private readonly workOrdersPublicService: WorkOrdersPublicService,
    private readonly executionSessionsService: WorkOrderExecutionSessionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new work order' })
  @ApiBody({ type: CreateWorkOrderDto })
  @ApiResponse({ status: 201, description: 'Work order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or quote not approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Client, quote, or equipments not found or do not belong to you',
  })
  create(@CurrentUser() user: any, @Body() createWorkOrderDto: CreateWorkOrderDto) {
    return this.workOrdersService.create(user.id, createWorkOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all work orders for the authenticated user' })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: 'Filter by client ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: WorkOrderStatus,
    description: 'Filter by work order status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by scheduled date (start of range) - ISO 8601 format',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by scheduled date (end of range) - ISO 8601 format',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all work orders with client info and equipment count',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: any,
    @Query('clientId') clientId?: string,
    @Query('status') status?: WorkOrderStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.workOrdersService.findAll(user.id, clientId, status, startDate, endDate);
  }

  // =============================================================================
  // SYNC ENDPOINTS (Mobile App) - Must come before :id routes
  // =============================================================================

  @Get('sync')
  @ApiOperation({
    summary: 'Pull work orders for sync (delta + cursor pagination)',
    description:
      'Returns work orders modified since a given date with cursor-based pagination. ' +
      'Supports scopes: all, assigned, date_range (default: -30 to +60 days).',
  })
  @ApiQuery({ name: 'since', required: false, description: 'ISO date for delta sync' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Records per page (max 500)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['all', 'assigned', 'date_range'] })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date for date_range scope' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date for date_range scope' })
  @ApiResponse({ status: 200, description: 'Returns paginated work orders', type: SyncWorkOrderPullResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  syncPull(
    @CurrentUser() user: any,
    @Query() query: SyncWorkOrderPullQueryDto,
  ): Promise<SyncWorkOrderPullResponseDto> {
    return this.workOrdersSyncService.pull(user.id, query);
  }

  @Post('sync/mutations')
  @ApiOperation({
    summary: 'Push work order mutations (create/update/delete/update_status)',
    description:
      'Applies mutations from mobile app. Supports idempotency via mutationId. ' +
      'Uses last-write-wins conflict resolution. Validates status transitions.',
  })
  @ApiBody({ type: SyncWorkOrderPushBodyDto })
  @ApiResponse({ status: 200, description: 'Mutation results', type: SyncWorkOrderPushResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  syncPush(
    @CurrentUser() user: any,
    @Body() body: SyncWorkOrderPushBodyDto,
  ): Promise<SyncWorkOrderPushResponseDto> {
    return this.workOrdersSyncService.push(user.id, body);
  }

  // =============================================================================
  // CRUD BY ID - Must come after static routes
  // =============================================================================

  @Get(':id')
  @ApiOperation({ summary: 'Get a single work order by ID with all details' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns work order with client, quote, and equipment info',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.workOrdersService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update work order details' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiBody({ type: UpdateWorkOrderDto })
  @ApiResponse({
    status: 200,
    description: 'Work order updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot update work order with status DONE or CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateWorkOrderDto: UpdateWorkOrderDto,
  ) {
    return this.workOrdersService.update(user.id, id, updateWorkOrderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a work order' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiResponse({ status: 200, description: 'Work order deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete work order with status IN_PROGRESS or DONE',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.workOrdersService.remove(user.id, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update work order status' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiBody({ type: UpdateWorkOrderStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully (SCHEDULED→IN_PROGRESS→DONE or CANCELED)',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateWorkOrderStatusDto: UpdateWorkOrderStatusDto,
  ) {
    return this.workOrdersService.updateStatus(user.id, id, updateWorkOrderStatusDto.status);
  }

  @Post(':id/equipments')
  @ApiOperation({ summary: 'Add equipment to work order' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiBody({ type: AddEquipmentDto })
  @ApiResponse({
    status: 201,
    description: 'Equipment added successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Equipment not found, already linked, or work order status is DONE/CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  addEquipment(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Body() addEquipmentDto: AddEquipmentDto,
  ) {
    return this.workOrdersService.addEquipment(user.id, workOrderId, addEquipmentDto);
  }

  @Delete(':id/equipments/:equipmentId')
  @ApiOperation({ summary: 'Remove equipment from work order' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Equipment removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Work order status is DONE or CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order or equipment link not found' })
  removeEquipment(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Param('equipmentId') equipmentId: string,
  ) {
    return this.workOrdersService.removeEquipment(user.id, workOrderId, equipmentId);
  }

  // ==================== WORK ORDER ITEMS ====================

  @Post(':id/items')
  @ApiOperation({
    summary: 'Add item to work order',
    description: 'Add an item from catalog (provide itemId) or manual item (provide name, unit, unitPrice)',
  })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiBody({ type: AddWorkOrderItemDto })
  @ApiResponse({
    status: 201,
    description: 'Item added successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Item not found, validation error, or work order status is DONE/CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  addItem(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Body() addWorkOrderItemDto: AddWorkOrderItemDto,
  ) {
    return this.workOrdersService.addItem(user.id, workOrderId, addWorkOrderItemDto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Update item quantity in work order' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiParam({ name: 'itemId', description: 'Work order item UUID' })
  @ApiBody({ type: UpdateWorkOrderItemDto })
  @ApiResponse({
    status: 200,
    description: 'Item updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Work order status is DONE or CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order or item not found' })
  updateItem(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Param('itemId') itemId: string,
    @Body() updateWorkOrderItemDto: UpdateWorkOrderItemDto,
  ) {
    return this.workOrdersService.updateItem(user.id, workOrderId, itemId, updateWorkOrderItemDto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove item from work order' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiParam({ name: 'itemId', description: 'Work order item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Item removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Work order status is DONE or CANCELED',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order or item not found' })
  removeItem(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.workOrdersService.removeItem(user.id, workOrderId, itemId);
  }

  // ==================== SHARE LINK ====================

  @Post(':id/share')
  @ApiOperation({
    summary: 'Generate or get share link for work order',
    description: 'Creates a unique shareable link for the work order that can be sent to clients via WhatsApp',
  })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the share key and full URL',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  async getShareLink(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
  ) {
    const shareKey = await this.workOrdersPublicService.getOrCreateShareKey(user.id, workOrderId);
    return {
      shareKey,
      // URL será montada no frontend com base na configuração do ambiente
    };
  }

  // ==========================================================================
  // EXECUTION SESSIONS (sync de pausas e sessões de trabalho do mobile)
  // ==========================================================================

  @Post(':id/execution-sessions/sync')
  @ApiOperation({ summary: 'Sync execution sessions from mobile (work and pause sessions)' })
  @ApiParam({ name: 'id', description: 'Work order ID' })
  @ApiBody({ type: SyncExecutionSessionsRequestDto })
  @ApiResponse({ status: 200, description: 'Sessions synced successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  async syncExecutionSessions(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
    @Body() dto: SyncExecutionSessionsRequestDto,
  ) {
    // Garantir que o workOrderId do body corresponde ao da URL
    dto.workOrderId = workOrderId;
    return this.executionSessionsService.syncSessions(
      user.id,
      user.technicianId || user.id,
      dto,
    );
  }

  @Get(':id/execution-sessions')
  @ApiOperation({ summary: 'Get execution sessions for a work order' })
  @ApiParam({ name: 'id', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Execution sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  async getExecutionSessions(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
  ) {
    return this.executionSessionsService.getByWorkOrder(user.id, workOrderId);
  }

  @Get(':id/execution-sessions/summary')
  @ApiOperation({ summary: 'Get time summary for a work order (total work and pause time)' })
  @ApiParam({ name: 'id', description: 'Work order ID' })
  @ApiResponse({ status: 200, description: 'Time summary retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Work order not found' })
  async getTimeSummary(
    @CurrentUser() user: any,
    @Param('id') workOrderId: string,
  ) {
    return this.executionSessionsService.getTimeSummary(user.id, workOrderId);
  }
}
