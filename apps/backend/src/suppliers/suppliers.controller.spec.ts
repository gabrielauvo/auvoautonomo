import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: SuppliersService;

  const mockUser = { id: 'user-id', email: 'test@test.com' };

  const mockSupplier = {
    id: 'supplier-id',
    userId: 'user-id',
    name: 'Fornecedor Teste',
    document: '12.345.678/0001-90',
    email: 'fornecedor@teste.com',
    phone: '(11) 99999-9999',
    address: 'Rua Teste, 123',
    notes: 'Observações',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    _count: { expenses: 2 },
  };

  const mockSuppliersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [
        {
          provide: SuppliersService,
          useValue: mockSuppliersService,
        },
      ],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
    service = module.get<SuppliersService>(SuppliersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const createDto: CreateSupplierDto = {
        name: 'Fornecedor Teste',
        document: '12.345.678/0001-90',
        email: 'fornecedor@teste.com',
        phone: '(11) 99999-9999',
        address: 'Rua Teste, 123',
        notes: 'Observações',
      };

      mockSuppliersService.create.mockResolvedValue(mockSupplier);

      const result = await controller.create(mockUser, createDto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(mockSupplier);
    });
  });

  describe('findAll', () => {
    it('should return all suppliers', async () => {
      const suppliers = [mockSupplier];
      mockSuppliersService.findAll.mockResolvedValue(suppliers);

      const result = await controller.findAll(mockUser);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id, {
        search: undefined,
      });
      expect(result).toEqual(suppliers);
    });

    it('should return suppliers with search filter', async () => {
      const suppliers = [mockSupplier];
      mockSuppliersService.findAll.mockResolvedValue(suppliers);

      const result = await controller.findAll(mockUser, 'Teste');

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id, {
        search: 'Teste',
      });
      expect(result).toEqual(suppliers);
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      const supplierWithExpenses = {
        ...mockSupplier,
        expenses: [],
      };
      mockSuppliersService.findOne.mockResolvedValue(supplierWithExpenses);

      const result = await controller.findOne(mockUser, 'supplier-id');

      expect(service.findOne).toHaveBeenCalledWith(mockUser.id, 'supplier-id');
      expect(result).toEqual(supplierWithExpenses);
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      const updateDto: UpdateSupplierDto = {
        name: 'Fornecedor Atualizado',
        phone: '(11) 88888-8888',
      };
      const updatedSupplier = { ...mockSupplier, ...updateDto };

      mockSuppliersService.update.mockResolvedValue(updatedSupplier);

      const result = await controller.update(
        mockUser,
        'supplier-id',
        updateDto,
      );

      expect(service.update).toHaveBeenCalledWith(
        mockUser.id,
        'supplier-id',
        updateDto,
      );
      expect(result).toEqual(updatedSupplier);
    });
  });

  describe('remove', () => {
    it('should soft delete a supplier', async () => {
      const deletedSupplier = { ...mockSupplier, deletedAt: new Date() };
      mockSuppliersService.remove.mockResolvedValue(deletedSupplier);

      const result = await controller.remove(mockUser, 'supplier-id');

      expect(service.remove).toHaveBeenCalledWith(mockUser.id, 'supplier-id');
      expect(result).toEqual(deletedSupplier);
    });
  });
});
