import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createEquipmentDto: CreateEquipmentDto) {
    // Verify that the client belongs to the user
    const client = await this.prisma.client.findFirst({
      where: {
        id: createEquipmentDto.clientId,
        userId,
      },
    });

    if (!client) {
      throw new ForbiddenException(
        `Client with ID ${createEquipmentDto.clientId} not found or does not belong to you`,
      );
    }

    return this.prisma.equipment.create({
      data: {
        ...createEquipmentDto,
        userId,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, clientId?: string, type?: string) {
    const where: any = { userId };

    if (clientId) {
      // Verify that the client belongs to the user
      const client = await this.prisma.client.findFirst({
        where: { id: clientId, userId },
      });

      if (!client) {
        throw new ForbiddenException(
          `Client with ID ${clientId} not found or does not belong to you`,
        );
      }

      where.clientId = clientId;
    }

    if (type) {
      where.type = {
        contains: type,
        mode: 'insensitive',
      };
    }

    return this.prisma.equipment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            workOrderEquipments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id, userId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        workOrderEquipments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            workOrder: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            workOrderEquipments: true,
          },
        },
      },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    return equipment;
  }

  async update(
    userId: string,
    id: string,
    updateEquipmentDto: UpdateEquipmentDto,
  ) {
    await this.findOne(userId, id);

    // If clientId is being changed, verify the new client belongs to the user
    if (updateEquipmentDto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: {
          id: updateEquipmentDto.clientId,
          userId,
        },
      });

      if (!client) {
        throw new ForbiddenException(
          `Client with ID ${updateEquipmentDto.clientId} not found or does not belong to you`,
        );
      }
    }

    return this.prisma.equipment.update({
      where: { id },
      data: updateEquipmentDto,
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    return this.prisma.equipment.delete({
      where: { id },
    });
  }

  async count(userId: string, clientId?: string): Promise<number> {
    const where: any = { userId };

    if (clientId) {
      where.clientId = clientId;
    }

    return this.prisma.equipment.count({
      where,
    });
  }

  async getByClient(userId: string, clientId: string) {
    // Verify that the client belongs to the user
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      throw new ForbiddenException(
        `Client with ID ${clientId} not found or does not belong to you`,
      );
    }

    return this.prisma.equipment.findMany({
      where: { userId, clientId },
      include: {
        _count: {
          select: {
            workOrderEquipments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
