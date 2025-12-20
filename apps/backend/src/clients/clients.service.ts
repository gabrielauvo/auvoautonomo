import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
  ) {}

  async create(userId: string, createClientDto: CreateClientDto) {
    // Check plan limit before creating
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'CLIENT',
    });

    return this.prisma.client.create({
      data: {
        ...createClientDto,
        userId,
      },
      include: {
        equipment: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.client.findMany({
      where: {
        userId,
        deletedAt: null, // Exclude soft-deleted clients
      },
      include: {
        equipment: true,
        _count: {
          select: {
            quotes: true,
            workOrders: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, userId },
      include: {
        equipment: true,
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            quotes: true,
            workOrders: true,
            invoices: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async search(userId: string, query: string) {
    return this.prisma.client.findMany({
      where: {
        userId,
        deletedAt: null, // Exclude soft-deleted clients
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { taxId: { contains: query } },
        ],
      },
      include: {
        equipment: true,
        _count: {
          select: {
            quotes: true,
            workOrders: true,
            invoices: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async update(userId: string, id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(userId, id);

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
      include: {
        equipment: true,
      },
    });
  }

  /**
   * Soft delete a client (sets deletedAt timestamp)
   * This ensures proper sync with mobile app
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Soft delete multiple clients at once
   */
  async removeMany(userId: string, ids: string[]) {
    // Verify all clients belong to the user
    const clients = await this.prisma.client.findMany({
      where: {
        id: { in: ids },
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const validIds = clients.map((c) => c.id);

    if (validIds.length === 0) {
      return { count: 0 };
    }

    const result = await this.prisma.client.updateMany({
      where: {
        id: { in: validIds },
        userId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return { count: result.count, deletedIds: validIds };
  }

  async count(userId: string): Promise<number> {
    return this.prisma.client.count({
      where: {
        userId,
        deletedAt: null, // Only count active clients
      },
    });
  }
}
