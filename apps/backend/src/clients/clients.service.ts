import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  /**
   * Normalize taxId by removing formatting characters
   */
  private normalizeTaxId(taxId: string | undefined | null): string | null {
    if (!taxId) return null;
    return taxId.replace(/[.\-\/]/g, '');
  }

  /**
   * Check for duplicate clients based on name+phone or taxId
   * @throws BadRequestException if duplicate found
   */
  private async checkForDuplicates(
    userId: string,
    name: string,
    phone: string | undefined | null,
    taxId: string | undefined | null,
    excludeId?: string,
  ): Promise<void> {
    const normalizedTaxId = this.normalizeTaxId(taxId);

    // Build conditions for duplicate check
    const orConditions: any[] = [];

    // Check name + phone combination (both must be present and match)
    if (name && phone) {
      orConditions.push({
        name: { equals: name, mode: 'insensitive' },
        phone: phone,
      });
    }

    // Check taxId (CPF/CNPJ) - must match normalized version
    if (normalizedTaxId) {
      // Check both formatted and unformatted versions
      orConditions.push({
        taxId: taxId, // Exact match with formatting
      });
      orConditions.push({
        taxId: normalizedTaxId, // Match without formatting
      });
    }

    if (orConditions.length === 0) {
      return; // Nothing to check
    }

    const existingClient = await this.prisma.client.findFirst({
      where: {
        userId,
        deletedAt: null, // Only check active clients
        ...(excludeId && { id: { not: excludeId } }),
        OR: orConditions,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        taxId: true,
      },
    });

    if (existingClient) {
      // Determine which field caused the duplicate
      const existingNormalizedTaxId = this.normalizeTaxId(existingClient.taxId);

      if (normalizedTaxId && existingNormalizedTaxId === normalizedTaxId) {
        throw new BadRequestException(
          `Já existe um cliente cadastrado com este CPF/CNPJ: ${existingClient.name}`,
        );
      }

      if (
        name &&
        phone &&
        existingClient.name.toLowerCase() === name.toLowerCase() &&
        existingClient.phone === phone
      ) {
        throw new BadRequestException(
          `Já existe um cliente cadastrado com este nome e telefone: ${existingClient.name}`,
        );
      }

      // Generic fallback
      throw new BadRequestException(
        `Já existe um cliente com dados semelhantes: ${existingClient.name}`,
      );
    }
  }

  async create(userId: string, createClientDto: CreateClientDto) {
    // Check plan limit before creating
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'CLIENT',
    });

    // Check for duplicates
    await this.checkForDuplicates(
      userId,
      createClientDto.name,
      createClientDto.phone,
      createClientDto.taxId,
    );

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
    const existingClient = await this.findOne(userId, id);

    // Check for duplicates only if relevant fields are being updated
    const nameToCheck = updateClientDto.name ?? existingClient.name;
    const phoneToCheck =
      updateClientDto.phone !== undefined
        ? updateClientDto.phone
        : existingClient.phone;
    const taxIdToCheck =
      updateClientDto.taxId !== undefined
        ? updateClientDto.taxId
        : existingClient.taxId;

    // Only check if name, phone or taxId are actually changing
    const isChangingName =
      updateClientDto.name && updateClientDto.name !== existingClient.name;
    const isChangingPhone =
      updateClientDto.phone !== undefined &&
      updateClientDto.phone !== existingClient.phone;
    const isChangingTaxId =
      updateClientDto.taxId !== undefined &&
      updateClientDto.taxId !== existingClient.taxId;

    if (isChangingName || isChangingPhone || isChangingTaxId) {
      await this.checkForDuplicates(
        userId,
        nameToCheck,
        phoneToCheck,
        taxIdToCheck,
        id, // Exclude current client from duplicate check
      );
    }

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
