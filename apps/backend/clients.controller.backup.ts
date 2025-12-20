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
import { ClientsService } from './clients.service';
import { ClientsSyncService } from './clients-sync.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import {
  SyncPullQueryDto,
  SyncPullResponseDto,
  SyncPushBodyDto,
  SyncPushResponseDto,
} from './dto/sync-clients.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageLimitGuard } from '../plans/guards/usage-limit.guard';
import { CheckLimit } from '../plans/decorators/check-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly clientsSyncService: ClientsSyncService,
  ) {}

  @Post()
  @UseGuards(UsageLimitGuard)
  @CheckLimit('clients')
  @ApiOperation({ summary: 'Create a new client' })
  @ApiBody({ type: CreateClientDto })
  @ApiResponse({ status: 201, description: 'Client created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Client limit reached for current plan' })
  create(@CurrentUser() user: any, @Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(user.id, createClientDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all clients for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns all clients with counts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: any) {
    return this.clientsService.findAll(user.id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search clients by name, email, phone, or tax ID' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiResponse({ status: 200, description: 'Returns matching clients' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  search(@CurrentUser() user: any, @Query('q') query: string) {
    return this.clientsService.search(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single client by ID' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Returns client with full details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clientsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiBody({ type: UpdateClientDto })
  @ApiResponse({ status: 200, description: 'Client updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.id, id, updateClientDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a client' })
  @ApiParam({ name: 'id', description: 'Client UUID' })
  @ApiResponse({ status: 200, description: 'Client deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clientsService.remove(user.id, id);
  }

  // =============================================================================
  // SYNC ENDPOINTS (Mobile App)
  // =============================================================================

  @Get('sync')
  @ApiOperation({
    summary: 'Pull clients for sync (delta + cursor pagination)',
    description:
      'Returns clients modified since a given date with cursor-based pagination. ' +
      'Supports scopes: all, recent (90 days), assigned (clients with work orders).',
  })
  @ApiQuery({ name: 'since', required: false, description: 'ISO date for delta sync' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, description: 'Records per page (max 500)' })
  @ApiQuery({ name: 'scope', required: false, enum: ['all', 'recent', 'assigned'] })
  @ApiResponse({ status: 200, description: 'Returns paginated clients', type: SyncPullResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  syncPull(
    @CurrentUser() user: any,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncPullResponseDto> {
    return this.clientsSyncService.pull(user.id, query);
  }

  @Post('sync/mutations')
  @ApiOperation({
    summary: 'Push client mutations (create/update/delete)',
    description:
      'Applies mutations from mobile app. Supports idempotency via mutationId. ' +
      'Uses last-write-wins conflict resolution based on updatedAt.',
  })
  @ApiBody({ type: SyncPushBodyDto })
  @ApiResponse({ status: 200, description: 'Mutation results', type: SyncPushResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  syncPush(
    @CurrentUser() user: any,
    @Body() body: SyncPushBodyDto,
  ): Promise<SyncPushResponseDto> {
    return this.clientsSyncService.push(user.id, body);
  }
}
