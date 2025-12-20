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
import { ItemsService } from './items.service';
import { CreateItemDto, ItemType } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('items')
@ApiBearerAuth('JWT-auth')
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new item (product or service)' })
  @ApiBody({ type: CreateItemDto })
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@CurrentUser() user: any, @Body() createItemDto: CreateItemDto) {
    return this.itemsService.create(user.id, createItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all items for the authenticated user' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ItemType,
    description: 'Filter by item type (PRODUCT, SERVICE, BUNDLE)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in name, SKU, or description',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({ status: 200, description: 'Returns all items with category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: any,
    @Query('type') type?: ItemType,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBoolean =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.itemsService.findAll(user.id, type, categoryId, search, isActiveBoolean);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get item statistics for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics (total, products, services, bundles, active, inactive)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@CurrentUser() user: any) {
    return this.itemsService.getStats(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single item by ID' })
  @ApiParam({ name: 'id', description: 'Item UUID' })
  @ApiResponse({ status: 200, description: 'Returns item details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.itemsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an item' })
  @ApiParam({ name: 'id', description: 'Item UUID' })
  @ApiBody({ type: UpdateItemDto })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.itemsService.update(user.id, id, updateItemDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an item (soft delete if in use)' })
  @ApiParam({ name: 'id', description: 'Item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Item deleted (or deactivated if referenced in quotes/work orders)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.itemsService.remove(user.id, id);
  }
}
