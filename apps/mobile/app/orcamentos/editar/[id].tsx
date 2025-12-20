// @ts-nocheck
/**
 * Orçamentos - Editar Orçamento
 *
 * Tela para editar um orçamento existente.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { SafeAreaView, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { QuoteFormScreen, QuoteWithItems, QuoteService } from '../../../src/modules/quotes';
import { ClientService } from '../../../src/modules/clients/ClientService';
import { CatalogService } from '../../../src/modules/catalog/CatalogService';
import { useAuth } from '../../../src/services';
import { useColors } from '../../../src/design-system/ThemeProvider';

export default function EditarOrcamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  // Configurar serviços quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        QuoteService.configure(user.id);
        ClientService.configure(user.id);
        CatalogService.configure(user.id);
      }
    }, [user?.id])
  );

  // Carregar orçamento
  useEffect(() => {
    const loadQuote = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await QuoteService.getQuoteWithItems(id);
        setQuote(data);
      } catch (error) {
        console.error('[EditarOrcamento] Error loading quote:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [id]);

  // Handler para salvar orçamento
  const handleSave = (updatedQuote: QuoteWithItems) => {
    console.log('[EditarOrcamento] Quote updated:', updatedQuote.id);
    router.replace(`/orcamentos/${updatedQuote.id}`);
  };

  // Handler para cancelar
  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.secondary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <QuoteFormScreen
        quote={quote}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
