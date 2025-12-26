import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AiPlanService } from '../services/ai-plan.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ToolRegistryService } from '../services/tool-registry.service';
import { AiAuditService } from '../services/ai-audit.service';

// Mock enum values since Prisma types may not be available in test
const AiPlanStatus = {
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

const AiActionType = {
  READ: 'READ',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SEND: 'SEND',
  PAYMENT_CREATE: 'PAYMENT_CREATE',
  PAYMENT_SEND: 'PAYMENT_SEND',
} as const;

describe('AiPlanService', () => {
  let service: AiPlanService;

  const mockPrismaService = {
    aiPlan: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    aiPaymentPreview: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
  };

  const mockToolRegistryService = {
    executeTool: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPlanService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ToolRegistryService, useValue: mockToolRegistryService },
        { provide: AiAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AiPlanService>(AiPlanService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPlan', () => {
    it('should create a new plan', async () => {
      const mockPlan = {
        id: 'plan-123',
        conversationId: 'conv-123',
        userId: 'user-123',
        summary: 'Create client',
        actions: [],
        status: AiPlanStatus.PENDING_CONFIRMATION,
        idempotencyKey: 'key-123',
        expiresAt: new Date(),
      };

      mockPrismaService.aiPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.aiPlan.create.mockResolvedValue(mockPlan);

      const result = await service.createPlan({
        conversationId: 'conv-123',
        userId: 'user-123',
        summary: 'Create client',
        actions: [],
        idempotencyKey: 'key-123',
      });

      expect(result).toEqual(mockPlan);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should return existing plan for duplicate idempotency key', async () => {
      const existingPlan = {
        id: 'plan-existing',
        idempotencyKey: 'key-123',
      };

      mockPrismaService.aiPlan.findUnique.mockResolvedValue(existingPlan);

      const result = await service.createPlan({
        conversationId: 'conv-123',
        userId: 'user-123',
        summary: 'Create client',
        actions: [],
        idempotencyKey: 'key-123',
      });

      expect(result).toEqual(existingPlan);
      expect(mockPrismaService.aiPlan.create).not.toHaveBeenCalled();
    });

    it('should create payment previews for payment actions', async () => {
      const mockPlan = {
        id: 'plan-123',
        conversationId: 'conv-123',
        userId: 'user-123',
        summary: 'Create payment',
        status: AiPlanStatus.PENDING_CONFIRMATION,
      };

      const actions = [
        {
          id: 'action-1',
          tool: 'payments.create',
          params: {},
          description: 'Create payment',
          actionType: AiActionType.PAYMENT_CREATE,
          paymentPreview: {
            clientId: 'client-123',
            clientName: 'Test Client',
            billingType: 'PIX' as const,
            value: 100,
            dueDate: new Date(),
          },
        },
      ];

      mockPrismaService.aiPlan.findUnique.mockResolvedValue(null);
      mockPrismaService.aiPlan.create.mockResolvedValue(mockPlan);
      mockPrismaService.aiPaymentPreview.createMany.mockResolvedValue({ count: 1 });

      await service.createPlan({
        conversationId: 'conv-123',
        userId: 'user-123',
        summary: 'Create payment',
        actions,
      });

      expect(mockPrismaService.aiPaymentPreview.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            planId: 'plan-123',
            clientId: 'client-123',
            billingType: 'PIX',
          }),
        ]),
      });
    });
  });

  describe('getPlan', () => {
    it('should return plan for owner', async () => {
      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        previews: [],
      };

      mockPrismaService.aiPlan.findFirst.mockResolvedValue(mockPlan);

      const result = await service.getPlan('plan-123', 'user-123');

      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if plan not found', async () => {
      mockPrismaService.aiPlan.findFirst.mockResolvedValue(null);

      await expect(service.getPlan('plan-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should not return plan from another user', async () => {
      mockPrismaService.aiPlan.findFirst.mockResolvedValue(null);

      await expect(service.getPlan('plan-123', 'other-user')).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.aiPlan.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'plan-123',
          userId: 'other-user',
        },
        include: { previews: true },
      });
    });
  });

  describe('confirmPlan', () => {
    it('should confirm and execute a pending plan', async () => {
      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        conversationId: 'conv-123',
        status: AiPlanStatus.PENDING_CONFIRMATION,
        expiresAt: new Date(Date.now() + 300000), // 5 min from now
        actions: [
          {
            id: 'action-1',
            tool: 'clients.create',
            params: { name: 'Test' },
          },
        ],
      };

      mockPrismaService.aiPlan.findFirst
        .mockResolvedValueOnce(mockPlan) // confirmPlan check
        .mockResolvedValueOnce({ ...mockPlan, status: AiPlanStatus.CONFIRMED, previews: [] }); // executePlan

      mockPrismaService.aiPlan.update.mockResolvedValue({
        ...mockPlan,
        status: AiPlanStatus.CONFIRMED,
      });

      mockToolRegistryService.executeTool.mockResolvedValue({
        success: true,
        data: { id: 'client-123' },
      });

      const context = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.confirmPlan('plan-123', 'user-123', context);

      expect(result).toEqual(
        expect.objectContaining({
          planId: 'plan-123',
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException if plan expired', async () => {
      const mockPlan = {
        id: 'plan-123',
        userId: 'user-123',
        status: AiPlanStatus.PENDING_CONFIRMATION,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      };

      mockPrismaService.aiPlan.findFirst.mockResolvedValue(mockPlan);
      mockPrismaService.aiPlan.update.mockResolvedValue({
        ...mockPlan,
        status: AiPlanStatus.EXPIRED,
      });

      const context = { userId: 'user-123', conversationId: 'conv-123' };

      await expect(service.confirmPlan('plan-123', 'user-123', context)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if plan already processed', async () => {
      mockPrismaService.aiPlan.findFirst.mockResolvedValue(null);

      const context = { userId: 'user-123', conversationId: 'conv-123' };

      await expect(service.confirmPlan('plan-123', 'user-123', context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectPlan', () => {
    it('should reject a pending plan', async () => {
      mockPrismaService.aiPlan.updateMany.mockResolvedValue({ count: 1 });

      const context = { userId: 'user-123', conversationId: '' };
      await service.rejectPlan('plan-123', 'user-123', context);

      expect(mockPrismaService.aiPlan.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'plan-123',
          userId: 'user-123',
          status: AiPlanStatus.PENDING_CONFIRMATION,
        },
        data: {
          status: AiPlanStatus.REJECTED,
        },
      });
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if plan not found', async () => {
      mockPrismaService.aiPlan.updateMany.mockResolvedValue({ count: 0 });

      const context = { userId: 'user-123', conversationId: '' };

      await expect(service.rejectPlan('plan-123', 'user-123', context)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPendingPlans', () => {
    it('should return pending plans for user', async () => {
      const mockPlans = [
        { id: 'plan-1', status: AiPlanStatus.PENDING_CONFIRMATION },
        { id: 'plan-2', status: AiPlanStatus.PENDING_CONFIRMATION },
      ];

      mockPrismaService.aiPlan.findMany.mockResolvedValue(mockPlans);

      const result = await service.getPendingPlans('user-123');

      expect(result).toEqual(mockPlans);
      expect(mockPrismaService.aiPlan.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: AiPlanStatus.PENDING_CONFIRMATION,
          expiresAt: { gt: expect.any(Date) },
        },
        include: { previews: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('cleanupExpiredPlans', () => {
    it('should expire old pending plans', async () => {
      mockPrismaService.aiPlan.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupExpiredPlans();

      expect(result).toBe(3);
      expect(mockPrismaService.aiPlan.updateMany).toHaveBeenCalledWith({
        where: {
          status: AiPlanStatus.PENDING_CONFIRMATION,
          expiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: AiPlanStatus.EXPIRED,
        },
      });
    });
  });

  describe('validatePaymentPreviews', () => {
    it('should return true if all previews are valid', async () => {
      const mockPreviews = [
        { id: 'preview-1', clientId: 'client-1' },
        { id: 'preview-2', clientId: 'client-2' },
      ];

      mockPrismaService.aiPaymentPreview.findMany.mockResolvedValue(mockPreviews);
      mockPrismaService.client.findFirst
        .mockResolvedValueOnce({ id: 'client-1' })
        .mockResolvedValueOnce({ id: 'client-2' });

      const result = await service.validatePaymentPreviews('plan-123', 'user-123');

      expect(result).toBe(true);
    });

    it('should return false if client no longer exists', async () => {
      const mockPreviews = [{ id: 'preview-1', clientId: 'client-deleted' }];

      mockPrismaService.aiPaymentPreview.findMany.mockResolvedValue(mockPreviews);
      mockPrismaService.client.findFirst.mockResolvedValue(null);
      mockPrismaService.aiPaymentPreview.update.mockResolvedValue({});

      const result = await service.validatePaymentPreviews('plan-123', 'user-123');

      expect(result).toBe(false);
      expect(mockPrismaService.aiPaymentPreview.update).toHaveBeenCalledWith({
        where: { id: 'preview-1' },
        data: { valid: false },
      });
    });
  });
});
