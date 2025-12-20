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
import { QuotesService } from './quotes.service';
import { QuotesPublicService } from './quotes-public.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { AddQuoteItemDto } from './dto/add-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { UpdateQuoteStatusDto, QuoteStatus } from './dto/update-quote-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Quotes')
@ApiBearerAuth('JWT-auth')
@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotesPublicService: QuotesPublicService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quote with items' })
  @ApiBody({ type: CreateQuoteDto })
  @ApiResponse({ status: 201, description: 'Quote created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or discount too high' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Client or items not found or do not belong to you',
  })
  create(@CurrentUser() user: any, @Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.create(user.id, createQuoteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all quotes for the authenticated user' })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: 'Filter by client ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: QuoteStatus,
    description: 'Filter by quote status',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns all quotes with client info and item count',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: any,
    @Query('clientId') clientId?: string,
    @Query('status') status?: QuoteStatus,
  ) {
    return this.quotesService.findAll(user.id, clientId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single quote by ID with all items' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns quote with client info and all items',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotesService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quote (discount and notes only, not items)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiBody({ type: UpdateQuoteDto })
  @ApiResponse({
    status: 200,
    description: 'Quote updated successfully, total recalculated if discount changed',
  })
  @ApiResponse({ status: 400, description: 'Invalid data or discount too high' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
  ) {
    return this.quotesService.update(user.id, id, updateQuoteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Quote deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotesService.remove(user.id, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add an item to the quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiBody({ type: AddQuoteItemDto })
  @ApiResponse({
    status: 201,
    description: 'Item added successfully, total recalculated',
  })
  @ApiResponse({ status: 400, description: 'Invalid data or item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  addItem(
    @CurrentUser() user: any,
    @Param('id') quoteId: string,
    @Body() addQuoteItemDto: AddQuoteItemDto,
  ) {
    return this.quotesService.addItem(user.id, quoteId, addQuoteItemDto);
  }

  @Put(':id/items/:itemId')
  @ApiOperation({ summary: 'Update quantity of an item in the quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Quote Item UUID' })
  @ApiBody({ type: UpdateQuoteItemDto })
  @ApiResponse({
    status: 200,
    description: 'Item quantity updated, totalPrice and quote total recalculated',
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  updateItem(
    @CurrentUser() user: any,
    @Param('id') quoteId: string,
    @Param('itemId') itemId: string,
    @Body() updateQuoteItemDto: UpdateQuoteItemDto,
  ) {
    return this.quotesService.updateItem(user.id, quoteId, itemId, updateQuoteItemDto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove an item from the quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Quote Item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Item removed successfully, total recalculated',
  })
  @ApiResponse({ status: 400, description: 'Cannot remove item if it makes total negative' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  removeItem(
    @CurrentUser() user: any,
    @Param('id') quoteId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.quotesService.removeItem(user.id, quoteId, itemId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update quote status with validation' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiBody({ type: UpdateQuoteStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully (DRAFT→SENT, SENT→APPROVED/REJECTED)',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateQuoteStatusDto: UpdateQuoteStatusDto,
  ) {
    return this.quotesService.updateStatus(user.id, id, updateQuoteStatusDto.status);
  }

  // ==================== SHARE LINK ====================

  @Post(':id/share')
  @ApiOperation({
    summary: 'Generate or get share link for quote',
    description: 'Creates a unique shareable link for the quote that can be sent to clients via WhatsApp',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the share key',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getShareLink(
    @CurrentUser() user: any,
    @Param('id') quoteId: string,
  ) {
    const shareKey = await this.quotesPublicService.getOrCreateShareKey(user.id, quoteId);
    return {
      shareKey,
      // URL será montada no frontend com base na configuração do ambiente
    };
  }
}
