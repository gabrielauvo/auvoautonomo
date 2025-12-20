/**
 * InvoicesListScreen
 *
 * Lista paginada de faturas com filtros.
 * Suporta busca, filtro por status e pull to refresh.
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { colors, spacing, borderRadius, shadows } from '../../design-system/tokens';
import { Invoice, InvoiceStatus } from '../../db/schema';
import { InvoiceService, FinancialSummary } from './InvoiceService';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface InvoicesListScreenProps {
  onInvoicePress?: (invoice: Invoice) => void;
  onNewInvoice?: () => void;
  onSync?: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: InvoiceStatus): string {
  const statusColors: Record<InvoiceStatus, string> = {
    PENDING: colors.warning[500],
    PAID: colors.success[500],
    OVERDUE: colors.error[500],
    CANCELLED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: InvoiceStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'PAID': return 'success';
    case 'OVERDUE': return 'error';
    case 'PENDING': return 'warning';
    default: return 'default';
  }
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
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

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status !== 'PENDING') return false;
  const dueDate = new Date(invoice.dueDate);
  return dueDate < new Date();
}

// =============================================================================
// COMPONENTS
// =============================================================================

const FinancialSummaryCard: React.FC<{
  summary: FinancialSummary;
  locale: string;
  t: (key: string) => string;
}> = ({ summary, locale, t }) => (
  <Card variant="elevated" style={styles.summaryCard}>
    <View style={styles.summaryRow}>
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('invoices.totalPending')}</Text>
        <Text variant="h4" weight="bold" style={{ color: colors.warning[600] }}>
          {formatCurrency(summary.totalPending, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{summary.countPending} {t('invoices.pending').toLowerCase()}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('invoices.totalOverdue')}</Text>
        <Text variant="h4" weight="bold" style={{ color: colors.error[600] }}>
          {formatCurrency(summary.totalOverdue, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{summary.countOverdue} {t('invoices.overdue').toLowerCase()}</Text>
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">{t('invoices.totalPaid')}</Text>
        <Text variant="h4" weight="bold" style={{ color: colors.success[600] }}>
          {formatCurrency(summary.totalPaid, locale)}
        </Text>
        <Text variant="caption" color="tertiary">{summary.countPaid} {t('invoices.paid').toLowerCase()}</Text>
      </View>
    </View>
  </Card>
);

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
  selectedStatus: InvoiceStatus | 'ALL';
  onStatusChange: (status: InvoiceStatus | 'ALL') => void;
  t: (key: string) => string;
}> = ({ selectedStatus, onStatusChange, t }) => {
  const statusFilters: { label: string; value: InvoiceStatus | 'ALL' }[] = [
    { label: t('invoices.all'), value: 'ALL' },
    { label: t('invoices.pending'), value: 'PENDING' },
    { label: t('invoices.overdue'), value: 'OVERDUE' },
    { label: t('invoices.paid'), value: 'PAID' },
    { label: t('invoices.cancelled'), value: 'CANCELLED' },
  ];

  return (
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
};

const InvoiceListItem: React.FC<{
  invoice: Invoice;
  onPress: () => void;
  t: (key: string) => string;
  locale: string;
}> = ({ invoice, onPress, t, locale }) => {
  const statusLabel = t(`invoices.${invoice.status.toLowerCase()}`);
  const overdue = isOverdue(invoice);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.listItem}>
        <View style={styles.listItemContent}>
          {/* Status indicator */}
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: overdue ? colors.error[500] : getStatusColor(invoice.status) },
            ]}
          />

          {/* Main content */}
          <View style={styles.listItemMain}>
            <View style={styles.listItemHeader}>
              <Text variant="bodySmall" color="secondary">
                #{invoice.invoiceNumber}
              </Text>
              <Badge
                label={overdue ? t('invoices.overdue') : statusLabel}
                variant={overdue ? 'error' : getStatusBadgeVariant(invoice.status)}
                size="small"
              />
            </View>

            <Text variant="body" weight="semibold" numberOfLines={1}>
              {invoice.clientName || t('invoices.client')}
            </Text>

            <Text variant="h4" weight="bold" style={{ color: colors.success[600] }}>
              {formatCurrency(invoice.total, locale)}
            </Text>

            <View style={styles.listItemFooter}>
              <Text variant="caption" color={overdue ? 'error' : 'tertiary'}>
                {t('invoices.dueDate')}: {formatDate(invoice.dueDate, locale)}
              </Text>
              {invoice.paidDate && (
                <Text variant="caption" color="success">
                  {t('invoices.paidDate')}: {formatDate(invoice.paidDate, locale)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const EmptyState: React.FC<{ hasFilter: boolean; t: (key: string) => string }> = ({ hasFilter, t }) => (
  <View style={styles.emptyState}>
    <Text variant="h2" style={styles.emptyIcon}>💰</Text>
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? t('invoices.noInvoicesFound') : t('invoices.noInvoices')}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter
        ? t('common.noResults')
        : t('invoices.subtitle')}
    </Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const InvoicesListScreen: React.FC<InvoicesListScreenProps> = ({
  onInvoicePress,
  onNewInvoice,
  onSync,
}) => {
  const { t, locale } = useTranslation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  // Load summary
  const loadSummary = async () => {
    try {
      const data = await InvoiceService.getFinancialSummary();
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  // Load invoices
  const loadInvoices = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(1);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 1 : page;
      const statusFilter = selectedStatus === 'ALL' ? undefined : selectedStatus;

      let result;
      if (searchQuery.trim()) {
        const searchResults = await InvoiceService.searchInvoices(searchQuery.trim(), PAGE_SIZE);
        result = {
          data: statusFilter
            ? searchResults.filter(i => i.status === statusFilter)
            : searchResults,
          total: searchResults.length,
          pages: 1,
        };
      } else {
        result = await InvoiceService.listInvoices(currentPage, PAGE_SIZE, statusFilter);
      }

      if (reset) {
        setInvoices(result.data);
      } else {
        setInvoices((prev) => [...prev, ...result.data]);
      }

      setHasMore(currentPage < result.pages);
      if (!reset) {
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, selectedStatus, searchQuery]);

  // Initial load
  useEffect(() => {
    loadInvoices(true);
    loadSummary();
  }, [selectedStatus]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onSync) {
        await onSync();
      }
      await Promise.all([loadInvoices(true), loadSummary()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading && !searchQuery.trim()) {
      loadInvoices(false);
    }
  };

  const handleInvoicePress = (invoice: Invoice) => {
    if (onInvoicePress) {
      onInvoicePress(invoice);
    }
  };

  const renderItem = ({ item }: { item: Invoice }) => (
    <InvoiceListItem
      invoice={item}
      onPress={() => handleInvoicePress(item)}
      t={t}
      locale={locale}
    />
  );

  const renderHeader = () => {
    if (!summary) return null;
    return (
      <FinancialSummaryCard summary={summary} locale={locale} t={t} />
    );
  };

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
        placeholder={t('invoices.searchPlaceholder')}
      />
      <StatusFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        t={t}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
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
          ListEmptyComponent={<EmptyState hasFilter={hasFilter} t={t} />}
        />
      )}

      {/* FAB for new invoice */}
      {onNewInvoice && (
        <TouchableOpacity style={styles.fab} onPress={onNewInvoice}>
          <Text variant="h3" style={{ color: colors.white }}>+</Text>
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
    backgroundColor: colors.border.light,
    marginHorizontal: spacing[2],
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
  listItemFooter: {
    flexDirection: 'row',
    marginTop: spacing[2],
    gap: spacing[3],
    flexWrap: 'wrap',
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
  fab: {
    position: 'absolute',
    right: spacing[4],
    bottom: spacing[4],
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});

export default InvoicesListScreen;
