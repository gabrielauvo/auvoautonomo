// @ts-nocheck
/**
 * Work Orders Screen
 *
 * Tela de ordens de serviço com lista real, filtros e sync.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { OptimizedList, AppHeader } from '../../src/components';
import { workOrderService } from '../../src/modules/workorders/WorkOrderService';
import { useSyncStatus } from '../../src/sync';
import { WorkOrder, WorkOrderStatus } from '../../src/db';

// =============================================================================
// TYPES
// =============================================================================

type SortOrder = 'newest' | 'oldest';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_FILTERS: { label: string; value: WorkOrderStatus | 'ALL' | 'OVERDUE' }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Atrasadas', value: 'OVERDUE' },
  { label: 'Agendadas', value: 'SCHEDULED' },
  { label: 'Em Andamento', value: 'IN_PROGRESS' },
  { label: 'Concluídas', value: 'DONE' },
  { label: 'Canceladas', value: 'CANCELED' },
];

const STATUS_CONFIG: Record<WorkOrderStatus, { color: string; label: string; icon: string }> = {
  SCHEDULED: { color: 'primary', label: 'Agendada', icon: 'calendar' },
  IN_PROGRESS: { color: 'warning', label: 'Em Andamento', icon: 'play-circle' },
  DONE: { color: 'success', label: 'Concluída', icon: 'checkmark-circle' },
  CANCELED: { color: 'error', label: 'Cancelada', icon: 'close-circle' },
};

// =============================================================================
// WORK ORDER CARD COMPONENT
// =============================================================================

const WorkOrderCard = React.memo(function WorkOrderCard({
  workOrder,
  onPress,
}: {
  workOrder: WorkOrder;
  onPress: () => void;
}) {
  const colors = useColors();
  const spacing = useSpacing();

  const statusConfig = STATUS_CONFIG[workOrder.status];

  const formattedDate = useMemo(() => {
    if (!workOrder.scheduledDate) return 'Sem data';
    const date = new Date(workOrder.scheduledDate);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  }, [workOrder.scheduledDate]);

  const formattedTime = useMemo(() => {
    if (!workOrder.scheduledStartTime) return '';
    const time = new Date(workOrder.scheduledStartTime);
    return time.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [workOrder.scheduledStartTime]);

  return (
    <Pressable onPress={onPress}>
      <Card
        variant="outlined"
        style={[styles.workOrderCard, { marginHorizontal: spacing[4], marginBottom: spacing[3] }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text variant="body" weight="medium" numberOfLines={1} style={styles.cardTitle}>
              {workOrder.title}
            </Text>
            <Badge variant={statusConfig.color as any} size="sm">
              {statusConfig.label}
            </Badge>
          </View>
          {workOrder.clientName && (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {workOrder.clientName}
            </Text>
          )}
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
            <Text variant="caption" color="tertiary" style={styles.detailText}>
              {formattedDate}
            </Text>
          </View>
          {formattedTime && (
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
              <Text variant="caption" color="tertiary" style={styles.detailText}>
                {formattedTime}
              </Text>
            </View>
          )}
          {workOrder.address && (
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
              <Text variant="caption" color="tertiary" numberOfLines={1} style={styles.detailText}>
                {workOrder.address}
              </Text>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );
});

// =============================================================================
// SORT TOGGLE COMPONENT
// =============================================================================

const SortToggle = React.memo(function SortToggle({
  sortOrder,
  onToggle,
}: {
  sortOrder: SortOrder;
  onToggle: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.sortToggle, { backgroundColor: colors.background.primary }]}
      onPress={onToggle}
    >
      <Ionicons
        name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
        size={16}
        color={colors.primary[600]}
      />
      <Text variant="caption" weight="medium" style={{ color: colors.primary[600], marginLeft: 4 }}>
        {sortOrder === 'newest' ? 'Mais recentes' : 'Mais antigos'}
      </Text>
    </TouchableOpacity>
  );
});

// =============================================================================
// FILTER CHIP COMPONENT
// =============================================================================

const FilterChip = React.memo(function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary[500] : colors.background.secondary,
          borderColor: selected ? colors.primary[500] : colors.border.light,
        },
      ]}
    >
      <Text
        variant="caption"
        style={{ color: selected ? '#FFFFFF' : colors.text.secondary }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function OSScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { isSyncing, isOnline, sync } = useSyncStatus();

  // State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'ALL' | 'OVERDUE'>('ALL');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<WorkOrderStatus, number>>({
    SCHEDULED: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    CANCELED: 0,
  });
  const [overdueCount, setOverdueCount] = useState(0);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const PAGE_SIZE = 30;

  // Toggle sort order
  const handleSortToggle = useCallback(() => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  }, []);

  // Sorted work orders
  const sortedWorkOrders = useMemo(() => {
    return [...workOrders].sort((a, b) => {
      const dateA = new Date(a.scheduledDate || a.createdAt).getTime();
      const dateB = new Date(b.scheduledDate || b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [workOrders, sortOrder]);

  // Load work orders from local DB
  const loadWorkOrders = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      let result;

      if (statusFilter === 'OVERDUE') {
        result = await workOrderService.getOverdueWorkOrders({
          limit: PAGE_SIZE,
          offset: (pageNum - 1) * PAGE_SIZE,
        });
      } else {
        const filter = statusFilter !== 'ALL' ? { status: statusFilter as WorkOrderStatus } : undefined;
        result = await workOrderService.listWorkOrders(filter, {
          limit: PAGE_SIZE,
          offset: (pageNum - 1) * PAGE_SIZE,
        });
      }

      if (append) {
        setWorkOrders((prev) => [...prev, ...result.items]);
      } else {
        setWorkOrders(result.items);
      }

      setTotal(result.total);
      setHasMore(pageNum < Math.ceil(result.total / PAGE_SIZE));
      setPage(pageNum);

      const [counts, overdue] = await Promise.all([
        workOrderService.getStatusCounts(),
        workOrderService.countOverdue(),
      ]);
      setStatusCounts(counts);
      setOverdueCount(overdue);
    } catch (error) {
      console.error('[OSScreen] Error loading work orders:', error);
      setWorkOrders([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [statusFilter]);

  // Initial load and filter change
  useEffect(() => {
    loadWorkOrders(1);
  }, [loadWorkOrders, statusFilter]);

  // Handle refresh (pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isOnline) {
        await sync();
      }
      await loadWorkOrders(1);
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnline, sync, loadWorkOrders]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadWorkOrders(page + 1, true);
    }
  }, [hasMore, isLoadingMore, page, loadWorkOrders]);

  // Handle work order press
  const handleWorkOrderPress = useCallback((workOrder: WorkOrder) => {
    router.push(`/os/${workOrder.id}`);
  }, []);

  // Handle add work order
  const handleAddWorkOrder = useCallback(() => {
    router.push('/os/novo');
  }, []);

  // Render work order item
  const renderItem = useCallback(
    ({ item }: { item: WorkOrder }) => (
      <WorkOrderCard workOrder={item} onPress={() => handleWorkOrderPress(item)} />
    ),
    [handleWorkOrderPress]
  );

  // Key extractor
  const keyExtractor = useCallback((item: WorkOrder) => item.id, []);

  // Get filter count
  const getFilterCount = (value: WorkOrderStatus | 'ALL' | 'OVERDUE') => {
    if (value === 'ALL') {
      return Object.values(statusCounts).reduce((a, b) => a + b, 0);
    }
    if (value === 'OVERDUE') {
      return overdueCount;
    }
    return statusCounts[value] || 0;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <AppHeader title="Ordens de Serviço" />

      {/* Header with filters */}
      <View style={[styles.header, { paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}>
        {/* Status filters */}
        <View style={styles.filtersContainer}>
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              label={`${filter.label} (${getFilterCount(filter.value)})`}
              selected={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
            />
          ))}
        </View>

        {/* Sync status and Sort Toggle */}
        <View style={styles.syncStatus}>
          <View style={styles.syncInfo}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? colors.success[500] : colors.error[500] },
              ]}
            />
            <Text variant="caption" color="secondary">
              {isSyncing ? 'Sincronizando...' : isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <SortToggle sortOrder={sortOrder} onToggle={handleSortToggle} />
        </View>
      </View>

      {/* Work orders list */}
      <OptimizedList
        data={sortedWorkOrders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        estimatedItemSize={120}
        emptyText={
          statusFilter === 'OVERDUE'
            ? 'Nenhuma OS atrasada'
            : statusFilter !== 'ALL'
            ? `Nenhuma OS ${STATUS_CONFIG[statusFilter as WorkOrderStatus].label.toLowerCase()}`
            : 'Nenhuma ordem de serviço'
        }
        contentContainerStyle={{ paddingTop: spacing[2], paddingBottom: spacing[20] }}
      />

      {/* Total count */}
      {!isLoading && total > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.background.secondary }]}>
          <Text variant="caption" color="secondary">
            {total} ordem{total > 1 ? 'ns' : ''} de serviço
          </Text>
        </View>
      )}

      {/* FAB - Add Work Order */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary[500] }]}
        onPress={handleAddWorkOrder}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    gap: 12,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  workOrderCard: {
    padding: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
  },
  cardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    marginLeft: 2,
  },
  footer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
