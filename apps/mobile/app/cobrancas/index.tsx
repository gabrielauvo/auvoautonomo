/**
 * Cobranças - Lista de Cobranças
 *
 * Tela principal com listagem de todas as cobranças.
 */

import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ChargesListScreen } from '../../src/modules/charges';
import { useColors } from '../../src/design-system/ThemeProvider';
import type { Charge } from '../../src/modules/charges';

export default function CobrancasListScreen() {
  const router = useRouter();
  const colors = useColors();

  // Handler para ver detalhes da cobrança
  const handleChargePress = (charge: Charge) => {
    router.push(`/cobrancas/${charge.id}`);
  };

  // Handler para criar nova cobrança
  const handleNewCharge = () => {
    router.push('/cobrancas/nova');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ChargesListScreen
        onChargePress={handleChargePress}
        onNewCharge={handleNewCharge}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
