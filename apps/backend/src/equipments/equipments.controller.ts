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
import { EquipmentsService } from './equipments.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Equipments')
@ApiBearerAuth('JWT-auth')
@Controller('equipments')
@UseGuards(JwtAuthGuard)
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new equipment for a client' })
  @ApiBody({ type: CreateEquipmentDto })
  @ApiResponse({ status: 201, description: 'Equipment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Client not found or does not belong to you',
  })
  create(
    @CurrentUser() user: any,
    @Body() createEquipmentDto: CreateEquipmentDto,
  ) {
    return this.equipmentsService.create(user.id, createEquipmentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all equipment for the authenticated user',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: 'Filter by client ID',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by equipment type (case-insensitive partial match)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all equipment with client info and work order count',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: any,
    @Query('clientId') clientId?: string,
    @Query('type') type?: string,
  ) {
    return this.equipmentsService.findAll(user.id, clientId, type);
  }

  @Get('by-client/:clientId')
  @ApiOperation({ summary: 'Get all equipment for a specific client' })
  @ApiParam({ name: 'clientId', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Returns client equipment' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Client does not belong to you' })
  getByClient(
    @CurrentUser() user: any,
    @Param('clientId') clientId: string,
  ) {
    return this.equipmentsService.getByClient(user.id, clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single equipment by ID' })
  @ApiParam({ name: 'id', description: 'Equipment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns equipment with client info and recent work orders',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.equipmentsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an equipment' })
  @ApiParam({ name: 'id', description: 'Equipment UUID' })
  @ApiBody({ type: UpdateEquipmentDto })
  @ApiResponse({ status: 200, description: 'Equipment updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  @ApiResponse({
    status: 403,
    description: 'Client does not belong to you',
  })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
  ) {
    return this.equipmentsService.update(user.id, id, updateEquipmentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an equipment' })
  @ApiParam({ name: 'id', description: 'Equipment UUID' })
  @ApiResponse({ status: 200, description: 'Equipment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Equipment not found' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.equipmentsService.remove(user.id, id);
  }
}
