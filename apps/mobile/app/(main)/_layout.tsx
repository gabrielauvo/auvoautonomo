/**
 * Main Layout
 *
 * Layout principal com drawer navigation.
 * Todas as telas principais do app ficam aqui.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { DrawerMenu, useDrawer } from '../../src/components';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function MainLayout() {
  const colors = useColors();
  const { isOpen, closeDrawer } = useDrawer();

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background.secondary },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="agenda" />
        <Stack.Screen name="os" />
        <Stack.Screen name="clientes" />
      </Stack>
      <DrawerMenu isOpen={isOpen} onClose={closeDrawer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
