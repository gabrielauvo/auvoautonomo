import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import { ReferralService } from '../../src/services/ReferralService';
import { AuthService } from '../../src/services/AuthService';

// Mock modules
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Linking: {
    getInitialURL: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '100',
}));

jest.mock('expo-device', () => ({
  modelName: 'iPhone 15',
  osVersion: '17.0',
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      name: 'Auvo Mobile',
    },
  },
}));

jest.mock('../../src/services/AuthService', () => ({
  AuthService: {
    getAccessToken: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('ReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    // Reset the singleton's internal state
    (ReferralService as any).isInitialized = false;
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(ReferralService.initialize()).resolves.not.toThrow();
    });

    it('should handle initial deep link URL', async () => {
      (Linking.getInitialURL as jest.Mock).mockResolvedValue(
        'auvoautonomo://referral?code=JOAO-7K2F&clickId=abc123'
      );

      await ReferralService.initialize();

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingReferralCode',
        'JOAO-7K2F'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingClickId',
        'abc123'
      );
    });

    it('should set up deep link listener', async () => {
      await ReferralService.initialize();

      expect(Linking.addEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    });
  });

  describe('handleDeepLink', () => {
    it('should parse app scheme deep link', async () => {
      await ReferralService.handleDeepLink(
        'auvoautonomo://referral?code=MARIA-9X3Z&clickId=xyz789'
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingReferralCode',
        'MARIA-9X3Z'
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingClickId',
        'xyz789'
      );
    });

    it('should parse web URL referral link', async () => {
      await ReferralService.handleDeepLink('https://auvo.com/r/PEDRO-1A2B');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingReferralCode',
        'PEDRO-1A2B'
      );
    });

    it('should handle malformed URLs gracefully', async () => {
      await expect(
        ReferralService.handleDeepLink('invalid-url')
      ).resolves.not.toThrow();
    });

    it('should not store anything if no code found', async () => {
      await ReferralService.handleDeepLink('https://auvo.com/other-page');

      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('storePendingReferral', () => {
    it('should store referral code', async () => {
      await ReferralService.storePendingReferral('TEST-CODE');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingReferralCode',
        'TEST-CODE'
      );
    });

    it('should store clickId', async () => {
      await ReferralService.storePendingReferral(undefined, 'click-123');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingClickId',
        'click-123'
      );
    });

    it('should store install referrer', async () => {
      await ReferralService.storePendingReferral(
        undefined,
        undefined,
        'ref=CODE&clickId=123'
      );

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:installReferrer',
        'ref=CODE&clickId=123'
      );
    });
  });

  describe('getPendingReferral', () => {
    it('should return pending referral data', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('PENDING-CODE')
        .mockResolvedValueOnce('pending-click')
        .mockResolvedValueOnce(null);

      const result = await ReferralService.getPendingReferral();

      expect(result).toEqual({
        code: 'PENDING-CODE',
        clickId: 'pending-click',
        installReferrer: undefined,
        timestamp: expect.any(Number),
      });
    });

    it('should return null if no pending referral', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await ReferralService.getPendingReferral();

      expect(result).toBeNull();
    });
  });

  describe('clearPendingReferral', () => {
    it('should clear pending referral data', async () => {
      await ReferralService.clearPendingReferral();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        '@auvo:pendingReferralCode',
        '@auvo:pendingClickId',
      ]);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:referralAttributed',
        'true'
      );
    });
  });

  describe('attributeReferral', () => {
    const userId = 'user-123';

    beforeEach(() => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('fake-token');
    });

    it('should attribute referral successfully', async () => {
      // getPendingReferral calls (code, clickId, installReferrer)
      // then again for updatedPending
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('REFER-CODE') // code
        .mockResolvedValueOnce('click-456')  // clickId
        .mockResolvedValueOnce(null)         // installReferrer
        .mockResolvedValueOnce('REFER-CODE') // code (second call)
        .mockResolvedValueOnce('click-456')  // clickId (second call)
        .mockResolvedValueOnce(null);        // installReferrer (second call)

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await ReferralService.attributeReferral(userId);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/referral/attach'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-token',
          }),
        })
      );
    });

    it('should return false if no pending referral', async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce(null) // Already attributed check
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Mock deferred deep link resolution to also return nothing
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const result = await ReferralService.attributeReferral(userId);

      expect(result).toBe(false);
    });

    it('should return false if no auth token', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue(null);
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('CODE')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await ReferralService.attributeReferral(userId);

      expect(result).toBe(false);
    });

    it('should clear pending referral on success', async () => {
      // getPendingReferral calls twice (initial check + updated pending)
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce('CODE')    // code
        .mockResolvedValueOnce(null)      // clickId
        .mockResolvedValueOnce(null)      // installReferrer
        .mockResolvedValueOnce('CODE')    // code (second call)
        .mockResolvedValueOnce(null)      // clickId (second call)
        .mockResolvedValueOnce(null);     // installReferrer (second call)

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await ReferralService.attributeReferral(userId);

      expect(AsyncStorage.multiRemove).toHaveBeenCalled();
    });
  });

  describe('resolveDeferredDeepLink', () => {
    it('should resolve deferred deep link', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); // Not already attributed

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            referralCode: 'DEFERRED-CODE',
            clickId: 'deferred-click',
          }),
      });

      const result = await ReferralService.resolveDeferredDeepLink();

      expect(result.resolved).toBe(true);
      expect(result.referralCode).toBe('DEFERRED-CODE');
      expect(result.clickId).toBe('deferred-click');
    });

    it('should return not resolved if no match', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await ReferralService.resolveDeferredDeepLink();

      expect(result.resolved).toBe(false);
    });

    it('should return not resolved if already attributed', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

      const result = await ReferralService.resolveDeferredDeepLink();

      expect(result.resolved).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('setManualReferralCode', () => {
    it('should store manual code', async () => {
      await ReferralService.setManualReferralCode('MANUAL-CODE');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@auvo:pendingReferralCode',
        'MANUAL-CODE'
      );
    });
  });

  describe('getDashboard', () => {
    it('should fetch dashboard data', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('token');

      const mockDashboard = {
        code: { code: 'MY-CODE', customCode: null },
        stats: { totalClicks: 10, totalDaysEarned: 60 },
        shareUrl: 'https://auvo.com/r/MY-CODE',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDashboard),
      });

      const result = await ReferralService.getDashboard();

      expect(result).toEqual(mockDashboard);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/referral/dashboard'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        })
      );
    });

    it('should return null if no token', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue(null);

      const result = await ReferralService.getDashboard();

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (AuthService.getAccessToken as jest.Mock).mockResolvedValue('token');
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const result = await ReferralService.getDashboard();

      expect(result).toBeNull();
    });
  });

  describe('getShareMessage', () => {
    it('should return formatted share message', () => {
      const shareUrl = 'https://auvo.com/r/TEST-CODE';
      const message = ReferralService.getShareMessage(shareUrl);

      expect(message).toContain('Auvo Autônomo');
      expect(message).toContain(shareUrl);
    });
  });

  describe('getWhatsAppShareUrl', () => {
    it('should return WhatsApp URL with encoded message', () => {
      const shareUrl = 'https://auvo.com/r/TEST-CODE';
      const whatsappUrl = ReferralService.getWhatsAppShareUrl(shareUrl);

      expect(whatsappUrl.startsWith('whatsapp://send?text=')).toBe(true);
      expect(whatsappUrl).toContain(encodeURIComponent(shareUrl));
    });
  });
});

describe('ReferralService Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const result = await ReferralService.getPendingReferral();

    expect(result).toBeNull();
  });

  it('should handle network errors in attribution', async () => {
    (AuthService.getAccessToken as jest.Mock).mockResolvedValue('token');
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce('CODE')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await ReferralService.attributeReferral('user-123');

    expect(result).toBe(false);
  });

  it('should handle API errors in dashboard fetch', async () => {
    (AuthService.getAccessToken as jest.Mock).mockResolvedValue('token');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await ReferralService.getDashboard();

    expect(result).toBeNull();
  });
});
