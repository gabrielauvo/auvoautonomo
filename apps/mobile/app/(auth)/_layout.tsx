/**
 * Auth Layout
 *
 * Layout para telas de autenticação (login, registro, etc.)
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
