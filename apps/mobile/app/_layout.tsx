/**
 * Root Layout
 *
 * Layout principal com AuthProvider, DrawerProvider e navegação
 */

// MUST be first import - polyfill for crypto.getRandomValues (required by uuid)
import 'react-native-get-random-values';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/services/AuthProvider';
import { ThemeProvider } from '../src/design-system/ThemeProvider';
import { I18nProvider } from '../src/i18n';
import { DrawerProvider } from '../src/components';

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="clientes" />
        <Stack.Screen name="os" />
        <Stack.Screen name="orcamentos" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider forcedColorScheme="light">
      <I18nProvider>
        <AuthProvider>
          <DrawerProvider>
            <RootLayoutNav />
          </DrawerProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
