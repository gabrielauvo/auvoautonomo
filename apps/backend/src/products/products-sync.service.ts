import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ItemType } from '@prisma/client';
import {
  SyncPullQueryDto,
  SyncScope,
  SyncCategoryDto,
  SyncCategoriesPullResponseDto,
  SyncItemDto,
  SyncItemsPullResponseDto,
  SyncBundleItemDto,
  SyncCategoriesPushBodyDto,
  SyncCategoriesPushResponseDto,
  CategoryMutationResultDto,
  MutationAction,
  MutationStatus,
  SyncItemsPushBodyDto,
  SyncItemsPushResponseDto,
  ItemMutationResultDto,
} from './dto/sync-products.dto';

@Injectable()
export class ProductsSyncService {
  private readonly logger = new Logger(ProductsSyncService.name);

  constructor(private prisma: PrismaService) {}

  // =============================================================================
  // PULL CATEGORIES - Delta Sync with Cursor Pagination
  // =============================================================================

  async pullCategories(
    userId: string,
    query: SyncPullQueryDto,
  ): Promise<SyncCategoriesPullResponseDto> {
    const limit = Math.min(query.limit || 100, 500);
    const since = query.since ? new Date(query.since) : null;
    const scope = query.scope || SyncScope.ALL;

    // Decode cursor if provided
    let cursorData: { updatedAt: Date; id: string } | null = null;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf-8'),
        );
        cursorData = {
          updatedAt: new Date(decoded.updatedAt),
          id: decoded.id,
        };
      } catch (e) {
        this.logger.warn(`Invalid cursor: ${query.cursor}`);
      }
    }

    // Build where clause
    const where: any = { userId };

    // Apply scope filter
    if (scope === SyncScope.ACTIVE_ONLY) {
      where.isActive = true;
    }

    // Apply since filter (delta sync)
    if (since) {
      where.updatedAt = { gte: since };
    }

    // Apply cursor pagination (keyset pagination)
    if (cursorData) {
      where.OR = [
        { updatedAt: { gt: cursorData.updatedAt } },
        {
          updatedAt: cursorData.updatedAt,
          id: { gt: cursorData.id },
        },
      ];
    }

    // Get total count for this query
    const total = await this.prisma.productCategory.count({
      where: { userId, ...(since ? { updatedAt: { gte: since } } : {}) },
    });

    // Fetch categories with cursor-based pagination
    const categories = await this.prisma.productCategory.findMany({
      where,
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    // Check if there are more records
    const hasMore = categories.length > limit;
    const items = hasMore ? categories.slice(0, limit) : categories;

    // Build next cursor
    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          updatedAt: lastItem.updatedAt.toISOString(),
          id: lastItem.id,
        }),
      ).toString('base64');
    }

    // Transform to response format
    const responseItems: SyncCategoryDto[] = items.map((category) =>
      this.toSyncCategoryDto(category),
    );

    return {
      items: responseItems,
      nextCursor,
      serverTime: new Date().toISOString(),
      hasMore,
      total,
    };
  }

  // =============================================================================
  // PULL ITEMS - Delta Sync with Cursor Pagination
  // =============================================================================

  async pullItems(
    userId: string,
    query: SyncPullQueryDto,
  ): Promise<SyncItemsPullResponseDto> {
    const limit = Math.min(query.limit || 100, 500);
    const since = query.since ? new Date(query.since) : null;
    const scope = query.scope || SyncScope.ALL;

    // Decode cursor if provided
    let cursorData: { updatedAt: Date; id: string } | null = null;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf-8'),
        );
        cursorData = {
          updatedAt: new Date(decoded.updatedAt),
          id: decoded.id,
        };
      } catch (e) {
        this.logger.warn(`Invalid cursor: ${query.cursor}`);
      }
    }

    // Build where clause
    const where: any = { userId };

    // Apply scope filter
    if (scope === SyncScope.ACTIVE_ONLY) {
      where.isActive = true;
    }

    // Apply since filter (delta sync)
    if (since) {
      where.updatedAt = { gte: since };
    }

    // Apply cursor pagination (keyset pagination)
    if (cursorData) {
      where.OR = [
        { updatedAt: { gt: cursorData.updatedAt } },
        {
          updatedAt: cursorData.updatedAt,
          id: { gt: cursorData.id },
        },
      ];
    }

    // Get total count for this query
    const total = await this.prisma.item.count({
      where: { userId, ...(since ? { updatedAt: { gte: since } } : {}) },
    });

    // Fetch items with cursor-based pagination
    const items = await this.prisma.item.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
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
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    // Check if there are more records
    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;

    // Build next cursor
    let nextCursor: string | null = null;
    if (hasMore && resultItems.length > 0) {
      const lastItem = resultItems[resultItems.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          updatedAt: lastItem.updatedAt.toISOString(),
          id: lastItem.id,
        }),
      ).toString('base64');
    }

    // Transform to response format
    const responseItems: SyncItemDto[] = resultItems.map((item) =>
      this.toSyncItemDto(item),
    );

    return {
      items: responseItems,
      nextCursor,
      serverTime: new Date().toISOString(),
      hasMore,
      total,
    };
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private toSyncCategoryDto(category: any): SyncCategoryDto {
    return {
      id: category.id,
      technicianId: category.userId,
      name: category.name,
      description: category.description || undefined,
      color: category.color || undefined,
      isActive: category.isActive,
      itemCount: category._count?.items || 0,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private toSyncItemDto(item: any): SyncItemDto {
    const dto: SyncItemDto = {
      id: item.id,
      technicianId: item.userId,
      categoryId: item.categoryId || undefined,
      categoryName: item.category?.name || undefined,
      categoryColor: item.category?.color || undefined,
      name: item.name,
      description: item.description || undefined,
      type: item.type,
      sku: item.sku || undefined,
      unit: item.unit,
      basePrice: Number(item.basePrice),
      costPrice: item.costPrice ? Number(item.costPrice) : undefined,
      defaultDurationMinutes: item.defaultDurationMinutes || undefined,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };

    // Include bundle items for BUNDLE type
    if (item.type === 'BUNDLE' && item.bundleAsParent?.length > 0) {
      dto.bundleItems = item.bundleAsParent.map(
        (bi: any): SyncBundleItemDto => ({
          id: bi.id,
          itemId: bi.item.id,
          itemName: bi.item.name,
          itemType: bi.item.type,
          itemUnit: bi.item.unit,
          itemBasePrice: Number(bi.item.basePrice),
          quantity: Number(bi.quantity),
        }),
      );
    }

    return dto;
  }

  // =============================================================================
  // PUSH CATEGORIES - Process Mutations with Idempotency
  // =============================================================================

  async pushCategories(
    userId: string,
    body: SyncCategoriesPushBodyDto,
  ): Promise<SyncCategoriesPushResponseDto> {
    const results: CategoryMutationResultDto[] = [];

    for (const mutation of body.mutations) {
      try {
        // Check if mutation was already processed (idempotency)
        const existingMutation = await this.prisma.processedMutation.findUnique({
          where: { mutationId: mutation.mutationId },
        });

        if (existingMutation) {
          results.push({
            mutationId: mutation.mutationId,
            status: existingMutation.status as MutationStatus,
            record: existingMutation.resultData as unknown as SyncCategoryDto | undefined,
          });
          continue;
        }

        let result: CategoryMutationResultDto;

        switch (mutation.action) {
          case MutationAction.CREATE:
            result = await this.processCategoryCreate(userId, mutation);
            break;
          case MutationAction.UPDATE:
            result = await this.processCategoryUpdate(userId, mutation);
            break;
          case MutationAction.DELETE:
            result = await this.processCategoryDelete(userId, mutation);
            break;
          default:
            result = {
              mutationId: mutation.mutationId,
              status: MutationStatus.REJECTED,
              error: `Unknown action: ${mutation.action}`,
            };
        }

        // Store processed mutation for idempotency
        await this.prisma.processedMutation.create({
          data: {
            mutationId: mutation.mutationId,
            userId,
            entity: 'category',
            entityId: result.record?.id || mutation.record.id || '',
            action: mutation.action,
            status: result.status,
            resultData: result.record as any,
          },
        });

        results.push(result);
      } catch (error) {
        this.logger.error(
          `Error processing category mutation ${mutation.mutationId}: ${error.message}`,
        );
        results.push({
          mutationId: mutation.mutationId,
          status: MutationStatus.REJECTED,
          error: error.message,
        });
      }
    }

    return {
      results,
      serverTime: new Date().toISOString(),
    };
  }

  private async processCategoryCreate(
    userId: string,
    mutation: any,
  ): Promise<CategoryMutationResultDto> {
    const category = await this.prisma.productCategory.create({
      data: {
        id: mutation.record.id,
        userId,
        name: mutation.record.name,
        description: mutation.record.description || null,
        color: mutation.record.color || null,
        isActive: mutation.record.isActive !== false,
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncCategoryDto(category),
    };
  }

  private async processCategoryUpdate(
    userId: string,
    mutation: any,
  ): Promise<CategoryMutationResultDto> {
    const existing = await this.prisma.productCategory.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Category not found',
      };
    }

    const category = await this.prisma.productCategory.update({
      where: { id: mutation.record.id },
      data: {
        name: mutation.record.name,
        description: mutation.record.description,
        color: mutation.record.color,
        isActive: mutation.record.isActive,
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncCategoryDto(category),
    };
  }

  private async processCategoryDelete(
    userId: string,
    mutation: any,
  ): Promise<CategoryMutationResultDto> {
    const existing = await this.prisma.productCategory.findFirst({
      where: { id: mutation.record.id, userId },
      include: { _count: { select: { items: true } } },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Category not found',
      };
    }

    // Soft delete if has items, hard delete otherwise
    if (existing._count.items > 0) {
      const category = await this.prisma.productCategory.update({
        where: { id: mutation.record.id },
        data: { isActive: false },
        include: { _count: { select: { items: true } } },
      });
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
        record: this.toSyncCategoryDto(category),
      };
    } else {
      await this.prisma.productCategory.delete({
        where: { id: mutation.record.id },
      });
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
      };
    }
  }

  // =============================================================================
  // PUSH ITEMS - Process Mutations with Idempotency
  // =============================================================================

  async pushItems(
    userId: string,
    body: SyncItemsPushBodyDto,
  ): Promise<SyncItemsPushResponseDto> {
    const results: ItemMutationResultDto[] = [];

    for (const mutation of body.mutations) {
      try {
        // Check if mutation was already processed (idempotency)
        const existingMutation = await this.prisma.processedMutation.findUnique({
          where: { mutationId: mutation.mutationId },
        });

        if (existingMutation) {
          results.push({
            mutationId: mutation.mutationId,
            status: existingMutation.status as MutationStatus,
            record: existingMutation.resultData as unknown as SyncItemDto | undefined,
          });
          continue;
        }

        let result: ItemMutationResultDto;

        switch (mutation.action) {
          case MutationAction.CREATE:
            result = await this.processItemCreate(userId, mutation);
            break;
          case MutationAction.UPDATE:
            result = await this.processItemUpdate(userId, mutation);
            break;
          case MutationAction.DELETE:
            result = await this.processItemDelete(userId, mutation);
            break;
          default:
            result = {
              mutationId: mutation.mutationId,
              status: MutationStatus.REJECTED,
              error: `Unknown action: ${mutation.action}`,
            };
        }

        // Store processed mutation for idempotency
        await this.prisma.processedMutation.create({
          data: {
            mutationId: mutation.mutationId,
            userId,
            entity: 'item',
            entityId: result.record?.id || mutation.record.id || '',
            action: mutation.action,
            status: result.status,
            resultData: result.record as any,
          },
        });

        results.push(result);
      } catch (error) {
        this.logger.error(
          `Error processing item mutation ${mutation.mutationId}: ${error.message}`,
        );
        results.push({
          mutationId: mutation.mutationId,
          status: MutationStatus.REJECTED,
          error: error.message,
        });
      }
    }

    return {
      results,
      serverTime: new Date().toISOString(),
    };
  }

  private async processItemCreate(
    userId: string,
    mutation: any,
  ): Promise<ItemMutationResultDto> {
    // Validate category if provided
    if (mutation.record.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: mutation.record.categoryId, userId },
      });
      if (!category) {
        return {
          mutationId: mutation.mutationId,
          status: MutationStatus.REJECTED,
          error: 'Category not found',
        };
      }
    }

    const item = await this.prisma.item.create({
      data: {
        id: mutation.record.id,
        userId,
        categoryId: mutation.record.categoryId || null,
        name: mutation.record.name,
        description: mutation.record.description || null,
        type: mutation.record.type as ItemType,
        sku: mutation.record.sku || null,
        unit: mutation.record.unit,
        basePrice: new Decimal(mutation.record.basePrice),
        costPrice: mutation.record.costPrice
          ? new Decimal(mutation.record.costPrice)
          : null,
        defaultDurationMinutes: mutation.record.defaultDurationMinutes || null,
        isActive: mutation.record.isActive !== false,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
        bundleAsParent: {
          include: {
            item: {
              select: { id: true, name: true, type: true, unit: true, basePrice: true },
            },
          },
        },
      },
    });

    // Create bundle items if provided and type is BUNDLE
    if (mutation.record.type === 'BUNDLE' && mutation.record.bundleItems?.length > 0) {
      for (const bi of mutation.record.bundleItems) {
        // Validate child item exists
        const childItem = await this.prisma.item.findFirst({
          where: { id: bi.itemId, userId },
        });
        if (childItem) {
          await this.prisma.bundleItem.create({
            data: {
              id: bi.id,
              userId,
              bundleId: item.id,
              itemId: bi.itemId,
              quantity: new Decimal(bi.quantity),
            },
          });
        }
      }

      // Refetch with bundle items
      const itemWithBundle = await this.prisma.item.findUnique({
        where: { id: item.id },
        include: {
          category: { select: { id: true, name: true, color: true } },
          bundleAsParent: {
            include: {
              item: {
                select: { id: true, name: true, type: true, unit: true, basePrice: true },
              },
            },
          },
        },
      });

      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
        record: this.toSyncItemDto(itemWithBundle),
      };
    }

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncItemDto(item),
    };
  }

  private async processItemUpdate(
    userId: string,
    mutation: any,
  ): Promise<ItemMutationResultDto> {
    const existing = await this.prisma.item.findFirst({
      where: { id: mutation.record.id, userId },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Item not found',
      };
    }

    // Validate category if provided
    if (mutation.record.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: mutation.record.categoryId, userId },
      });
      if (!category) {
        return {
          mutationId: mutation.mutationId,
          status: MutationStatus.REJECTED,
          error: 'Category not found',
        };
      }
    }

    const updateData: any = {
      name: mutation.record.name,
      description: mutation.record.description,
      categoryId: mutation.record.categoryId || null,
      sku: mutation.record.sku,
      unit: mutation.record.unit,
      basePrice: new Decimal(mutation.record.basePrice),
      costPrice: mutation.record.costPrice
        ? new Decimal(mutation.record.costPrice)
        : null,
      defaultDurationMinutes: mutation.record.defaultDurationMinutes,
      isActive: mutation.record.isActive,
    };

    const item = await this.prisma.item.update({
      where: { id: mutation.record.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, color: true } },
        bundleAsParent: {
          include: {
            item: {
              select: { id: true, name: true, type: true, unit: true, basePrice: true },
            },
          },
        },
      },
    });

    // Update bundle items if type is BUNDLE
    if (existing.type === 'BUNDLE' && mutation.record.bundleItems) {
      // Delete existing bundle items
      await this.prisma.bundleItem.deleteMany({
        where: { bundleId: item.id },
      });

      // Create new bundle items
      for (const bi of mutation.record.bundleItems) {
        const childItem = await this.prisma.item.findFirst({
          where: { id: bi.itemId, userId },
        });
        if (childItem) {
          await this.prisma.bundleItem.create({
            data: {
              id: bi.id,
              userId,
              bundleId: item.id,
              itemId: bi.itemId,
              quantity: new Decimal(bi.quantity),
            },
          });
        }
      }

      // Refetch with updated bundle items
      const itemWithBundle = await this.prisma.item.findUnique({
        where: { id: item.id },
        include: {
          category: { select: { id: true, name: true, color: true } },
          bundleAsParent: {
            include: {
              item: {
                select: { id: true, name: true, type: true, unit: true, basePrice: true },
              },
            },
          },
        },
      });

      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
        record: this.toSyncItemDto(itemWithBundle),
      };
    }

    return {
      mutationId: mutation.mutationId,
      status: MutationStatus.APPLIED,
      record: this.toSyncItemDto(item),
    };
  }

  private async processItemDelete(
    userId: string,
    mutation: any,
  ): Promise<ItemMutationResultDto> {
    const existing = await this.prisma.item.findFirst({
      where: { id: mutation.record.id, userId },
      include: {
        _count: {
          select: {
            quoteItems: true,
            workOrderItems: true,
            bundleAsChild: true,
          },
        },
      },
    });

    if (!existing) {
      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.REJECTED,
        error: 'Item not found',
      };
    }

    // Check if item is in use
    const inUseCount =
      existing._count.quoteItems +
      existing._count.workOrderItems +
      existing._count.bundleAsChild;

    if (inUseCount > 0) {
      // Soft delete - just deactivate
      const item = await this.prisma.item.update({
        where: { id: mutation.record.id },
        data: { isActive: false },
        include: {
          category: { select: { id: true, name: true, color: true } },
          bundleAsParent: {
            include: {
              item: {
                select: { id: true, name: true, type: true, unit: true, basePrice: true },
              },
            },
          },
        },
      });

      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
        record: this.toSyncItemDto(item),
      };
    } else {
      // Hard delete - remove completely
      // First delete bundle items if this is a bundle
      await this.prisma.bundleItem.deleteMany({
        where: { bundleId: mutation.record.id },
      });

      await this.prisma.item.delete({
        where: { id: mutation.record.id },
      });

      return {
        mutationId: mutation.mutationId,
        status: MutationStatus.APPLIED,
      };
    }
  }
}
