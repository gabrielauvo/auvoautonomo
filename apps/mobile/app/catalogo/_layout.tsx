// @ts-nocheck
/**
 * Catalog Layout
 *
 * Layout para as telas de catálogo (produtos, serviços, kits).
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function CatalogoLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.primary,
        },
        headerTintColor: colors.text.primary,
        headerShadowVisible: false,
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="novo"
        options={{
          title: 'Novo Item',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes',
        }}
      />
      <Stack.Screen
        name="editar/[id]"
        options={{
          title: 'Editar Item',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
