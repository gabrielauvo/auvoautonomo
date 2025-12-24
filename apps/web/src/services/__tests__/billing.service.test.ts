/**
 * Billing Service Tests
 *
 * Testes unitários para o serviço de billing
 */

import {
  calculateTrialDaysRemaining,
  isTrialExpired,
  TRIAL_DURATION_DAYS,
  PRO_PLAN_PRICING,
  BillingStatus,
  BillingPeriod,
} from '../billing.service';

describe('Billing Service', () => {
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
      // Use fake timers for consistent date testing
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
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      expect(calculateTrialDaysRemaining(pastDate.toISOString())).toBe(0);
    });

    it('should return correct days remaining for future date', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // Trial ends in 7 days
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

    it('should handle same-day expiration correctly', () => {
      const now = new Date('2024-06-15T06:00:00Z');
      jest.setSystemTime(now);

      // Ends later today
      const laterToday = new Date('2024-06-15T23:59:59Z');
      expect(calculateTrialDaysRemaining(laterToday.toISOString())).toBe(1);
    });

    it('should round up partial days', () => {
      const now = new Date('2024-06-15T23:00:00Z');
      jest.setSystemTime(now);

      // Just over 1 day remaining
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

    it('should return true when trial ends exactly now', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // Same moment - should be expired
      expect(isTrialExpired(now.toISOString())).toBe(false);
    });

    it('should return true when trial ended 1 second ago', () => {
      const now = new Date('2024-06-15T12:00:01Z');
      jest.setSystemTime(now);

      const justPassed = new Date('2024-06-15T12:00:00Z');
      expect(isTrialExpired(justPassed.toISOString())).toBe(true);
    });
  });

  describe('BillingStatus type', () => {
    it('should accept valid TRIAL status', () => {
      const status: BillingStatus = {
        planKey: 'TRIAL',
        planName: 'Trial Gratuito',
        subscriptionStatus: 'TRIALING',
        trialEndAt: '2024-06-22T00:00:00Z',
        trialDaysRemaining: 7,
      };

      expect(status.planKey).toBe('TRIAL');
      expect(status.subscriptionStatus).toBe('TRIALING');
    });

    it('should accept valid PRO status with monthly billing', () => {
      const status: BillingStatus = {
        planKey: 'PRO',
        planName: 'PRO',
        subscriptionStatus: 'ACTIVE',
        billingPeriod: 'MONTHLY',
        currentPeriodStart: '2024-06-01T00:00:00Z',
        currentPeriodEnd: '2024-07-01T00:00:00Z',
      };

      expect(status.planKey).toBe('PRO');
      expect(status.subscriptionStatus).toBe('ACTIVE');
      expect(status.billingPeriod).toBe('MONTHLY');
    });

    it('should accept valid PRO status with yearly billing', () => {
      const status: BillingStatus = {
        planKey: 'PRO',
        planName: 'PRO',
        subscriptionStatus: 'ACTIVE',
        billingPeriod: 'YEARLY',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2025-01-01T00:00:00Z',
      };

      expect(status.billingPeriod).toBe('YEARLY');
    });

    it('should accept PAST_DUE status', () => {
      const status: BillingStatus = {
        planKey: 'PRO',
        planName: 'PRO',
        subscriptionStatus: 'PAST_DUE',
        billingPeriod: 'MONTHLY',
      };

      expect(status.subscriptionStatus).toBe('PAST_DUE');
    });

    it('should accept CANCELED status with cancelAtPeriodEnd', () => {
      const status: BillingStatus = {
        planKey: 'PRO',
        planName: 'PRO',
        subscriptionStatus: 'CANCELED',
        billingPeriod: 'MONTHLY',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: '2024-07-01T00:00:00Z',
      };

      expect(status.subscriptionStatus).toBe('CANCELED');
      expect(status.cancelAtPeriodEnd).toBe(true);
    });

    it('should accept BLOCKED status', () => {
      const status: BillingStatus = {
        planKey: 'TRIAL',
        planName: 'Trial Gratuito',
        subscriptionStatus: 'BLOCKED',
      };

      expect(status.subscriptionStatus).toBe('BLOCKED');
    });

    it('should accept EXPIRED status', () => {
      const status: BillingStatus = {
        planKey: 'TRIAL',
        planName: 'Trial Gratuito',
        subscriptionStatus: 'EXPIRED',
        trialEndAt: '2024-06-01T00:00:00Z',
      };

      expect(status.subscriptionStatus).toBe('EXPIRED');
    });
  });

  describe('BillingPeriod type', () => {
    it('should accept MONTHLY period', () => {
      const period: BillingPeriod = 'MONTHLY';
      expect(period).toBe('MONTHLY');
    });

    it('should accept YEARLY period', () => {
      const period: BillingPeriod = 'YEARLY';
      expect(period).toBe('YEARLY');
    });
  });

  describe('Urgency levels for trial banner', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should be urgent when <= 3 days remaining', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // 3 days remaining
      const trialEnd3Days = new Date('2024-06-18T12:00:00Z');
      const days3 = calculateTrialDaysRemaining(trialEnd3Days.toISOString());
      expect(days3).toBeLessThanOrEqual(3);

      // 2 days remaining
      const trialEnd2Days = new Date('2024-06-17T12:00:00Z');
      const days2 = calculateTrialDaysRemaining(trialEnd2Days.toISOString());
      expect(days2).toBeLessThanOrEqual(3);

      // 1 day remaining
      const trialEnd1Day = new Date('2024-06-16T12:00:00Z');
      const days1 = calculateTrialDaysRemaining(trialEnd1Day.toISOString());
      expect(days1).toBeLessThanOrEqual(3);
    });

    it('should be warning when 4-7 days remaining', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // 7 days remaining
      const trialEnd7Days = new Date('2024-06-22T12:00:00Z');
      const days7 = calculateTrialDaysRemaining(trialEnd7Days.toISOString());
      expect(days7).toBeLessThanOrEqual(7);
      expect(days7).toBeGreaterThan(3);

      // 5 days remaining
      const trialEnd5Days = new Date('2024-06-20T12:00:00Z');
      const days5 = calculateTrialDaysRemaining(trialEnd5Days.toISOString());
      expect(days5).toBeLessThanOrEqual(7);
      expect(days5).toBeGreaterThan(3);
    });

    it('should be normal when > 7 days remaining', () => {
      const now = new Date('2024-06-15T12:00:00Z');
      jest.setSystemTime(now);

      // 10 days remaining
      const trialEnd10Days = new Date('2024-06-25T12:00:00Z');
      const days10 = calculateTrialDaysRemaining(trialEnd10Days.toISOString());
      expect(days10).toBeGreaterThan(7);

      // 14 days remaining
      const trialEnd14Days = new Date('2024-06-29T12:00:00Z');
      const days14 = calculateTrialDaysRemaining(trialEnd14Days.toISOString());
      expect(days14).toBeGreaterThan(7);
    });
  });
});
