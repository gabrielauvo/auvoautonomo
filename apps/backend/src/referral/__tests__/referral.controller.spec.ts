import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ReferralController } from '../referral.controller';
import { ReferralCodeService } from '../services/referral-code.service';
import { ReferralClickService } from '../services/referral-click.service';
import { ReferralAttributionService } from '../services/referral-attribution.service';
import { ReferralRewardsService } from '../services/referral-rewards.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ReferralAttributionMethod } from '@prisma/client';

describe('ReferralController (Integration)', () => {
  let app: INestApplication;

  const mockUser = {
    id: 'user-123',
    name: 'João Silva',
    email: 'joao@test.com',
  };

  const mockCodeService = {
    getOrCreateCode: jest.fn(),
    validateCode: jest.fn(),
    setCustomCode: jest.fn(),
  };

  const mockClickService = {
    registerClick: jest.fn(),
  };

  const mockAttributionService = {
    attach: jest.fn(),
    resolveDeferred: jest.fn(),
  };

  const mockRewardsService = {
    getStats: jest.fn(),
    getRecentReferrals: jest.fn(),
    getRewardsHistory: jest.fn(),
    applyPendingCredits: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn().mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      req.user = mockUser;
      return true;
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
      ],
      controllers: [ReferralController],
      providers: [
        { provide: ReferralCodeService, useValue: mockCodeService },
        { provide: ReferralClickService, useValue: mockClickService },
        { provide: ReferralAttributionService, useValue: mockAttributionService },
        { provide: ReferralRewardsService, useValue: mockRewardsService },
        {
          provide: APP_GUARD,
          useClass: ThrottlerGuard,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/referral/validate/:code', () => {
    it('should return valid response for active code', async () => {
      mockCodeService.validateCode.mockResolvedValue({
        valid: true,
        referrerFirstName: 'Maria',
        referrerUserId: 'referrer-456',
        codeId: 'code-123',
      });

      const response = await request(app.getHttpServer())
        .get('/api/referral/validate/MARIA7K2F')
        .expect(200);

      expect(response.body).toEqual({
        valid: true,
        referrerFirstName: 'Maria',
      });
    });

    it('should return invalid response for unknown code', async () => {
      mockCodeService.validateCode.mockResolvedValue({ valid: false });

      const response = await request(app.getHttpServer())
        .get('/api/referral/validate/INVALID')
        .expect(200);

      expect(response.body).toEqual({ valid: false });
    });
  });

  describe('GET /api/referral/my-code', () => {
    it('should return user referral code', async () => {
      const code = {
        code: 'JOAO7K2F',
        customCode: null,
        link: 'https://auvoautonomo.com/r/JOAO7K2F',
      };

      mockCodeService.getOrCreateCode.mockResolvedValue(code);

      const response = await request(app.getHttpServer())
        .get('/api/referral/my-code')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toEqual(code);
      expect(mockCodeService.getOrCreateCode).toHaveBeenCalledWith('user-123');
    });
  });

  describe('POST /api/referral/custom-code', () => {
    it('should set custom code successfully', async () => {
      const updatedCode = {
        code: 'JOAO7K2F',
        customCode: 'MEUNEGOCIO',
        link: 'https://auvoautonomo.com/r/MEUNEGOCIO',
      };

      mockCodeService.setCustomCode.mockResolvedValue(updatedCode);

      const response = await request(app.getHttpServer())
        .post('/api/referral/custom-code')
        .set('Authorization', 'Bearer fake-token')
        .send({ customCode: 'meunegocio' })
        .expect(201);

      expect(response.body.customCode).toBe('MEUNEGOCIO');
      expect(mockCodeService.setCustomCode).toHaveBeenCalledWith('user-123', 'meunegocio');
    });

    it('should reject empty custom code', async () => {
      await request(app.getHttpServer())
        .post('/api/referral/custom-code')
        .set('Authorization', 'Bearer fake-token')
        .send({ customCode: '' })
        .expect(400);
    });
  });

  describe('POST /api/referral/attach', () => {
    it('should attach referral to authenticated user via code', async () => {
      mockAttributionService.attach.mockResolvedValue({
        success: true,
        referralId: 'referral-123',
        referrerName: 'Maria',
        attributionMethod: ReferralAttributionMethod.MANUAL_CODE,
      });

      const response = await request(app.getHttpServer())
        .post('/api/referral/attach')
        .set('Authorization', 'Bearer fake-token')
        .send({
          code: 'MARIA7K2F',
          platform: 'ANDROID',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        referrerName: 'Maria',
        attributionMethod: ReferralAttributionMethod.MANUAL_CODE,
      });

      expect(mockAttributionService.attach).toHaveBeenCalledWith(
        expect.objectContaining({
          refereeUserId: 'user-123',
          refereeEmail: 'joao@test.com',
          code: 'MARIA7K2F',
          platform: 'ANDROID',
        }),
      );
    });

    it('should handle attribution via clickId', async () => {
      mockAttributionService.attach.mockResolvedValue({
        success: true,
        referralId: 'referral-456',
        referrerName: 'Ana',
        attributionMethod: ReferralAttributionMethod.LINK_DIRECT,
      });

      const response = await request(app.getHttpServer())
        .post('/api/referral/attach')
        .set('Authorization', 'Bearer fake-token')
        .send({
          clickId: 'click-789',
          platform: 'IOS',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.attributionMethod).toBe(ReferralAttributionMethod.LINK_DIRECT);
    });

    it('should handle attribution via install referrer', async () => {
      mockAttributionService.attach.mockResolvedValue({
        success: true,
        referralId: 'referral-789',
        referrerName: 'Pedro',
        attributionMethod: ReferralAttributionMethod.INSTALL_REFERRER,
      });

      await request(app.getHttpServer())
        .post('/api/referral/attach')
        .set('Authorization', 'Bearer fake-token')
        .send({
          installReferrer: { installReferrer: 'utm_source=referral&utm_campaign=JOAO7K2F' },
          platform: 'ANDROID',
        })
        .expect(200);
    });

    it('should return error when attribution fails', async () => {
      mockAttributionService.attach.mockResolvedValue({
        success: false,
        message: 'User already has a referrer',
      });

      const response = await request(app.getHttpServer())
        .post('/api/referral/attach')
        .set('Authorization', 'Bearer fake-token')
        .send({
          code: 'SOME-CODE',
          platform: 'WEB',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already has a referrer');
    });
  });

  describe('POST /api/referral/resolve-deferred', () => {
    it('should resolve deferred deep link', async () => {
      mockAttributionService.resolveDeferred.mockResolvedValue({
        matched: true,
        code: 'MARIA9X3Z',
        referrerName: 'Maria',
      });

      const response = await request(app.getHttpServer())
        .post('/api/referral/resolve-deferred')
        .send({
          fingerprintHash: 'fingerprint-abc',
          deviceIdHash: 'device-xyz',
        })
        .expect(200);

      expect(response.body).toEqual({
        matched: true,
        code: 'MARIA9X3Z',
        referrerName: 'Maria',
      });
    });

    it('should return no match when fingerprint not found', async () => {
      mockAttributionService.resolveDeferred.mockResolvedValue({
        matched: false,
      });

      const response = await request(app.getHttpServer())
        .post('/api/referral/resolve-deferred')
        .send({
          fingerprintHash: 'unknown-fingerprint',
          deviceIdHash: 'device-xyz',
        })
        .expect(200);

      expect(response.body.matched).toBe(false);
    });
  });

  describe('GET /api/referral/status', () => {
    it('should return full referral status', async () => {
      mockCodeService.getOrCreateCode.mockResolvedValue({
        code: 'JOAO7K2F',
        customCode: 'MEUCODIGO',
        link: 'https://auvoautonomo.com/r/MEUCODIGO',
      });

      mockRewardsService.getStats.mockResolvedValue({
        totalClicks: 50,
        totalSignups: 15,
        totalPaid: 8,
        monthsEarned: 8,
        pendingMonths: 2,
        currentMilestoneProgress: 8,
      });

      mockRewardsService.getRecentReferrals.mockResolvedValue([
        {
          id: 'ref-1',
          name: 'Ana Costa',
          status: 'SUBSCRIPTION_PAID',
          date: new Date('2024-01-20'),
        },
        {
          id: 'ref-2',
          name: 'Pedro Silva',
          status: 'SIGNUP_COMPLETE',
          date: new Date('2024-01-18'),
        },
      ]);

      mockRewardsService.getRewardsHistory.mockResolvedValue([
        {
          id: 'reward-1',
          monthsCredited: 1,
          reason: 'SINGLE_REFERRAL',
          createdAt: new Date('2024-01-20'),
          status: 'APPLIED',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/referral/status')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toMatchObject({
        code: 'JOAO7K2F',
        customCode: 'MEUCODIGO',
        link: 'https://auvoautonomo.com/r/MEUCODIGO',
        stats: {
          totalClicks: 50,
          totalSignups: 15,
          totalPaid: 8,
          monthsEarned: 8,
          pendingMonths: 2,
        },
        progress: {
          current: 8,
          target: 10,
          reward: '12 meses grátis',
          percentComplete: 80,
        },
      });

      expect(response.body.recentReferrals).toHaveLength(2);
      expect(response.body.recentReferrals[0].status).toBe('Assinou');
      expect(response.body.rewardsHistory).toHaveLength(1);
    });
  });

  describe('POST /api/referral/apply-credits', () => {
    it('should apply pending credits', async () => {
      mockRewardsService.applyPendingCredits.mockResolvedValue(3);

      const response = await request(app.getHttpServer())
        .post('/api/referral/apply-credits')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toEqual({ applied: 3 });
      expect(mockRewardsService.applyPendingCredits).toHaveBeenCalledWith('user-123');
    });

    it('should return 0 when no pending credits', async () => {
      mockRewardsService.applyPendingCredits.mockResolvedValue(0);

      const response = await request(app.getHttpServer())
        .post('/api/referral/apply-credits')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toEqual({ applied: 0 });
    });
  });

  describe('GET /r/:code (Referral Link)', () => {
    it('should register click and redirect for valid code', async () => {
      mockClickService.registerClick.mockResolvedValue({
        clickId: 'click-123',
        platform: 'WEB',
        fingerprintHash: 'fp-hash',
        referrerName: 'João',
      });

      const response = await request(app.getHttpServer())
        .get('/r/JOAO7K2F')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        .expect(302);

      expect(response.headers.location).toContain('/r/JOAO7K2F');
      expect(response.headers.location).toContain('click_id=click-123');
      expect(mockClickService.registerClick).toHaveBeenCalledWith(
        'JOAO7K2F',
        expect.any(String),
        expect.any(String),
        undefined,
      );
    });

    it('should redirect to home for invalid code', async () => {
      mockClickService.registerClick.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .get('/r/INVALID')
        .expect(302);

      // Should redirect to base URL (home)
      expect(response.headers.location).not.toContain('click_id');
    });

    it('should return HTML with app link for mobile', async () => {
      mockClickService.registerClick.mockResolvedValue({
        clickId: 'click-123',
        platform: 'IOS',
        fingerprintHash: 'fp-hash',
        referrerName: 'João',
      });

      const response = await request(app.getHttpServer())
        .get('/r/JOAO7K2F')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')
        .expect(200);

      expect(response.text).toContain('auvofield://referral');
      expect(response.text).toContain('JOAO7K2F');
      expect(response.text).toContain('João');
    });
  });
});
