/**
 * Checklist Routes Layout
 */

import { Stack } from 'expo-router';

export default function ChecklistLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[instanceId]" />
    </Stack>
  );
}
