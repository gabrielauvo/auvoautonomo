import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

describe('ExpenseCategoriesController', () => {
  let controller: ExpenseCategoriesController;
  let service: ExpenseCategoriesService;

  const mockUser = { id: 'user-id', email: 'test@test.com' };

  const mockCategory = {
    id: 'category-id',
    userId: 'user-id',
    name: 'Material',
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { expenses: 3 },
  };

  const mockExpenseCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseCategoriesController],
      providers: [
        {
          provide: ExpenseCategoriesService,
          useValue: mockExpenseCategoriesService,
        },
      ],
    }).compile();

    controller = module.get<ExpenseCategoriesController>(
      ExpenseCategoriesController,
    );
    service = module.get<ExpenseCategoriesService>(ExpenseCategoriesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createDto: CreateExpenseCategoryDto = {
        name: 'Material',
        color: '#3B82F6',
      };

      mockExpenseCategoriesService.create.mockResolvedValue(mockCategory);

      const result = await controller.create(mockUser, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(mockCategory);
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [mockCategory];
      mockExpenseCategoriesService.findAll.mockResolvedValue(categories);

      const result = await controller.findAll(mockUser);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(categories);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      mockExpenseCategoriesService.findOne.mockResolvedValue(mockCategory);

      const result = await controller.findOne(mockUser, 'category-id');

      expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'category-id');
      expect(result).toEqual(mockCategory);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const updateDto: UpdateExpenseCategoryDto = {
        name: 'Materiais',
        color: '#10B981',
      };
      const updatedCategory = { ...mockCategory, ...updateDto };

      mockExpenseCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update(
        mockUser,
        'category-id',
        updateDto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockUser.id,
        'category-id',
        updateDto,
      );
      expect(result).toEqual(updatedCategory);
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      const categoryWithoutExpenses = {
        ...mockCategory,
        _count: { expenses: 0 },
      };
      mockExpenseCategoriesService.remove.mockResolvedValue(
        categoryWithoutExpenses,
      );

      const result = await controller.remove(mockUser, 'category-id');

      expect(service.remove).toHaveBeenCalledWith(mockUser.id, 'category-id');
      expect(result).toEqual(categoryWithoutExpenses);
    });
  });
});
