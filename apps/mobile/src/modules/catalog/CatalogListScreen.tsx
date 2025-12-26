// @ts-nocheck
/**
 * Catalog List Screen
 *
 * Tela principal do catálogo que lista produtos, serviços e kits.
 * Suporta:
 * - Filtro por tipo (Todos, Produtos, Serviços, Kits)
 * - Busca por nome/SKU
 * - Filtro por categoria
 * - Navegação para criar/editar/visualizar itens
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../services/AuthProvider';
import { CatalogItemRepository, CategoryRepository } from '../../db/repositories';
import { CatalogItem, ProductCategory, ItemType } from '../../db/schema';
import { useSyncStatus } from '../../sync';
import { colors, spacing, typography, borderRadius } from '../../design-system/tokens';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

type FilterType = 'ALL' | 'PRODUCT' | 'SERVICE' | 'BUNDLE';

interface FilterTab {
  key: FilterType;
  label: string;
  icon: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_COLORS: Record<ItemType, string> = {
  PRODUCT: colors.info[500],      // Blue
  SERVICE: colors.primary[500],   // Purple
  BUNDLE: colors.warning[500],    // Orange
};

// =============================================================================
// ITEM CARD COMPONENT
// =============================================================================

interface ItemCardProps {
  item: CatalogItem;
  onPress: () => void;
  typeLabels: Record<ItemType, string>;
  pendingLabel: string;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onPress, typeLabels, pendingLabel }) => {
  const typeColor = TYPE_COLORS[item.type];
  const typeLabel = typeLabels[item.type];

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemHeader}>
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        {item.sku && (
          <Text style={styles.skuText}>SKU: {item.sku}</Text>
        )}
      </View>

      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>

      {item.description && (
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.itemFooter}>
        <Text style={styles.priceText}>{formatPrice(item.basePrice)}</Text>
        {item.categoryName && (
          <View style={styles.categoryBadge}>
            {item.categoryColor && (
              <View style={[styles.categoryDot, { backgroundColor: item.categoryColor }]} />
            )}
            <Text style={styles.categoryText} numberOfLines={1}>{item.categoryName}</Text>
          </View>
        )}
      </View>

      {!item.syncedAt && (
        <View style={styles.pendingSyncBadge}>
          <Ionicons name="cloud-upload-outline" size={12} color={colors.warning[500]} />
          <Text style={styles.pendingSyncText}>{pendingLabel}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CatalogListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { sync } = useSyncStatus();
  const { t } = useTranslation();

  // Translation-based constants
  const FILTER_TABS: FilterTab[] = [
    { key: 'ALL', label: t('catalog.filterAll'), icon: 'grid-outline' },
    { key: 'PRODUCT', label: t('catalog.filterProducts'), icon: 'cube-outline' },
    { key: 'SERVICE', label: t('catalog.filterServices'), icon: 'construct-outline' },
    { key: 'BUNDLE', label: t('catalog.filterBundles'), icon: 'layers-outline' },
  ];

  const TYPE_LABELS: Record<ItemType, string> = {
    PRODUCT: t('catalog.typeProduct'),
    SERVICE: t('catalog.typeService'),
    BUNDLE: t('catalog.typeBundle'),
  };

  // State
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const technicianId = user?.technicianId;

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  const loadData = useCallback(async () => {
    console.log('[CatalogListScreen] loadData called, technicianId:', technicianId);
    if (!technicianId) {
      console.log('[CatalogListScreen] No technicianId, skipping load');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[CatalogListScreen] Loading items and categories...');
      const [itemsData, categoriesData] = await Promise.all([
        CatalogItemRepository.getAll(technicianId),
        CategoryRepository.getAll(technicianId),
      ]);

      console.log('[CatalogListScreen] Loaded', itemsData.length, 'items and', categoriesData.length, 'categories');
      setItems(itemsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('[CatalogListScreen] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [technicianId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await sync();
    } catch (error) {
      console.error('[CatalogListScreen] Sync error:', error);
    }
    await loadData();
  }, [sync, loadData]);

  // =============================================================================
  // FILTERING
  // =============================================================================

  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by type
    if (activeFilter !== 'ALL') {
      result = result.filter(item => item.type === activeFilter);
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(item => item.categoryId === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query)) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }

    return result;
  }, [items, activeFilter, selectedCategory, searchQuery]);

  // =============================================================================
  // NAVIGATION
  // =============================================================================

  const handleItemPress = (item: CatalogItem) => {
    router.push(`/catalogo/${item.id}`);
  };

  const handleAddItem = () => {
    router.push('/catalogo/novo');
  };

  // =============================================================================
  // STATS
  // =============================================================================

  const stats = useMemo(() => {
    return {
      total: items.length,
      products: items.filter(i => i.type === 'PRODUCT').length,
      services: items.filter(i => i.type === 'SERVICE').length,
      bundles: items.filter(i => i.type === 'BUNDLE').length,
    };
  }, [items]);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>{t('catalog.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>{t('catalog.statsTotal')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: TYPE_COLORS.PRODUCT }]}>{stats.products}</Text>
          <Text style={styles.statLabel}>{t('catalog.statsProducts')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: TYPE_COLORS.SERVICE }]}>{stats.services}</Text>
          <Text style={styles.statLabel}>{t('catalog.statsServices')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: TYPE_COLORS.BUNDLE }]}>{stats.bundles}</Text>
          <Text style={styles.statLabel}>{t('catalog.statsBundles')}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.gray[400]} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('catalog.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.gray[400]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <TouchableOpacity
          style={[
            styles.categoryFilterButton,
            selectedCategory && styles.categoryFilterButtonActive,
          ]}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
        >
          <Ionicons
            name="folder-outline"
            size={20}
            color={selectedCategory ? colors.primary[500] : colors.gray[500]}
          />
        </TouchableOpacity>
      </View>

      {/* Category Picker */}
      {showCategoryPicker && (
        <View style={styles.categoryPicker}>
          <TouchableOpacity
            style={[
              styles.categoryPickerItem,
              !selectedCategory && styles.categoryPickerItemActive,
            ]}
            onPress={() => {
              setSelectedCategory(null);
              setShowCategoryPicker(false);
            }}
          >
            <Text style={styles.categoryPickerText}>{t('catalog.allCategories')}</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPickerItem,
                selectedCategory === cat.id && styles.categoryPickerItemActive,
              ]}
              onPress={() => {
                setSelectedCategory(cat.id);
                setShowCategoryPicker(false);
              }}
            >
              {cat.color && (
                <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              )}
              <Text style={styles.categoryPickerText}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeFilter === tab.key ? colors.primary[500] : colors.gray[500]}
            />
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => handleItemPress(item)}
            typeLabels={TYPE_LABELS}
            pendingLabel={t('catalog.pendingSync')}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[500]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>{t('catalog.emptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedCategory || activeFilter !== 'ALL'
                ? t('catalog.emptyFilterHint')
                : t('catalog.emptySubtitle')}
            </Text>
            {!searchQuery && !selectedCategory && activeFilter === 'ALL' && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddItem}>
                <Ionicons name="add" size={20} color={colors.white} />
                <Text style={styles.emptyButtonText}>{t('catalog.addItem')}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: typography.fontSize.md,
    color: colors.gray[500],
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.gray[900],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.white,
    gap: spacing[2],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    height: 44,
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.gray[900],
  },
  categoryFilterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryFilterButtonActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[500],
  },

  // Category Picker
  categoryPicker: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  categoryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    gap: spacing[2],
  },
  categoryPickerItemActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[500],
  },
  categoryPickerText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
  },

  // Filter Tabs
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: spacing[2],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
    gap: spacing[1],
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    backgroundColor: colors.primary[50],
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    fontWeight: typography.fontWeight.medium as any,
  },
  filterTabTextActive: {
    color: colors.primary[500],
  },

  // List
  listContent: {
    padding: spacing[4],
    gap: spacing[3],
  },

  // Item Card
  itemCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  typeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold as any,
  },
  skuText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
  },
  itemName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  itemDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginBottom: spacing[3],
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as any,
    color: colors.primary[600],
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    gap: spacing[1],
    maxWidth: 120,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[600],
  },
  pendingSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
    gap: spacing[1],
  },
  pendingSyncText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[500],
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
  },
  emptyTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.gray[700],
    marginTop: spacing[4],
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: spacing[2],
    textAlign: 'center',
    paddingHorizontal: spacing[8],
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[6],
    gap: spacing[2],
  },
  emptyButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.white,
  },
});
