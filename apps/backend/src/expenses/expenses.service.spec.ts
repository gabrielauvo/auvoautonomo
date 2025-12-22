import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseStatus, PaymentMethod } from '@prisma/client';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    expense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    supplier: {
      findFirst: jest.fn(),
    },
    expenseCategory: {
      findFirst: jest.fn(),
    },
    workOrder: {
      findFirst: jest.fn(),
    },
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockExpense = {
    id: 'expense-id',
    userId: 'user-id',
    supplierId: 'supplier-id',
    categoryId: 'category-id',
    workOrderId: null,
    description: 'Compra de materiais',
    notes: 'Urgente',
    amount: 1500.0,
    dueDate: new Date('2024-12-15'),
    paidAt: null,
    status: ExpenseStatus.PENDING,
    paymentMethod: PaymentMethod.PIX,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    supplier: { id: 'supplier-id', name: 'Fornecedor ABC' },
    category: { id: 'category-id', name: 'Material', color: '#3B82F6' },
    workOrder: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PlanLimitsService,
          useValue: mockPlanLimitsService,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new expense', async () => {
      const createDto: CreateExpenseDto = {
        description: 'Compra de materiais',
        amount: 1500.0,
        dueDate: '2024-12-15',
        status: ExpenseStatus.PENDING,
        paymentMethod: PaymentMethod.PIX,
        supplierId: 'supplier-id',
        categoryId: 'category-id',
        notes: 'Urgente',
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue({ id: 'supplier-id' });
      mockPrismaService.expenseCategory.findFirst.mockResolvedValue({ id: 'category-id' });
      mockPrismaService.expense.create.mockResolvedValue(mockExpense);

      const result = await service.create('user-id', createDto);

      expect(mockPlanLimitsService.checkLimitOrThrow).toHaveBeenCalledWith({
        userId: 'user-id',
        resource: 'EXPENSE',
      });
      expect(prisma.expense.create).toHaveBeenCalled();
      expect(result).toEqual(mockExpense);
    });

    it('should throw BadRequestException when supplier not found', async () => {
      const createDto: CreateExpenseDto = {
        description: 'Compra de materiais',
        amount: 1500.0,
        dueDate: '2024-12-15',
        supplierId: 'invalid-supplier-id',
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      await expect(service.create('user-id', createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-id', createDto)).rejects.toThrow(
        'Fornecedor não encontrado',
      );
    });

    it('should throw BadRequestException when category not found', async () => {
      const createDto: CreateExpenseDto = {
        description: 'Compra de materiais',
        amount: 1500.0,
        dueDate: '2024-12-15',
        categoryId: 'invalid-category-id',
      };

      mockPrismaService.expenseCategory.findFirst.mockResolvedValue(null);

      await expect(service.create('user-id', createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create('user-id', createDto)).rejects.toThrow(
        'Categoria não encontrada',
      );
    });

    it('should throw error when plan limit reached', async () => {
      mockPlanLimitsService.checkLimitOrThrow.mockRejectedValue(
        new Error('LIMIT_REACHED'),
      );

      const createDto: CreateExpenseDto = {
        description: 'Compra de materiais',
        amount: 1500.0,
        dueDate: '2024-12-15',
      };

      await expect(service.create('user-id', createDto)).rejects.toThrow(
        'LIMIT_REACHED',
      );
    });
  });

  describe('findAll', () => {
    it('should return all expenses for a user', async () => {
      const mockExpenses = [mockExpense];
      mockPrismaService.expense.findMany.mockResolvedValue(mockExpenses);

      const result = await service.findAll('user-id');

      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
        include: expect.any(Object),
        orderBy: expect.any(Array),
      });
      expect(result).toHaveLength(1);
      expect(result[0].isOverdue).toBeDefined();
    });

    it('should filter expenses by status', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([mockExpense]);

      await service.findAll('user-id', { status: ExpenseStatus.PENDING });

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ExpenseStatus.PENDING,
          }),
        }),
      );
    });

    it('should filter expenses by date range', async () => {
      mockPrismaService.expense.findMany.mockResolvedValue([mockExpense]);

      await service.findAll('user-id', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(prisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return an expense by id', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);

      const result = await service.findOne('user-id', 'expense-id');

      expect(prisma.expense.findFirst).toHaveBeenCalledWith({
        where: { id: 'expense-id', userId: 'user-id', deletedAt: null },
        include: expect.any(Object),
      });
      expect(result.isOverdue).toBeDefined();
    });

    it('should throw NotFoundException when expense not found', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('user-id', 'invalid-id')).rejects.toThrow(
        'Despesa com ID invalid-id não encontrada',
      );
    });
  });

  describe('update', () => {
    it('should update an expense', async () => {
      const updateDto: UpdateExpenseDto = {
        description: 'Compra atualizada',
        amount: 2000.0,
      };

      mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);
      mockPrismaService.expense.update.mockResolvedValue({
        ...mockExpense,
        ...updateDto,
      });

      const result = await service.update('user-id', 'expense-id', updateDto);

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'expense-id' },
        data: expect.objectContaining({
          description: 'Compra atualizada',
          amount: 2000.0,
        }),
        include: expect.any(Object),
      });
      expect(result.description).toBe('Compra atualizada');
    });

    it('should throw NotFoundException when updating non-existent expense', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      await expect(
        service.update('user-id', 'invalid-id', { description: 'Teste' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsPaid', () => {
    it('should mark an expense as paid', async () => {
      const paidExpense = {
        ...mockExpense,
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
      };

      mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);
      mockPrismaService.expense.update.mockResolvedValue(paidExpense);

      const result = await service.markAsPaid('user-id', 'expense-id', '2024-12-10');

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'expense-id' },
        data: {
          status: ExpenseStatus.PAID,
          paidAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(result.status).toBe(ExpenseStatus.PAID);
    });

    it('should mark as paid with current date if no date provided', async () => {
      const paidExpense = {
        ...mockExpense,
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
      };

      mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);
      mockPrismaService.expense.update.mockResolvedValue(paidExpense);

      await service.markAsPaid('user-id', 'expense-id');

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'expense-id' },
        data: {
          status: ExpenseStatus.PAID,
          paidAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });
  });

  describe('remove', () => {
    it('should soft delete an expense', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(mockExpense);
      mockPrismaService.expense.update.mockResolvedValue({
        ...mockExpense,
        deletedAt: new Date(),
      });

      const result = await service.remove('user-id', 'expense-id');

      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'expense-id' },
        data: {
          deletedAt: expect.any(Date),
        },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when deleting non-existent expense', async () => {
      mockPrismaService.expense.findFirst.mockResolvedValue(null);

      await expect(service.remove('user-id', 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSummary', () => {
    it('should return expense summary', async () => {
      mockPrismaService.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 }, _count: 10 }) // total
        .mockResolvedValueOnce({ _sum: { amount: 2000 }, _count: 5 }) // pending
        .mockResolvedValueOnce({ _sum: { amount: 2500 }, _count: 4 }) // paid
        .mockResolvedValueOnce({ _sum: { amount: 500 }, _count: 1 }) // canceled
        .mockResolvedValueOnce({ _sum: { amount: 1000 }, _count: 2 }); // overdue

      const result = await service.getSummary('user-id');

      expect(result).toEqual({
        total: { count: 10, amount: 5000 },
        pending: { count: 5, amount: 2000 },
        paid: { count: 4, amount: 2500 },
        canceled: { count: 1, amount: 500 },
        overdue: { count: 2, amount: 1000 },
      });
    });

    it('should filter summary by date range', async () => {
      mockPrismaService.expense.aggregate.mockResolvedValue({
        _sum: { amount: 1000 },
        _count: 3,
      });

      await service.getSummary('user-id', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(prisma.expense.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        }),
      );
    });

    it('should return 0 for amounts when no expenses exist (prevents NaN)', async () => {
      // When there are no expenses, Prisma returns null for _sum.amount
      mockPrismaService.expense.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }) // total
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }) // pending
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }) // paid
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }) // canceled
        .mockResolvedValueOnce({ _sum: { amount: null }, _count: 0 }); // overdue

      const result = await service.getSummary('user-id');

      // All amounts should be 0, not NaN
      expect(result.total.amount).toBe(0);
      expect(result.pending.amount).toBe(0);
      expect(result.paid.amount).toBe(0);
      expect(result.canceled.amount).toBe(0);
      expect(result.overdue.amount).toBe(0);

      // Verify they are numbers, not NaN
      expect(Number.isNaN(result.total.amount)).toBe(false);
      expect(Number.isNaN(result.pending.amount)).toBe(false);
      expect(Number.isNaN(result.paid.amount)).toBe(false);
      expect(Number.isNaN(result.canceled.amount)).toBe(false);
      expect(Number.isNaN(result.overdue.amount)).toBe(false);
    });
  });

  describe('count', () => {
    it('should return count of expenses for a user', async () => {
      mockPrismaService.expense.count.mockResolvedValue(15);

      const result = await service.count('user-id');

      expect(prisma.expense.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          deletedAt: null,
        },
      });
      expect(result).toBe(15);
    });
  });
});
