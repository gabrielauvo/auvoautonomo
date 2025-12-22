import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { SubscriptionService } from './subscription.service';
import { PlanLimitsService } from './plan-limits.service';
import { AsaasBillingService } from './asaas-billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType, SubscriptionStatus, BillingPeriod } from '@prisma/client';

describe('BillingController', () => {
  let controller: BillingController;
  let subscriptionService: SubscriptionService;
  let planLimitsService: PlanLimitsService;
  let asaasBillingService: AsaasBillingService;

  const mockUserId = 'user-123';

  const mockBillingStatus = {
    planKey: PlanType.FREE,
    planName: 'Plano Gratuito',
    subscriptionStatus: 'FREE' as const,
    limits: {
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
    },
    usage: {
      clientsCount: 5,
      quotesCount: 10,
      workOrdersCount: 8,
      paymentsCount: 15,
      notificationsSentThisMonth: 20,
    },
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialEndAt: null,
    cancelAtPeriodEnd: false,
  };

  const mockSubscriptionService = {
    getBillingStatus: jest.fn(),
    getActivePlans: jest.fn(),
    createOrUpdateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const mockPlanLimitsService = {
    getRemainingQuota: jest.fn(),
    checkLimit: jest.fn(),
  };

  const mockAsaasBillingService = {
    createCustomer: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: AsaasBillingService, useValue: mockAsaasBillingService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    planLimitsService = module.get<PlanLimitsService>(PlanLimitsService);
    asaasBillingService = module.get<AsaasBillingService>(AsaasBillingService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPlan', () => {
    it('should return billing status', async () => {
      mockSubscriptionService.getBillingStatus.mockResolvedValue(mockBillingStatus);

      const result = await controller.getPlan(mockUserId);

      expect(result).toEqual(mockBillingStatus);
      expect(mockSubscriptionService.getBillingStatus).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('getAvailablePlans', () => {
    it('should return all active plans', async () => {
      const mockPlans = [
        { id: 'plan-1', type: PlanType.FREE, name: 'Free', price: 0 },
        { id: 'plan-2', type: PlanType.PRO, name: 'Pro', price: 49.90 },
      ];
      mockSubscriptionService.getActivePlans.mockResolvedValue(mockPlans);

      const result = await controller.getAvailablePlans();

      expect(result).toEqual(mockPlans);
      expect(mockSubscriptionService.getActivePlans).toHaveBeenCalled();
    });
  });

  describe('getQuota', () => {
    it('should return quota for specific resource', async () => {
      const mockQuota = { remaining: 5, max: 10, current: 5, unlimited: false };
      mockPlanLimitsService.getRemainingQuota.mockResolvedValue(mockQuota);

      const result = await controller.getQuota(mockUserId, 'CLIENT');

      expect(result).toEqual(mockQuota);
      expect(mockPlanLimitsService.getRemainingQuota).toHaveBeenCalledWith(mockUserId, 'CLIENT');
    });

    it('should return all quotas when no resource specified', async () => {
      const mockQuota = { remaining: 5, max: 10, current: 5, unlimited: false };
      mockPlanLimitsService.getRemainingQuota.mockResolvedValue(mockQuota);

      const result = await controller.getQuota(mockUserId, undefined as any);

      expect(result).toHaveProperty('clients');
      expect(result).toHaveProperty('quotes');
      expect(result).toHaveProperty('workOrders');
      expect(result).toHaveProperty('payments');
      expect(result).toHaveProperty('notifications');
    });
  });

  describe('cancelSubscription', () => {
    it('should return message if no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);

      const result = await controller.cancelSubscription(mockUserId, {});

      expect(result.message).toBe('Nenhuma assinatura encontrada');
      expect(result.success).toBe(false);
    });

    it('should return message if already on FREE plan', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        plan: { type: PlanType.FREE },
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await controller.cancelSubscription(mockUserId, {});

      expect(result.message).toBe('Você já está no plano gratuito');
      expect(result.success).toBe(false);
    });

    it('should cancel subscription and move to FREE plan', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        plan: { type: PlanType.PRO },
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockAsaasBillingService.cancelSubscription.mockResolvedValue(undefined);

      const result = await controller.cancelSubscription(mockUserId, {});

      expect(result.success).toBe(true);
      expect(result.newPlan).toBe('FREE');
    });
  });

  describe('reactivateSubscription', () => {
    it('should return message if no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);

      const result = await controller.reactivateSubscription(mockUserId);

      expect(result.message).toBe('Nenhuma assinatura encontrada');
      expect(result.success).toBe(false);
    });

    it('should reactivate a subscription marked for cancellation', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: true,
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.userSubscription.update.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: false,
      });

      const result = await controller.reactivateSubscription(mockUserId);

      expect(result.message).toBe('Assinatura reativada com sucesso.');
    });

    it('should return message if subscription is already active', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await controller.reactivateSubscription(mockUserId);

      expect(result.message).toBe('Assinatura já está ativa');
    });
  });

  describe('checkLimit', () => {
    it('should return limit check result', async () => {
      const mockResult = {
        allowed: true,
        resource: 'CLIENT' as const,
        plan: PlanType.FREE,
        max: 10,
        current: 5,
      };

      mockPlanLimitsService.checkLimit.mockResolvedValue(mockResult);

      const result = await controller.checkLimit(mockUserId, 'CLIENT');

      expect(result).toEqual(mockResult);
      expect(mockPlanLimitsService.checkLimit).toHaveBeenCalledWith({
        userId: mockUserId,
        resource: 'CLIENT',
      });
    });
  });
});
