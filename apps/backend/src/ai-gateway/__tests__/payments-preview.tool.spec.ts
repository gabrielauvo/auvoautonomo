import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsPreviewTool } from '../tools/payments/payments-preview.tool';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../services/tool-registry.service';
import { ToolContext } from '../interfaces/tool.interface';

describe('PaymentsPreviewTool', () => {
  let tool: PaymentsPreviewTool;

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    asaasIntegration: {
      findUnique: jest.fn(),
    },
    clientPayment: {
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
    },
  };

  const mockToolRegistryService = {
    registerTool: jest.fn(),
  };

  const mockContext: ToolContext = {
    userId: 'user-123',
    conversationId: 'conv-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsPreviewTool,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ToolRegistryService, useValue: mockToolRegistryService },
      ],
    }).compile();

    tool = module.get<PaymentsPreviewTool>(PaymentsPreviewTool);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(tool.metadata.name).toBe('payments.preview');
      expect(tool.metadata.actionType).toBe('READ'); // Preview is read-only
      expect(tool.metadata.parametersSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    beforeEach(() => {
      mockPrismaService.client.findFirst.mockResolvedValue({ id: 'client-123' });
    });

    it('should accept valid parameters', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-01-15',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe(true);
    });

    it('should reject missing clientId', async () => {
      const params = {
        clientId: '',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-01-15',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe('O ID do cliente é obrigatório');
    });

    it('should reject invalid value', async () => {
      const params = {
        clientId: 'client-123',
        value: 0,
        billingType: 'PIX' as const,
        dueDate: '2025-01-15',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe('O valor deve ser maior que zero');
    });

    it('should reject invalid billing type', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'INVALID' as any,
        dueDate: '2025-01-15',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe('Tipo de cobrança inválido. Use: PIX, BOLETO ou CREDIT_CARD');
    });

    it('should reject invalid due date', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: 'invalid-date',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe('Data de vencimento inválida');
    });

    it('should reject client from another user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const params = {
        clientId: 'client-other-user',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-01-15',
      };

      const result = await tool.validate(params, mockContext);
      expect(result).toBe('Cliente não encontrado');
    });
  });

  describe('execute', () => {
    const mockClient = {
      id: 'client-123',
      name: 'Test Client',
      email: 'test@example.com',
      phone: '11999999999',
      taxId: '12345678901',
      asaasCustomerId: 'cus_123',
    };

    beforeEach(() => {
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({ isActive: true });
      mockPrismaService.userSubscription.findUnique.mockResolvedValue({
        plan: {
          usageLimits: { maxPayments: -1 },
        },
      });
      mockPrismaService.clientPayment.count.mockResolvedValue(0);
    });

    it('should return valid preview for PIX payment', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
        description: 'Test payment',
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        valid: true,
        preview: expect.objectContaining({
          clientId: 'client-123',
          clientName: 'Test Client',
          billingType: 'PIX',
          value: 100,
        }),
        warnings: expect.any(Array),
        clientHasAsaasId: true,
      });
    });

    it('should warn if due date is in the past', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2020-01-01', // Past date
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.warnings).toContain('A data de vencimento está no passado');
    });

    it('should warn if client has no Asaas ID', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue({
        ...mockClient,
        asaasCustomerId: null,
      });

      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.clientHasAsaasId).toBe(false);
      expect(result.data?.warnings).toContain('Cliente será cadastrado automaticamente no Asaas');
    });

    it('should warn for low value payments', async () => {
      const params = {
        clientId: 'client-123',
        value: 3, // Below 5
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(true);
      expect(result.data?.warnings).toContain('Valor mínimo para cobrança no Asaas é R$ 5,00');
    });

    it('should return error if Asaas integration is not active', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({ isActive: false });

      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Integração com Asaas não está ativa');
    });

    it('should return error if client not found', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const params = {
        clientId: 'nonexistent',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
      };

      const result = await tool.execute(params, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cliente não encontrado');
    });

    it('should ensure multi-tenant isolation', async () => {
      const params = {
        clientId: 'client-123',
        value: 100,
        billingType: 'PIX' as const,
        dueDate: '2025-12-31',
      };

      await tool.execute(params, mockContext);

      expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'client-123',
          userId: 'user-123',
          deletedAt: null,
        },
        select: expect.any(Object),
      });
    });
  });
});
