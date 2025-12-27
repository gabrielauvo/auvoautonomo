/**
 * WorkOrdersListScreen
 *
 * Lista paginada de ordens de serviço com filtros.
 * Suporta busca, filtro por status e pull to refresh.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { colors, spacing, borderRadius, shadows, theme } from '../../design-system/tokens';
import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { workOrderService } from './WorkOrderService';
import { WorkOrderFilter } from './WorkOrderRepository';
import { ExecutionSessionRepository } from './execution/ExecutionSessionRepository';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface WorkOrdersListScreenProps {
  onWorkOrderPress?: (workOrder: WorkOrder) => void;
  onSync?: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: WorkOrderStatus, isPaused?: boolean): string {
  if (status === 'IN_PROGRESS' && isPaused) {
    return colors.warning[500];
  }
  return theme.statusColors.workOrder[status] || colors.gray[500];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// COMPONENTS
// =============================================================================

const SearchBar: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}> = ({ value, onChangeText, placeholder }) => (
  <View style={styles.searchContainer}>
    <TextInput
      style={styles.searchInput}
      placeholder={placeholder}
      placeholderTextColor={colors.gray[400]}
      value={value}
      onChangeText={onChangeText}
    />
  </View>
);

const StatusFilterBar: React.FC<{
  selectedStatus: WorkOrderStatus | 'ALL';
  onStatusChange: (status: WorkOrderStatus | 'ALL') => void;
  statusFilters: { label: string; value: WorkOrderStatus | 'ALL' }[];
}> = ({ selectedStatus, onStatusChange, statusFilters }) => (
  <View style={styles.filterContainer}>
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={statusFilters}
      keyExtractor={(item) => item.value}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedStatus === item.value && styles.filterButtonActive,
          ]}
          onPress={() => onStatusChange(item.value)}
        >
          <Text
            variant="bodySmall"
            weight={selectedStatus === item.value ? 'semibold' : 'normal'}
            style={{
              color: selectedStatus === item.value ? colors.white : colors.gray[600],
            }}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.filterList}
    />
  </View>
);

const WorkOrderListItem: React.FC<{
  workOrder: WorkOrder;
  onPress: () => void;
  isPaused?: boolean;
  statusLabel: string;
  clientNotDefined: string;
}> = ({ workOrder, onPress, isPaused, statusLabel, clientNotDefined }) => {
  const scheduledDate = workOrder.scheduledDate || workOrder.scheduledStartTime;
  const time = workOrderService.formatScheduledTime(workOrder);

  // Determinar variante do badge baseado no status e pausa
  const getBadgeVariant = () => {
    if (workOrder.status === 'IN_PROGRESS' && isPaused) {
      return 'warning';
    }
    if (workOrder.status === 'DONE') return 'success';
    if (workOrder.status === 'IN_PROGRESS') return 'warning';
    if (workOrder.status === 'CANCELED') return 'error';
    return 'default';
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.listItem}>
        <View style={styles.listItemContent}>
          {/* Status indicator */}
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(workOrder.status, isPaused) },
            ]}
          />

          {/* Main content */}
          <View style={styles.listItemMain}>
            <View style={styles.listItemHeader}>
              <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {workOrder.title}
              </Text>
              <Badge
                label={statusLabel}
                variant={getBadgeVariant()}
                size="small"
              />
            </View>

            <Text variant="bodySmall" color="secondary" numberOfLines={1}>
              {workOrder.clientName || clientNotDefined}
            </Text>

            <View style={styles.listItemFooter}>
              {scheduledDate && (
                <Text variant="caption" color="tertiary">
                  {formatDate(scheduledDate)} - {time}
                </Text>
              )}
              {workOrder.address && (
                <Text variant="caption" color="tertiary" numberOfLines={1} style={{ flex: 1 }}>
                  {workOrder.address}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const EmptyState: React.FC<{
  hasFilter: boolean;
  noOrdersFound: string;
  noOrders: string;
  adjustFilters: string;
  ordersWillAppear: string;
}> = ({ hasFilter, noOrdersFound, noOrders, adjustFilters, ordersWillAppear }) => (
  <View style={styles.emptyState}>
    <Text variant="h2" style={styles.emptyIcon}>📋</Text>
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? noOrdersFound : noOrders}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter ? adjustFilters : ordersWillAppear}
    </Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const WorkOrdersListScreen: React.FC<WorkOrdersListScreenProps> = ({
  onWorkOrderPress,
  onSync,
}) => {
  const { t } = useTranslation();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [offset, setOffset] = useState(0);
  const [pausedWorkOrderIds, setPausedWorkOrderIds] = useState<Set<string>>(new Set());

  // Build status filters with translations
  const statusFilters = useMemo(() => [
    { label: t('workOrders.all'), value: 'ALL' as const },
    { label: t('workOrders.scheduled'), value: 'SCHEDULED' as const },
    { label: t('workOrders.inProgress'), value: 'IN_PROGRESS' as const },
    { label: t('workOrders.completed'), value: 'DONE' as const },
    { label: t('workOrders.cancelled'), value: 'CANCELED' as const },
  ], [t]);

  // Get status label for a work order
  const getStatusLabel = useCallback((status: WorkOrderStatus, isPaused?: boolean): string => {
    if (status === 'IN_PROGRESS' && isPaused) {
      return t('workOrders.paused');
    }
    const labels: Record<WorkOrderStatus, string> = {
      SCHEDULED: t('workOrders.statusScheduled'),
      IN_PROGRESS: t('workOrders.statusInProgress'),
      DONE: t('workOrders.statusCompleted'),
      CANCELED: t('workOrders.statusCancelled'),
    };
    return labels[status];
  }, [t]);

  // Build filter
  const buildFilter = useCallback((): WorkOrderFilter => {
    const filter: WorkOrderFilter = {};

    if (selectedStatus !== 'ALL') {
      filter.status = selectedStatus;
    }

    if (searchQuery.trim()) {
      filter.searchQuery = searchQuery.trim();
    }

    return filter;
  }, [selectedStatus, searchQuery]);

  // Load paused work order IDs
  const loadPausedWorkOrderIds = useCallback(async () => {
    try {
      const pausedIds = await ExecutionSessionRepository.getPausedWorkOrderIds();
      setPausedWorkOrderIds(new Set(pausedIds));
    } catch (error) {
      console.error('Error loading paused work order IDs:', error);
    }
  }, []);

  // Load work orders
  const loadWorkOrders = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const result = await workOrderService.listWorkOrders(buildFilter(), {
        limit: PAGE_SIZE,
        offset: currentOffset,
      });

      if (reset) {
        setWorkOrders(result.items);
      } else {
        setWorkOrders((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.hasMore);
      setOffset(currentOffset + result.items.length);
    } catch (error) {
      console.error('Error loading work orders:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildFilter, offset]);

  // Initial load
  useEffect(() => {
    loadWorkOrders(true);
    loadPausedWorkOrderIds();
  }, [selectedStatus, searchQuery]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onSync) {
        await onSync();
      }
      await Promise.all([
        loadWorkOrders(true),
        loadPausedWorkOrderIds(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadWorkOrders(false);
    }
  };

  const handleWorkOrderPress = (workOrder: WorkOrder) => {
    if (onWorkOrderPress) {
      onWorkOrderPress(workOrder);
    }
  };

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearch !== undefined) {
      loadWorkOrders(true);
    }
  }, [debouncedSearch]);

  const renderItem = ({ item }: { item: WorkOrder }) => (
    <WorkOrderListItem
      workOrder={item}
      onPress={() => handleWorkOrderPress(item)}
      isPaused={pausedWorkOrderIds.has(item.id)}
      statusLabel={getStatusLabel(item.status, pausedWorkOrderIds.has(item.id))}
      clientNotDefined={t('workOrders.clientNotDefined')}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary[600]} />
      </View>
    );
  };

  const hasFilter = searchQuery.trim() !== '' || selectedStatus !== 'ALL';

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('workOrders.searchPlaceholder')}
      />
      <StatusFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        statusFilters={statusFilters}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={workOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[600]]}
              tintColor={colors.primary[600]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <EmptyState
              hasFilter={hasFilter}
              noOrdersFound={t('workOrders.noOrdersFound')}
              noOrders={t('workOrders.noOrders')}
              adjustFilters={t('workOrders.adjustFilters')}
              ordersWillAppear={t('workOrders.ordersWillAppear')}
            />
          }
        />
      )}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  searchContainer: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...shadows.sm,
  },
  searchInput: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
  },
  filterContainer: {
    backgroundColor: colors.background.primary,
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterList: {
    paddingHorizontal: spacing[4],
  },
  filterButton: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing[2],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[600],
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[16],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItem: {
    marginBottom: spacing[3],
  },
  listItemContent: {
    flexDirection: 'row',
  },
  statusIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: spacing[3],
  },
  listItemMain: {
    flex: 1,
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[1],
  },
  listItemFooter: {
    flexDirection: 'row',
    marginTop: spacing[2],
    gap: spacing[3],
  },
  loadingMore: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[16],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
});

export default WorkOrdersListScreen;
