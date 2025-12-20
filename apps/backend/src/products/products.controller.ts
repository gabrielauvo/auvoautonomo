import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateItemDto, ItemType } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateBundleItemDto } from './dto/create-bundle-item.dto';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ============================================
  // CATEGORIES
  // ============================================

  /**
   * List all categories
   * GET /products/categories
   */
  @Get('categories')
  findAllCategories(
    @CurrentUser('id') userId: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBoolean =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.productsService.findAllCategories(userId, isActiveBoolean);
  }

  /**
   * Get single category
   * GET /products/categories/:id
   */
  @Get('categories/:id')
  findOneCategory(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOneCategory(userId, id);
  }

  /**
   * Create category
   * POST /products/categories
   */
  @Post('categories')
  createCategory(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.productsService.createCategory(userId, dto);
  }

  /**
   * Update category
   * PUT /products/categories/:id
   */
  @Put('categories/:id')
  updateCategory(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.productsService.updateCategory(userId, id, dto);
  }

  /**
   * Delete category
   * DELETE /products/categories/:id
   */
  @Delete('categories/:id')
  removeCategory(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.removeCategory(userId, id);
  }

  // ============================================
  // ITEMS (PRODUCTS/SERVICES/BUNDLES)
  // ============================================

  /**
   * List all items with filters
   * GET /products/items
   */
  @Get('items')
  findAllItems(
    @CurrentUser('id') userId: string,
    @Query('type') type?: ItemType,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBoolean =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.productsService.findAllItems(userId, {
      type,
      categoryId,
      search,
      isActive: isActiveBoolean,
    });
  }

  /**
   * Get single item
   * GET /products/items/:id
   */
  @Get('items/:id')
  findOneItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOneItem(userId, id);
  }

  /**
   * Create item (product/service/bundle)
   * POST /products/items
   */
  @Post('items')
  createItem(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.productsService.createItem(userId, dto);
  }

  /**
   * Update item
   * PUT /products/items/:id
   */
  @Put('items/:id')
  updateItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.productsService.updateItem(userId, id, dto);
  }

  /**
   * Delete item (soft delete if in use, hard delete otherwise)
   * DELETE /products/items/:id
   */
  @Delete('items/:id')
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.removeItem(userId, id);
  }

  // ============================================
  // BUNDLE ITEMS
  // ============================================

  /**
   * Get bundle items
   * GET /products/items/:id/bundle-items
   */
  @Get('items/:id/bundle-items')
  getBundleItems(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.getBundleItems(userId, id);
  }

  /**
   * Add item to bundle
   * POST /products/items/:id/bundle-items
   */
  @Post('items/:id/bundle-items')
  addBundleItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBundleItemDto,
  ) {
    return this.productsService.addBundleItem(userId, id, dto);
  }

  /**
   * Remove item from bundle
   * DELETE /products/bundle-items/:bundleItemId
   */
  @Delete('bundle-items/:bundleItemId')
  removeBundleItem(
    @CurrentUser('id') userId: string,
    @Param('bundleItemId', ParseUUIDPipe) bundleItemId: string,
  ) {
    return this.productsService.removeBundleItem(userId, bundleItemId);
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get catalog statistics
   * GET /products/stats
   */
  @Get('stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.productsService.getStats(userId);
  }
}
