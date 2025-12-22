import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
  ) {}

  async create(userId: string, createSupplierDto: CreateSupplierDto) {
    this.logger.log(`Creating supplier for user ${userId}`);

    // Check plan limit before creating (uses SUPPLIER resource type)
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'SUPPLIER',
    });

    return this.prisma.supplier.create({
      data: {
        ...createSupplierDto,
        userId,
      },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, options?: { search?: string }) {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { document: { contains: options.search } },
        { phone: { contains: options.search } },
      ];
    }

    return this.prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        expenses: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Fornecedor com ID ${id} não encontrado`);
    }

    return supplier;
  }

  async update(userId: string, id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(userId, id);

    this.logger.log(`Updating supplier ${id} for user ${userId}`);

    return this.prisma.supplier.update({
      where: { id },
      data: updateSupplierDto,
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a supplier (sets deletedAt timestamp)
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    this.logger.log(`Soft deleting supplier ${id} for user ${userId}`);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async count(userId: string): Promise<number> {
    return this.prisma.supplier.count({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }
}
