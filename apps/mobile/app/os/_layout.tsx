/**
 * OS (Work Order) Routes Layout
 */

import { Stack } from 'expo-router';

export default function OSLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="checklist" />
    </Stack>
  );
}
