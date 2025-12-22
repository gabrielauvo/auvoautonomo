/**
 * ChargesListScreen
 *
 * Lista paginada de cobranças com filtros.
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
}> = ({ stats, locale, colors }) => (
  <Card variant="elevated" style={styles.summaryCard}>
    <View style={styles.summaryRow}>
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">Pendente</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.warning[600] }}>
          {formatCurrency(stats.pendingValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{stats.pending} cobranças</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">Vencida</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.error[600] }}>
          {formatCurrency(stats.overdueValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{stats.overdue} cobranças</Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">Recebido</Text>
        <Text variant="h5" weight="bold" style={{ color: colors.success[600] }}>
          {formatCurrency(stats.receivedValue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{stats.confirmed} cobranças</Text>
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
}> = ({ selectedStatus, onStatusChange, colors }) => {
  const statusFilters: { label: string; value: ChargeStatus | 'ALL' }[] = [
    { label: 'Todas', value: 'ALL' },
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Vencidas', value: 'OVERDUE' },
    { label: 'Recebidas', value: 'RECEIVED' },
    { label: 'Canceladas', value: 'CANCELED' },
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
              {item.label}
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
}> = ({ charge, onPress, onSharePayment, locale, colors }) => {
  const statusLabel = chargeStatusLabels[charge.status];
  const billingLabel = billingTypeLabels[charge.billingType];
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
                {charge.client?.name || 'Cliente'}
              </Text>
              <Badge
                label={overdue ? 'Vencida' : statusLabel}
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
                  {billingLabel}
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
                    Compartilhar
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
}> = ({ sortOrder, onToggle, colors }) => (
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

const EmptyState: React.FC<{ hasFilter: boolean; colors: ThemeColors }> = ({ hasFilter, colors }) => (
  <View style={styles.emptyState}>
    <Ionicons name="receipt-outline" size={64} color={colors.gray[400]} style={{ marginBottom: spacing[3] }} />
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? 'Nenhuma cobrança encontrada' : 'Sem cobranças'}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter
        ? 'Tente ajustar os filtros'
        : 'Crie sua primeira cobrança tocando no botão +'}
    </Text>
  </View>
);

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

  // Load stats
  const loadStats = async () => {
    try {
      const data = await ChargeService.getChargeStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Load charges
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

      const result = await ChargeService.listCharges({
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
  }, [page, selectedStatus, searchQuery, preSelectedClientId]);

  // Initial load
  useEffect(() => {
    loadCharges(true);
    loadStats();
  }, [selectedStatus]);

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
      Alert.alert('Erro', 'Link de pagamento não disponível');
      return;
    }

    const message = `Olá! Segue o link para pagamento da cobrança de ${formatCurrency(charge.value, locale)}:\n\n${paymentUrl}`;

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
    />
  );

  const renderHeader = () => {
    if (!stats) return null;
    return (
      <FinancialSummaryCard stats={stats} locale={locale} colors={colors} />
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

  if (error && !loading) {
    const isOfflineError = error === 'OFFLINE';

    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background.secondary }]}>
        <Ionicons name="cloud-offline-outline" size={64} color={colors.error[400]} />
        <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing[4] }}>
          {isOfflineError ? 'Sem conexão' : 'Erro ao carregar cobranças'}
        </Text>
        <Text variant="bodySmall" color="secondary" align="center" style={{ marginTop: spacing[2] }}>
          {isOfflineError
            ? 'Cobranças só está disponível com conexão com a internet'
            : 'Não foi possível carregar as cobranças. Tente novamente.'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary[600] }]}
          onPress={() => loadCharges(true)}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.white }}>
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Buscar por cliente..."
        colors={colors}
      />
      <StatusFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        colors={colors}
      />

      {/* Sort Toggle */}
      <View style={[styles.sortContainer, { borderBottomColor: colors.border.light }]}>
        <SortToggle sortOrder={sortOrder} onToggle={handleSortToggle} colors={colors} />
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
          ListEmptyComponent={<EmptyState hasFilter={hasFilter} colors={colors} />}
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
