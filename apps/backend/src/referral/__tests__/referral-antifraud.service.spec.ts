import { Test, TestingModule } from '@nestjs/testing';
import { ReferralAntifraudService } from '../services/referral-antifraud.service';
import { ReferralAuditService } from '../services/referral-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReferralAntifraudService', () => {
  let service: ReferralAntifraudService;
  let prisma: PrismaService;
  let auditService: ReferralAuditService;

  const mockPrismaService = {
    referral: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
    },
    referralInstall: {
      findFirst: jest.fn(),
    },
    referralClick: {
      count: jest.fn(),
    },
    subscriptionPaymentHistory: {
      findMany: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralAntifraudService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ReferralAuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<ReferralAntifraudService>(ReferralAntifraudService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<ReferralAuditService>(ReferralAuditService);

    jest.clearAllMocks();
  });

  describe('checkAttribution', () => {
    const baseParams = {
      referrerUserId: 'referrer-123',
      refereeUserId: 'referee-456',
      refereeEmail: 'referee@gmail.com',
    };

    it('should return clean result when no fraud detected', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'referrer@example.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution(baseParams);

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.flags).toHaveLength(0);
    });

    it('should detect self-referral', async () => {
      const result = await service.checkAttribution({
        referrerUserId: 'user-123',
        refereeUserId: 'user-123',
        refereeEmail: 'test@gmail.com',
      });

      expect(result.blocked).toBe(true);
      expect(result.flags).toContain('SELF_REFERRAL');
    });

    it('should detect same email (normalized Gmail)', async () => {
      // Gmail dot trick: john.doe@gmail.com === johndoe@gmail.com
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'john.doe@gmail.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution({
        ...baseParams,
        refereeEmail: 'johndoe@gmail.com',
      });

      expect(result.blocked).toBe(true);
      expect(result.flags).toContain('SAME_EMAIL_NORMALIZED');
    });

    it('should detect Gmail plus addressing trick', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'john@gmail.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution({
        ...baseParams,
        refereeEmail: 'john+referral@gmail.com',
      });

      expect(result.blocked).toBe(true);
      expect(result.flags).toContain('SAME_EMAIL_NORMALIZED');
    });

    it('should allow different emails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'alice@gmail.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution({
        ...baseParams,
        refereeEmail: 'bob@gmail.com',
      });

      expect(result.flags).not.toContain('SAME_EMAIL_NORMALIZED');
    });

    it('should detect velocity abuse (too many referrals in short time)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'a@test.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(10); // >= 5 triggers flag
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution(baseParams);

      expect(result.flags).toContain('HIGH_VELOCITY');
    });

    it('should detect multiple conversions from same IP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'a@test.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);
      mockPrismaService.referralClick.count.mockResolvedValue(5); // >= 3 triggers flag

      const result = await service.checkAttribution({
        ...baseParams,
        ipHash: 'ip-hash-123',
      });

      expect(result.flags).toContain('MULTIPLE_CONVERSIONS_SAME_IP');
    });

    it('should log to audit service when flags are found', async () => {
      await service.checkAttribution({
        referrerUserId: 'user-123',
        refereeUserId: 'user-123',
        refereeEmail: 'test@gmail.com',
      });

      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'fraud_check',
          decision: 'BLOCKED',
        }),
      );
    });
  });

  describe('checkPayment', () => {
    const params = {
      referralId: 'referral-123',
      refereeUserId: 'referee-456',
    };

    it('should return clean result when no fraud detected', async () => {
      mockPrismaService.subscriptionPaymentHistory.findMany.mockResolvedValue([]);
      mockPrismaService.referral.findUnique.mockResolvedValue({
        id: 'referral-123',
        referrerUser: null,
      });

      const result = await service.checkPayment(params);

      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should detect same card as referrer', async () => {
      mockPrismaService.subscriptionPaymentHistory.findMany.mockResolvedValue([]);
      mockPrismaService.referral.findUnique.mockResolvedValue({
        id: 'referral-123',
        referrerUser: {
          subscription: {
            creditCardLastFour: '1234',
          },
        },
      });

      const result = await service.checkPayment({
        ...params,
        cardLastFour: '1234',
      });

      expect(result.blocked).toBe(true);
      expect(result.flags).toContain('SAME_CARD_AS_REFERRER');
    });

    it('should allow different cards', async () => {
      mockPrismaService.subscriptionPaymentHistory.findMany.mockResolvedValue([]);
      mockPrismaService.referral.findUnique.mockResolvedValue({
        id: 'referral-123',
        referrerUser: {
          subscription: {
            creditCardLastFour: '1234',
          },
        },
      });

      const result = await service.checkPayment({
        ...params,
        cardLastFour: '5678',
      });

      expect(result.blocked).toBe(false);
      expect(result.flags).not.toContain('SAME_CARD_AS_REFERRER');
    });
  });

  describe('normalizeEmail (private method via behavior)', () => {
    it('should normalize Gmail addresses correctly', async () => {
      // Test via checkAttribution behavior
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'J.O.H.N+spam@gmail.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution({
        referrerUserId: 'referrer-123',
        refereeUserId: 'referee-456',
        refereeEmail: 'john@gmail.com',
      });

      expect(result.flags).toContain('SAME_EMAIL_NORMALIZED');
    });

    it('should preserve non-Gmail addresses', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'referrer-123',
        email: 'john.doe@outlook.com',
      });
      mockPrismaService.referral.count.mockResolvedValue(0);
      mockPrismaService.device.findMany.mockResolvedValue([]);

      const result = await service.checkAttribution({
        referrerUserId: 'referrer-123',
        refereeUserId: 'referee-456',
        refereeEmail: 'johndoe@outlook.com', // Different (dots matter for non-Gmail)
      });

      expect(result.flags).not.toContain('SAME_EMAIL_NORMALIZED');
    });
  });
});
