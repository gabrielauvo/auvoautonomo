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

  describe('upgradeToPro', () => {
    it('should upgrade user to PRO plan', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'user@example.com',
        name: 'Test User',
        subscription: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAsaasBillingService.createCustomer.mockResolvedValue({ id: 'cus_123' });
      mockAsaasBillingService.createSubscription.mockResolvedValue({
        id: 'sub_123',
        nextDueDate: '2025-02-01',
        paymentUrl: 'https://pay.asaas.com/xxx',
      });
      mockSubscriptionService.createOrUpdateSubscription.mockResolvedValue({
        id: 'local-sub-123',
        status: SubscriptionStatus.ACTIVE,
      });

      const result = await controller.upgradeToPro(mockUserId, {
        billingType: 'PIX' as any,
        billingPeriod: 'MONTHLY' as any,
        cpfCnpj: '12345678901',
      });

      expect(result.subscriptionId).toBe('local-sub-123');
      expect(result.asaasSubscriptionId).toBe('sub_123');
      expect(result.paymentUrl).toBe('https://pay.asaas.com/xxx');
    });

    it('should return message if already PRO', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'user@example.com',
        subscription: {
          status: SubscriptionStatus.ACTIVE,
          planId: 'plan-pro-id',
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.plan.findUnique.mockResolvedValue({ type: PlanType.PRO });

      const result = await controller.upgradeToPro(mockUserId, {
        billingType: 'PIX' as any,
        billingPeriod: 'MONTHLY' as any,
        cpfCnpj: '12345678901',
      });

      expect(result.message).toBe('You are already on the PRO plan');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        asaasSubscriptionId: 'asaas_sub_123',
        currentPeriodEnd: new Date('2025-02-01'),
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockAsaasBillingService.cancelSubscription.mockResolvedValue(undefined);
      mockSubscriptionService.cancelSubscription.mockResolvedValue({
        ...mockSubscription,
        cancelAtPeriodEnd: true,
      });

      const result = await controller.cancelSubscription(mockUserId, {
        cancelImmediately: false,
      });

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.message).toContain('será cancelada ao fim do período');
    });

    it('should cancel subscription immediately when requested', async () => {
      const mockSubscription = {
        id: 'sub-123',
        status: SubscriptionStatus.ACTIVE,
        asaasSubscriptionId: 'asaas_sub_123',
      };

      mockPrisma.userSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockAsaasBillingService.cancelSubscription.mockResolvedValue(undefined);
      mockSubscriptionService.cancelSubscription.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await controller.cancelSubscription(mockUserId, {
        cancelImmediately: true,
      });

      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.message).toContain('cancelada imediatamente');
    });

    it('should return message if no subscription exists', async () => {
      mockPrisma.userSubscription.findUnique.mockResolvedValue(null);

      const result = await controller.cancelSubscription(mockUserId, {});

      expect(result.message).toBe('No active subscription to cancel');
    });
  });

  describe('reactivateSubscription', () => {
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

      expect(result.message).toBe('Subscription is already active');
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
