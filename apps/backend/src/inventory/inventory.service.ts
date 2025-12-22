import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WorkOrderStatus,
  InventoryMovementType,
  InventoryMovementSource,
  ItemType,
  Prisma,
} from '@prisma/client';
import {
  UpdateInventorySettingsDto,
  InventorySettingsResponseDto,
  InventoryBalanceResponseDto,
  InventoryBalanceListResponseDto,
  UpdateBalanceDto,
  CreateMovementDto,
  InventoryMovementResponseDto,
  MovementListQueryDto,
  MovementListResponseDto,
} from './dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // Feature Flag Check
  // ============================================================================

  async isFeatureEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        plan: {
          include: {
            usageLimits: true,
          },
        },
      },
    });

    if (!user?.plan?.usageLimits) {
      return false;
    }

    return user.plan.usageLimits.enableInventory === true;
  }

  async checkFeatureEnabled(userId: string): Promise<void> {
    const enabled = await this.isFeatureEnabled(userId);
    if (!enabled) {
      throw new ForbiddenException(
        'Funcionalidade de estoque não está disponível no seu plano',
      );
    }
  }

  // ============================================================================
  // Settings
  // ============================================================================

  async getSettings(userId: string): Promise<InventorySettingsResponseDto> {
    const featureEnabled = await this.isFeatureEnabled(userId);

    let settings = await this.prisma.inventorySettings.findUnique({
      where: { userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await this.prisma.inventorySettings.create({
        data: {
          userId,
          isEnabled: false,
          deductOnStatus: WorkOrderStatus.DONE,
          allowNegativeStock: false,
          deductOnlyOncePerWorkOrder: true,
        },
      });
    }

    return {
      ...settings,
      featureEnabled,
    };
  }

  async updateSettings(
    userId: string,
    dto: UpdateInventorySettingsDto,
  ): Promise<InventorySettingsResponseDto> {
    await this.checkFeatureEnabled(userId);

    const settings = await this.prisma.inventorySettings.upsert({
      where: { userId },
      update: {
        ...dto,
        updatedAt: new Date(),
      },
      create: {
        userId,
        isEnabled: dto.isEnabled ?? false,
        deductOnStatus: dto.deductOnStatus ?? WorkOrderStatus.DONE,
        allowNegativeStock: dto.allowNegativeStock ?? false,
        deductOnlyOncePerWorkOrder: dto.deductOnlyOncePerWorkOrder ?? true,
      },
    });

    const featureEnabled = await this.isFeatureEnabled(userId);

    return {
      ...settings,
      featureEnabled,
    };
  }

  // ============================================================================
  // Balances
  // ============================================================================

  async getBalances(userId: string): Promise<InventoryBalanceListResponseDto> {
    // Get all products for user with their balances
    const products = await this.prisma.item.findMany({
      where: {
        userId,
        type: ItemType.PRODUCT,
        isActive: true,
      },
      include: {
        inventoryBalance: true,
      },
      orderBy: { name: 'asc' },
    });

    const items: InventoryBalanceResponseDto[] = products.map((product) => ({
      id: product.inventoryBalance?.id ?? product.id,
      itemId: product.id,
      itemName: product.name,
      itemSku: product.sku ?? undefined,
      itemUnit: product.unit,
      quantity: product.inventoryBalance
        ? Number(product.inventoryBalance.quantity)
        : 0,
      createdAt: product.inventoryBalance?.createdAt ?? product.createdAt,
      updatedAt: product.inventoryBalance?.updatedAt ?? product.updatedAt,
    }));

    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      total: items.length,
      totalSkus: items.filter((i) => i.quantity > 0).length,
      totalQuantity,
    };
  }

  async getBalance(
    userId: string,
    itemId: string,
  ): Promise<InventoryBalanceResponseDto> {
    const product = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        userId,
        type: ItemType.PRODUCT,
      },
      include: {
        inventoryBalance: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    return {
      id: product.inventoryBalance?.id ?? product.id,
      itemId: product.id,
      itemName: product.name,
      itemSku: product.sku ?? undefined,
      itemUnit: product.unit,
      quantity: product.inventoryBalance
        ? Number(product.inventoryBalance.quantity)
        : 0,
      createdAt: product.inventoryBalance?.createdAt ?? product.createdAt,
      updatedAt: product.inventoryBalance?.updatedAt ?? product.updatedAt,
    };
  }

  async updateBalance(
    userId: string,
    itemId: string,
    dto: UpdateBalanceDto,
  ): Promise<InventoryBalanceResponseDto> {
    await this.checkFeatureEnabled(userId);

    const settings = await this.getSettings(userId);
    if (!settings.isEnabled) {
      throw new BadRequestException('Controle de estoque não está ativo');
    }

    // Validate product exists
    const product = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        userId,
        type: ItemType.PRODUCT,
      },
      include: {
        inventoryBalance: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Check negative stock
    if (!settings.allowNegativeStock && dto.quantity < 0) {
      throw new BadRequestException(
        'Estoque negativo não é permitido nas configurações',
      );
    }

    const currentBalance = product.inventoryBalance
      ? Number(product.inventoryBalance.quantity)
      : 0;

    const difference = dto.quantity - currentBalance;

    // Use transaction to update balance and create movement
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert balance
      const balance = await tx.inventoryBalance.upsert({
        where: { itemId },
        update: {
          quantity: dto.quantity,
          updatedAt: new Date(),
        },
        create: {
          itemId,
          quantity: dto.quantity,
        },
      });

      // Create movement record
      if (difference !== 0) {
        await tx.inventoryMovement.create({
          data: {
            itemId,
            type:
              difference > 0
                ? InventoryMovementType.ADJUSTMENT_IN
                : InventoryMovementType.ADJUSTMENT_OUT,
            source: InventoryMovementSource.MANUAL,
            quantity: difference,
            balanceAfter: dto.quantity,
            notes: dto.notes,
            createdBy: userId,
          },
        });
      }

      return balance;
    });

    return {
      id: result.id,
      itemId: product.id,
      itemName: product.name,
      itemSku: product.sku ?? undefined,
      itemUnit: product.unit,
      quantity: Number(result.quantity),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  // ============================================================================
  // Initial Stock (sem verificação de isEnabled)
  // ============================================================================

  /**
   * Define estoque inicial para um produto recém-criado.
   * Este método NÃO exige que o controle de estoque esteja ativo,
   * permitindo definir estoque inicial mesmo antes de ativar o módulo.
   */
  async setInitialStock(
    userId: string,
    itemId: string,
    quantity: number,
    notes?: string,
  ): Promise<InventoryBalanceResponseDto> {
    // Apenas verifica feature flag (plano), não se está ativo
    await this.checkFeatureEnabled(userId);

    // Validate product exists and belongs to user
    const product = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        userId,
        type: ItemType.PRODUCT,
      },
      include: {
        inventoryBalance: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    // Se já tem saldo, não permite usar este método
    if (product.inventoryBalance && Number(product.inventoryBalance.quantity) > 0) {
      throw new BadRequestException(
        'Produto já possui saldo. Use o ajuste de estoque para modificar.',
      );
    }

    // Use transaction to create balance and movement
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert balance
      const balance = await tx.inventoryBalance.upsert({
        where: { itemId },
        update: {
          quantity,
          updatedAt: new Date(),
        },
        create: {
          itemId,
          quantity,
        },
      });

      // Create movement record
      await tx.inventoryMovement.create({
        data: {
          itemId,
          type: InventoryMovementType.ADJUSTMENT_IN,
          source: InventoryMovementSource.MANUAL,
          quantity,
          balanceAfter: quantity,
          notes: notes || 'Estoque inicial',
          createdBy: userId,
        },
      });

      return balance;
    });

    this.logger.log(
      `Initial stock set for item ${itemId}: ${quantity} units`,
    );

    return {
      id: result.id,
      itemId: product.id,
      itemName: product.name,
      itemSku: product.sku ?? undefined,
      itemUnit: product.unit,
      quantity: Number(result.quantity),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  // ============================================================================
  // Movements
  // ============================================================================

  async createMovement(
    userId: string,
    dto: CreateMovementDto,
  ): Promise<InventoryMovementResponseDto> {
    await this.checkFeatureEnabled(userId);

    const settings = await this.getSettings(userId);
    if (!settings.isEnabled) {
      throw new BadRequestException('Controle de estoque não está ativo');
    }

    // Validate product exists
    const product = await this.prisma.item.findFirst({
      where: {
        id: dto.itemId,
        userId,
        type: ItemType.PRODUCT,
      },
      include: {
        inventoryBalance: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }

    const currentBalance = product.inventoryBalance
      ? Number(product.inventoryBalance.quantity)
      : 0;

    // Calculate new balance
    const quantityChange =
      dto.type === 'ADJUSTMENT_IN' ? dto.quantity : -dto.quantity;
    const newBalance = currentBalance + quantityChange;

    // Check negative stock
    if (!settings.allowNegativeStock && newBalance < 0) {
      throw new BadRequestException(
        `Estoque insuficiente. Saldo atual: ${currentBalance}, tentando retirar: ${dto.quantity}`,
      );
    }

    // Use transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert balance
      await tx.inventoryBalance.upsert({
        where: { itemId: dto.itemId },
        update: {
          quantity: newBalance,
          updatedAt: new Date(),
        },
        create: {
          itemId: dto.itemId,
          quantity: newBalance,
        },
      });

      // Create movement
      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: dto.itemId,
          type: dto.type as InventoryMovementType,
          source: InventoryMovementSource.MANUAL,
          quantity: quantityChange,
          balanceAfter: newBalance,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      return movement;
    });

    return {
      id: result.id,
      itemId: result.itemId,
      itemName: product.name,
      itemSku: product.sku ?? undefined,
      type: result.type,
      source: result.source,
      quantity: Number(result.quantity),
      balanceAfter: Number(result.balanceAfter),
      sourceId: result.sourceId ?? undefined,
      notes: result.notes ?? undefined,
      createdBy: result.createdBy ?? undefined,
      createdAt: result.createdAt,
    };
  }

  async getMovements(
    userId: string,
    query: MovementListQueryDto,
  ): Promise<MovementListResponseDto> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Build where clause - only movements for products owned by user
    const productIds = await this.prisma.item
      .findMany({
        where: { userId, type: ItemType.PRODUCT },
        select: { id: true },
      })
      .then((items) => items.map((i) => i.id));

    const where: Prisma.InventoryMovementWhereInput = {
      itemId: { in: productIds },
    };

    if (query.itemId) {
      where.itemId = query.itemId;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    // Get product names
    const items = await this.prisma.item.findMany({
      where: { id: { in: movements.map((m) => m.itemId) } },
      select: { id: true, name: true, sku: true },
    });

    const itemMap = new Map(items.map((i) => [i.id, i]));

    return {
      items: movements.map((m) => ({
        id: m.id,
        itemId: m.itemId,
        itemName: itemMap.get(m.itemId)?.name,
        itemSku: itemMap.get(m.itemId)?.sku ?? undefined,
        type: m.type,
        source: m.source,
        quantity: Number(m.quantity),
        balanceAfter: Number(m.balanceAfter),
        sourceId: m.sourceId ?? undefined,
        notes: m.notes ?? undefined,
        createdBy: m.createdBy ?? undefined,
        createdAt: m.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  // ============================================================================
  // Work Order Deduction (used by work-orders service)
  // ============================================================================

  async deductForWorkOrder(
    userId: string,
    workOrderId: string,
  ): Promise<{ deducted: boolean; itemsCount: number; message: string }> {
    const settings = await this.prisma.inventorySettings.findUnique({
      where: { userId },
    });

    // Check if inventory is enabled
    if (!settings?.isEnabled) {
      return { deducted: false, itemsCount: 0, message: 'Estoque desabilitado' };
    }

    // Check idempotency - already deducted?
    if (settings.deductOnlyOncePerWorkOrder) {
      const existing = await this.prisma.workOrderInventoryDeduction.findUnique(
        {
          where: { workOrderId },
        },
      );

      if (existing) {
        return {
          deducted: false,
          itemsCount: 0,
          message: 'Baixa já realizada para esta OS',
        };
      }
    }

    // Get work order items (only products)
    const workOrderItems = await this.prisma.workOrderItem.findMany({
      where: {
        workOrderId,
        type: ItemType.PRODUCT,
        itemId: { not: null },
      },
      include: {
        item: {
          include: {
            inventoryBalance: true,
          },
        },
      },
    });

    if (workOrderItems.length === 0) {
      return { deducted: false, itemsCount: 0, message: 'Sem produtos na OS' };
    }

    // Validate stock availability if negative not allowed
    if (!settings.allowNegativeStock) {
      for (const woItem of workOrderItems) {
        if (!woItem.item) continue;
        const currentStock = woItem.item.inventoryBalance
          ? Number(woItem.item.inventoryBalance.quantity)
          : 0;
        const requiredQty = Number(woItem.quantity);

        if (currentStock < requiredQty) {
          this.logger.warn(
            `Estoque insuficiente para ${woItem.item.name}: ${currentStock} < ${requiredQty}`,
          );
          // Continue anyway - log warning but don't block
        }
      }
    }

    // Perform deduction in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const woItem of workOrderItems) {
        if (!woItem.item || !woItem.itemId) continue;

        const currentStock = woItem.item.inventoryBalance
          ? Number(woItem.item.inventoryBalance.quantity)
          : 0;
        const deductQty = Number(woItem.quantity);
        const newBalance = currentStock - deductQty;

        // Upsert balance
        await tx.inventoryBalance.upsert({
          where: { itemId: woItem.itemId },
          update: {
            quantity: newBalance,
            updatedAt: new Date(),
          },
          create: {
            itemId: woItem.itemId,
            quantity: newBalance,
          },
        });

        // Create movement with idempotency key
        try {
          await tx.inventoryMovement.create({
            data: {
              itemId: woItem.itemId,
              type: InventoryMovementType.WORK_ORDER_OUT,
              source: InventoryMovementSource.WORK_ORDER,
              quantity: -deductQty,
              balanceAfter: newBalance,
              sourceId: workOrderId,
              notes: `Baixa automática - OS`,
              createdBy: userId,
            },
          });
        } catch (error) {
          // Unique constraint violation - movement already exists (idempotency)
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            this.logger.debug(
              `Movement already exists for item ${woItem.itemId} and WO ${workOrderId}`,
            );
            continue;
          }
          throw error;
        }
      }

      // Record deduction for idempotency
      await tx.workOrderInventoryDeduction.create({
        data: {
          workOrderId,
          itemsCount: workOrderItems.length,
          notes: 'Baixa automática por conclusão de OS',
        },
      });
    });

    this.logger.log(
      `Inventory deducted for WO ${workOrderId}: ${workOrderItems.length} items`,
    );

    return {
      deducted: true,
      itemsCount: workOrderItems.length,
      message: `${workOrderItems.length} produto(s) baixado(s)`,
    };
  }

  // ============================================================================
  // Dashboard/Report
  // ============================================================================

  async getDashboard(userId: string): Promise<{
    totalSkus: number;
    totalQuantity: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentMovements: InventoryMovementResponseDto[];
  }> {
    const balances = await this.getBalances(userId);

    const lowStockThreshold = 5; // Could be configurable
    const lowStockCount = balances.items.filter(
      (i) => i.quantity > 0 && i.quantity <= lowStockThreshold,
    ).length;
    const outOfStockCount = balances.items.filter(
      (i) => i.quantity <= 0,
    ).length;

    const recentMovements = await this.getMovements(userId, { limit: 10 });

    return {
      totalSkus: balances.totalSkus,
      totalQuantity: balances.totalQuantity,
      lowStockCount,
      outOfStockCount,
      recentMovements: recentMovements.items,
    };
  }
}
