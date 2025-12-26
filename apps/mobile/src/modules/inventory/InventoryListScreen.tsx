/**
 * InventoryListScreen
 *
 * Tela principal de estoque com lista de saldos e busca.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../../i18n';
import { InventoryService } from './InventoryService';
import { InventoryBalance } from './InventoryRepository';
import { InventoryBalanceCard, AdjustStockModal } from './components';

interface Props {
  navigation?: any;
}

export function InventoryListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [filteredBalances, setFilteredBalances] = useState<InventoryBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  // Modal state
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<InventoryBalance | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalQuantity: 0,
    lowStockCount: 0,
    pendingSyncCount: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const [enabled, negativeStock, balancesData, statsData] = await Promise.all([
        InventoryService.isEnabled(),
        InventoryService.allowsNegativeStock(),
        InventoryService.getBalances(),
        InventoryService.getStats(),
      ]);

      setIsEnabled(enabled);
      setAllowNegativeStock(negativeStock);
      setBalances(balancesData);
      setFilteredBalances(balancesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = balances.filter(
        (b) =>
          b.itemName?.toLowerCase().includes(query) ||
          b.itemSku?.toLowerCase().includes(query)
      );
      setFilteredBalances(filtered);
    } else {
      setFilteredBalances(balances);
    }
  }, [searchQuery, balances]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleAdjust = (balance: InventoryBalance) => {
    setSelectedBalance(balance);
    setAdjustModalVisible(true);
  };

  const handleConfirmAdjust = async (newQuantity: number, notes?: string) => {
    if (!selectedBalance) return;

    await InventoryService.adjustStock({
      itemId: selectedBalance.itemId,
      newQuantity,
      notes,
    });

    // Reload data
    await loadData();
  };

  const handleBalancePress = (balance: InventoryBalance) => {
    navigation?.navigate('InventoryDetail', { itemId: balance.itemId });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>{t('inventory.loadingStock')}</Text>
      </View>
    );
  }

  if (!isEnabled) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cube-outline" size={64} color="#d1d5db" />
        <Text style={styles.disabledTitle}>{t('inventory.moduleDisabled')}</Text>
        <Text style={styles.disabledText}>
          {t('inventory.moduleDisabledMessage')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="cube" size={24} color="#6366f1" />
          <Text style={styles.statValue}>{stats.totalProducts}</Text>
          <Text style={styles.statLabel}>{t('inventory.products')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="layers" size={24} color="#22c55e" />
          <Text style={styles.statValue}>{stats.totalQuantity.toFixed(0)}</Text>
          <Text style={styles.statLabel}>{t('inventory.total')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.statValue}>{stats.lowStockCount}</Text>
          <Text style={styles.statLabel}>{t('inventory.low')}</Text>
        </View>
        {stats.pendingSyncCount > 0 && (
          <View style={styles.statCard}>
            <Ionicons name="cloud-upload" size={24} color="#3b82f6" />
            <Text style={styles.statValue}>{stats.pendingSyncCount}</Text>
            <Text style={styles.statLabel}>{t('inventory.pendingSync')}</Text>
          </View>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('inventory.searchProduct')}
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Balances List */}
      <FlatList
        data={filteredBalances}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InventoryBalanceCard
            balance={item}
            onPress={() => handleBalancePress(item)}
            onAdjust={() => handleAdjust(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#6366f1']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? t('inventory.noResults') : t('inventory.noProducts')}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('inventory.tryAnotherSearch')
                : t('inventory.addProductsMessage')}
            </Text>
          </View>
        }
      />

      {/* Movements Button */}
      <TouchableOpacity
        style={styles.historyButton}
        onPress={() => navigation?.navigate('InventoryMovements')}
      >
        <Ionicons name="time-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Adjust Modal */}
      <AdjustStockModal
        visible={adjustModalVisible}
        balance={selectedBalance}
        allowNegativeStock={allowNegativeStock}
        onClose={() => {
          setAdjustModalVisible(false);
          setSelectedBalance(null);
        }}
        onConfirm={handleConfirmAdjust}
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
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  disabledText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#1f2937',
  },
  listContent: {
    paddingBottom: 100,
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
  historyButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default InventoryListScreen;
