/**
 * QuotesListScreen
 *
 * Lista paginada de orcamentos com filtros.
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
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { Quote, QuoteStatus } from '../../db/schema';
import { QuoteService } from './QuoteService';
import { useTranslation } from '../../i18n';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

type SortOrder = 'newest' | 'oldest';

interface QuotesListScreenProps {
  onQuotePress?: (quote: Quote) => void;
  onNewQuote?: () => void;
  onSync?: () => Promise<void>;
  userId?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PAGE_SIZE = 20;

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: QuoteStatus, colors: ThemeColors): string {
  const statusColors: Record<QuoteStatus, string> = {
    DRAFT: colors.gray[500],
    SENT: colors.primary[500],
    APPROVED: colors.success[500],
    REJECTED: colors.error[500],
    EXPIRED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: QuoteStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'APPROVED': return 'success';
    case 'REJECTED': return 'error';
    case 'SENT': return 'warning';
    default: return 'default';
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

// =============================================================================
// COMPONENTS
// =============================================================================

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
  selectedStatus: QuoteStatus | 'ALL';
  onStatusChange: (status: QuoteStatus | 'ALL') => void;
  t: (key: string) => string;
  colors: ThemeColors;
}> = ({ selectedStatus, onStatusChange, t, colors }) => {
  const statusFilters: { label: string; value: QuoteStatus | 'ALL' }[] = [
    { label: t('quotes.all'), value: 'ALL' },
    { label: t('quotes.draft'), value: 'DRAFT' },
    { label: t('quotes.sent'), value: 'SENT' },
    { label: t('quotes.approved'), value: 'APPROVED' },
    { label: t('quotes.rejected'), value: 'REJECTED' },
    { label: t('quotes.expired'), value: 'EXPIRED' },
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

const QuoteListItem: React.FC<{
  quote: Quote;
  onPress: () => void;
  t: (key: string) => string;
  locale: string;
  colors: ThemeColors;
}> = ({ quote, onPress, t, locale, colors }) => {
  const statusLabel = t(`quotes.${quote.status.toLowerCase()}`);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.listItem}>
        <View style={styles.listItemContent}>
          {/* Status indicator */}
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(quote.status, colors) },
            ]}
          />

          {/* Main content */}
          <View style={styles.listItemMain}>
            <View style={styles.listItemHeader}>
              <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {quote.clientName || t('quotes.client')}
              </Text>
              <Badge
                label={statusLabel}
                variant={getStatusBadgeVariant(quote.status)}
                size="small"
              />
            </View>

            <Text variant="h4" weight="bold" style={{ color: colors.success[600] }}>
              {formatCurrency(quote.totalValue, locale)}
            </Text>

            <View style={styles.listItemFooter}>
              <Text variant="caption" color="tertiary">
                {formatDate(quote.createdAt, locale)}
              </Text>
              {quote.visitScheduledAt && (
                <Text variant="caption" color="tertiary">
                  {t('quotes.visitDate')}: {formatDate(quote.visitScheduledAt, locale)}
                </Text>
              )}
            </View>
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

const EmptyState: React.FC<{ hasFilter: boolean; t: (key: string) => string }> = ({ hasFilter, t }) => (
  <View style={styles.emptyState}>
    <Text variant="h2" style={styles.emptyIcon}>📋</Text>
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? t('quotes.noQuotesFound') : t('quotes.noQuotes')}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter
        ? t('common.noResults')
        : t('quotes.subtitle')}
    </Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuotesListScreen: React.FC<QuotesListScreenProps> = ({
  onQuotePress,
  onNewQuote,
  onSync,
  userId,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<QuoteStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [isConfigured, setIsConfigured] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Toggle sort order
  const handleSortToggle = useCallback(() => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  }, []);

  // Sorted quotes
  const sortedQuotes = useMemo(() => {
    return [...quotes].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [quotes, sortOrder]);

  // Configure service when userId changes
  useEffect(() => {
    if (userId) {
      QuoteService.configure(userId);
      setIsConfigured(true);
    }
  }, [userId]);

  // Load quotes
  const loadQuotes = useCallback(async (reset: boolean = false) => {
    if (!isConfigured) return;

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
        const searchResults = await QuoteService.searchQuotes(searchQuery.trim(), PAGE_SIZE);
        result = {
          data: statusFilter
            ? searchResults.filter(q => q.status === statusFilter)
            : searchResults,
          total: searchResults.length,
          pages: 1,
        };
      } else {
        result = await QuoteService.listQuotes(currentPage, PAGE_SIZE, statusFilter);
      }

      if (reset) {
        setQuotes(result.data);
      } else {
        setQuotes((prev) => [...prev, ...result.data]);
      }

      setHasMore(currentPage < result.pages);
      if (!reset) {
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, selectedStatus, searchQuery, isConfigured]);

  // Initial load when configured - sync first then load
  useEffect(() => {
    const initialLoad = async () => {
      if (isConfigured) {
        // Sync quotes first, then load from local DB
        if (onSync) {
          try {
            console.log('[QuotesListScreen] Running initial sync...');
            await onSync();
            console.log('[QuotesListScreen] Initial sync completed');
          } catch (err) {
            console.warn('[QuotesListScreen] Initial sync failed:', err);
          }
        }
        loadQuotes(true);
      }
    };
    initialLoad();
  }, [isConfigured]); // Only run on initial config

  // Filter change - reload without sync
  useEffect(() => {
    if (isConfigured) {
      loadQuotes(true);
    }
  }, [selectedStatus]);

  // Debounced search
  useEffect(() => {
    if (!isConfigured) return;
    const timer = setTimeout(() => {
      loadQuotes(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isConfigured]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onSync) {
        await onSync();
      }
      await loadQuotes(true);
    } finally {
      setRefreshing(false);
    }
  };

  // Load more
  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading && !searchQuery.trim()) {
      loadQuotes(false);
    }
  };

  const handleQuotePress = (quote: Quote) => {
    if (onQuotePress) {
      onQuotePress(quote);
    }
  };

  const renderItem = ({ item }: { item: Quote }) => (
    <QuoteListItem
      quote={item}
      onPress={() => handleQuotePress(item)}
      t={t}
      locale={locale}
      colors={colors}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  };

  const hasFilter = searchQuery.trim() !== '' || selectedStatus !== 'ALL';

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('quotes.searchPlaceholder')}
        colors={colors}
      />
      <StatusFilterBar
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        t={t}
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
          data={sortedQuotes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
          ListEmptyComponent={<EmptyState hasFilter={hasFilter} t={t} />}
        />
      )}

      {/* FAB for new quote */}
      {onNewQuote && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary[600] }]}
          onPress={onNewQuote}
        >
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

export default QuotesListScreen;
