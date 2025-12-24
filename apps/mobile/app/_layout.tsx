/**
 * Root Layout
 *
 * Layout principal com AuthProvider, PowerSyncProvider, DrawerProvider e navegação
 */

// MUST be first import - polyfill for crypto.getRandomValues (required by uuid)
import 'react-native-get-random-values';

// Required for PowerSync async iterator support
import '@azure/core-asynciterator-polyfill';

// Initialize Sentry for error monitoring
import { initSentry } from '../src/config/sentry';
initSentry();

import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/services/AuthProvider';
import { ThemeProvider } from '../src/design-system/ThemeProvider';
import { I18nProvider } from '../src/i18n';
import { DrawerProvider, TrialBanner } from '../src/components';
import { PowerSyncProvider } from '../src/powersync';
import { BillingService, BillingStatus } from '../src/services/BillingService';
import { ReferralService } from '../src/services/ReferralService';

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);

  // Initialize referral service on mount
  useEffect(() => {
    ReferralService.initialize();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Não autenticado, redirecionar para login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Autenticado mas em tela de auth, redirecionar para home
      router.replace('/(main)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Fetch billing status when authenticated
  useEffect(() => {
    if (!isAuthenticated || isLoading) {
      setBilling(null);
      setBillingLoaded(false);
      return;
    }

    let mounted = true;

    const fetchBilling = async () => {
      try {
        const status = await BillingService.getBillingStatus();
        if (mounted) {
          setBilling(status);
          setBillingLoaded(true);
        }
      } catch (error) {
        console.warn('[RootLayout] Error fetching billing:', error);
        if (mounted) {
          setBillingLoaded(true);
        }
      }
    };

    fetchBilling();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // Check if we're in auth screens (don't show trial banner on login/register)
  const inAuthGroup = segments[0] === '(auth)';
  const showTrialBanner = isAuthenticated && !inAuthGroup && billingLoaded;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {showTrialBanner && <TrialBanner billing={billing} />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="clientes" />
        <Stack.Screen name="os" />
        <Stack.Screen name="orcamentos" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider forcedColorScheme="light">
      <I18nProvider>
        <AuthProvider>
          <PowerSyncProvider>
            <DrawerProvider>
              <RootLayoutNav />
            </DrawerProvider>
          </PowerSyncProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
