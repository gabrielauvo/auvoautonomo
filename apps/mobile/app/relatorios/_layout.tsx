/**
 * Relatorios Layout
 *
 * Layout para as rotas de relatorios.
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';
import { useTranslation } from '../../src/i18n';

export default function RelatoriosLayout() {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.primary,
        },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="finance"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sales"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="operations"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="clients"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
