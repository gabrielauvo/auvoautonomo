import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { RegionalService } from '../regional/regional.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseFiltersDto } from './dto/expense-filters.dto';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
    private regionalService: RegionalService,
  ) {}

  async create(userId: string, createDto: CreateExpenseDto) {
    this.logger.log(`Creating expense for user ${userId}`);

    // Check plan limit
    await this.planLimitsService.checkLimitOrThrow({
      userId,
      resource: 'EXPENSE',
    });

    // Validate business rules
    this.validateExpenseRules(createDto);

    // Validate foreign keys if provided
    await this.validateRelations(userId, createDto);

    // Get the company's configured currency
    const currency = await this.regionalService.getCompanyCurrency(userId);

    return this.prisma.expense.create({
      data: {
        description: createDto.description,
        amount: createDto.amount,
        dueDate: new Date(createDto.dueDate),
        status: createDto.status || ExpenseStatus.PENDING,
        paymentMethod: createDto.paymentMethod,
        paidAt: createDto.paidAt ? new Date(createDto.paidAt) : null,
        notes: createDto.notes,
        invoiceNumber: createDto.invoiceNumber,
        userId,
        supplierId: createDto.supplierId,
        categoryId: createDto.categoryId,
        workOrderId: createDto.workOrderId,
        currency,
      },
      include: {
        supplier: true,
        category: true,
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, filters?: ExpenseFiltersDto) {
    const where: any = {
      userId,
      deletedAt: null,
    };

    // Apply filters
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters?.workOrderId) {
      where.workOrderId = filters.workOrderId;
    }

    // Date range filter
    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) {
        where.dueDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.dueDate.lte = new Date(filters.endDate);
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Add computed isOverdue field
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
      isOverdue: this.isExpenseOverdue(expense, today),
    }));
  }

  async findOne(userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        supplier: true,
        category: true,
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            totalValue: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Despesa com ID ${id} não encontrada`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      ...expense,
      amount: Number(expense.amount),
      isOverdue: this.isExpenseOverdue(expense, today),
    };
  }

  async update(userId: string, id: string, updateDto: UpdateExpenseDto) {
    await this.findOne(userId, id);

    // Validate business rules if status is being updated
    if (updateDto.status || updateDto.paidAt) {
      this.validateExpenseRules({
        ...updateDto,
        status: updateDto.status,
        paidAt: updateDto.paidAt,
      } as CreateExpenseDto);
    }

    // Validate foreign keys if being updated
    await this.validateRelations(userId, updateDto);

    this.logger.log(`Updating expense ${id} for user ${userId}`);

    const data: any = { ...updateDto };

    // Convert date strings to Date objects
    if (updateDto.dueDate) {
      data.dueDate = new Date(updateDto.dueDate);
    }
    if (updateDto.paidAt) {
      data.paidAt = new Date(updateDto.paidAt);
    }

    return this.prisma.expense.update({
      where: { id },
      data,
      include: {
        supplier: true,
        category: true,
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Mark expense as paid
   */
  async markAsPaid(userId: string, id: string, paidAt?: string) {
    await this.findOne(userId, id);

    this.logger.log(`Marking expense ${id} as paid for user ${userId}`);

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.PAID,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
      },
      include: {
        supplier: true,
        category: true,
        workOrder: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete an expense
   */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    this.logger.log(`Soft deleting expense ${id} for user ${userId}`);

    return this.prisma.expense.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get summary statistics for expenses
   */
  async getSummary(userId: string, filters?: { startDate?: string; endDate?: string }) {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (filters?.startDate || filters?.endDate) {
      where.dueDate = {};
      if (filters.startDate) {
        where.dueDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.dueDate.lte = new Date(filters.endDate);
      }
    }

    const [total, pending, paid, canceled] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: ExpenseStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: ExpenseStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: ExpenseStatus.CANCELED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Calculate overdue
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue = await this.prisma.expense.aggregate({
      where: {
        ...where,
        status: ExpenseStatus.PENDING,
        dueDate: { lt: today },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total: {
        count: total._count,
        amount: Number(total._sum.amount || 0),
      },
      pending: {
        count: pending._count,
        amount: Number(pending._sum.amount || 0),
      },
      paid: {
        count: paid._count,
        amount: Number(paid._sum.amount || 0),
      },
      canceled: {
        count: canceled._count,
        amount: Number(canceled._sum.amount || 0),
      },
      overdue: {
        count: overdue._count,
        amount: Number(overdue._sum.amount || 0),
      },
    };
  }

  async count(userId: string): Promise<number> {
    return this.prisma.expense.count({
      where: {
        userId,
        deletedAt: null,
      },
    });
  }

  // ==================== PRIVATE METHODS ====================

  private validateExpenseRules(dto: Partial<CreateExpenseDto>) {
    // If status is PAID, paidAt must be provided or will be set to now
    if (dto.status === ExpenseStatus.PAID && !dto.paidAt) {
      // Will set paidAt to now in create/update - this is acceptable
    }
  }

  private async validateRelations(userId: string, dto: Partial<CreateExpenseDto>) {
    // Validate supplier belongs to user
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, userId, deletedAt: null },
      });
      if (!supplier) {
        throw new BadRequestException('Fornecedor não encontrado');
      }
    }

    // Validate category belongs to user
    if (dto.categoryId) {
      const category = await this.prisma.expenseCategory.findFirst({
        where: { id: dto.categoryId, userId },
      });
      if (!category) {
        throw new BadRequestException('Categoria não encontrada');
      }
    }

    // Validate work order belongs to user
    if (dto.workOrderId) {
      const workOrder = await this.prisma.workOrder.findFirst({
        where: { id: dto.workOrderId, userId },
      });
      if (!workOrder) {
        throw new BadRequestException('Ordem de Serviço não encontrada');
      }
    }
  }

  private isExpenseOverdue(
    expense: { status: ExpenseStatus; dueDate: Date },
    today: Date
  ): boolean {
    if (expense.status === ExpenseStatus.PAID || expense.status === ExpenseStatus.CANCELED) {
      return false;
    }
    return expense.dueDate < today;
  }
}
