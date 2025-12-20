/**
 * OptimizedList Component
 *
 * Wrapper otimizado para FlatList, projetado para lidar com
 * grandes volumes de dados (100k+ registros).
 *
 * Features:
 * - Virtualização eficiente
 * - Pull-to-refresh
 * - Infinite scroll com paginação
 * - Skeleton loading
 * - Empty state
 * - Memoização automática
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  FlatListProps,
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  ListRenderItem,
  ListRenderItemInfo,
  ViewToken,
} from 'react-native';
import { Text, Skeleton } from '../design-system';
import { useColors } from '../design-system/ThemeProvider';
import { spacing } from '../design-system/tokens';

// =============================================================================
// TYPES
// =============================================================================

interface OptimizedListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
  /** Dados da lista */
  data: T[];

  /** Função para renderizar cada item */
  renderItem: ListRenderItem<T>;

  /** Função para extrair a key de cada item */
  keyExtractor: (item: T, index: number) => string;

  /** Callback para carregar mais dados */
  onLoadMore?: () => void;

  /** Callback para refresh */
  onRefresh?: () => Promise<void>;

  /** Está carregando mais? */
  isLoadingMore?: boolean;

  /** Está fazendo refresh? */
  isRefreshing?: boolean;

  /** Está carregando dados iniciais? */
  isLoading?: boolean;

  /** Há mais dados para carregar? */
  hasMore?: boolean;

  /** Altura estimada do item (para performance) */
  estimatedItemSize?: number;

  /** Componente para lista vazia */
  emptyComponent?: React.ReactElement;

  /** Texto para lista vazia */
  emptyText?: string;

  /** Número de skeletons para mostrar */
  skeletonCount?: number;

  /** Componente skeleton customizado */
  skeletonComponent?: React.ReactElement;

  /** Callback quando item fica visível */
  onItemVisible?: (item: T) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

function OptimizedListInner<T>(
  {
    data,
    renderItem,
    keyExtractor,
    onLoadMore,
    onRefresh,
    isLoadingMore = false,
    isRefreshing = false,
    isLoading = false,
    hasMore = true,
    estimatedItemSize = 80,
    emptyComponent,
    emptyText = 'Nenhum item encontrado',
    skeletonCount = 5,
    skeletonComponent,
    onItemVisible,
    ...props
  }: OptimizedListProps<T>,
  ref: React.Ref<FlatList<T>>
) {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Handle end reached (infinite scroll)
  const handleEndReached = useCallback(() => {
    if (!onLoadMore || isLoadingMore || !hasMore) return;
    onLoadMore();
  }, [onLoadMore, isLoadingMore, hasMore]);

  // Track visible items
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!onItemVisible) return;

      viewableItems.forEach((viewToken) => {
        if (viewToken.item) {
          onItemVisible(viewToken.item);
        }
      });
    },
    [onItemVisible]
  );

  // Memoized render item
  const memoizedRenderItem = useCallback(
    (info: ListRenderItemInfo<T>) => {
      return renderItem(info);
    },
    [renderItem]
  );

  // Loading skeleton
  const renderSkeleton = useMemo(() => {
    if (!isLoading) return null;

    return (
      <View style={styles.skeletonContainer}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <View key={`skeleton-${index}`} style={styles.skeletonItem}>
            {skeletonComponent || (
              <View style={styles.defaultSkeleton}>
                <Skeleton width={48} height={48} borderRadius="full" />
                <View style={styles.skeletonContent}>
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={12} width="40%" style={styles.skeletonLine} />
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }, [isLoading, skeletonCount, skeletonComponent]);

  // Empty state
  const renderEmpty = useMemo(() => {
    if (isLoading) return null;

    return (
      emptyComponent || (
        <View style={styles.emptyContainer}>
          <Text variant="body" color="secondary" align="center">
            {emptyText}
          </Text>
        </View>
      )
    );
  }, [isLoading, emptyComponent, emptyText]);

  // Footer loader
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  }, [isLoadingMore, colors]);

  // Show skeleton while loading
  if (isLoading) {
    return <View style={styles.container}>{renderSkeleton}</View>;
  }

  return (
    <FlatList
      ref={ref}
      data={data}
      renderItem={memoizedRenderItem}
      keyExtractor={keyExtractor}
      style={styles.container}
      contentContainerStyle={data.length === 0 ? styles.emptyList : undefined}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      windowSize={11}
      initialNumToRender={10}
      getItemLayout={
        estimatedItemSize
          ? (_, index) => ({
              length: estimatedItemSize,
              offset: estimatedItemSize * index,
              index,
            })
          : undefined
      }
      // Refresh control
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing || isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        ) : undefined
      }
      // Infinite scroll
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      // Empty and footer
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      // Viewability tracking
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onItemVisible ? onViewableItemsChanged : undefined}
      // Extra props
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}

// Forward ref with generics
export const OptimizedList = React.forwardRef(OptimizedListInner) as <T>(
  props: OptimizedListProps<T> & { ref?: React.Ref<FlatList<T>> }
) => React.ReactElement;

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
  skeletonContainer: {
    padding: spacing[4],
  },
  skeletonItem: {
    marginBottom: spacing[4],
  },
  defaultSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonContent: {
    flex: 1,
    marginLeft: spacing[3],
  },
  skeletonLine: {
    marginTop: spacing[2],
  },
  footerLoader: {
    padding: spacing[4],
    alignItems: 'center',
  },
});

export default OptimizedList;
