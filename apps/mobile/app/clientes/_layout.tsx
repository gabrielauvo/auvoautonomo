// @ts-nocheck
/**
 * Clients Stack Layout
 *
 * Layout para as telas de clientes.
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function ClientesLayout() {
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
        name="novo"
        options={{
          title: 'Novo Cliente',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Detalhes do Cliente',
        }}
      />
    </Stack>
  );
}
