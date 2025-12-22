/**
 * Despesas Layout
 *
 * Layout para as rotas de despesas.
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function DespesasLayout() {
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
          title: 'Despesas',
        }}
      />
      <Stack.Screen
        name="nova"
        options={{
          title: 'Nova Despesa',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes da Despesa',
        }}
      />
      <Stack.Screen
        name="editar/[id]"
        options={{
          title: 'Editar Despesa',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
