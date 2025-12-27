// @ts-nocheck
/**
 * Catalog Item Detail Screen
 *
 * Tela de detalhes de um item do catálogo.
 * Mostra todas as informações e permite editar/excluir.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { useAuth } from '../../src/services';
import { CatalogItemRepository } from '../../src/db/repositories';
import { CatalogItem, BundleItem, ItemType } from '../../src/db/schema';
import { useTranslation, useLocale } from '../../src/i18n';

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_COLORS: Record<ItemType, string> = {
  PRODUCT: '#3b82f6',
  SERVICE: '#8b5cf6',
  BUNDLE: '#f97316',
};

// TYPE_LABELS moved to component to support i18n

const TYPE_ICONS: Record<ItemType, string> = {
  PRODUCT: 'cube-outline',
  SERVICE: 'construct-outline',
  BUNDLE: 'layers-outline',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CatalogoDetalheScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [item, setItem] = useState<(CatalogItem & { bundleItems?: BundleItem[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const technicianId = user?.id;

  // Dynamic type labels based on current locale
  const TYPE_LABELS: Record<ItemType, string> = {
    PRODUCT: t('catalog.types.product'),
    SERVICE: t('catalog.types.service'),
    BUNDLE: t('catalog.types.bundle'),
  };

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  const loadItem = useCallback(async () => {
    if (!id) return;

    try {
      const data = await CatalogItemRepository.getByIdWithBundleItems(id);
      setItem(data);
    } catch (error) {
      console.error('[CatalogoDetalheScreen] Error loading item:', error);
      Alert.alert(t('common.error'), t('catalog.couldNotLoadItem'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleEdit = () => {
    router.push(`/catalogo/editar/${id}`);
  };

  const handleDelete = () => {
    Alert.alert(
      t('catalog.deleteItem'),
      t('catalog.deleteConfirmation', { name: item?.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!id || !technicianId) return;

    setIsDeleting(true);
    try {
      await CatalogItemRepository.deleteItem(id, technicianId);
      Alert.alert(t('common.success'), t('catalog.itemDeleted'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('[CatalogoDetalheScreen] Error deleting item:', error);
      Alert.alert(t('common.error'), t('catalog.couldNotDeleteItem'));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
        <Text variant="h5" color="secondary" style={{ marginTop: spacing[3] }}>
          {t('catalog.itemNotFound')}
        </Text>
        <Button variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
          {t('common.back')}
        </Button>
      </View>
    );
  }

  const typeColor = TYPE_COLORS[item.type];
  const typeLabel = TYPE_LABELS[item.type];
  const typeIcon = TYPE_ICONS[item.type];

  return (
    <>
      <Stack.Screen
        options={{
          title: item.name,
          headerBackTitle: t('common.back'),
          headerRight: () => (
            <TouchableOpacity onPress={handleEdit} style={{ marginRight: 8 }}>
              <Ionicons name="pencil-outline" size={22} color={colors.primary[500]} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background.secondary }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.content, { padding: spacing[4] }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card */}
          <Card variant="elevated" style={[styles.headerCard, { marginBottom: spacing[4] }]}>
            <View style={styles.headerTop}>
              <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
                <Ionicons name={typeIcon as any} size={20} color={typeColor} />
                <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                  {typeLabel}
                </Text>
              </View>
              {item.sku && (
                <Text variant="caption" color="tertiary">SKU: {item.sku}</Text>
              )}
            </View>

            <Text variant="h4" weight="bold" style={{ marginTop: spacing[3] }}>
              {item.name}
            </Text>

            {item.description && (
              <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
                {item.description}
              </Text>
            )}

            <View style={[styles.priceRow, { marginTop: spacing[4] }]}>
              <View>
                <Text variant="caption" color="secondary">{t('catalog.salePrice')}</Text>
                <Text variant="h3" weight="bold" color="primary">
                  {formatCurrency(item.basePrice)}
                </Text>
              </View>
              {item.costPrice && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="caption" color="secondary">{t('catalog.cost')}</Text>
                  <Text variant="body" color="secondary">
                    {formatCurrency(item.costPrice)}
                  </Text>
                </View>
              )}
            </View>

            {!item.syncedAt && (
              <View style={[styles.syncBadge, { backgroundColor: colors.warning[50] }]}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.warning[500]} />
                <Text variant="caption" style={{ color: colors.warning[700], marginLeft: 4 }}>
                  {t('catalog.pendingSync')}
                </Text>
              </View>
            )}
          </Card>

          {/* Details Card */}
          <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
            <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('common.details')}
            </Text>

            <View style={styles.detailRow}>
              <Text variant="body" color="secondary">{t('catalog.unit')}</Text>
              <Text variant="body" weight="medium">{item.unit}</Text>
            </View>

            {item.categoryName && (
              <View style={styles.detailRow}>
                <Text variant="body" color="secondary">{t('catalog.category')}</Text>
                <View style={styles.categoryBadge}>
                  {item.categoryColor && (
                    <View style={[styles.categoryDot, { backgroundColor: item.categoryColor }]} />
                  )}
                  <Text variant="body" weight="medium">{item.categoryName}</Text>
                </View>
              </View>
            )}

            {item.type === 'SERVICE' && item.defaultDurationMinutes && (
              <View style={styles.detailRow}>
                <Text variant="body" color="secondary">{t('catalog.defaultDuration')}</Text>
                <Text variant="body" weight="medium">
                  {formatDuration(item.defaultDurationMinutes)}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text variant="body" color="secondary">{t('common.status')}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.isActive ? colors.success[50] : colors.error[50] }
              ]}>
                <Text
                  variant="caption"
                  weight="medium"
                  style={{ color: item.isActive ? colors.success[700] : colors.error[700] }}
                >
                  {item.isActive ? t('catalog.active') : t('catalog.inactive')}
                </Text>
              </View>
            </View>
          </Card>

          {/* Bundle Items Card */}
          {item.type === 'BUNDLE' && item.bundleItems && item.bundleItems.length > 0 && (
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[3] }}>
                {t('catalog.bundleComposition')}
              </Text>

              {item.bundleItems.map((bi, index) => (
                <View
                  key={bi.id || index}
                  style={[
                    styles.bundleItem,
                    { borderBottomColor: colors.border.light },
                    index === item.bundleItems!.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.bundleItemInfo}>
                    <Text variant="body" weight="medium">{bi.itemName}</Text>
                    <Text variant="caption" color="secondary">
                      {formatCurrency(bi.itemBasePrice)} / {bi.itemUnit}
                    </Text>
                  </View>
                  <View style={styles.bundleItemQty}>
                    <Text variant="body" weight="semibold">x{bi.quantity}</Text>
                    <Text variant="caption" color="secondary">
                      {formatCurrency(bi.itemBasePrice * bi.quantity)}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={[styles.bundleTotal, { borderTopColor: colors.border.light }]}>
                <Text variant="body" weight="medium">{t('catalog.bundleTotal')}</Text>
                <Text variant="h5" weight="bold" color="primary">
                  {formatCurrency(
                    item.bundleItems.reduce((sum, bi) => sum + (bi.itemBasePrice * bi.quantity), 0)
                  )}
                </Text>
              </View>
            </Card>
          )}

          {/* Timestamps */}
          <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
            <View style={styles.detailRow}>
              <Text variant="caption" color="tertiary">{t('catalog.createdAt')}</Text>
              <Text variant="caption" color="tertiary">
                {new Date(item.createdAt).toLocaleDateString(locale)}
              </Text>
            </View>
            <View style={[styles.detailRow, { marginBottom: 0 }]}>
              <Text variant="caption" color="tertiary">{t('catalog.updatedAt')}</Text>
              <Text variant="caption" color="tertiary">
                {new Date(item.updatedAt).toLocaleDateString(locale)}
              </Text>
            </View>
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={handleEdit}
              style={styles.actionButton}
              leftIcon={<Ionicons name="pencil-outline" size={18} color={colors.primary[500]} />}
            >
              {t('common.edit')}
            </Button>
            <Button
              variant="ghost"
              onPress={handleDelete}
              loading={isDeleting}
              style={styles.actionButton}
              leftIcon={<Ionicons name="trash-outline" size={18} color={colors.error[500]} />}
            >
              <Text style={{ color: colors.error[500] }}>{t('common.delete')}</Text>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    padding: 16,
  },

  // Header
  headerCard: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginTop: 16,
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // Bundle Items
  bundleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bundleItemInfo: {
    flex: 1,
  },
  bundleItemQty: {
    alignItems: 'flex-end',
  },
  bundleTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
  },
});
