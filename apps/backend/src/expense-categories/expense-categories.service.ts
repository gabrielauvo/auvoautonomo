import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  private readonly logger = new Logger(ExpenseCategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, createDto: CreateExpenseCategoryDto) {
    this.logger.log(`Creating expense category for user ${userId}`);

    // Check for duplicate name within user's categories
    const existing = await this.prisma.expenseCategory.findFirst({
      where: {
        userId,
        name: { equals: createDto.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`Já existe uma categoria com o nome "${createDto.name}"`);
    }

    return this.prisma.expenseCategory.create({
      data: {
        ...createDto,
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

  async findAll(userId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { userId },
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
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Categoria com ID ${id} não encontrada`);
    }

    return category;
  }

  async update(userId: string, id: string, updateDto: UpdateExpenseCategoryDto) {
    await this.findOne(userId, id);

    // Check for duplicate name if name is being updated
    if (updateDto.name) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: {
          userId,
          name: { equals: updateDto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Já existe uma categoria com o nome "${updateDto.name}"`);
      }
    }

    this.logger.log(`Updating expense category ${id} for user ${userId}`);

    return this.prisma.expenseCategory.update({
      where: { id },
      data: updateDto,
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.findOne(userId, id);

    // Check if category has expenses
    if (category._count.expenses > 0) {
      throw new ConflictException(
        `Não é possível excluir a categoria "${category.name}" pois existem ${category._count.expenses} despesas vinculadas. Remova ou reclassifique as despesas primeiro.`
      );
    }

    this.logger.log(`Deleting expense category ${id} for user ${userId}`);

    return this.prisma.expenseCategory.delete({
      where: { id },
    });
  }
}
