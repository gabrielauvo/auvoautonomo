// @ts-nocheck
/**
 * Orçamentos - Lista de Orçamentos
 *
 * Tela principal do módulo de orçamentos.
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QuotesListScreen } from '../../src/modules/quotes';
import { Quote } from '../../src/db/schema';
import { syncEngine } from '../../src/sync';
import { useAuth } from '../../src/services';
import { useColors } from '../../src/design-system/ThemeProvider';
import { Text } from '../../src/design-system/components/Text';
import { spacing } from '../../src/design-system/tokens';

export default function OrcamentosIndexScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Navegar para detalhes do orçamento
  const handleQuotePress = (quote: Quote) => {
    router.push(`/orcamentos/${quote.id}`);
  };

  // Navegar para criar novo orçamento
  const handleNewQuote = () => {
    router.push('/orcamentos/novo');
  };

  // Sincronizar dados
  const handleSync = async () => {
    await syncEngine.syncAll();
  };

  // Voltar para tela anterior
  const handleBack = () => {
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header com botão voltar */}
      <View style={[
        styles.header,
        {
          backgroundColor: colors.background.primary,
          borderBottomColor: colors.border.light,
          paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + spacing[2],
        }
      ]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">Orçamentos</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Lista de Orçamentos */}
      <QuotesListScreen
        onQuotePress={handleQuotePress}
        onNewQuote={handleNewQuote}
        onSync={handleSync}
        userId={user?.technicianId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },
  headerRight: {
    width: 40,
  },
});
