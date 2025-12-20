import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateItemDto, ItemType } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateBundleItemDto } from './dto/create-bundle-item.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ============================================
  // CATEGORIES
  // ============================================

  async createCategory(userId: string, dto: CreateCategoryDto) {
    return this.prisma.productCategory.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllCategories(userId: string, isActive?: boolean) {
    const where: any = { userId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.productCategory.findMany({
      where,
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneCategory(userId: string, id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async updateCategory(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOneCategory(userId, id);

    return this.prisma.productCategory.update({
      where: { id },
      data: dto,
    });
  }

  async removeCategory(userId: string, id: string) {
    const category = await this.findOneCategory(userId, id);

    // Check if category has items
    if (category._count.items > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.items} items. Remove items first or set isActive to false.`,
      );
    }

    return this.prisma.productCategory.delete({
      where: { id },
    });
  }

  // ============================================
  // ITEMS (PRODUCTS/SERVICES/BUNDLES)
  // ============================================

  async createItem(userId: string, dto: CreateItemDto) {
    // Validate category if provided
    if (dto.categoryId) {
      await this.findOneCategory(userId, dto.categoryId);
    }

    return this.prisma.item.create({
      data: {
        ...dto,
        basePrice: new Decimal(dto.basePrice),
        costPrice: dto.costPrice ? new Decimal(dto.costPrice) : null,
        userId,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
            bundleAsParent: true,
          },
        },
      },
    });
  }

  async findAllItems(
    userId: string,
    options?: {
      type?: ItemType;
      categoryId?: string;
      search?: string;
      isActive?: boolean;
    },
  ) {
    const where: any = { userId };

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.categoryId) {
      where.categoryId = options.categoryId;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return this.prisma.item.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
            bundleAsParent: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOneItem(userId: string, id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, userId },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        bundleAsParent: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                type: true,
                unit: true,
                basePrice: true,
              },
            },
          },
        },
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
            bundleAsParent: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    return item;
  }

  async updateItem(userId: string, id: string, dto: UpdateItemDto) {
    await this.findOneItem(userId, id);

    // Validate category if provided
    if (dto.categoryId) {
      await this.findOneCategory(userId, dto.categoryId);
    }

    const updateData: any = { ...dto };
    if (dto.basePrice !== undefined) {
      updateData.basePrice = new Decimal(dto.basePrice);
    }
    if (dto.costPrice !== undefined) {
      updateData.costPrice = dto.costPrice ? new Decimal(dto.costPrice) : null;
    }

    return this.prisma.item.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
            bundleAsParent: true,
          },
        },
      },
    });
  }

  async removeItem(userId: string, id: string) {
    const item = await this.findOneItem(userId, id);

    // Check if item is used in quotes or work orders
    if (item._count.quoteItems > 0 || item._count.workOrderItems > 0) {
      // Soft delete - just set isActive to false
      return this.prisma.item.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if not used anywhere
    return this.prisma.item.delete({
      where: { id },
    });
  }

  // ============================================
  // BUNDLE ITEMS
  // ============================================

  async addBundleItem(userId: string, bundleId: string, dto: CreateBundleItemDto) {
    // Validate bundle exists and is of type BUNDLE
    const bundle = await this.findOneItem(userId, bundleId);
    if (bundle.type !== 'BUNDLE') {
      throw new BadRequestException('Item is not a bundle');
    }

    // Validate child item exists
    const childItem = await this.findOneItem(userId, dto.itemId);

    // Prevent adding bundle to itself
    if (bundleId === dto.itemId) {
      throw new BadRequestException('Cannot add bundle to itself');
    }

    // Prevent adding another bundle as child (to avoid recursive bundles)
    if (childItem.type === 'BUNDLE') {
      throw new BadRequestException('Cannot add a bundle inside another bundle');
    }

    // Check if item already exists in bundle
    const existing = await this.prisma.bundleItem.findUnique({
      where: {
        bundleId_itemId: {
          bundleId,
          itemId: dto.itemId,
        },
      },
    });

    if (existing) {
      // Update quantity
      return this.prisma.bundleItem.update({
        where: { id: existing.id },
        data: { quantity: new Decimal(dto.quantity) },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              type: true,
              unit: true,
              basePrice: true,
            },
          },
        },
      });
    }

    return this.prisma.bundleItem.create({
      data: {
        userId,
        bundleId,
        itemId: dto.itemId,
        quantity: new Decimal(dto.quantity),
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            basePrice: true,
          },
        },
      },
    });
  }

  async getBundleItems(userId: string, bundleId: string) {
    // Validate bundle exists
    const bundle = await this.findOneItem(userId, bundleId);
    if (bundle.type !== 'BUNDLE') {
      throw new BadRequestException('Item is not a bundle');
    }

    const bundleItems = await this.prisma.bundleItem.findMany({
      where: { bundleId, userId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            basePrice: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate total bundle price
    const totalPrice = bundleItems.reduce((sum, bi) => {
      const itemPrice = Number(bi.item.basePrice);
      const quantity = Number(bi.quantity);
      return sum + itemPrice * quantity;
    }, 0);

    return {
      bundleId,
      bundleName: bundle.name,
      items: bundleItems,
      totalPrice,
      itemCount: bundleItems.length,
    };
  }

  async removeBundleItem(userId: string, bundleItemId: string) {
    const bundleItem = await this.prisma.bundleItem.findFirst({
      where: { id: bundleItemId, userId },
    });

    if (!bundleItem) {
      throw new NotFoundException(`Bundle item with ID ${bundleItemId} not found`);
    }

    return this.prisma.bundleItem.delete({
      where: { id: bundleItemId },
    });
  }

  // ============================================
  // STATISTICS
  // ============================================

  async getStats(userId: string) {
    const [
      totalItems,
      products,
      services,
      bundles,
      activeItems,
      inactiveItems,
      categories,
    ] = await Promise.all([
      this.prisma.item.count({ where: { userId } }),
      this.prisma.item.count({ where: { userId, type: 'PRODUCT' } }),
      this.prisma.item.count({ where: { userId, type: 'SERVICE' } }),
      this.prisma.item.count({ where: { userId, type: 'BUNDLE' } }),
      this.prisma.item.count({ where: { userId, isActive: true } }),
      this.prisma.item.count({ where: { userId, isActive: false } }),
      this.prisma.productCategory.count({ where: { userId } }),
    ]);

    return {
      totalItems,
      products,
      services,
      bundles,
      activeItems,
      inactiveItems,
      categories,
    };
  }

  // ============================================
  // HELPER: Calculate bundle price
  // ============================================

  async calculateBundlePrice(userId: string, bundleId: string): Promise<number> {
    const bundleItems = await this.prisma.bundleItem.findMany({
      where: { bundleId, userId },
      include: {
        item: {
          select: { basePrice: true },
        },
      },
    });

    return bundleItems.reduce((sum, bi) => {
      const itemPrice = Number(bi.item.basePrice);
      const quantity = Number(bi.quantity);
      return sum + itemPrice * quantity;
    }, 0);
  }
}
