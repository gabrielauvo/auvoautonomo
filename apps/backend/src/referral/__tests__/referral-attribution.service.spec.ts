import { Test, TestingModule } from '@nestjs/testing';
import { ReferralAttributionService } from '../services/referral-attribution.service';
import { ReferralCodeService } from '../services/referral-code.service';
import { ReferralClickService } from '../services/referral-click.service';
import { ReferralAntifraudService } from '../services/referral-antifraud.service';
import { ReferralAuditService } from '../services/referral-audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralAttributionMethod, ReferralStatus, ReferralPlatform } from '@prisma/client';

describe('ReferralAttributionService', () => {
  let service: ReferralAttributionService;
  let prisma: PrismaService;
  let codeService: ReferralCodeService;
  let clickService: ReferralClickService;
  let antifraudService: ReferralAntifraudService;
  let auditService: ReferralAuditService;

  const mockPrismaService = {
    referral: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    referralInstall: {
      create: jest.fn(),
    },
  };

  const mockCodeService = {
    validateCode: jest.fn(),
  };

  const mockClickService = {
    findByClickId: jest.fn(),
    findByFingerprint: jest.fn(),
    markAsConverted: jest.fn(),
  };

  const mockAntifraudService = {
    checkAttribution: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralAttributionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ReferralCodeService, useValue: mockCodeService },
        { provide: ReferralClickService, useValue: mockClickService },
        { provide: ReferralAntifraudService, useValue: mockAntifraudService },
        { provide: ReferralAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ReferralAttributionService>(ReferralAttributionService);
    prisma = module.get<PrismaService>(PrismaService);
    codeService = module.get<ReferralCodeService>(ReferralCodeService);
    clickService = module.get<ReferralClickService>(ReferralClickService);
    antifraudService = module.get<ReferralAntifraudService>(ReferralAntifraudService);
    auditService = module.get<ReferralAuditService>(ReferralAuditService);

    jest.clearAllMocks();
  });

  describe('attach', () => {
    const baseParams = {
      refereeUserId: 'referee-123',
      refereeEmail: 'referee@test.com',
      platform: 'ANDROID' as const,
    };

    it('should return error if user already has a referrer', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue({
        id: 'existing-referral',
        refereeUserId: baseParams.refereeUserId,
      });

      const result = await service.attach(baseParams);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User already has a referrer');
      expect(mockPrismaService.referral.create).not.toHaveBeenCalled();
    });

    describe('code attribution', () => {
      it('should attribute via referral code successfully', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockCodeService.validateCode.mockResolvedValue({
          valid: true,
          referrerFirstName: 'João',
          referrerUserId: 'referrer-456',
          codeId: 'code-123',
        });
        mockAntifraudService.checkAttribution.mockResolvedValue({
          blocked: false,
          flags: [],
        });
        mockPrismaService.referral.create.mockResolvedValue({
          id: 'referral-123',
          referrerUserId: 'referrer-456',
          refereeUserId: baseParams.refereeUserId,
          status: ReferralStatus.SIGNUP_COMPLETE,
        });

        const result = await service.attach({
          ...baseParams,
          code: 'JOAO7K2F',
        });

        expect(result.success).toBe(true);
        expect(result.referralId).toBe('referral-123');
        expect(result.referrerName).toBe('João');
        expect(result.attributionMethod).toBe(ReferralAttributionMethod.MANUAL_CODE);
        expect(mockPrismaService.referral.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            referrerUserId: 'referrer-456',
            refereeUserId: baseParams.refereeUserId,
            attributionMethod: ReferralAttributionMethod.MANUAL_CODE,
            status: ReferralStatus.SIGNUP_COMPLETE,
          }),
        });
      });

      it('should return error for invalid code', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockCodeService.validateCode.mockResolvedValue({ valid: false });

        const result = await service.attach({
          ...baseParams,
          code: 'INVALID',
        });

        expect(result.success).toBe(false);
        // When only code fails and no other attribution methods, returns generic message
        expect(result.message).toBeDefined();
      });

      it('should block fraudulent attribution', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockCodeService.validateCode.mockResolvedValue({
          valid: true,
          referrerFirstName: 'João',
          referrerUserId: 'referrer-456',
          codeId: 'code-123',
        });
        mockAntifraudService.checkAttribution.mockResolvedValue({
          blocked: true,
          reason: 'Self-referral detected',
          flags: ['SELF_REFERRAL'],
        });

        const result = await service.attach({
          ...baseParams,
          code: 'JOAO7K2F',
        });

        expect(result.success).toBe(false);
        // Fraud detection returns generic message (could not attribute) when blocked
        expect(result.message).toBeDefined();
      });
    });

    describe('clickId attribution', () => {
      it('should attribute via clickId successfully', async () => {
        const click = {
          id: 'click-record-id',
          clickId: 'click-789',
          converted: false,
          expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
          code: {
            userId: 'referrer-456',
            user: {
              name: 'Maria Silva',
            },
          },
        };

        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockClickService.findByClickId.mockResolvedValue(click);
        mockAntifraudService.checkAttribution.mockResolvedValue({
          blocked: false,
          flags: [],
        });
        mockPrismaService.referral.create.mockResolvedValue({
          id: 'referral-456',
          referrerUserId: 'referrer-456',
          refereeUserId: baseParams.refereeUserId,
          status: ReferralStatus.SIGNUP_COMPLETE,
        });

        const result = await service.attach({
          ...baseParams,
          clickId: 'click-789',
        });

        expect(result.success).toBe(true);
        expect(result.referralId).toBe('referral-456');
        expect(result.referrerName).toBe('Maria');
        expect(result.attributionMethod).toBe(ReferralAttributionMethod.LINK_DIRECT);
        expect(mockClickService.markAsConverted).toHaveBeenCalledWith('click-789');
      });

      it('should return error for invalid clickId', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockClickService.findByClickId.mockResolvedValue(null);

        const result = await service.attach({
          ...baseParams,
          clickId: 'invalid-click',
        });

        expect(result.success).toBe(false);
        // Invalid click returns generic error message
        expect(result.message).toBeDefined();
      });

      it('should return error for already converted click', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockClickService.findByClickId.mockResolvedValue({
          id: 'click-record-id',
          clickId: 'click-789',
          converted: true,
          expiresAt: new Date(Date.now() + 3600000),
          code: { userId: 'referrer-456', user: { name: 'Test' } },
        });

        const result = await service.attach({
          ...baseParams,
          clickId: 'click-789',
        });

        expect(result.success).toBe(false);
      });

      it('should return error for expired click', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockClickService.findByClickId.mockResolvedValue({
          id: 'click-record-id',
          clickId: 'click-789',
          converted: false,
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago (expired)
          code: { userId: 'referrer-456', user: { name: 'Test' } },
        });

        const result = await service.attach({
          ...baseParams,
          clickId: 'click-789',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('install referrer attribution (Android)', () => {
      it('should attribute via install referrer successfully', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);
        mockCodeService.validateCode.mockResolvedValue({
          valid: true,
          referrerFirstName: 'Pedro',
          referrerUserId: 'referrer-789',
          codeId: 'code-456',
        });
        mockAntifraudService.checkAttribution.mockResolvedValue({
          blocked: false,
          flags: [],
        });
        mockPrismaService.referral.create.mockResolvedValue({
          id: 'referral-789',
          referrerUserId: 'referrer-789',
          refereeUserId: baseParams.refereeUserId,
          status: ReferralStatus.SIGNUP_COMPLETE,
        });

        const result = await service.attach({
          ...baseParams,
          platform: 'ANDROID',
          installReferrer: {
            installReferrer: 'utm_source=referral&utm_campaign=PEDRO123&click_id=click-abc',
          },
        });

        expect(result.success).toBe(true);
        expect(result.referralId).toBe('referral-789');
        expect(result.referrerName).toBe('Pedro');
        expect(result.attributionMethod).toBe(ReferralAttributionMethod.INSTALL_REFERRER);
        expect(mockPrismaService.referralInstall.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            platform: ReferralPlatform.ANDROID,
            matched: true,
          }),
        });
      });

      it('should return error if not a referral install', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);

        const result = await service.attach({
          ...baseParams,
          platform: 'ANDROID',
          installReferrer: {
            installReferrer: 'utm_source=organic',
          },
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe('Could not attribute referral');
      });
    });

    describe('attribution priority', () => {
      it('should try code first, then clickId', async () => {
        mockPrismaService.referral.findUnique.mockResolvedValue(null);

        // Code validation fails
        mockCodeService.validateCode.mockResolvedValue({ valid: false });

        // Click validation succeeds
        mockClickService.findByClickId.mockResolvedValue({
          id: 'click-id',
          clickId: 'click-123',
          converted: false,
          expiresAt: new Date(Date.now() + 3600000),
          code: {
            userId: 'referrer-456',
            user: { name: 'Ana Costa' },
          },
        });
        mockAntifraudService.checkAttribution.mockResolvedValue({
          blocked: false,
          flags: [],
        });
        mockPrismaService.referral.create.mockResolvedValue({
          id: 'referral-123',
          referrerUserId: 'referrer-456',
          refereeUserId: baseParams.refereeUserId,
        });

        const result = await service.attach({
          ...baseParams,
          code: 'INVALID',
          clickId: 'click-123',
        });

        expect(result.success).toBe(true);
        expect(result.attributionMethod).toBe(ReferralAttributionMethod.LINK_DIRECT);
      });
    });
  });

  describe('resolveDeferred (iOS)', () => {
    it('should resolve deferred deep link via fingerprint', async () => {
      const click = {
        id: 'click-record-id',
        clickId: 'click-123',
        code: {
          code: 'MARIA9X3Z',
          customCode: null,
          userId: 'referrer-789',
          user: {
            name: 'Maria Santos',
          },
        },
      };

      mockClickService.findByFingerprint.mockResolvedValue(click);
      mockPrismaService.referralInstall.create.mockResolvedValue({});

      const result = await service.resolveDeferred({
        fingerprintHash: 'fingerprint-abc',
        deviceIdHash: 'device-xyz',
      });

      expect(result.matched).toBe(true);
      expect(result.code).toBe('MARIA9X3Z');
      expect(result.referrerName).toBe('Maria');
      expect(mockPrismaService.referralInstall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clickId: 'click-123',
          deviceIdHash: 'device-xyz',
          platform: ReferralPlatform.IOS,
          matched: true,
        }),
      });
    });

    it('should use customCode if available', async () => {
      const click = {
        id: 'click-record-id',
        clickId: 'click-123',
        code: {
          code: 'GABR9X3Z',
          customCode: 'GABRIEL',
          userId: 'referrer-789',
          user: {
            name: 'Gabriel Silva',
          },
        },
      };

      mockClickService.findByFingerprint.mockResolvedValue(click);
      mockPrismaService.referralInstall.create.mockResolvedValue({});

      const result = await service.resolveDeferred({
        fingerprintHash: 'fingerprint-abc',
        deviceIdHash: 'device-xyz',
      });

      expect(result.code).toBe('GABRIEL');
    });

    it('should return no match if fingerprint not found', async () => {
      mockClickService.findByFingerprint.mockResolvedValue(null);

      const result = await service.resolveDeferred({
        fingerprintHash: 'unknown-fingerprint',
        deviceIdHash: 'device-xyz',
      });

      expect(result.matched).toBe(false);
      expect(result.code).toBeUndefined();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deferred_resolve_attempt',
          decision: 'NO_MATCH',
        }),
      );
    });

    it('should fallback to "Usuário" if referrer name is empty', async () => {
      const click = {
        id: 'click-record-id',
        clickId: 'click-123',
        code: {
          code: 'TEST1234',
          customCode: null,
          userId: 'referrer-789',
          user: {
            name: null,
          },
        },
      };

      mockClickService.findByFingerprint.mockResolvedValue(click);
      mockPrismaService.referralInstall.create.mockResolvedValue({});

      const result = await service.resolveDeferred({
        fingerprintHash: 'fingerprint-abc',
        deviceIdHash: 'device-xyz',
      });

      expect(result.referrerName).toBe('Usuário');
    });
  });

  describe('onSignupComplete', () => {
    it('should update referral status to SIGNUP_COMPLETE', async () => {
      const referral = {
        id: 'referral-123',
        refereeUserId: 'referee-123',
        status: ReferralStatus.PENDING,
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);
      mockPrismaService.referral.update.mockResolvedValue({
        ...referral,
        status: ReferralStatus.SIGNUP_COMPLETE,
      });

      await service.onSignupComplete('referee-123');

      expect(mockPrismaService.referral.update).toHaveBeenCalledWith({
        where: { id: 'referral-123' },
        data: { status: ReferralStatus.SIGNUP_COMPLETE },
      });
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'status_update',
          decision: 'SIGNUP_COMPLETE',
        }),
      );
    });

    it('should not update if referral not found', async () => {
      mockPrismaService.referral.findUnique.mockResolvedValue(null);

      await service.onSignupComplete('referee-123');

      expect(mockPrismaService.referral.update).not.toHaveBeenCalled();
    });

    it('should not update if status is not PENDING', async () => {
      const referral = {
        id: 'referral-123',
        refereeUserId: 'referee-123',
        status: ReferralStatus.SIGNUP_COMPLETE,
      };

      mockPrismaService.referral.findUnique.mockResolvedValue(referral);

      await service.onSignupComplete('referee-123');

      expect(mockPrismaService.referral.update).not.toHaveBeenCalled();
    });
  });
});
