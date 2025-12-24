import {
  getReferralDashboard,
  getMyReferralCode,
  setCustomCode,
  getMyReferrals,
  getMyRewards,
  getStatusLabel,
  getStatusColor,
  getRewardReasonLabel,
  getPlatformLabel,
} from '../referral.service';
import { api } from '../api';

// Mock the api module
jest.mock('../api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('ReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReferralDashboard', () => {
    it('should fetch dashboard data', async () => {
      const mockDashboard = {
        code: {
          id: 'code-123',
          code: 'JOAO-7K2F',
          customCode: null,
          status: 'ACTIVE',
          totalClicks: 50,
          totalSignups: 15,
          totalPaidConversions: 8,
        },
        stats: {
          totalClicks: 50,
          totalSignups: 15,
          totalPaidConversions: 8,
          totalDaysEarned: 270,
          pendingRewards: 2,
        },
        referrals: [],
        rewards: [],
        shareUrl: 'https://auvo.com/r/JOAO-7K2F',
      };

      mockedApi.get.mockResolvedValue({ data: mockDashboard });

      const result = await getReferralDashboard();

      expect(api.get).toHaveBeenCalledWith('/api/referral/dashboard');
      expect(result).toEqual(mockDashboard);
    });

    it('should propagate errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'));

      await expect(getReferralDashboard()).rejects.toThrow('Network error');
    });
  });

  describe('getMyReferralCode', () => {
    it('should fetch user referral code', async () => {
      const mockCode = {
        id: 'code-123',
        code: 'MARIA-9X3Z',
        customCode: 'MARIATECH',
        status: 'ACTIVE',
        totalClicks: 100,
        totalSignups: 30,
        totalPaidConversions: 15,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockedApi.get.mockResolvedValue({ data: mockCode });

      const result = await getMyReferralCode();

      expect(api.get).toHaveBeenCalledWith('/api/referral/my-code');
      expect(result).toEqual(mockCode);
    });
  });

  describe('setCustomCode', () => {
    it('should set custom code successfully', async () => {
      const updatedCode = {
        id: 'code-123',
        code: 'JOAO-7K2F',
        customCode: 'MEUNEGOCIO',
        status: 'ACTIVE',
      };

      mockedApi.post.mockResolvedValue({ data: updatedCode });

      const result = await setCustomCode({ customCode: 'MEUNEGOCIO' });

      expect(api.post).toHaveBeenCalledWith('/api/referral/custom-code', {
        customCode: 'MEUNEGOCIO',
      });
      expect(result).toEqual(updatedCode);
    });

    it('should handle already taken code error', async () => {
      mockedApi.post.mockRejectedValue({
        response: {
          data: { message: 'Este código personalizado já está em uso' },
        },
      });

      await expect(setCustomCode({ customCode: 'TAKEN' })).rejects.toMatchObject({
        response: {
          data: { message: 'Este código personalizado já está em uso' },
        },
      });
    });
  });

  describe('getMyReferrals', () => {
    it('should fetch user referrals', async () => {
      const mockReferrals = [
        {
          id: 'ref-1',
          status: 'SUBSCRIPTION_PAID',
          attributionMethod: 'LINK_DIRECT',
          platform: 'ANDROID',
          referee: {
            id: 'user-1',
            name: 'Pedro Silva',
            email: 'pedro@test.com',
          },
          createdAt: '2024-01-15T10:00:00Z',
          convertedAt: '2024-01-20T14:30:00Z',
        },
        {
          id: 'ref-2',
          status: 'SIGNUP_COMPLETE',
          attributionMethod: 'FINGERPRINT',
          platform: 'IOS',
          referee: {
            id: 'user-2',
            name: 'Ana Costa',
            email: 'ana@test.com',
          },
          createdAt: '2024-01-18T08:00:00Z',
          convertedAt: null,
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockReferrals });

      const result = await getMyReferrals();

      expect(api.get).toHaveBeenCalledWith('/api/referral/my-referrals');
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('SUBSCRIPTION_PAID');
    });
  });

  describe('getMyRewards', () => {
    it('should fetch user rewards', async () => {
      const mockRewards = [
        {
          id: 'reward-1',
          daysAwarded: 30,
          reason: 'SINGLE_REFERRAL',
          status: 'APPLIED',
          referral: { referee: { name: 'Pedro' } },
          createdAt: '2024-01-20T14:30:00Z',
          appliedAt: '2024-01-20T14:30:00Z',
        },
        {
          id: 'reward-2',
          daysAwarded: 365,
          reason: 'MILESTONE_10',
          status: 'APPLIED',
          referral: null,
          createdAt: '2024-02-15T10:00:00Z',
          appliedAt: '2024-02-15T10:00:00Z',
        },
      ];

      mockedApi.get.mockResolvedValue({ data: mockRewards });

      const result = await getMyRewards();

      expect(api.get).toHaveBeenCalledWith('/api/referral/my-rewards');
      expect(result).toHaveLength(2);
      expect(result[0].daysAwarded).toBe(30);
      expect(result[1].daysAwarded).toBe(365);
    });
  });

  describe('Utility functions', () => {
    describe('getStatusLabel', () => {
      it('should return correct labels for all statuses', () => {
        expect(getStatusLabel('PENDING')).toBe('Aguardando');
        expect(getStatusLabel('SIGNUP_COMPLETE')).toBe('Cadastrado');
        expect(getStatusLabel('SUBSCRIPTION_PAID')).toBe('Pago');
        expect(getStatusLabel('CHURNED')).toBe('Cancelado');
        expect(getStatusLabel('FRAUDULENT')).toBe('Fraude');
      });
    });

    describe('getStatusColor', () => {
      it('should return correct colors for all statuses', () => {
        expect(getStatusColor('PENDING')).toContain('yellow');
        expect(getStatusColor('SIGNUP_COMPLETE')).toContain('blue');
        expect(getStatusColor('SUBSCRIPTION_PAID')).toContain('green');
        expect(getStatusColor('CHURNED')).toContain('gray');
        expect(getStatusColor('FRAUDULENT')).toContain('red');
      });
    });

    describe('getRewardReasonLabel', () => {
      it('should return correct labels for all reasons', () => {
        expect(getRewardReasonLabel('SINGLE_REFERRAL')).toBe('Indicação');
        expect(getRewardReasonLabel('MILESTONE_10')).toBe('Bônus 10 indicações');
        expect(getRewardReasonLabel('BONUS')).toBe('Bônus especial');
        expect(getRewardReasonLabel('REVERSAL')).toBe('Estorno');
      });
    });

    describe('getPlatformLabel', () => {
      it('should return correct labels for all platforms', () => {
        expect(getPlatformLabel('IOS')).toBe('iOS');
        expect(getPlatformLabel('ANDROID')).toBe('Android');
        expect(getPlatformLabel('WEB')).toBe('Web');
        expect(getPlatformLabel('UNKNOWN')).toBe('Desconhecido');
      });
    });
  });
});

describe('ReferralService Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard with empty data', () => {
    it('should handle empty referrals and rewards', async () => {
      const mockDashboard = {
        code: {
          id: 'code-123',
          code: 'NEW-USER',
          customCode: null,
          status: 'ACTIVE',
          totalClicks: 0,
          totalSignups: 0,
          totalPaidConversions: 0,
        },
        stats: {
          totalClicks: 0,
          totalSignups: 0,
          totalPaidConversions: 0,
          totalDaysEarned: 0,
          pendingRewards: 0,
        },
        referrals: [],
        rewards: [],
        shareUrl: 'https://auvo.com/r/NEW-USER',
      };

      mockedApi.get.mockResolvedValue({ data: mockDashboard });

      const result = await getReferralDashboard();

      expect(result.stats.totalDaysEarned).toBe(0);
      expect(result.referrals).toEqual([]);
      expect(result.rewards).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle 401 unauthorized', async () => {
      mockedApi.get.mockRejectedValue({
        response: { status: 401, data: { message: 'Unauthorized' } },
      });

      await expect(getReferralDashboard()).rejects.toMatchObject({
        response: { status: 401 },
      });
    });

    it('should handle 500 server error', async () => {
      mockedApi.get.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal Server Error' } },
      });

      await expect(getMyReferralCode()).rejects.toMatchObject({
        response: { status: 500 },
      });
    });

    it('should handle network timeout', async () => {
      mockedApi.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      await expect(setCustomCode({ customCode: 'TEST' })).rejects.toMatchObject({
        code: 'ECONNABORTED',
      });
    });
  });
});
