/**
 * Smoke Tests
 *
 * Quick sanity checks to ensure core components render without crashing.
 * These tests are designed to run fast in CI and catch major regressions.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock AsyncStorage (must be before other imports)
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Test Device',
  osName: 'iOS',
  osVersion: '17.0',
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      env: 'test',
      apiUrl: 'http://localhost:3001',
    },
  },
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

// =============================================================================
// SMOKE TESTS
// =============================================================================

describe('Smoke Tests', () => {
  describe('App Entry', () => {
    it('should render a basic component', () => {
      const TestComponent = () => (
        <View testID="test-view">
          <Text>Auvo Field</Text>
        </View>
      );

      const { getByTestId, getByText } = render(<TestComponent />);

      expect(getByTestId('test-view')).toBeTruthy();
      expect(getByText('Auvo Field')).toBeTruthy();
    });
  });

  describe('Design System Components', () => {
    it('should import design tokens without error', () => {
      // This test verifies the design system module loads correctly
      expect(() => {
        // Import will throw if there are syntax/module errors
        require('../../src/design-system/tokens');
      }).not.toThrow();
    });

    it('should import Button component without error', () => {
      expect(() => {
        require('../../src/design-system/components/Button');
      }).not.toThrow();
    });

    it('should import Card component without error', () => {
      expect(() => {
        require('../../src/design-system/components/Card');
      }).not.toThrow();
    });
  });

  describe('Core Modules', () => {
    it('should import database module without error', () => {
      expect(() => {
        require('../../src/db');
      }).not.toThrow();
    });

    it('should import sync module without error', () => {
      expect(() => {
        require('../../src/sync/SyncEngine');
      }).not.toThrow();
    });

    it('should import notification types without error', () => {
      expect(() => {
        require('../../src/services/notifications/types');
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should have valid i18n configuration', () => {
      const i18n = require('../../src/i18n');
      expect(i18n).toBeDefined();
    });

    it('should have observability module', () => {
      expect(() => {
        require('../../src/observability');
      }).not.toThrow();
    });
  });

  describe('Build Configuration', () => {
    it('should have valid eas.json structure', () => {
      const easConfig = require('../../eas.json');

      expect(easConfig.build).toBeDefined();
      expect(easConfig.build.development).toBeDefined();
      expect(easConfig.build.preview).toBeDefined();
      expect(easConfig.build.production).toBeDefined();
    });

    it('should have correct build profiles', () => {
      const easConfig = require('../../eas.json');

      // Development profile
      expect(easConfig.build.development.developmentClient).toBe(true);
      expect(easConfig.build.development.distribution).toBe('internal');

      // Preview profile
      expect(easConfig.build.preview.distribution).toBe('internal');
      expect(easConfig.build.preview.channel).toBe('preview');

      // Production profile
      expect(easConfig.build.production.distribution).toBe('store');
      expect(easConfig.build.production.channel).toBe('production');
    });

    it('should have submit configuration', () => {
      const easConfig = require('../../eas.json');

      expect(easConfig.submit).toBeDefined();
      expect(easConfig.submit.production).toBeDefined();
    });
  });

  describe('Environment Variables', () => {
    it('should define required env vars in eas.json', () => {
      const easConfig = require('../../eas.json');

      // Check development env vars
      expect(easConfig.build.development.env.EXPO_PUBLIC_ENV).toBe('development');

      // Check preview env vars
      expect(easConfig.build.preview.env.EXPO_PUBLIC_ENV).toBe('preview');

      // Check production env vars
      expect(easConfig.build.production.env.EXPO_PUBLIC_ENV).toBe('production');
    });
  });
});

describe('Module Integration', () => {
  it('should have consistent exports between modules', () => {
    // Database exports
    const db = require('../../src/db');
    expect(db.getDatabase).toBeDefined();
    expect(db.initDatabase).toBeDefined();

    // Observability exports
    const obs = require('../../src/observability');
    expect(obs.perf).toBeDefined();
    expect(obs.logger).toBeDefined();
  });

  it('should have notification service structure', () => {
    const notifications = require('../../src/services/notifications');

    expect(notifications.NotificationService).toBeDefined();
    expect(notifications.SyncTriggers).toBeDefined();
    expect(notifications.DeepLinkHandler).toBeDefined();
  });
});
