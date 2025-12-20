// @ts-nocheck
/**
 * Orçamentos Layout
 *
 * Stack navigator para as telas de orçamentos.
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function OrcamentosLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.primary,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Orçamentos',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes do Orçamento',
        }}
      />
      <Stack.Screen
        name="novo"
        options={{
          title: 'Novo Orçamento',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="editar/[id]"
        options={{
          title: 'Editar Orçamento',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="assinar/[id]"
        options={{
          title: 'Coletar Assinatura',
          presentation: 'fullScreenModal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
