// @ts-nocheck
/**
 * Catálogo - Lista de Itens do Catálogo
 *
 * Tela principal do módulo de catálogo (produtos, serviços, kits).
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CatalogListScreen from '../../src/modules/catalog/CatalogListScreen';
import { useColors } from '../../src/design-system/ThemeProvider';
import { Text } from '../../src/design-system/components/Text';
import { spacing } from '../../src/design-system/tokens';

export default function CatalogoIndexScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Navegar para criar novo item
  const handleNewItem = () => {
    router.push('/catalogo/novo');
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
        <Text variant="h4" weight="semibold">Catálogo</Text>
        <TouchableOpacity onPress={handleNewItem} style={styles.addButton}>
          <Ionicons name="add" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Lista do Catálogo */}
      <CatalogListScreen />
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
  addButton: {
    padding: spacing[2],
    marginRight: -spacing[2],
  },
});
