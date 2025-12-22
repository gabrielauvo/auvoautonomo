/**
 * Cobranças - Detalhes da Cobrança
 *
 * Tela de visualização dos detalhes de uma cobrança específica.
 */

import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChargeDetailScreen } from '../../src/modules/charges';
import { useColors } from '../../src/design-system/ThemeProvider';
import type { Charge } from '../../src/modules/charges';

export default function CobrancaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();

  // Handler para voltar
  const handleBack = () => {
    router.back();
  };

  // Handler para quando a cobrança for atualizada
  const handleChargeUpdated = (charge: Charge) => {
    console.log('[CobrancaDetail] Charge updated:', charge.id, charge.status);
  };

  if (!id) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ChargeDetailScreen
        chargeId={id}
        onBack={handleBack}
        onChargeUpdated={handleChargeUpdated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
