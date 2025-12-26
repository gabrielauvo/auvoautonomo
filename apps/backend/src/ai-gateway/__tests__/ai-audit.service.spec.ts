import { Test, TestingModule } from '@nestjs/testing';
import { AiAuditService } from '../services/ai-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock enum values since Prisma types may not be available in test
const AiAuditCategory = {
  TOOL_CALL: 'TOOL_CALL',
  SECURITY_BLOCK: 'SECURITY_BLOCK',
  RATE_LIMIT: 'RATE_LIMIT',
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_CONFIRMED: 'PLAN_CONFIRMED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_EXECUTED: 'PLAN_EXECUTED',
  ACTION_SUCCESS: 'ACTION_SUCCESS',
  ACTION_FAILED: 'ACTION_FAILED',
} as const;

describe('AiAuditService', () => {
  let service: AiAuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aiAuditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiAuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AiAuditService>(AiAuditService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const entry = {
        userId: 'user-123',
        conversationId: 'conv-123',
        category: AiAuditCategory.TOOL_CALL,
        tool: 'clients.list',
        action: 'execute',
        success: true,
      };

      mockPrismaService.aiAuditLog.create.mockResolvedValue({ id: 'log-123', ...entry });

      await service.log(entry);

      expect(mockPrismaService.aiAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          conversationId: 'conv-123',
          category: AiAuditCategory.TOOL_CALL,
          tool: 'clients.list',
          action: 'execute',
          success: true,
        }),
      });
    });

    it('should sanitize sensitive data from payloads', async () => {
      const entry = {
        userId: 'user-123',
        category: AiAuditCategory.TOOL_CALL,
        action: 'execute',
        success: true,
        inputPayload: {
          name: 'Test User',
          password: 'secret123',
          apiKey: 'sk-123456',
          creditCardNumber: '4111111111111111',
        },
      };

      mockPrismaService.aiAuditLog.create.mockResolvedValue({ id: 'log-123' });

      await service.log(entry);

      expect(mockPrismaService.aiAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inputPayload: expect.objectContaining({
            name: 'Test User',
            password: '[REDACTED]',
            apiKey: '[REDACTED]',
            creditCardNumber: '[REDACTED]',
          }),
        }),
      });
    });

    it('should not fail if audit logging fails', async () => {
      const entry = {
        userId: 'user-123',
        category: AiAuditCategory.TOOL_CALL,
        action: 'execute',
        success: true,
      };

      mockPrismaService.aiAuditLog.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.log(entry)).resolves.not.toThrow();
    });
  });

  describe('getLogsForUser', () => {
    it('should return logs for a user', async () => {
      const mockLogs = [
        { id: 'log-1', userId: 'user-123', action: 'execute' },
        { id: 'log-2', userId: 'user-123', action: 'execute' },
      ];

      mockPrismaService.aiAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogsForUser('user-123');

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.aiAuditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should apply filters', async () => {
      mockPrismaService.aiAuditLog.findMany.mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await service.getLogsForUser('user-123', {
        limit: 10,
        offset: 5,
        category: AiAuditCategory.SECURITY_BLOCK,
        startDate,
        endDate,
      });

      expect(mockPrismaService.aiAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          category: AiAuditCategory.SECURITY_BLOCK,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('countFailedOperations', () => {
    it('should count failed operations within time window', async () => {
      mockPrismaService.aiAuditLog.count.mockResolvedValue(5);

      const result = await service.countFailedOperations('user-123', 60000);

      expect(result).toBe(5);
      expect(mockPrismaService.aiAuditLog.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          success: false,
          createdAt: { gte: expect.any(Date) },
        },
      });
    });
  });
});
