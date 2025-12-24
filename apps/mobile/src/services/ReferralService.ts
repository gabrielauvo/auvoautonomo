/**
 * ReferralService
 *
 * Handles referral attribution for the mobile app.
 * Supports:
 * - Play Install Referrer API (Android)
 * - Deferred deep linking (iOS fingerprint matching)
 * - Manual code entry
 * - Storing pending referral for post-signup attribution
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Linking } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { AuthService } from './AuthService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Storage keys
const STORAGE_KEYS = {
  PENDING_REFERRAL_CODE: '@auvo:pendingReferralCode',
  PENDING_CLICK_ID: '@auvo:pendingClickId',
  REFERRAL_ATTRIBUTED: '@auvo:referralAttributed',
  INSTALL_REFERRER: '@auvo:installReferrer',
};

// Types
interface PendingReferral {
  code?: string;
  clickId?: string;
  installReferrer?: string;
  timestamp: number;
}

interface DeferredDeepLinkResult {
  resolved: boolean;
  referralCode?: string;
  clickId?: string;
  method?: string;
}

interface ReferralDashboard {
  code: {
    code: string;
    customCode: string | null;
  };
  stats: {
    totalClicks: number;
    totalSignups: number;
    totalPaidConversions: number;
    totalDaysEarned: number;
  };
  shareUrl: string;
}

class ReferralServiceClass {
  private isInitialized = false;

  /**
   * Initialize the referral service
   * Should be called at app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check for install referrer (Android)
      if (Platform.OS === 'android') {
        await this.checkInstallReferrer();
      }

      // Handle initial deep link URL
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await this.handleDeepLink(initialUrl);
      }

      // Listen for deep links
      Linking.addEventListener('url', ({ url }) => {
        this.handleDeepLink(url);
      });

      this.isInitialized = true;
      console.log('[ReferralService] Initialized');
    } catch (error) {
      console.error('[ReferralService] Initialization error:', error);
    }
  }

  /**
   * Check Android Install Referrer
   * The referrer data is passed from Play Store during install
   */
  private async checkInstallReferrer(): Promise<void> {
    try {
      // Check if we already processed install referrer
      const processed = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_REFERRER);
      if (processed) return;

      // Note: In production, you'd use react-native-install-referrer
      // or a native module to get the actual install referrer.
      // For Expo, this requires a custom dev client.

      // Placeholder for install referrer check
      // The referrer string format is: ref=CODE&clickId=UUID

      // Mark as processed
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_REFERRER, 'processed');
    } catch (error) {
      console.error('[ReferralService] Install referrer error:', error);
    }
  }

  /**
   * Handle incoming deep link
   * URL formats:
   * - auvoautonomo://referral?code=CODE&clickId=UUID
   * - https://auvo.com/r/CODE
   */
  async handleDeepLink(url: string): Promise<void> {
    try {
      console.log('[ReferralService] Handling deep link:', url);

      let code: string | null = null;
      let clickId: string | null = null;

      // Parse URL
      if (url.includes('referral')) {
        // App scheme: auvoautonomo://referral?code=...
        const params = new URLSearchParams(url.split('?')[1] || '');
        code = params.get('code');
        clickId = params.get('clickId');
      } else if (url.includes('/r/')) {
        // Web URL: https://auvo.com/r/CODE
        const match = url.match(/\/r\/([A-Z0-9-]+)/i);
        if (match) {
          code = match[1];
        }
      }

      if (code || clickId) {
        await this.storePendingReferral(code || undefined, clickId || undefined);
      }
    } catch (error) {
      console.error('[ReferralService] Deep link error:', error);
    }
  }

  /**
   * Store pending referral for attribution after signup
   */
  async storePendingReferral(code?: string, clickId?: string, installReferrer?: string): Promise<void> {
    try {
      const pending: PendingReferral = {
        code,
        clickId,
        installReferrer,
        timestamp: Date.now(),
      };

      if (code) {
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_REFERRAL_CODE, code);
      }
      if (clickId) {
        await AsyncStorage.setItem(STORAGE_KEYS.PENDING_CLICK_ID, clickId);
      }
      if (installReferrer) {
        await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_REFERRER, installReferrer);
      }

      console.log('[ReferralService] Stored pending referral:', pending);
    } catch (error) {
      console.error('[ReferralService] Error storing pending referral:', error);
    }
  }

  /**
   * Get pending referral data
   */
  async getPendingReferral(): Promise<PendingReferral | null> {
    try {
      const code = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_REFERRAL_CODE);
      const clickId = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_CLICK_ID);
      const installReferrer = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_REFERRER);

      if (!code && !clickId && !installReferrer) {
        return null;
      }

      return {
        code: code || undefined,
        clickId: clickId || undefined,
        installReferrer: installReferrer || undefined,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[ReferralService] Error getting pending referral:', error);
      return null;
    }
  }

  /**
   * Clear pending referral after successful attribution
   */
  async clearPendingReferral(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.PENDING_REFERRAL_CODE,
        STORAGE_KEYS.PENDING_CLICK_ID,
      ]);
      await AsyncStorage.setItem(STORAGE_KEYS.REFERRAL_ATTRIBUTED, 'true');
    } catch (error) {
      console.error('[ReferralService] Error clearing pending referral:', error);
    }
  }

  /**
   * Resolve deferred deep link (iOS)
   * Uses fingerprint matching when app is installed after clicking referral link
   */
  async resolveDeferredDeepLink(): Promise<DeferredDeepLinkResult> {
    try {
      // Check if already attributed
      const attributed = await AsyncStorage.getItem(STORAGE_KEYS.REFERRAL_ATTRIBUTED);
      if (attributed === 'true') {
        return { resolved: false };
      }

      // Collect device fingerprint data
      const fingerprint = await this.collectFingerprint();

      // Call backend to resolve
      const response = await fetch(`${API_URL}/api/referral/resolve-deferred`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fingerprint),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.referralCode) {
          await this.storePendingReferral(data.referralCode, data.clickId);
          return {
            resolved: true,
            referralCode: data.referralCode,
            clickId: data.clickId,
            method: 'fingerprint',
          };
        }
      }

      return { resolved: false };
    } catch (error) {
      console.error('[ReferralService] Deferred deep link error:', error);
      return { resolved: false };
    }
  }

  /**
   * Collect device fingerprint for deferred deep linking
   */
  private async collectFingerprint(): Promise<Record<string, string | undefined>> {
    return {
      platform: Platform.OS,
      deviceModel: Device.modelName || undefined,
      osVersion: Device.osVersion || undefined,
      appVersion: Application.nativeApplicationVersion || undefined,
      buildNumber: Application.nativeBuildVersion || undefined,
      // Note: IP address is collected server-side from request
    };
  }

  /**
   * Attribute referral to a user after signup
   */
  async attributeReferral(userId: string): Promise<boolean> {
    try {
      const pending = await this.getPendingReferral();
      if (!pending) {
        // Try deferred deep link resolution for iOS
        if (Platform.OS === 'ios') {
          const deferred = await this.resolveDeferredDeepLink();
          if (!deferred.resolved) {
            return false;
          }
        } else {
          return false;
        }
      }

      const token = await AuthService.getAccessToken();
      if (!token) return false;

      const updatedPending = await this.getPendingReferral();
      if (!updatedPending) return false;

      const response = await fetch(`${API_URL}/api/referral/attach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referralCode: updatedPending.code,
          clickId: updatedPending.clickId,
          installReferrer: updatedPending.installReferrer,
          platform: Platform.OS.toUpperCase(),
        }),
      });

      if (response.ok) {
        await this.clearPendingReferral();
        console.log('[ReferralService] Referral attributed successfully');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ReferralService] Attribution error:', error);
      return false;
    }
  }

  /**
   * Manually enter referral code
   */
  async setManualReferralCode(code: string): Promise<void> {
    await this.storePendingReferral(code);
  }

  /**
   * Get the user's referral dashboard data
   */
  async getDashboard(): Promise<ReferralDashboard | null> {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return null;

      const response = await fetch(`${API_URL}/api/referral/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }

      return null;
    } catch (error) {
      console.error('[ReferralService] Dashboard error:', error);
      return null;
    }
  }

  /**
   * Generate share message with referral link
   */
  getShareMessage(shareUrl: string): string {
    return `Olá! 👋\n\nEstou usando o Auvo Autônomo para gerenciar meu negócio e recomendo muito!\n\nExperimente gratuitamente: ${shareUrl}`;
  }

  /**
   * Get WhatsApp share URL
   */
  getWhatsAppShareUrl(shareUrl: string): string {
    const message = encodeURIComponent(this.getShareMessage(shareUrl));
    return `whatsapp://send?text=${message}`;
  }
}

// Singleton instance
export const ReferralService = new ReferralServiceClass();
export default ReferralService;
