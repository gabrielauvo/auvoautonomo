import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateWorkOrderTypeDto, UpdateWorkOrderTypeDto } from './dto';

export interface WorkOrderTypeFilters {
  search?: string;
  isActive?: boolean;
  updatedSince?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class WorkOrderTypesService {
  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
  ) {}

  /**
   * Check if the work order types feature is enabled for the user
   */
  async checkFeatureEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: {
          select: {
            usageLimits: {
              select: {
                enableWorkOrderTypes: true,
              },
            },
          },
        },
      },
    });

    return user?.plan?.usageLimits?.enableWorkOrderTypes ?? false;
  }

  /**
   * Throws if feature is not enabled
   */
  async ensureFeatureEnabled(userId: string): Promise<void> {
    const enabled = await this.checkFeatureEnabled(userId);
    if (!enabled) {
      throw new ForbiddenException({
        error: 'FEATURE_NOT_AVAILABLE',
        feature: 'WORK_ORDER_TYPES',
        message:
          'O recurso de Tipos de Ordem de Serviço não está disponível no seu plano',
      });
    }
  }

  /**
   * Create a new work order type
   */
  async create(userId: string, dto: CreateWorkOrderTypeDto) {
    await this.ensureFeatureEnabled(userId);

    // Check if name already exists for this user
    const existing = await this.prisma.workOrderType.findUnique({
      where: {
        userId_name: {
          userId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        error: 'DUPLICATE_NAME',
        message: 'Já existe um tipo de OS com este nome',
      });
    }

    return this.prisma.workOrderType.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
      },
    });
  }

  /**
   * Find all work order types for a user with optional filters
   */
  async findAll(userId: string, filters: WorkOrderTypeFilters = {}) {
    const { search, isActive, updatedSince, limit = 100, offset = 0 } = filters;

    const where: any = { userId };

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Filter by search term
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by updatedSince (for sync)
    if (updatedSince) {
      where.updatedAt = {
        gte: new Date(updatedSince),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrderType.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.workOrderType.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Find a single work order type by ID
   */
  async findOne(userId: string, id: string) {
    const type = await this.prisma.workOrderType.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!type) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Tipo de OS não encontrado',
      });
    }

    return type;
  }

  /**
   * Update a work order type
   */
  async update(userId: string, id: string, dto: UpdateWorkOrderTypeDto) {
    await this.ensureFeatureEnabled(userId);
    await this.findOne(userId, id);

    // Check for duplicate name if name is being changed
    if (dto.name) {
      const existing = await this.prisma.workOrderType.findFirst({
        where: {
          userId,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException({
          error: 'DUPLICATE_NAME',
          message: 'Já existe um tipo de OS com este nome',
        });
      }
    }

    return this.prisma.workOrderType.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Deactivate a work order type (soft delete)
   * This preserves the type for historical work orders
   */
  async deactivate(userId: string, id: string) {
    await this.ensureFeatureEnabled(userId);
    await this.findOne(userId, id);

    return this.prisma.workOrderType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Reactivate a work order type
   */
  async reactivate(userId: string, id: string) {
    await this.ensureFeatureEnabled(userId);
    await this.findOne(userId, id);

    return this.prisma.workOrderType.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Get sync data for mobile app
   * Returns types updated since a given timestamp
   * Response format matches SyncPullResponse expected by mobile SyncEngine
   */
  async getSyncData(userId: string, updatedSince?: string) {
    const where: any = { userId };

    if (updatedSince) {
      where.updatedAt = {
        gte: new Date(updatedSince),
      };
    }

    const items = await this.prisma.workOrderType.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
    });

    // Get the latest updatedAt for cursor
    const nextCursor =
      items.length > 0
        ? items[items.length - 1].updatedAt.toISOString()
        : null;

    const total = await this.prisma.workOrderType.count({ where: { userId } });

    return {
      items,
      nextCursor,
      serverTime: new Date().toISOString(),
      hasMore: false, // Types are typically few, no pagination needed for sync
      total,
    };
  }
}
