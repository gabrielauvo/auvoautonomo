import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, SubscriptionStatus, BillingPeriod } from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockPlanId = 'plan-123';

  const mockFreePlan = {
    id: 'plan-free-id',
    type: PlanType.FREE,
    name: 'Plano Gratuito',
    description: 'Plano básico gratuito',
    price: 0,
    yearlyPrice: null,
    maxClients: 10,
    maxQuotes: 20,
    maxWorkOrders: 20,
    maxInvoices: 20,
    features: ['Até 10 clientes'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageLimits: {
      id: 'limits-free-id',
      planId: 'plan-free-id',
      maxClients: 10,
      maxQuotes: 20,
      maxWorkOrders: 20,
      maxPayments: 20,
      maxNotificationsPerMonth: 50,
      enableAdvancedAutomations: false,
      enableAdvancedAnalytics: false,
      enableClientPortal: false,
      enablePdfExport: true,
      enableDigitalSignature: false,
      enableWhatsApp: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockProPlan = {
    id: 'plan-pro-id',
    type: PlanType.PRO,
    name: 'Plano PRO',
    description: 'Plano profissional',
    price: 49.90,
    yearlyPrice: 499.00,
    maxClients: -1,
    maxQuotes: -1,
    maxWorkOrders: -1,
    maxInvoices: -1,
    features: ['Clientes ilimitados'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageLimits: {
      id: 'limits-pro-id',
      planId: 'plan-pro-id',
      maxClients: -1,
      maxQuotes: -1,
      maxWorkOrders: -1,
      maxPayments: -1,
      maxNotificationsPerMonth: -1,
      enableAdvancedAutomations: true,
      enableAdvancedAnalytics: true,
      enableClientPortal: true,
      enablePdfExport: true,
      enableDigitalSignature: true,
      enableWhatsApp: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockPrisma = {
    userSubscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    client: {
      count: jest.fn(),
    },
    quote: {
      count: jest.fn(),
    },
    workOrder: {
      count: jest.fn(),
    },
    clientPayment: {
      count: jest.fn(),
    },
    notificationLog: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserEffectivePlan', () => {
    it('should return FREE plan when no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.plan.findUnique.mockResolvedValue(mockFreePlan);

      const result = await service.getUserEffectivePlan(mockUserId);

      expect(result.planKey).toBe(PlanType.FREE);
      expect(result.subscriptionStatus).toBe('FREE');
      expect(result.limits.maxClients).toBe(10);
    });

    it('should return PRO plan when user has active PRO subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: mockUserId,
        planId: mockProPlan.id,
        status: SubscriptionStatus.ACTIVE,
        billingPeriod: BillingPeriod.MONTHLY,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        plan: mockProPlan,
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.getUserEffectivePlan(mockUserId);

      expect(result.planKey).toBe(PlanType.PRO);
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.ACTIVE);
      expect(result.limits.maxClients).toBe(-1);
      expect(result.limits.enableAdvancedAutomations).toBe(true);
    });

    it('should return PAST_DUE status when subscription is past due', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: mockUserId,
        planId: mockProPlan.id,
        status: SubscriptionStatus.PAST_DUE,
        plan: mockProPlan,
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await service.getUserEffectivePlan(mockUserId);

      expect(result.planKey).toBe(PlanType.PRO);
      expect(result.subscriptionStatus).toBe(SubscriptionStatus.PAST_DUE);
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current usage counts', async () => {
      mockPrisma.client.count.mockResolvedValue(5);
      mockPrisma.quote.count.mockResolvedValue(10);
      mockPrisma.workOrder.count.mockResolvedValue(8);
      mockPrisma.clientPayment.count.mockResolvedValue(15);
      mockPrisma.notificationLog.count.mockResolvedValue(20);

      const result = await service.getCurrentUsage(mockUserId);

      expect(result.clientsCount).toBe(5);
      expect(result.quotesCount).toBe(10);
      expect(result.workOrdersCount).toBe(8);
      expect(result.paymentsCount).toBe(15);
      expect(result.notificationsSentThisMonth).toBe(20);
    });
  });

  describe('getBillingStatus', () => {
    it('should return complete billing status', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.plan.findUnique.mockResolvedValue(mockFreePlan);
      mockPrisma.client.count.mockResolvedValue(5);
      mockPrisma.quote.count.mockResolvedValue(10);
      mockPrisma.workOrder.count.mockResolvedValue(8);
      mockPrisma.clientPayment.count.mockResolvedValue(15);
      mockPrisma.notificationLog.count.mockResolvedValue(20);

      const result = await service.getBillingStatus(mockUserId);

      expect(result.planKey).toBe(PlanType.FREE);
      expect(result.subscriptionStatus).toBe('FREE');
      expect(result.limits).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.usage.clientsCount).toBe(5);
    });
  });

  describe('createOrUpdateSubscription', () => {
    it('should create a new subscription', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockProPlan);
      mockPrisma.userSubscription.upsert.mockResolvedValue({
        id: 'sub-new',
        userId: mockUserId,
        planId: mockProPlan.id,
        status: SubscriptionStatus.ACTIVE,
      });

      const result = await service.createOrUpdateSubscription(
        mockUserId,
        PlanType.PRO,
        {
          asaasCustomerId: 'cus_123',
          asaasSubscriptionId: 'sub_123',
          status: SubscriptionStatus.ACTIVE,
          billingPeriod: BillingPeriod.MONTHLY,
        },
      );

      expect(result.id).toBe('sub-new');
      expect(mockPrisma.userSubscription.upsert).toHaveBeenCalled();
    });

    it('should throw error when plan not found', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrUpdateSubscription(mockUserId, PlanType.PRO, {}),
      ).rejects.toThrow('Plan PRO not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should mark subscription for cancellation at period end', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: mockUserId,
        planId: mockProPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.userSubscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await service.cancelSubscription(mockUserId, false);

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockPrisma.userSubscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { cancelAtPeriodEnd: true },
      });
    });

    it('should cancel immediately when requested', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: mockUserId,
        planId: mockProPlan.id,
        status: SubscriptionStatus.ACTIVE,
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.plan.findUnique.mockResolvedValue(mockFreePlan);
      mockPrisma.userSubscription.update.mockResolvedValue({
        ...mockSubscription,
        planId: mockFreePlan.id,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await service.cancelSubscription(mockUserId, true);

      expect(result.status).toBe(SubscriptionStatus.CANCELED);
    });

    it('should throw error when no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);

      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(
        'No active subscription found',
      );
    });
  });

  describe('getActivePlans', () => {
    it('should return all active plans', async () => {
      mockPrisma.plan.findMany.mockResolvedValue([mockFreePlan, mockProPlan]);

      const result = await service.getActivePlans();

      expect(result).toHaveLength(2);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { usageLimits: true },
        orderBy: { price: 'asc' },
      });
    });
  });
});
