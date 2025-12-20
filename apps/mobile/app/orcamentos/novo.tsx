// @ts-nocheck
/**
 * Orçamentos - Novo Orçamento
 *
 * Tela para criar um novo orçamento.
 */

import React, { useCallback } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { QuoteFormScreen, QuoteWithItems } from '../../src/modules/quotes';
import { QuoteService } from '../../src/modules/quotes/QuoteService';
import { ClientService } from '../../src/modules/clients/ClientService';
import { CatalogService } from '../../src/modules/catalog/CatalogService';
import { useAuth } from '../../src/services';
import { useColors } from '../../src/design-system/ThemeProvider';

export default function NovoOrcamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string }>();
  const { user } = useAuth();
  const colors = useColors();

  // Configurar serviços quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      if (user?.technicianId) {
        QuoteService.configure(user.technicianId);
        ClientService.configure(user.technicianId);
        CatalogService.configure(user.technicianId);
      }
    }, [user?.technicianId])
  );

  // Handler para salvar orçamento
  const handleSave = (quote: QuoteWithItems) => {
    console.log('[NovoOrcamento] Quote saved:', quote.id);
    router.replace(`/orcamentos/${quote.id}`);
  };

  // Handler para cancelar
  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <QuoteFormScreen
        clientId={params.clientId}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
