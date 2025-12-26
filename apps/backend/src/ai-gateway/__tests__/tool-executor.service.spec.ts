import { Test, TestingModule } from '@nestjs/testing';
import { ToolExecutorService, TOOLS_METADATA } from '../services/tool-executor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionPlan } from '../guards/tool-permission.guard';
import { ToolPermission, ToolErrorCode } from '../dto/tool-params';

describe('ToolExecutorService', () => {
  let service: ToolExecutorService;

  const mockPrismaService = {
    client: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    workOrder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    payment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    asaasIntegration: {
      findUnique: jest.fn(),
    },
    aiPaymentPreview: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockContext = {
    userId: 'user-123',
    conversationId: 'conv-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolExecutorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ToolExecutorService>(ToolExecutorService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getToolMetadata', () => {
    it('should return metadata for existing tool', () => {
      const metadata = service.getToolMetadata('customers.search');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('customers.search');
      expect(metadata?.permission).toBe(ToolPermission.CUSTOMERS_READ);
      expect(metadata?.sideEffects).toBe('none');
      expect(metadata?.idempotent).toBe(true);
    });

    it('should return undefined for non-existing tool', () => {
      const metadata = service.getToolMetadata('nonexistent.tool');

      expect(metadata).toBeUndefined();
    });
  });

  describe('getAvailableTools', () => {
    it('should return only FREE tools for FREE plan', () => {
      const tools = service.getAvailableTools(SubscriptionPlan.FREE);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('customers.search');
      expect(toolNames).toContain('customers.get');
      expect(toolNames).toContain('customers.create');
      expect(toolNames).toContain('kb.search');
      expect(toolNames).not.toContain('workOrders.search');
      expect(toolNames).not.toContain('billing.getCharge');
    });

    it('should return STARTER tools for STARTER plan', () => {
      const tools = service.getAvailableTools(SubscriptionPlan.STARTER);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('customers.search');
      expect(toolNames).toContain('workOrders.search');
      expect(toolNames).toContain('quotes.create');
      expect(toolNames).not.toContain('billing.getCharge');
    });

    it('should return all tools for PROFESSIONAL plan', () => {
      const tools = service.getAvailableTools(SubscriptionPlan.PROFESSIONAL);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('customers.search');
      expect(toolNames).toContain('workOrders.search');
      expect(toolNames).toContain('billing.getCharge');
      expect(toolNames).toContain('billing.createCharge');
    });
  });

  describe('checkToolPermission', () => {
    it('should return true for allowed tool', () => {
      const result = service.checkToolPermission('customers.search', SubscriptionPlan.FREE);
      expect(result).toBe(true);
    });

    it('should return false for disallowed tool', () => {
      const result = service.checkToolPermission('billing.createCharge', SubscriptionPlan.FREE);
      expect(result).toBe(false);
    });

    it('should return false for non-existing tool', () => {
      const result = service.checkToolPermission('nonexistent.tool', SubscriptionPlan.ENTERPRISE);
      expect(result).toBe(false);
    });
  });

  describe('customersSearch', () => {
    it('should search customers successfully', async () => {
      const mockCustomers = [
        { id: 'c1', name: 'John Doe', email: 'john@example.com', phone: null, city: 'NYC', isDelinquent: false, createdAt: new Date() },
        { id: 'c2', name: 'Jane Doe', email: null, phone: '1234567890', city: null, isDelinquent: true, createdAt: new Date() },
      ];

      mockPrismaService.client.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.client.count.mockResolvedValue(2);

      const result = await service.customersSearch(
        { query: 'Doe', limit: 20, offset: 0 },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.customers).toHaveLength(2);
      expect(result.data?.total).toBe(2);
      expect(result.data?.hasMore).toBe(false);
      expect(result.affectedEntities).toHaveLength(2);
    });

    it('should filter by hasOverduePayments', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);
      mockPrismaService.client.count.mockResolvedValue(0);

      await service.customersSearch(
        { query: 'test', hasOverduePayments: true },
        mockContext,
      );

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            isDelinquent: true,
          }),
        }),
      );
    });
  });

  describe('customersGet', () => {
    it('should return customer details', async () => {
      const mockCustomer = {
        id: 'c1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        taxId: '12345678901',
        address: '123 Main St',
        city: 'NYC',
        state: 'NY',
        zipCode: '10001',
        notes: 'VIP customer',
        isDelinquent: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.customersGet({ id: 'c1' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John Doe');
      expect(result.affectedEntities?.[0]).toEqual({
        type: 'customer',
        id: 'c1',
        action: 'read',
      });
    });

    it('should return error for non-existing customer', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const result = await service.customersGet({ id: 'nonexistent' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ToolErrorCode.ENTITY_NOT_FOUND);
    });
  });

  describe('customersCreate', () => {
    it('should create customer successfully', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null); // No existing
      mockPrismaService.client.create.mockResolvedValue({
        id: 'c1',
        name: 'New Customer',
        email: 'new@example.com',
        phone: null,
        createdAt: new Date(),
      });

      const result = await service.customersCreate(
        {
          idempotencyKey: 'key-12345678',
          name: 'New Customer',
          email: 'new@example.com',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('New Customer');
      expect(result.affectedEntities?.[0].action).toBe('created');
    });

    it('should return existing customer on duplicate idempotency key', async () => {
      const existingCustomer = {
        id: 'existing-c1',
        name: 'Existing Customer',
        email: 'existing@example.com',
        phone: null,
        createdAt: new Date(),
      };

      mockPrismaService.client.findFirst.mockResolvedValue(existingCustomer);

      const result = await service.customersCreate(
        {
          idempotencyKey: 'duplicate-key',
          name: 'New Customer',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('existing-c1');
      expect(result.affectedEntities?.[0].action).toBe('read');
      expect(mockPrismaService.client.create).not.toHaveBeenCalled();
    });
  });

  describe('billingPreviewCharge', () => {
    it('should create charge preview successfully', async () => {
      const mockCustomer = {
        id: 'c1',
        name: 'John Doe',
        email: 'john@example.com',
        taxId: '12345678901',
        asaasCustomerId: 'cus_abc123',
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockCustomer);
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({ isActive: true });
      mockPrismaService.aiPaymentPreview.create.mockResolvedValue({
        id: 'preview-1',
        clientId: 'c1',
        billingType: 'PIX',
        value: 100,
        dueDate: new Date('2025-01-15'),
        description: 'Test charge',
        valid: true,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      const result = await service.billingPreviewCharge(
        {
          customerId: 'c1',
          value: 100,
          billingType: 'PIX' as any,
          dueDate: '2025-01-15',
          description: 'Test charge',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.preview.customerName).toBe('John Doe');
      expect(result.data?.customerHasPaymentProfile).toBe(true);
    });

    it('should add warning for customer without Asaas ID', async () => {
      const mockCustomer = {
        id: 'c1',
        name: 'John Doe',
        email: 'john@example.com',
        taxId: null,
        asaasCustomerId: null, // No Asaas ID
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockCustomer);
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({ isActive: true });
      mockPrismaService.aiPaymentPreview.create.mockResolvedValue({
        id: 'preview-1',
        valid: true,
        expiresAt: new Date(),
      });

      const result = await service.billingPreviewCharge(
        {
          customerId: 'c1',
          value: 100,
          billingType: 'PIX' as any,
          dueDate: '2025-01-15',
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.customerHasPaymentProfile).toBe(false);
      expect(result.data?.warnings).toContain('Customer will be automatically registered in Asaas');
    });

    it('should return error when customer not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const result = await service.billingPreviewCharge(
        {
          customerId: 'nonexistent',
          value: 100,
          billingType: 'PIX' as any,
          dueDate: '2025-01-15',
        },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ToolErrorCode.ENTITY_NOT_FOUND);
    });
  });

  describe('kbSearch', () => {
    it('should return placeholder results', async () => {
      const result = await service.kbSearch(
        { query: 'How do I create a customer?', limit: 5 },
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.data?.results).toHaveLength(1);
      expect(result.data?.totalResults).toBe(1);
    });
  });
});

describe('TOOLS_METADATA', () => {
  it('should have all required tools', () => {
    const requiredTools = [
      'customers.search',
      'customers.get',
      'customers.create',
      'workOrders.search',
      'workOrders.get',
      'workOrders.create',
      'quotes.search',
      'quotes.get',
      'quotes.create',
      'billing.getCharge',
      'billing.searchCharges',
      'billing.previewCharge',
      'billing.createCharge',
      'kb.search',
    ];

    requiredTools.forEach((tool) => {
      expect(TOOLS_METADATA[tool]).toBeDefined();
      expect(TOOLS_METADATA[tool].name).toBe(tool);
      expect(TOOLS_METADATA[tool].permission).toBeDefined();
      expect(TOOLS_METADATA[tool].sideEffects).toMatch(/^(none|write)$/);
      expect(typeof TOOLS_METADATA[tool].idempotent).toBe('boolean');
    });
  });

  it('should have correct side effects for write tools', () => {
    expect(TOOLS_METADATA['customers.create'].sideEffects).toBe('write');
    expect(TOOLS_METADATA['workOrders.create'].sideEffects).toBe('write');
    expect(TOOLS_METADATA['quotes.create'].sideEffects).toBe('write');
    expect(TOOLS_METADATA['billing.createCharge'].sideEffects).toBe('write');
  });

  it('should have no side effects for read tools', () => {
    expect(TOOLS_METADATA['customers.search'].sideEffects).toBe('none');
    expect(TOOLS_METADATA['customers.get'].sideEffects).toBe('none');
    expect(TOOLS_METADATA['billing.previewCharge'].sideEffects).toBe('none');
    expect(TOOLS_METADATA['kb.search'].sideEffects).toBe('none');
  });
});
