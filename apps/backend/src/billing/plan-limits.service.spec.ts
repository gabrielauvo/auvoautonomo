import { Test, TestingModule } from '@nestjs/testing';
import { PlanLimitsService, LimitReachedException, FeatureNotAvailableException } from './plan-limits.service';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { PlanType } from '@prisma/client';

describe('PlanLimitsService', () => {
  let service: PlanLimitsService;
  let subscriptionService: SubscriptionService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';

  const mockFreeLimits = {
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
  };

  const mockProLimits = {
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
  };

  const mockSubscriptionService = {
    getUserEffectivePlan: jest.fn(),
  };

  const mockPrisma = {
    client: { count: jest.fn() },
    quote: { count: jest.fn() },
    workOrder: { count: jest.fn() },
    clientPayment: { count: jest.fn() },
    notificationLog: { count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanLimitsService,
        { provide: SubscriptionService, useValue: mockSubscriptionService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlanLimitsService>(PlanLimitsService);
    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkLimit', () => {
    it('should allow creation when under limit', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(5);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'CLIENT',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(5);
      expect(result.max).toBe(10);
    });

    it('should block creation when at limit', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(10);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'CLIENT',
      });

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
      expect(result.max).toBe(10);
    });

    it('should always allow when limit is unlimited (-1)', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.PRO,
        limits: mockProLimits,
      });
      mockPrisma.client.count.mockResolvedValue(1000);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'CLIENT',
      });

      expect(result.allowed).toBe(true);
      expect(result.max).toBe(-1);
    });

    it('should check quotes limit correctly', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.quote.count.mockResolvedValue(15);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'QUOTE',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(15);
      expect(result.max).toBe(20);
    });

    it('should check work orders limit correctly', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.workOrder.count.mockResolvedValue(20);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'WORK_ORDER',
      });

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(20);
      expect(result.max).toBe(20);
    });

    it('should check payments limit correctly', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.clientPayment.count.mockResolvedValue(10);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'PAYMENT',
      });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.max).toBe(20);
    });

    it('should check notifications limit correctly', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.notificationLog.count.mockResolvedValue(50);

      const result = await service.checkLimit({
        userId: mockUserId,
        resource: 'NOTIFICATION',
      });

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(50);
      expect(result.max).toBe(50);
    });
  });

  describe('checkLimitOrThrow', () => {
    it('should not throw when under limit', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(5);

      await expect(
        service.checkLimitOrThrow({ userId: mockUserId, resource: 'CLIENT' }),
      ).resolves.toBeUndefined();
    });

    it('should throw LimitReachedException when at limit', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(10);

      await expect(
        service.checkLimitOrThrow({ userId: mockUserId, resource: 'CLIENT' }),
      ).rejects.toThrow(LimitReachedException);
    });

    it('should include correct error details', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(10);

      try {
        await service.checkLimitOrThrow({ userId: mockUserId, resource: 'CLIENT' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LimitReachedException);
        expect(error.details.error).toBe('LIMIT_REACHED');
        expect(error.details.resource).toBe('CLIENT');
        expect(error.details.plan).toBe(PlanType.FREE);
        expect(error.details.max).toBe(10);
        expect(error.details.current).toBe(10);
      }
    });
  });

  describe('checkFeature', () => {
    it('should allow enabled features', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.PRO,
        planName: 'Plano PRO',
        limits: mockProLimits,
      });

      const result = await service.checkFeature({
        userId: mockUserId,
        feature: 'ADVANCED_AUTOMATIONS',
      });

      expect(result.available).toBe(true);
    });

    it('should block disabled features', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        planName: 'Plano Gratuito',
        limits: mockFreeLimits,
      });

      const result = await service.checkFeature({
        userId: mockUserId,
        feature: 'ADVANCED_AUTOMATIONS',
      });

      expect(result.available).toBe(false);
      expect(result.message).toContain('Automações Avançadas');
      expect(result.message).toContain('Plano Gratuito');
    });

    it('should check all feature flags correctly', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        planName: 'Plano Gratuito',
        limits: mockFreeLimits,
      });

      const features = [
        'ADVANCED_AUTOMATIONS',
        'ADVANCED_ANALYTICS',
        'CLIENT_PORTAL',
        'DIGITAL_SIGNATURE',
        'WHATSAPP',
      ];

      for (const feature of features) {
        const result = await service.checkFeature({
          userId: mockUserId,
          feature: feature as any,
        });
        expect(result.available).toBe(false);
      }

      // PDF should be available on FREE
      const pdfResult = await service.checkFeature({
        userId: mockUserId,
        feature: 'PDF_EXPORT',
      });
      expect(pdfResult.available).toBe(true);
    });
  });

  describe('checkFeatureOrThrow', () => {
    it('should not throw when feature is available', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.PRO,
        planName: 'Plano PRO',
        limits: mockProLimits,
      });

      await expect(
        service.checkFeatureOrThrow({ userId: mockUserId, feature: 'WHATSAPP' }),
      ).resolves.toBeUndefined();
    });

    it('should throw FeatureNotAvailableException when feature is disabled', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        planName: 'Plano Gratuito',
        limits: mockFreeLimits,
      });

      await expect(
        service.checkFeatureOrThrow({ userId: mockUserId, feature: 'WHATSAPP' }),
      ).rejects.toThrow(FeatureNotAvailableException);
    });
  });

  describe('getRemainingQuota', () => {
    it('should return correct remaining quota', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(7);

      const result = await service.getRemainingQuota(mockUserId, 'CLIENT');

      expect(result.remaining).toBe(3);
      expect(result.max).toBe(10);
      expect(result.current).toBe(7);
      expect(result.unlimited).toBe(false);
    });

    it('should return unlimited for PRO plan', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.PRO,
        limits: mockProLimits,
      });
      mockPrisma.client.count.mockResolvedValue(100);

      const result = await service.getRemainingQuota(mockUserId, 'CLIENT');

      expect(result.remaining).toBe(-1);
      expect(result.unlimited).toBe(true);
    });

    it('should return 0 remaining when at limit', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(15);

      const result = await service.getRemainingQuota(mockUserId, 'CLIENT');

      expect(result.remaining).toBe(0);
      expect(result.current).toBe(15);
    });
  });

  describe('checkMultipleLimits', () => {
    it('should check multiple resources at once', async () => {
      mockSubscriptionService.getUserEffectivePlan.mockResolvedValue({
        planKey: PlanType.FREE,
        limits: mockFreeLimits,
      });
      mockPrisma.client.count.mockResolvedValue(5);
      mockPrisma.quote.count.mockResolvedValue(20);
      mockPrisma.workOrder.count.mockResolvedValue(10);

      const results = await service.checkMultipleLimits(mockUserId, [
        'CLIENT',
        'QUOTE',
        'WORK_ORDER',
      ]);

      expect(results.get('CLIENT')?.allowed).toBe(true);
      expect(results.get('QUOTE')?.allowed).toBe(false);
      expect(results.get('WORK_ORDER')?.allowed).toBe(true);
    });
  });
});
