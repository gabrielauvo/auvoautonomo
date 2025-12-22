/**
 * Cobranças Layout
 *
 * Layout para as rotas de cobranças.
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function CobrancasLayout() {
  const colors = useColors();

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
          title: 'Cobranças',
        }}
      />
      <Stack.Screen
        name="nova"
        options={{
          title: 'Nova Cobrança',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes da Cobrança',
        }}
      />
    </Stack>
  );
}
