import { Test, TestingModule } from '@nestjs/testing';
import { ReferralRewardsService } from '../services/referral-rewards.service';
import { ReferralAuditService } from '../services/referral-audit.service';
import { ReferralAntifraudService } from '../services/referral-antifraud.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ReferralStatus,
  ReferralRewardReason,
  ReferralRewardStatus,
} from '@prisma/client';

describe('ReferralRewardsService', () => {
  let service: ReferralRewardsService;
  let prisma: PrismaService;
  let auditService: ReferralAuditService;
  let antifraudService: ReferralAntifraudService;

  const mockPrismaService = {
    referral: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    referralReward: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    referralClick: {
      count: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockAntifraudService = {
    checkPayment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralRewardsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ReferralAuditService,
          useValue: mockAuditService,
        },
        {
          provide: ReferralAntifraudService,
          useValue: mockAntifraudService,
        },
      ],
    }).compile();

    service = module.get<ReferralRewardsService>(ReferralRewardsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<ReferralAuditService>(ReferralAuditService);
    antifraudService = module.get<ReferralAntifraudService>(ReferralAntifraudService);

    jest.clearAllMocks();
  });

  describe('processSubscriptionPaid', () => {
    const params = {
      refereeUserId: 'referee-123',
      paymentId: 'payment-456',
    };

    it('should award 1 month for first referral', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SIGNUP_COMPLETE,
        rewardCredited: false,
        referrerUser: {
          id: 'referrer-123',
          name: 'João Silva',
          email: 'joao@test.com',
        },
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);
      mockAntifraudService.checkPayment.mockResolvedValue({
        blocked: false,
        flags: [],
      });
      mockPrismaService.referral.update.mockResolvedValue({
        ...referral,
        status: ReferralStatus.SUBSCRIPTION_PAID,
        rewardCredited: true,
      });
      mockPrismaService.referralReward.findUnique.mockResolvedValue(null); // Not already rewarded
      mockPrismaService.referral.count.mockResolvedValue(0); // First paid referral

      const result = await service.processSubscriptionPaid(params);

      expect(result.rewarded).toBe(true);
      expect(result.monthsCredited).toBe(1);
      expect(result.milestoneReached).toBe(false);
      expect(mockPrismaService.referral.update).toHaveBeenCalledWith({
        where: { id: 'referral-123' },
        data: expect.objectContaining({
          status: ReferralStatus.SUBSCRIPTION_PAID,
          rewardCredited: true,
        }),
      });
    });

    it('should award bonus 12 months at 10th referral', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SIGNUP_COMPLETE,
        rewardCredited: false,
        referrerUser: {
          id: 'referrer-123',
          name: 'João Silva',
          email: 'joao@test.com',
        },
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);
      mockAntifraudService.checkPayment.mockResolvedValue({
        blocked: false,
        flags: [],
      });
      mockPrismaService.referral.update.mockResolvedValue({
        ...referral,
        status: ReferralStatus.SUBSCRIPTION_PAID,
        rewardCredited: true,
      });
      mockPrismaService.referralReward.findUnique
        .mockResolvedValueOnce(null) // Single referral check
        .mockResolvedValueOnce(null); // Milestone check
      mockPrismaService.referral.count.mockResolvedValue(10); // This is the 10th

      const result = await service.processSubscriptionPaid(params);

      expect(result.rewarded).toBe(true);
      expect(result.monthsCredited).toBe(13); // 1 + 12
      expect(result.milestoneReached).toBe(true);
    });

    it('should be idempotent - not process already credited referral', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SUBSCRIPTION_PAID,
        rewardCredited: true, // Already credited
        referrerUser: {
          id: 'referrer-123',
          name: 'João Silva',
          email: 'joao@test.com',
        },
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);

      const result = await service.processSubscriptionPaid(params);

      expect(result.rewarded).toBe(false);
      expect(mockPrismaService.referralReward.create).not.toHaveBeenCalled();
    });

    it('should return not rewarded if no referral found', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(null);

      const result = await service.processSubscriptionPaid(params);

      expect(result.rewarded).toBe(false);
    });

    it('should block fraudulent payment', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SIGNUP_COMPLETE,
        rewardCredited: false,
        referrerUser: {
          id: 'referrer-123',
          name: 'João Silva',
          email: 'joao@test.com',
        },
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);
      mockAntifraudService.checkPayment.mockResolvedValue({
        blocked: true,
        reason: 'Same card used by referrer',
        flags: ['SAME_CARD'],
      });

      const result = await service.processSubscriptionPaid(params);

      expect(result.rewarded).toBe(false);
      expect(mockPrismaService.referral.update).toHaveBeenCalledWith({
        where: { id: 'referral-123' },
        data: expect.objectContaining({
          status: ReferralStatus.FRAUDULENT,
        }),
      });
    });
  });

  describe('processChargeback', () => {
    const params = {
      refereeUserId: 'referee-123',
      reason: 'Payment disputed',
    };

    it('should reverse rewards on chargeback', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SUBSCRIPTION_PAID,
        rewardCredited: true,
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);
      mockPrismaService.referralReward.findUnique.mockResolvedValue(null);

      await service.processChargeback(params);

      expect(mockPrismaService.referral.update).toHaveBeenCalledWith({
        where: { id: 'referral-123' },
        data: expect.objectContaining({
          status: ReferralStatus.FRAUDULENT,
        }),
      });
      expect(mockPrismaService.referralReward.updateMany).toHaveBeenCalled();
    });

    it('should do nothing if referral not found', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(null);

      await service.processChargeback(params);

      expect(mockPrismaService.referral.update).not.toHaveBeenCalled();
    });

    it('should do nothing if reward not credited', async () => {
      const referral = {
        id: 'referral-123',
        referrerUserId: 'referrer-123',
        refereeUserId: params.refereeUserId,
        status: ReferralStatus.SIGNUP_COMPLETE,
        rewardCredited: false,
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);

      await service.processChargeback(params);

      expect(mockPrismaService.referral.update).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return user stats', async () => {
      const userId = 'user-123';

      mockPrismaService.referralClick.count.mockResolvedValue(50);
      mockPrismaService.referral.groupBy.mockResolvedValue([
        { status: ReferralStatus.SIGNUP_COMPLETE, _count: 7 },
        { status: ReferralStatus.SUBSCRIPTION_PAID, _count: 8 },
        { status: ReferralStatus.PENDING, _count: 3 },
      ]);
      mockPrismaService.referralReward.aggregate
        .mockResolvedValueOnce({ _sum: { monthsCredited: 10 } }) // Total
        .mockResolvedValueOnce({ _sum: { monthsCredited: 2 } }); // Pending

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalClicks: 50,
        totalSignups: 15, // 7 + 8
        totalPaid: 8,
        monthsEarned: 10,
        pendingMonths: 2,
        currentMilestoneProgress: 8, // 8 % 10
      });
    });

    it('should return zeros for new user', async () => {
      const userId = 'new-user';

      mockPrismaService.referralClick.count.mockResolvedValue(0);
      mockPrismaService.referral.groupBy.mockResolvedValue([]);
      mockPrismaService.referralReward.aggregate
        .mockResolvedValueOnce({ _sum: { monthsCredited: null } })
        .mockResolvedValueOnce({ _sum: { monthsCredited: null } });

      const result = await service.getStats(userId);

      expect(result).toEqual({
        totalClicks: 0,
        totalSignups: 0,
        totalPaid: 0,
        monthsEarned: 0,
        pendingMonths: 0,
        currentMilestoneProgress: 0,
      });
    });
  });

  describe('getRecentReferrals', () => {
    it('should return masked referral names', async () => {
      const userId = 'user-123';
      const referrals = [
        {
          id: 'ref-1',
          status: ReferralStatus.SUBSCRIPTION_PAID,
          createdAt: new Date('2024-01-20'),
          refereeUser: { name: 'Maria Clara Santos', createdAt: new Date() },
        },
        {
          id: 'ref-2',
          status: ReferralStatus.SIGNUP_COMPLETE,
          createdAt: new Date('2024-01-18'),
          refereeUser: { name: 'Pedro', createdAt: new Date() },
        },
      ];

      mockPrismaService.referral.findMany.mockResolvedValue(referrals);

      const result = await service.getRecentReferrals(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Maria S.');
      expect(result[1].name).toBe('P***');
    });

    it('should handle null names', async () => {
      const userId = 'user-123';
      const referrals = [
        {
          id: 'ref-1',
          status: ReferralStatus.SUBSCRIPTION_PAID,
          createdAt: new Date('2024-01-20'),
          refereeUser: { name: null, createdAt: new Date() },
        },
      ];

      mockPrismaService.referral.findMany.mockResolvedValue(referrals);

      const result = await service.getRecentReferrals(userId);

      expect(result[0].name).toBe('Usuário');
    });
  });

  describe('getRewardsHistory', () => {
    it('should return user rewards history', async () => {
      const userId = 'user-123';
      const rewards = [
        {
          id: 'reward-1',
          monthsCredited: 1,
          reason: ReferralRewardReason.SINGLE_REFERRAL,
          status: ReferralRewardStatus.APPLIED,
          createdAt: new Date('2024-01-20'),
          appliedAt: new Date('2024-01-20'),
        },
        {
          id: 'reward-2',
          monthsCredited: 12,
          reason: ReferralRewardReason.MILESTONE_10,
          status: ReferralRewardStatus.PENDING,
          createdAt: new Date('2024-01-25'),
          appliedAt: null,
        },
      ];

      mockPrismaService.referralReward.findMany.mockResolvedValue(rewards);

      const result = await service.getRewardsHistory(userId);

      expect(result).toEqual(rewards);
      expect(mockPrismaService.referralReward.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: expect.any(Object),
      });
    });
  });

  describe('applyPendingCredits', () => {
    it('should apply pending credits to subscription', async () => {
      const userId = 'user-123';
      const pendingRewards = [
        { id: 'reward-1', monthsCredited: 1 },
        { id: 'reward-2', monthsCredited: 12 },
      ];
      const subscription = {
        id: 'sub-123',
        userId,
        currentPeriodEnd: new Date('2024-02-01'),
      };

      mockPrismaService.referralReward.findMany.mockResolvedValue(pendingRewards);
      mockPrismaService.userSubscription.findUnique.mockResolvedValue(subscription);

      const result = await service.applyPendingCredits(userId);

      expect(result).toBe(13);
      expect(mockPrismaService.userSubscription.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          currentPeriodEnd: expect.any(Date),
        }),
      });
      expect(mockPrismaService.referralReward.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['reward-1', 'reward-2'] },
        },
        data: expect.objectContaining({
          status: ReferralRewardStatus.APPLIED,
        }),
      });
    });

    it('should return 0 if no pending rewards', async () => {
      const userId = 'user-123';
      mockPrismaService.referralReward.findMany.mockResolvedValue([]);

      const result = await service.applyPendingCredits(userId);

      expect(result).toBe(0);
      expect(mockPrismaService.userSubscription.update).not.toHaveBeenCalled();
    });

    it('should return 0 if no subscription', async () => {
      const userId = 'user-123';
      const pendingRewards = [{ id: 'reward-1', monthsCredited: 1 }];

      mockPrismaService.referralReward.findMany.mockResolvedValue(pendingRewards);
      mockPrismaService.userSubscription.findUnique.mockResolvedValue(null);

      const result = await service.applyPendingCredits(userId);

      expect(result).toBe(0);
    });
  });
});
