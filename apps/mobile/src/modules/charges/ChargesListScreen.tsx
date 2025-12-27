/**
 * ChargesListScreen
 *
 * Lista paginada de cobranças com filtros.
 * Suporta busca, filtro por status e pull to refresh.
 *
 * OFFLINE-FIRST:
 * - Usa cache local quando offline
 * - Sincroniza automaticamente quando online
 * - Mostra indicador de dados offline
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
  Alert,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { useTranslation } from '../../i18n';
import { ChargeService } from './ChargeService';
import { ChargesCacheService } from './ChargesCacheService';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { useAuth } from '../../context/AuthContext';
import type {
  Charge,
  ChargeStatus,
  BillingType,
  ChargeStats,
} from './types';
import {
  chargeStatusLabels,
  billingTypeLabels,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
} from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

type SortOrder = 'newest' | 'oldest';

interface ChargesListScreenProps {
  onChargePress?: (charge: Charge) => void;
  onNewCharge?: () => void;
  preSelectedClientId?: string;
  preSelectedQuoteId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: ChargeStatus, colors: ThemeColors): string {
  const statusColors: Record<ChargeStatus, string> = {
    PENDING: colors.warning[500],
    OVERDUE: colors.error[500],
    CONFIRMED: colors.success[500],
    RECEIVED: colors.success[600],
    RECEIVED_IN_CASH: colors.success[500],
    REFUNDED: colors.gray[500],
    CANCELED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: ChargeStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'CONFIRMED':
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'success';
    case 'OVERDUE':
    case 'CANCELED':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

function getBillingTypeIcon(type: BillingType): string {
  switch (type) {
    case 'PIX':
      return 'qr-code-outline';
    case 'BOLETO':
      return 'document-text-outline';
    case 'CREDIT_CARD':
      return 'card-outline';
    default:
      return 'help-circle-outline';
  }
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function isOverdue(charge: Charge): boolean {
  if (charge.status !== 'PENDING') return false;
  const dueDate = new Date(charge.dueDate);
  return dueDate < new Date();
}

// =============================================================================
// COMPONENTS
// =============================================================================

const FinancialSummaryCard: React.FC<{
  stats: ChargeStats;
  locale: string;
  colors: ThemeColors;
  t: (key: string, params?: Record<string, any>) => string;
}> = ({ stats, locale, colors, t }) => (
  <Card variant="elevated" style={styles.summaryCard}>
    <View style={styles.summaryRow}>
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('charges.summary.pending')}</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.warning[600] }}>
          {formatCurrency(stats.pendingValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{t('charges.chargesCount', { count: stats.pending })}</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('charges.summary.overdue')}</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.error[600] }}>
          {formatCurrency(stats.overdueValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{t('charges.chargesCount', { count: stats.overdue })}</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('charges.summary.received')}</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.success[600] }}>
          {formatCurrency(stats.receivedValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{t('charges.chargesCount', { count: stats.confirmed })}</Text>
      </View>
    </View>
  </Card>
);

const SearchBar: React.FC<{
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  colors: ThemeColors;
}> = ({ value, onChangeText, placeholder, colors }) => (
  <View style={[styles.searchContainer, { backgroundColor: colors.background.primary }]}>
    <TextInput
      style={[
        styles.searchInput,
        {
          backgroundColor: colors.gray[200],
          color: colors.text.primary,
        }
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors.gray[400]}
      value={value}
      onChangeText={onChangeText}
    />
  </View>
);

const StatusFilterBar: React.FC<{
  selectedStatus: ChargeStatus | 'ALL';
  onStatusChange: (status: ChargeStatus | 'ALL') => void;
  colors: ThemeColors;
  t: (key: string) => string;
}> = ({ selectedStatus, onStatusChange, colors, t }) => {
  const statusFilters: { labelKey: string; value: ChargeStatus | 'ALL' }[] = [
    { labelKey: 'charges.filters.all', value: 'ALL' },
    { labelKey: 'charges.filters.pending', value: 'PENDING' },
    { labelKey: 'charges.filters.overdue', value: 'OVERDUE' },
    { labelKey: 'charges.filters.received', value: 'RECEIVED' },
    { labelKey: 'charges.filters.canceled', value: 'CANCELED' },
  ];

  return (
    <View style={[
      styles.filterContainer,
      {
        backgroundColor: colors.background.primary,
        borderBottomColor: colors.border.light,
      }
    ]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={statusFilters}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.gray[200] },
              selectedStatus === item.value && { backgroundColor: colors.primary[600] },
            ]}
            onPress={() => onStatusChange(item.value)}
          >
            <Text
              variant="bodySmall"
              weight={selectedStatus === item.value ? 'semibold' : 'normal'}
              style={{
                color: selectedStatus === item.value ? colors.white : colors.text.secondary,
              }}
            >
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );
};

const ChargeListItem: React.FC<{
  charge: Charge;
  onPress: () => void;
  onSharePayment: (charge: Charge) => void;
  locale: string;
  colors: ThemeColors;
  t: (key: string) => string;
}> = ({ charge, onPress, onSharePayment, locale, colors, t }) => {
  const overdue = isOverdue(charge);
  const paid = isChargePaid(charge);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.listItem}>
        <View style={styles.listItemContent}>
          {/* Status indicator */}
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: overdue ? colors.error[500] : getStatusColor(charge.status, colors) },
            ]}
          />

          {/* Main content */}
          <View style={styles.listItemMain}>
            <View style={styles.listItemHeader}>
              <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {charge.client?.name || t('charges.client')}
              </Text>
              <Badge
                label={overdue ? t('charges.statuses.overdue') : t(`charges.statuses.${charge.status.toLowerCase()}`)}
                variant={overdue ? 'error' : getStatusBadgeVariant(charge.status)}
                size="small"
              />
            </View>

            <Text variant="h4" weight="bold" style={{ color: paid ? colors.success[600] : colors.text.primary }}>
              {formatCurrency(charge.value, locale)}
            </Text>

            <View style={styles.listItemMeta}>
              <View style={styles.metaItem}>
                <Ionicons name={getBillingTypeIcon(charge.billingType) as any} size={14} color={colors.text.tertiary} />
                <Text variant="caption" color="tertiary" style={{ marginLeft: 4 }}>
                  {t(`charges.billingTypes.${charge.billingType.toLowerCase()}`)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={overdue ? colors.error[500] : colors.text.tertiary} />
                <Text
                  variant="caption"
                  style={{ marginLeft: 4, color: overdue ? colors.error[500] : colors.text.tertiary }}
                >
                  {formatDate(charge.dueDate, locale)}
                </Text>
              </View>
            </View>

            {charge.description && (
              <Text variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 4 }}>
                {charge.description}
              </Text>
            )}

            {/* Action buttons */}
            {!paid && charge.urls?.invoiceUrl && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary[50] }]}
                  onPress={() => onSharePayment(charge)}
                >
                  <Ionicons name="share-outline" size={16} color={colors.primary[600]} />
                  <Text variant="caption" weight="medium" style={{ color: colors.primary[600], marginLeft: 4 }}>
                    {t('charges.share')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const SortToggle: React.FC<{
  sortOrder: SortOrder;
  onToggle: () => void;
  colors: ThemeColors;
  t: (key: string) => string;
}> = ({ sortOrder, onToggle, colors, t }) => (
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
      {sortOrder === 'newest' ? t('charges.sortNewest') : t('charges.sortOldest')}
    </Text>
  </TouchableOpacity>
);

const EmptyState: React.FC<{ hasFilter: boolean; colors: ThemeColors; t: (key: string) => string }> = ({ hasFilter, colors, t }) => (
  <View style={styles.emptyState}>
    <Ionicons name="receipt-outline" size={64} color={colors.gray[400]} style={{ marginBottom: spacing[3] }} />
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? t('charges.noChargesFound') : t('charges.noCharges')}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter
        ? t('charges.tryAdjustFilters')
        : t('charges.createFirstCharge')}
    </Text>
  </View>
);

const OfflineBanner: React.FC<{
  isOffline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  onSync: () => void;
  colors: ThemeColors;
  t: (key: string) => string;
}> = ({ isOffline, isSyncing, lastSyncAt, onSync, colors, t }) => {
  if (!isOffline && !isSyncing) return null;

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return t('charges.neverSynced');
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('charges.justNow');
    if (diffMins < 60) return t('charges.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('charges.hoursAgo', { count: diffHours });
    return date.toLocaleDateString();
  };

  return (
    <View style={[
      styles.offlineBanner,
      { backgroundColor: isOffline ? colors.warning[100] : colors.primary[100] }
    ]}>
      <View style={styles.offlineBannerContent}>
        <Ionicons
          name={isOffline ? 'cloud-offline-outline' : 'sync-outline'}
          size={18}
          color={isOffline ? colors.warning[700] : colors.primary[700]}
        />
        <View style={styles.offlineBannerText}>
          <Text
            variant="bodySmall"
            weight="medium"
            style={{ color: isOffline ? colors.warning[800] : colors.primary[800] }}
          >
            {isOffline ? t('charges.offlineMode') : t('charges.syncing')}
          </Text>
          {isOffline && lastSyncAt && (
            <Text variant="caption" style={{ color: colors.warning[600] }}>
              {t('charges.lastSync')}: {formatLastSync(lastSyncAt)}
            </Text>
          )}
        </View>
      </View>
      {isOffline && !isSyncing && (
        <TouchableOpacity onPress={onSync} style={styles.offlineSyncButton}>
          <Ionicons name="refresh-outline" size={18} color={colors.warning[700]} />
        </TouchableOpacity>
      )}
      {isSyncing && (
        <ActivityIndicator size="small" color={colors.primary[600]} />
      )}
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChargesListScreen: React.FC<ChargesListScreenProps> = ({
  onChargePress,
  onNewCharge,
  preSelectedClientId,
  preSelectedQuoteId,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();
  const { user } = useAuth();
  const { isOnline, isSyncing: globalSyncing } = useSyncStatus();

  const [charges, setCharges] = useState<Charge[]>([]);
  const [stats, setStats] = useState<ChargeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ChargeStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [error, setError] = useState<string | null>(null);

  // Cache state
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [cacheSyncing, setCacheSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Configure cache service with user ID
  useEffect(() => {
    if (user?.id) {
      ChargesCacheService.configure(user.id);
    }
  }, [user?.id]);

  // Toggle sort order
  const handleSortToggle = useCallback(() => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  }, []);

  // Sorted charges
  const sortedCharges = useMemo(() => {
    return [...charges].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [charges, sortOrder]);

  // Load stats (from cache or server)
  const loadStats = async (fromCache: boolean = false) => {
    try {
      if (fromCache) {
        const cachedStats = await ChargesCacheService.getCachedStats();
        if (cachedStats) {
          setStats(cachedStats);
          return;
        }
      }

      const data = await ChargeService.getChargeStats();
      setStats(data);

      // Save to cache for offline use
      if (ChargesCacheService.isConfigured()) {
        await ChargesCacheService.saveStatsToCache(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      // Try to load from cache if server fails
      if (!fromCache && ChargesCacheService.isConfigured()) {
        const cachedStats = await ChargesCacheService.getCachedStats();
        if (cachedStats) {
          setStats(cachedStats);
        }
      }
    }
  };

  // Sync charges from server to cache
  const syncChargesFromServer = useCallback(async () => {
    if (!ChargesCacheService.isConfigured() || !isOnline) return false;

    setCacheSyncing(true);
    try {
      const success = await ChargesCacheService.syncFromServer();
      if (success) {
        const syncStatus = ChargesCacheService.getSyncStatus();
        setLastSyncAt(syncStatus.lastSyncAt);
      }
      return success;
    } finally {
      setCacheSyncing(false);
    }
  }, [isOnline]);

  // Load charges (from server or cache)
  const loadCharges = useCallback(async (reset: boolean = false) => {
    try {
      setError(null);

      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const statusFilter = selectedStatus === 'ALL' ? undefined : selectedStatus;

      // Try to load from server first if online
      if (isOnline) {
        try {
          const result = await ChargeService.listCharges({
            search: searchQuery.trim() || undefined,
            status: statusFilter,
            clientId: preSelectedClientId,
            page: currentPage,
            pageSize: PAGE_SIZE,
          });

          if (reset) {
            setCharges(result.data);
            // Save to cache for offline use
            if (ChargesCacheService.isConfigured()) {
              await ChargesCacheService.saveToCache(result.data);
            }
          } else {
            setCharges((prev) => [...prev, ...result.data]);
          }

          setHasMore(currentPage < result.totalPages);
          if (!reset) {
            setPage(currentPage + 1);
          }

          setIsUsingCache(false);
          return;
        } catch (err) {
          console.log('[ChargesListScreen] Server fetch failed, falling back to cache');
        }
      }

      // Fallback to cache if offline or server failed
      if (ChargesCacheService.isConfigured()) {
        const hasCachedData = await ChargesCacheService.hasCachedData();

        if (hasCachedData) {
          const result = await ChargesCacheService.getCachedCharges({
            search: searchQuery.trim() || undefined,
            status: statusFilter,
            clientId: preSelectedClientId,
            page: currentPage,
            pageSize: PAGE_SIZE,
          });

          if (reset) {
            setCharges(result.data);
          } else {
            setCharges((prev) => [...prev, ...result.data]);
          }

          setHasMore(currentPage < result.totalPages);
          if (!reset) {
            setPage(currentPage + 1);
          }

          setIsUsingCache(true);
          const syncStatus = ChargesCacheService.getSyncStatus();
          setLastSyncAt(syncStatus.lastSyncAt);

          // Load stats from cache too
          await loadStats(true);
          return;
        }
      }

      // No cache and offline - show error
      if (!isOnline) {
        setError('OFFLINE');
      } else {
        setError('GENERIC');
      }
    } catch (err) {
      // Check if it's a network/offline error
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('offline') ||
        errorMessage.toLowerCase().includes('internet') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('timeout');

      // Set user-friendly error message (never show technical error to user)
      if (isNetworkError) {
        setError('OFFLINE');
      } else {
        setError('GENERIC');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, selectedStatus, searchQuery, preSelectedClientId, isOnline]);

  // Initial load and sync
  useEffect(() => {
    const initializeData = async () => {
      // First load (may use cache if offline)
      await loadCharges(true);
      await loadStats();

      // If online and not already syncing, do a full cache sync in background
      if (isOnline && ChargesCacheService.isConfigured()) {
        syncChargesFromServer().then((success) => {
          if (success) {
            // Reload after sync to show fresh data
            loadCharges(true);
            loadStats();
          }
        });
      }
    };

    initializeData();
  }, [selectedStatus]);

  // Re-sync when coming back online
  useEffect(() => {
    if (isOnline && isUsingCache && ChargesCacheService.isConfigured()) {
      syncChargesFromServer().then((success) => {
        if (success) {
          loadCharges(true);
          loadStats();
        }
      });
    }
  }, [isOnline]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCharges(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCharges(true), loadStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadCharges(false);
    }
  };

  // Share payment link
  const handleSharePayment = useCallback(async (charge: Charge) => {
    const paymentUrl = charge.urls?.invoiceUrl;
    if (!paymentUrl) {
      Alert.alert(t('common.error'), t('charges.paymentLinkUnavailable'));
      return;
    }

    const message = t('charges.sharePaymentMessage', { value: formatCurrency(charge.value, locale), url: paymentUrl });

    try {
      await Share.share({
        message,
        url: paymentUrl,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  }, [locale]);

  // Handle charge press
  const handleChargePress = (charge: Charge) => {
    if (onChargePress) {
      onChargePress(charge);
    }
  };

  const renderItem = ({ item }: { item: Charge }) => (
    <ChargeListItem
      charge={item}
      onPress={() => handleChargePress(item)}
      onSharePayment={handleSharePayment}
      locale={locale}
      colors={colors}
      t={t}
    />
  );

  const renderHeader = () => {
    if (!stats) return null;
    return (
      <FinancialSummaryCard stats={stats} locale={locale} colors={colors} t={t} />
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  };

  const hasFilter = searchQuery.trim() !== '' || selectedStatus !== 'ALL';

  // Handle manual sync from banner
  const handleManualSync = useCallback(async () => {
    if (isOnline) {
      const success = await syncChargesFromServer();
      if (success) {
        await loadCharges(true);
        await loadStats();
      }
    }
  }, [isOnline, syncChargesFromServer, loadCharges]);

  if (error && !loading && !isUsingCache) {
    const isOfflineError = error === 'OFFLINE';

    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background.secondary }]}>
        <Ionicons name="cloud-offline-outline" size={64} color={colors.error[400]} />
        <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing[4] }}>
          {isOfflineError ? t('charges.noConnection') : t('charges.loadChargesError')}
        </Text>
        <Text variant="bodySmall" color="secondary" align="center" style={{ marginTop: spacing[2] }}>
          {isOfflineError
            ? t('charges.offlineNoCacheMessage')
            : t('charges.loadChargesErrorMessage')}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary[600] }]}
          onPress={() => loadCharges(true)}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.white }}>
            {t('common.retry')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Offline/Sync Banner */}
      <OfflineBanner
        isOffline={!isOnline || isUsingCache}
        isSyncing={cacheSyncing}
        lastSyncAt={lastSyncAt}
        onSync={handleManualSync}
        colors={colors}
        t={t}
      />

      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('charges.searchByClient')}
        colors={colors}
      />
      <StatusFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        colors={colors}
        t={t}
      />

      {/* Sort Toggle */}
      <View style={[styles.sortContainer, { borderBottomColor: colors.border.light }]}>
        <SortToggle sortOrder={sortOrder} onToggle={handleSortToggle} colors={colors} t={t} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : (
        <FlatList
          data={sortedCharges}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary[500]]}
              tintColor={colors.primary[500]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={<EmptyState hasFilter={hasFilter} colors={colors} t={t} />}
        />
      )}

      {/* FAB for new charge */}
      {onNewCharge && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary[600] }]}
          onPress={onNewCharge}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
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
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  retryButton: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  offlineBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  offlineBannerText: {
    marginLeft: spacing[2],
    flex: 1,
  },
  offlineSyncButton: {
    padding: spacing[2],
  },
  searchContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...shadows.sm,
  },
  searchInput: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
  },
  filterContainer: {
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  filterList: {
    paddingHorizontal: spacing[4],
  },
  filterButton: {
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  summaryCard: {
    marginBottom: spacing[4],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: spacing[2],
  },
  sortContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
  },
  listContent: {
    padding: spacing[4],
    paddingBottom: spacing[20],
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
  listItemMeta: {
    flexDirection: 'row',
    marginTop: spacing[2],
    gap: spacing[4],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
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
  fab: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});

export default ChargesListScreen;
