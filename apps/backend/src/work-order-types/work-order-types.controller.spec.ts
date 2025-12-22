import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrderTypesController } from './work-order-types.controller';
import { WorkOrderTypesService } from './work-order-types.service';

describe('WorkOrderTypesController', () => {
  let controller: WorkOrderTypesController;
  let service: WorkOrderTypesService;

  const mockUserId = 'user-123';
  const mockTypeId = 'type-123';

  const mockWorkOrderType = {
    id: mockTypeId,
    userId: mockUserId,
    name: 'Instalação',
    description: 'Instalação de equipamentos',
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    getSyncData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrderTypesController],
      providers: [
        {
          provide: WorkOrderTypesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<WorkOrderTypesController>(WorkOrderTypesController);
    service = module.get<WorkOrderTypesService>(WorkOrderTypesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a work order type', async () => {
      const createDto = {
        name: 'Instalação',
        description: 'Instalação de equipamentos',
        color: '#3B82F6',
      };
      mockService.create.mockResolvedValue(mockWorkOrderType);

      const result = await controller.create(mockUserId, createDto);

      expect(result).toEqual(mockWorkOrderType);
      expect(mockService.create).toHaveBeenCalledWith(mockUserId, createDto);
    });
  });

  describe('findAll', () => {
    it('should return paginated work order types', async () => {
      const mockResult = {
        items: [mockWorkOrderType],
        total: 1,
        limit: 100,
        offset: 0,
      };
      mockService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockUserId);

      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: undefined,
        updatedSince: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should pass search filter', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });

      await controller.findAll(mockUserId, 'Instal');

      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: 'Instal',
        updatedSince: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should parse isActive filter as boolean', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });

      await controller.findAll(mockUserId, undefined, 'true');

      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: undefined,
        isActive: true,
        updatedSince: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should parse isActive=false correctly', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });

      await controller.findAll(mockUserId, undefined, 'false');

      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: undefined,
        isActive: false,
        updatedSince: undefined,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should pass updatedSince filter', async () => {
      const updatedSince = '2025-01-01T00:00:00.000Z';
      mockService.findAll.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 });

      await controller.findAll(mockUserId, undefined, undefined, updatedSince);

      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: undefined,
        updatedSince,
        limit: undefined,
        offset: undefined,
      });
    });

    it('should parse pagination parameters', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 50, limit: 10, offset: 20 });

      await controller.findAll(mockUserId, undefined, undefined, undefined, '10', '20');

      expect(mockService.findAll).toHaveBeenCalledWith(mockUserId, {
        search: undefined,
        updatedSince: undefined,
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('getSyncData', () => {
    it('should return sync data', async () => {
      const mockSyncData = {
        items: [mockWorkOrderType],
        nextCursor: mockWorkOrderType.updatedAt.toISOString(),
        serverTime: new Date().toISOString(),
        hasMore: false,
        total: 1,
      };
      mockService.getSyncData.mockResolvedValue(mockSyncData);

      const result = await controller.getSyncData(mockUserId);

      expect(result).toEqual(mockSyncData);
      expect(mockService.getSyncData).toHaveBeenCalledWith(mockUserId, undefined);
    });

    it('should pass updatedSince parameter', async () => {
      const updatedSince = '2025-01-01T00:00:00.000Z';
      mockService.getSyncData.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

      await controller.getSyncData(mockUserId, updatedSince);

      expect(mockService.getSyncData).toHaveBeenCalledWith(mockUserId, updatedSince);
    });
  });

  describe('findOne', () => {
    it('should return a work order type by id', async () => {
      mockService.findOne.mockResolvedValue(mockWorkOrderType);

      const result = await controller.findOne(mockUserId, mockTypeId);

      expect(result).toEqual(mockWorkOrderType);
      expect(mockService.findOne).toHaveBeenCalledWith(mockUserId, mockTypeId);
    });
  });

  describe('update', () => {
    it('should update a work order type', async () => {
      const updateDto = { name: 'Manutenção' };
      const updatedType = { ...mockWorkOrderType, name: 'Manutenção' };
      mockService.update.mockResolvedValue(updatedType);

      const result = await controller.update(mockUserId, mockTypeId, updateDto);

      expect(result).toEqual(updatedType);
      expect(mockService.update).toHaveBeenCalledWith(mockUserId, mockTypeId, updateDto);
    });
  });

  describe('deactivate', () => {
    it('should deactivate a work order type', async () => {
      const deactivatedType = { ...mockWorkOrderType, isActive: false };
      mockService.deactivate.mockResolvedValue(deactivatedType);

      const result = await controller.deactivate(mockUserId, mockTypeId);

      expect(result).toEqual(deactivatedType);
      expect(mockService.deactivate).toHaveBeenCalledWith(mockUserId, mockTypeId);
    });
  });

  describe('reactivate', () => {
    it('should reactivate a work order type', async () => {
      const reactivatedType = { ...mockWorkOrderType, isActive: true };
      mockService.reactivate.mockResolvedValue(reactivatedType);

      const result = await controller.reactivate(mockUserId, mockTypeId);

      expect(result).toEqual(reactivatedType);
      expect(mockService.reactivate).toHaveBeenCalledWith(mockUserId, mockTypeId);
    });
  });
});
