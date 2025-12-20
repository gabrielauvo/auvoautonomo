import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ProductsSyncService } from './products-sync.service';
import {
  SyncPullQueryDto,
  SyncScope,
  SyncCategoriesPullResponseDto,
  SyncItemsPullResponseDto,
  SyncCategoriesPushBodyDto,
  SyncCategoriesPushResponseDto,
  SyncItemsPushBodyDto,
  SyncItemsPushResponseDto,
} from './dto/sync-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Products Sync')
@ApiBearerAuth('JWT-auth')
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class ProductsSyncController {
  constructor(private readonly productsSyncService: ProductsSyncService) {}

  // =============================================================================
  // CATEGORIES SYNC
  // =============================================================================

  @Get('categories')
  @ApiOperation({
    summary: 'Pull product categories for sync (delta sync with cursor pagination)',
    description: `
      Fetches product categories for mobile sync with delta sync support.

      Features:
      - Delta sync: Use 'since' parameter to only get records updated after a specific time
      - Cursor pagination: Use 'cursor' for efficient pagination through large datasets
      - Scope filtering: 'all' for full sync, 'active_only' for only active categories

      The response includes 'serverTime' which should be used as 'since' in the next sync.
    `,
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO date string - only return records updated after this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination (base64 encoded)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records per page (max 500)',
    example: 100,
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: SyncScope,
    description: 'Scope of categories to sync',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns categories with pagination info',
    type: SyncCategoriesPullResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  pullCategories(
    @CurrentUser() user: any,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncCategoriesPullResponseDto> {
    return this.productsSyncService.pullCategories(user.id, query);
  }

  // =============================================================================
  // ITEMS SYNC
  // =============================================================================

  @Get('items')
  @ApiOperation({
    summary: 'Pull catalog items for sync (delta sync with cursor pagination)',
    description: `
      Fetches catalog items (products, services, bundles) for mobile sync with delta sync support.

      Features:
      - Delta sync: Use 'since' parameter to only get records updated after a specific time
      - Cursor pagination: Use 'cursor' for efficient pagination through large datasets
      - Scope filtering: 'all' for full sync, 'active_only' for only active items
      - Category info: Each item includes denormalized category name and color
      - Bundle items: For BUNDLE type items, includes the child items with quantities

      The response includes 'serverTime' which should be used as 'since' in the next sync.
    `,
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO date string - only return records updated after this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination (base64 encoded)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of records per page (max 500)',
    example: 100,
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: SyncScope,
    description: 'Scope of items to sync',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns items with pagination info',
    type: SyncItemsPullResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  pullItems(
    @CurrentUser() user: any,
    @Query() query: SyncPullQueryDto,
  ): Promise<SyncItemsPullResponseDto> {
    return this.productsSyncService.pullItems(user.id, query);
  }

  // =============================================================================
  // CATEGORIES PUSH (Mutations)
  // =============================================================================

  @Post('categories')
  @ApiOperation({
    summary: 'Push category mutations from mobile',
    description: `
      Receives category mutations (create, update, delete) from mobile app.

      Features:
      - Idempotency: Duplicate mutations are ignored (same mutationId)
      - Batch processing: Multiple mutations in single request
      - Conflict resolution: Server validates ownership

      Each mutation must include a unique mutationId for idempotency.
    `,
  })
  @ApiBody({ type: SyncCategoriesPushBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Returns mutation results',
    type: SyncCategoriesPushResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  pushCategories(
    @CurrentUser() user: any,
    @Body() body: SyncCategoriesPushBodyDto,
  ): Promise<SyncCategoriesPushResponseDto> {
    return this.productsSyncService.pushCategories(user.id, body);
  }

  // =============================================================================
  // ITEMS PUSH (Mutations)
  // =============================================================================

  @Post('items')
  @ApiOperation({
    summary: 'Push catalog item mutations from mobile',
    description: `
      Receives catalog item mutations (create, update, delete) from mobile app.

      Features:
      - Idempotency: Duplicate mutations are ignored (same mutationId)
      - Batch processing: Multiple mutations in single request
      - Bundle support: Can include bundleItems for BUNDLE type items
      - Soft delete: Items in use are deactivated instead of deleted

      Each mutation must include a unique mutationId for idempotency.
    `,
  })
  @ApiBody({ type: SyncItemsPushBodyDto })
  @ApiResponse({
    status: 200,
    description: 'Returns mutation results',
    type: SyncItemsPushResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  pushItems(
    @CurrentUser() user: any,
    @Body() body: SyncItemsPushBodyDto,
  ): Promise<SyncItemsPushResponseDto> {
    return this.productsSyncService.pushItems(user.id, body);
  }
}
