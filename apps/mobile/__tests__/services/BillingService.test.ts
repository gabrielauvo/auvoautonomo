/**
 * BillingService Tests
 *
 * Testes para o serviço de billing que verifica limites do plano.
 * Garante que:
 * 1. Quota é corretamente obtida do backend
 * 2. Fallback para ilimitado em caso de erro
 * 3. Diferentes tipos de recursos são suportados
 */

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

import { BillingService } from '../../src/services/BillingService';
import * as SecureStore from 'expo-secure-store';

describe('BillingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock token exists
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
  });

  describe('getQuota', () => {
    it('should return quota info for CLIENT resource', async () => {
      const mockQuota = {
        remaining: 5,
        max: 10,
        current: 5,
        unlimited: false,
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

    it('should return unlimited on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await BillingService.getQuota('CLIENT');

      expect(result).toEqual({
        remaining: -1,
        max: -1,
        current: 0,
        unlimited: true,
      });
    });

    it('should support different resource types', async () => {
      const resources = ['CLIENT', 'QUOTE', 'WORK_ORDER', 'PAYMENT', 'NOTIFICATION'];

      for (const resource of resources) {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ remaining: 10, max: 20, current: 10, unlimited: false }),
        });

        await BillingService.getQuota(resource as any);

        expect(global.fetch).toHaveBeenLastCalledWith(
          expect.stringContaining(`resource=${resource}`),
          expect.any(Object)
        );
      }
    });
  });

  describe('getSubscription', () => {
    it('should return subscription info', async () => {
      const mockSubscription = {
        plan: {
          type: 'PRO',
          name: 'Profissional',
          price: 39.9,
          limits: {
            maxClients: -1,
            maxQuotes: -1,
            maxWorkOrders: -1,
            maxInvoices: -1,
          },
        },
        usage: {
          clients: 50,
          quotes: 100,
          workOrders: 200,
          payments: 150,
        },
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSubscription),
      });

      const result = await BillingService.getSubscription();

      expect(result).toEqual(mockSubscription);
    });

    it('should return null when not authenticated', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BillingService.getSubscription();

      expect(result).toBeNull();
    });

    it('should return null on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await BillingService.getSubscription();

      expect(result).toBeNull();
    });
  });

  describe('isFreePlan', () => {
    it('should return true for FREE plan', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { type: 'FREE' },
          }),
      });

      const result = await BillingService.isFreePlan();

      expect(result).toBe(true);
    });

    it('should return false for PRO plan', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            plan: { type: 'PRO' },
          }),
      });

      const result = await BillingService.isFreePlan();

      expect(result).toBe(false);
    });

    it('should return true when no subscription (defaults to FREE)', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await BillingService.isFreePlan();

      expect(result).toBe(true);
    });
  });

  describe('getClientQuota', () => {
    it('should be an alias for getQuota(CLIENT)', async () => {
      const mockQuota = {
        remaining: 3,
        max: 10,
        current: 7,
        unlimited: false,
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

describe('Plan Limits Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('valid-token');
  });

  it('FREE plan: should enforce 10 client limit', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          remaining: 0,
          max: 10,
          current: 10,
          unlimited: false,
        }),
    });

    const quota = await BillingService.getClientQuota();

    expect(quota.remaining).toBe(0);
    expect(quota.unlimited).toBe(false);
    // This indicates user cannot create more clients
  });

  it('PRO plan: should have unlimited clients', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          remaining: -1,
          max: -1,
          current: 100,
          unlimited: true,
        }),
    });

    const quota = await BillingService.getClientQuota();

    expect(quota.unlimited).toBe(true);
    expect(quota.remaining).toBe(-1); // -1 indicates unlimited
  });

  it('FREE plan with partial usage: should show remaining quota', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          remaining: 7,
          max: 10,
          current: 3,
          unlimited: false,
        }),
    });

    const quota = await BillingService.getClientQuota();

    expect(quota.remaining).toBe(7);
    expect(quota.current).toBe(3);
    expect(quota.max).toBe(10);
  });
});
