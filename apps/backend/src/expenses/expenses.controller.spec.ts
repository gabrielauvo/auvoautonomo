import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseFiltersDto } from './dto/expense-filters.dto';
import { ExpenseStatus, ExpensePaymentMethod } from '@prisma/client';

describe('ExpensesController', () => {
  let controller: ExpensesController;
  let service: ExpensesService;

  const mockUser = { id: 'user-id', email: 'test@test.com' };

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
    paymentMethod: ExpensePaymentMethod.PIX,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    supplier: { id: 'supplier-id', name: 'Fornecedor ABC' },
    category: { id: 'category-id', name: 'Material', color: '#3B82F6' },
    workOrder: null,
    isOverdue: false,
  };

  const mockSummary = {
    total: { count: 10, amount: 5000 },
    pending: { count: 5, amount: 2000 },
    paid: { count: 4, amount: 2500 },
    canceled: { count: 1, amount: 500 },
    overdue: { count: 2, amount: 1000 },
  };

  const mockExpensesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    markAsPaid: jest.fn(),
    remove: jest.fn(),
    getSummary: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        {
          provide: ExpensesService,
          useValue: mockExpensesService,
        },
      ],
    }).compile();

    controller = module.get<ExpensesController>(ExpensesController);
    service = module.get<ExpensesService>(ExpensesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new expense', async () => {
      const createDto: CreateExpenseDto = {
        description: 'Compra de materiais',
        amount: 1500.0,
        dueDate: '2024-12-15',
        status: ExpenseStatus.PENDING,
        paymentMethod: ExpensePaymentMethod.PIX,
        supplierId: 'supplier-id',
        categoryId: 'category-id',
      };

      mockExpensesService.create.mockResolvedValue(mockExpense);

      const result = await controller.create(mockUser, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(mockExpense);
    });
  });

  describe('findAll', () => {
    it('should return all expenses', async () => {
      const expenses = [mockExpense];
      mockExpensesService.findAll.mockResolvedValue(expenses);

      const filters: ExpenseFiltersDto = {};
      const result = await controller.findAll(mockUser, filters);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id, filters);
      expect(result).toEqual(expenses);
    });

    it('should return expenses with filters', async () => {
      const expenses = [mockExpense];
      mockExpensesService.findAll.mockResolvedValue(expenses);

      const filters: ExpenseFiltersDto = {
        status: ExpenseStatus.PENDING,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      const result = await controller.findAll(mockUser, filters);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id, filters);
      expect(result).toEqual(expenses);
    });
  });

  describe('getSummary', () => {
    it('should return expense summary', async () => {
      mockExpensesService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(mockUser);

      expect(service.getSummary).toHaveBeenCalledWith(mockUser.id, {
        startDate: undefined,
        endDate: undefined,
      });
      expect(result).toEqual(mockSummary);
    });

    it('should return summary with date filters', async () => {
      mockExpensesService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary(
        mockUser,
        '2024-01-01',
        '2024-12-31',
      );

      expect(service.getSummary).toHaveBeenCalledWith(mockUser.id, {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      expect(result).toEqual(mockSummary);
    });
  });

  describe('findOne', () => {
    it('should return an expense by id', async () => {
      mockExpensesService.findOne.mockResolvedValue(mockExpense);

      const result = await controller.findOne(mockUser, 'expense-id');

      expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'expense-id');
      expect(result).toEqual(mockExpense);
    });
  });

  describe('update', () => {
    it('should update an expense', async () => {
      const updateDto: UpdateExpenseDto = {
        description: 'Compra atualizada',
        amount: 2000.0,
      };
      const updatedExpense = { ...mockExpense, ...updateDto };

      mockExpensesService.update.mockResolvedValue(updatedExpense);

      const result = await controller.update(mockUser, 'expense-id', updateDto);

      expect(service.update).toHaveBeenCalledWith(
        mockUser.id,
        'expense-id',
        updateDto,
      );
      expect(result).toEqual(updatedExpense);
    });
  });

  describe('markAsPaid', () => {
    it('should mark an expense as paid', async () => {
      const paidExpense = {
        ...mockExpense,
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
      };

      mockExpensesService.markAsPaid.mockResolvedValue(paidExpense);

      const result = await controller.markAsPaid(
        mockUser,
        'expense-id',
        '2024-12-10',
      );

      expect(service.markAsPaid).toHaveBeenCalledWith(
        mockUser.id,
        'expense-id',
        '2024-12-10',
      );
      expect(result).toEqual(paidExpense);
    });

    it('should mark as paid without date', async () => {
      const paidExpense = {
        ...mockExpense,
        status: ExpenseStatus.PAID,
        paidAt: new Date(),
      };

      mockExpensesService.markAsPaid.mockResolvedValue(paidExpense);

      const result = await controller.markAsPaid(mockUser, 'expense-id');

      expect(service.markAsPaid).toHaveBeenCalledWith(
        mockUser.id,
        'expense-id',
        undefined,
      );
      expect(result).toEqual(paidExpense);
    });
  });

  describe('remove', () => {
    it('should soft delete an expense', async () => {
      const deletedExpense = { ...mockExpense, deletedAt: new Date() };
      mockExpensesService.remove.mockResolvedValue(deletedExpense);

      const result = await controller.remove(mockUser, 'expense-id');

      expect(service.remove).toHaveBeenCalledWith(mockUser.id, 'expense-id');
      expect(result).toEqual(deletedExpense);
    });
  });
});
