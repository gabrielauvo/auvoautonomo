import { Test, TestingModule } from '@nestjs/testing';
import { ClientsListTool } from '../tools/clients/clients-list.tool';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../services/tool-registry.service';
import { ToolContext } from '../interfaces/tool.interface';

describe('ClientsListTool', () => {
  let tool: ClientsListTool;

  const mockPrismaService = {
    client: {
      findMany: jest.fn(),
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
        ClientsListTool,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ToolRegistryService, useValue: mockToolRegistryService },
      ],
    }).compile();

    tool = module.get<ClientsListTool>(ClientsListTool);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(tool).toBeDefined();
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(tool.metadata.name).toBe('clients.list');
      expect(tool.metadata.actionType).toBe('READ');
      expect(tool.metadata.parametersSchema).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should accept valid parameters', async () => {
      const result = await tool.validate({ limit: 20, offset: 0 }, mockContext);
      expect(result).toBe(true);
    });

    it('should accept empty parameters', async () => {
      const result = await tool.validate({}, mockContext);
      expect(result).toBe(true);
    });

    it('should reject invalid limit', async () => {
      const result = await tool.validate({ limit: 150 }, mockContext);
      expect(result).toBe('O limite deve ser entre 1 e 100');
    });

    it('should reject negative offset', async () => {
      const result = await tool.validate({ offset: -1 }, mockContext);
      expect(result).toBe('O offset não pode ser negativo');
    });
  });

  describe('execute', () => {
    it('should list clients for user', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'Client One',
          email: 'client1@example.com',
          phone: '11999999999',
          city: 'São Paulo',
          isDelinquent: false,
          createdAt: new Date(),
        },
        {
          id: 'client-2',
          name: 'Client Two',
          email: 'client2@example.com',
          phone: null,
          city: null,
          isDelinquent: true,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.client.findMany.mockResolvedValue(mockClients);

      const result = await tool.execute({}, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.affectedEntities).toHaveLength(2);
      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          deletedAt: null,
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by search term', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);

      await tool.execute({ search: 'João' }, mockContext);

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          deletedAt: null,
          OR: [
            { name: { contains: 'João', mode: 'insensitive' } },
            { email: { contains: 'João', mode: 'insensitive' } },
            { phone: { contains: 'João' } },
          ],
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
        take: 20,
        skip: 0,
      });
    });

    it('should filter by delinquent status', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);

      await tool.execute({ hasOverduePayments: true }, mockContext);

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          deletedAt: null,
          isDelinquent: true,
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply pagination', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);

      await tool.execute({ limit: 10, offset: 20 }, mockContext);

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should ensure multi-tenant isolation', async () => {
      mockPrismaService.client.findMany.mockResolvedValue([]);

      await tool.execute({}, { ...mockContext, userId: 'different-user' });

      expect(mockPrismaService.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'different-user',
          }),
        }),
      );
    });
  });
});
