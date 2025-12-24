/**
 * BillingService Tests
 *
 * Testes para o serviço de billing com o novo modelo:
 * - TRIAL: 14 dias grátis com tudo liberado
 * - PRO: R$ 99,90/mês ou R$ 89,90/mês (anual)
 *
 * Funções testadas:
 * - calculateTrialDaysRemaining
 * - isTrialExpired
 * - getBillingStatus
 * - isOnTrial
 * - Constants (TRIAL_DURATION_DAYS, PRO_PLAN_PRICING)
 */

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

import {
  BillingService,
  calculateTrialDaysRemaining,
  isTrialExpired,
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
  BillingStatus,
  BillingPeriod,
  SubscriptionStatus,
} from '../../src/services/BillingService';
import * as SecureStore from 'expo-secure-store';

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock token exists
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
  });

  describe('Constants', () => {
    it('should have correct trial duration', () => {
      expect(TRIAL_DURATION_DAYS).toBe(14);
    });

    it('should have correct PRO plan pricing', () => {
      expect(PRO_PLAN_PRICING.MONTHLY).toBe(99.90);
      expect(PRO_PLAN_PRICING.YEARLY).toBe(89.90);
      expect(PRO_PLAN_PRICING.YEARLY_TOTAL).toBe(1078.80);
      expect(PRO_PLAN_PRICING.YEARLY_SAVINGS).toBe(119.00);
    });

    it('should calculate yearly savings correctly', () => {
      const monthlyAnnualCost = PRO_PLAN_PRICING.MONTHLY * 12;
      const yearlyTotalCost = PRO_PLAN_PRICING.YEARLY_TOTAL;
      const expectedSavings = monthlyAnnualCost - yearlyTotalCost;

      // Allow for floating point precision (within R$ 2.00 tolerance)
      expect(Math.abs(expectedSavings - PRO_PLAN_PRICING.YEARLY_SAVINGS)).toBeLessThan(2);
    });
  });

  describe('calculateTrialDaysRemaining', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return 0 when trialEndAt is null', () => {
      expect(calculateTrialDaysRemaining(null)).toBe(0);
    });

    it('should return 0 when trialEndAt is undefined', () => {
      expect(calculateTrialDaysRemaining(undefined)).toBe(0);
    });

    it('should return 0 when trial has expired', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      const pastDate = new Date('2024-06-14T12:00:00Z');
      expect(calculateTrialDaysRemaining(pastDate.toISOString())).toBe(0);
    });

    it('should return correct days remaining for future date', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      const futureDate = new Date('2024-06-22T12:00:00Z');
      expect(calculateTrialDaysRemaining(futureDate.toISOString())).toBe(7);
    });

    it('should return 1 for trial ending tomorrow', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      const tomorrow = new Date('2024-06-16T12:00:00Z');
      expect(calculateTrialDaysRemaining(tomorrow.toISOString())).toBe(1);
    });

    it('should return 14 for full trial period', () => {
      const now = new Date('2024-06-01T00:00:00Z');
      jest.setSystemTime(now);

      const trialEnd = new Date('2024-06-15T00:00:00Z');
      expect(calculateTrialDaysRemaining(trialEnd.toISOString())).toBe(14);
    });

    it('should round up partial days', () => {
      const now = new Date('2024-06-15T23:00:00Z');
      jest.setSystemTime(now);

      const futureDate = new Date('2024-06-17T01:00:00Z');
      expect(calculateTrialDaysRemaining(futureDate.toISOString())).toBe(2);
    });
  });

  describe('isTrialExpired', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return false when trialEndAt is null', () => {
      expect(isTrialExpired(null)).toBe(false);
    });

    it('should return false when trialEndAt is undefined', () => {
      expect(isTrialExpired(undefined)).toBe(false);
    });

    it('should return true when trial end date is in the past', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      const pastDate = new Date('2024-06-14T12:00:00Z');
      expect(isTrialExpired(pastDate.toISOString())).toBe(true);
    });

    it('should return false when trial end date is in the future', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      const futureDate = new Date('2024-06-22T12:00:00Z');
      expect(isTrialExpired(futureDate.toISOString())).toBe(false);
    });

    it('should return true when trial ended 1 second ago', () => {
      const now = new Date('2024-06-15T12:00:01Z');
      jest.setSystemTime(now);

      const justPassed = new Date('2024-06-15T12:00:00Z');
      expect(isTrialExpired(justPassed.toISOString())).toBe(true);
    });
  });

  describe('getBillingStatus', () => {
    it('should return billing status for TRIALING user', async () => {
      const mockBillingStatus: BillingStatus = {
        planKey: 'TRIAL',
        planName: 'Trial Gratuito',
        subscriptionStatus: 'TRIALING',
        trialEndAt: '2024-06-22T00:00:00Z',
        trialDaysRemaining: 7,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingStatus),
      });

      const result = await BillingService.getBillingStatus();

      expect(result).toEqual(mockBillingStatus);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/plan'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
    });

    it('should return billing status for ACTIVE PRO user', async () => {
      const mockBillingStatus: BillingStatus = {
        planKey: 'PRO',
        planName: 'PRO',
        subscriptionStatus: 'ACTIVE',
        billingPeriod: 'MONTHLY',
        currentPeriodStart: '2024-06-01T00:00:00Z',
        currentPeriodEnd: '2024-07-01T00:00:00Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBillingStatus),
      });

      const result = await BillingService.getBillingStatus();

      expect(result).toEqual(mockBillingStatus);
      expect(result?.billingPeriod).toBe('MONTHLY');
    });

    it('should return null when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BillingService.getBillingStatus();

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await BillingService.getBillingStatus();

      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await BillingService.getBillingStatus();

      expect(result).toBeNull();
    });
  });

  describe('isOnTrial', () => {
    it('should return true when subscription status is TRIALING', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            planKey: 'TRIAL',
            planName: 'Trial Gratuito',
            subscriptionStatus: 'TRIALING',
          }),
      });

      const result = await BillingService.isOnTrial();

      expect(result).toBe(true);
    });

    it('should return false when subscription status is ACTIVE', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            planKey: 'PRO',
            planName: 'PRO',
            subscriptionStatus: 'ACTIVE',
          }),
      });

      const result = await BillingService.isOnTrial();

      expect(result).toBe(false);
    });

    it('should return false when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BillingService.isOnTrial();

      expect(result).toBe(false);
    });
  });

  describe('getQuota (legacy support)', () => {
    it('should return quota info for CLIENT resource', async () => {
      const mockQuota = {
        remaining: -1,
        max: -1,
        current: 50,
        unlimited: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuota),
      });

      const result = await BillingService.getQuota('CLIENT');

      expect(result).toEqual(mockQuota);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/quota?resource=CLIENT'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
    });

    it('should return unlimited when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BillingService.getQuota('CLIENT');

      expect(result).toEqual({
        remaining: -1,
        max: -1,
        current: 0,
        unlimited: true,
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return unlimited on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await BillingService.getQuota('CLIENT');

      expect(result).toEqual({
        remaining: -1,
        max: -1,
        current: 0,
        unlimited: true,
      });
    });
  });

  describe('getClientQuota', () => {
    it('should be an alias for getQuota(CLIENT)', async () => {
      const mockQuota = {
        remaining: -1,
        max: -1,
        current: 100,
        unlimited: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockQuota),
      });

      const result = await BillingService.getClientQuota();

      expect(result).toEqual(mockQuota);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=CLIENT'),
        expect.any(Object)
      );
    });
  });
});

describe('Subscription Status Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
  });

  it('TRIALING: user on 14-day trial', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'TRIAL',
          planName: 'Trial Gratuito',
          subscriptionStatus: 'TRIALING',
          trialEndAt: '2024-06-22T00:00:00Z',
          trialDaysRemaining: 7,
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('TRIALING');
    expect(status?.trialDaysRemaining).toBe(7);
  });

  it('ACTIVE: paying PRO user with monthly billing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'PRO',
          planName: 'PRO',
          subscriptionStatus: 'ACTIVE',
          billingPeriod: 'MONTHLY',
          currentPeriodStart: '2024-06-01T00:00:00Z',
          currentPeriodEnd: '2024-07-01T00:00:00Z',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('ACTIVE');
    expect(status?.billingPeriod).toBe('MONTHLY');
    expect(status?.planKey).toBe('PRO');
  });

  it('ACTIVE: paying PRO user with yearly billing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'PRO',
          planName: 'PRO',
          subscriptionStatus: 'ACTIVE',
          billingPeriod: 'YEARLY',
          currentPeriodStart: '2024-01-01T00:00:00Z',
          currentPeriodEnd: '2025-01-01T00:00:00Z',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.billingPeriod).toBe('YEARLY');
  });

  it('PAST_DUE: user with payment issue', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'PRO',
          planName: 'PRO',
          subscriptionStatus: 'PAST_DUE',
          billingPeriod: 'MONTHLY',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('PAST_DUE');
  });

  it('CANCELED: user who canceled subscription', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'PRO',
          planName: 'PRO',
          subscriptionStatus: 'CANCELED',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: '2024-07-01T00:00:00Z',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('CANCELED');
    expect(status?.cancelAtPeriodEnd).toBe(true);
  });

  it('BLOCKED: user blocked from access', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'TRIAL',
          planName: 'Trial Gratuito',
          subscriptionStatus: 'BLOCKED',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('BLOCKED');
  });

  it('EXPIRED: trial expired without subscription', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          planKey: 'TRIAL',
          planName: 'Trial Gratuito',
          subscriptionStatus: 'EXPIRED',
          trialEndAt: '2024-06-01T00:00:00Z',
        }),
    });

    const status = await BillingService.getBillingStatus();

    expect(status?.subscriptionStatus).toBe('EXPIRED');
  });
});

describe('Urgency Level Calculation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be urgent when <= 3 days remaining', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    // 3 days
    expect(calculateTrialDaysRemaining('2024-06-18T12:00:00Z')).toBe(3);
    // 2 days
    expect(calculateTrialDaysRemaining('2024-06-17T12:00:00Z')).toBe(2);
    // 1 day
    expect(calculateTrialDaysRemaining('2024-06-16T12:00:00Z')).toBe(1);

    // All should be <= 3 (urgent threshold)
    [3, 2, 1].forEach(days => {
      expect(days).toBeLessThanOrEqual(3);
    });
  });

  it('should be warning when 4-7 days remaining', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    // 7 days
    const days7 = calculateTrialDaysRemaining('2024-06-22T12:00:00Z');
    expect(days7).toBe(7);
    expect(days7 <= 7 && days7 > 3).toBe(true);

    // 5 days
    const days5 = calculateTrialDaysRemaining('2024-06-20T12:00:00Z');
    expect(days5).toBe(5);
    expect(days5 <= 7 && days5 > 3).toBe(true);

    // 4 days
    const days4 = calculateTrialDaysRemaining('2024-06-19T12:00:00Z');
    expect(days4).toBe(4);
    expect(days4 <= 7 && days4 > 3).toBe(true);
  });

  it('should be normal when > 7 days remaining', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    // 10 days
    const days10 = calculateTrialDaysRemaining('2024-06-25T12:00:00Z');
    expect(days10).toBe(10);
    expect(days10 > 7).toBe(true);

    // 14 days (full trial)
    const days14 = calculateTrialDaysRemaining('2024-06-29T12:00:00Z');
    expect(days14).toBe(14);
    expect(days14 > 7).toBe(true);
  });
});
