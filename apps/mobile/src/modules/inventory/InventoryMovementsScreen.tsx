/**
 * InventoryMovementsScreen
 *
 * Tela de histórico de movimentações de estoque.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { InventoryService } from './InventoryService';
import { InventoryMovement } from './InventoryRepository';
import { MovementListItem } from './components';

interface Props {
  navigation?: any;
  route?: {
    params?: {
      itemId?: string;
      itemName?: string;
    };
  };
}

type FilterType = 'all' | 'in' | 'out';

export function InventoryMovementsScreen({ navigation, route }: Props) {
  const { itemId, itemName } = route?.params || {};

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 30;

  const loadMovements = useCallback(
    async (reset = false) => {
      try {
        const offset = reset ? 0 : page * LIMIT;

        let data: InventoryMovement[];
        if (itemId) {
          data = await InventoryService.getItemMovements(itemId, LIMIT);
        } else {
          data = await InventoryService.getMovements({
            limit: LIMIT,
            offset,
          });
        }

        // Apply filter
        let filtered = data;
        if (filter === 'in') {
          filtered = data.filter(
            (m) => m.type === 'ADJUSTMENT_IN' || m.type === 'INITIAL'
          );
        } else if (filter === 'out') {
          filtered = data.filter(
            (m) => m.type === 'ADJUSTMENT_OUT' || m.type === 'WORK_ORDER_OUT'
          );
        }

        if (reset) {
          setMovements(filtered);
          setPage(0);
        } else {
          setMovements((prev) => [...prev, ...filtered]);
        }

        setHasMore(data.length === LIMIT);
      } catch (error) {
        console.error('Error loading movements:', error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [itemId, filter, page]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadMovements(true);
    }, [filter])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadMovements(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      setPage((p) => p + 1);
      loadMovements(false);
    }
  };

  const FilterButton = ({
    type,
    label,
    icon,
  }: {
    type: FilterType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Ionicons
        name={icon}
        size={16}
        color={filter === type ? '#6366f1' : '#6b7280'}
      />
      <Text
        style={[
          styles.filterButtonText,
          filter === type && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading && movements.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>
            {itemName ? `Histórico - ${itemName}` : 'Movimentações'}
          </Text>
          <Text style={styles.subtitle}>
            {movements.length} registro{movements.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterButton type="all" label="Todas" icon="list" />
        <FilterButton type="in" label="Entradas" icon="add-circle" />
        <FilterButton type="out" label="Saídas" icon="remove-circle" />
      </View>

      {/* Movements List */}
      <FlatList
        data={movements}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MovementListItem movement={item} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#6366f1']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoading && movements.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Sem movimentações</Text>
            <Text style={styles.emptyText}>
              {filter !== 'all'
                ? 'Nenhuma movimentação deste tipo'
                : 'Nenhuma movimentação registrada ainda'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#eef2ff',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#6366f1',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default InventoryMovementsScreen;
