/**
 * Profile Layout
 *
 * Layout para telas de perfil e configurações
 */

import { Stack } from 'expo-router';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function ProfileLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="dados-pessoais" />
      <Stack.Screen name="alterar-senha" />
      <Stack.Screen name="empresa" />
      <Stack.Screen name="plano" />
      <Stack.Screen name="idioma" />
      <Stack.Screen name="indicacoes" />
      <Stack.Screen name="crescimento" />
    </Stack>
  );
}
