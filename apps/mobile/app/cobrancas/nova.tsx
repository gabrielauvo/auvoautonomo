/**
 * Cobranças - Nova Cobrança
 *
 * Tela para criar uma nova cobrança.
 * Suporta pré-preenchimento a partir de orçamento ou ordem de serviço.
 */

import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChargeFormScreen } from '../../src/modules/charges';
import { useColors } from '../../src/design-system/ThemeProvider';
import type { Charge } from '../../src/modules/charges';

export default function NovaCobrancaScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{
    clientId?: string;
    clientName?: string;
    quoteId?: string;
    workOrderId?: string;
    value?: string;
    description?: string;
  }>();

  // Handler para sucesso na criação
  const handleSuccess = (charge: Charge) => {
    // Volta para a lista e depois navega para os detalhes da nova cobrança
    router.replace(`/cobrancas/${charge.id}`);
  };

  // Handler para cancelar
  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ChargeFormScreen
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        preSelectedClientId={params.clientId}
        preSelectedClientName={params.clientName ? decodeURIComponent(params.clientName) : undefined}
        preSelectedQuoteId={params.quoteId}
        preSelectedWorkOrderId={params.workOrderId}
        preSelectedValue={params.value ? parseFloat(params.value) : undefined}
        preSelectedDescription={params.description ? decodeURIComponent(params.description) : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
