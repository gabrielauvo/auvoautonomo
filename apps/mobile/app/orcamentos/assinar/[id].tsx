// @ts-nocheck
/**
 * Orçamentos - Coletar Assinatura
 *
 * Tela para coletar assinatura do cliente em um orçamento.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { QuoteSignatureScreen, QuoteWithItems, QuoteService, QuoteSignatureService } from '../../../src/modules/quotes';
import { useAuth } from '../../../src/services';
import { useColors } from '../../../src/design-system/ThemeProvider';

export default function AssinarOrcamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  // Configurar serviços quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      if (user?.technicianId) {
        QuoteService.configure(user.technicianId);
        QuoteSignatureService.configure(user.technicianId);
      }
    }, [user?.technicianId])
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
        console.error('[AssinarOrcamento] Error loading quote:', error);
      } finally {
        setLoading(false);
      }
    };

    loadQuote();
  }, [id]);

  // Handler para assinatura completa
  const handleSignatureComplete = (quoteId: string) => {
    console.log('[AssinarOrcamento] Signature complete for:', quoteId);
    // Voltar para detalhes do orçamento
    router.replace(`/orcamentos/${quoteId}`);
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
    <QuoteSignatureScreen
      quote={quote}
      onSignatureComplete={handleSignatureComplete}
      onCancel={handleCancel}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
