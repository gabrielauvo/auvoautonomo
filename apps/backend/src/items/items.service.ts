import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto, ItemType } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createItemDto: CreateItemDto) {
    // Validate category exists and belongs to user if provided
    if (createItemDto.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: {
          id: createItemDto.categoryId,
          userId,
        },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${createItemDto.categoryId} not found or does not belong to you`,
        );
      }
    }

    return this.prisma.item.create({
      data: {
        ...createItemDto,
        userId,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
  }

  async findAll(
    userId: string,
    type?: ItemType,
    categoryId?: string,
    search?: string,
    isActive?: boolean,
  ) {
    const where: any = { userId };

    if (type) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.item.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Item with ID ${id} not found`);
    }

    return item;
  }

  async update(userId: string, id: string, updateItemDto: UpdateItemDto) {
    await this.findOne(userId, id);

    // Validate category exists and belongs to user if provided
    if (updateItemDto.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: {
          id: updateItemDto.categoryId,
          userId,
        },
      });

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${updateItemDto.categoryId} not found or does not belong to you`,
        );
      }
    }

    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const item = await this.findOne(userId, id);

    // Check if item has any references
    if (item._count.quoteItems > 0 || item._count.workOrderItems > 0) {
      // Soft delete by setting isActive to false
      return this.prisma.item.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.item.delete({
      where: { id },
    });
  }

  async count(userId: string): Promise<number> {
    return this.prisma.item.count({
      where: { userId },
    });
  }

  async getStats(userId: string) {
    const [total, products, services, bundles, active, inactive] = await Promise.all([
      this.prisma.item.count({ where: { userId } }),
      this.prisma.item.count({ where: { userId, type: 'PRODUCT' } }),
      this.prisma.item.count({ where: { userId, type: 'SERVICE' } }),
      this.prisma.item.count({ where: { userId, type: 'BUNDLE' } }),
      this.prisma.item.count({ where: { userId, isActive: true } }),
      this.prisma.item.count({ where: { userId, isActive: false } }),
    ]);

    return {
      total,
      products,
      services,
      bundles,
      active,
      inactive,
    };
  }
}
