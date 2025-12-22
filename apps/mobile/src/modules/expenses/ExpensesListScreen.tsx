/**
 * ExpensesListScreen
 *
 * Lista de despesas com filtros por status, fornecedor, categoria.
 * Suporta busca, pull to refresh e resumo financeiro.
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
import { useTranslation } from '../../i18n';
import { ExpenseService } from './ExpenseService';
import type { Expense, ExpenseStatus, ExpenseSummary, ExpenseCategory } from './types';
import { expenseStatusLabels, paymentMethodLabels, isExpenseOverdue } from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

type SortOrder = 'dueDate' | 'newest' | 'amount';

interface ExpensesListScreenProps {
  onExpensePress?: (expense: Expense) => void;
  onNewExpense?: () => void;
  preSelectedWorkOrderId?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: ExpenseStatus, isOverdue: boolean, colors: ThemeColors): string {
  if (isOverdue) return colors.error[500];
  const statusColors: Record<ExpenseStatus, string> = {
    PENDING: colors.warning[500],
    PAID: colors.success[500],
    CANCELED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(
  status: ExpenseStatus,
  isOverdue: boolean
): 'default' | 'success' | 'error' | 'warning' {
  if (isOverdue) return 'error';
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'CANCELED':
      return 'default';
    default:
      return 'default';
  }
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(
    locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }
  );
}

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(
    locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    {
      style: 'currency',
      currency,
    }
  ).format(value);
}

// =============================================================================
// COMPONENTS
// =============================================================================

const FinancialSummaryCard: React.FC<{
  summary: ExpenseSummary;
  locale: string;
  colors: ThemeColors;
}> = ({ summary, locale, colors }) => (
  <Card variant="elevated" style={styles.summaryCard}>
    <View style={styles.summaryRow}>
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">
          Pendente
        </Text>
        <Text variant="h5" weight="bold" style={{ color: colors.warning[600] }}>
          {formatCurrency(summary.pending.amount, locale)}
        </Text>
        <Text variant="caption" color="tertiary">
          {summary.pending.count} despesas
        </Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">
          Vencida
        </Text>
        <Text variant="h5" weight="bold" style={{ color: colors.error[600] }}>
          {formatCurrency(summary.overdue.amount, locale)}
        </Text>
        <Text variant="caption" color="tertiary">
          {summary.overdue.count} despesas
        </Text>
      </View>
      <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
      <View style={styles.summaryItem}>
        <Text variant="caption" color="secondary">
          Pago
        </Text>
        <Text variant="h5" weight="bold" style={{ color: colors.success[600] }}>
          {formatCurrency(summary.paid.amount, locale)}
        </Text>
        <Text variant="caption" color="tertiary">
          {summary.paid.count} despesas
        </Text>
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
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors.gray[400]}
      value={value}
      onChangeText={onChangeText}
    />
  </View>
);

const StatusFilterBar: React.FC<{
  selectedStatus: ExpenseStatus | 'ALL' | 'OVERDUE';
  onStatusChange: (status: ExpenseStatus | 'ALL' | 'OVERDUE') => void;
  colors: ThemeColors;
}> = ({ selectedStatus, onStatusChange, colors }) => {
  const statusFilters: { label: string; value: ExpenseStatus | 'ALL' | 'OVERDUE' }[] = [
    { label: 'Todas', value: 'ALL' },
    { label: 'Pendentes', value: 'PENDING' },
    { label: 'Vencidas', value: 'OVERDUE' },
    { label: 'Pagas', value: 'PAID' },
    { label: 'Canceladas', value: 'CANCELED' },
  ];

  return (
    <View
      style={[
        styles.filterContainer,
        {
          backgroundColor: colors.background.primary,
          borderBottomColor: colors.border.light,
        },
      ]}
    >
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

const ExpenseListItem: React.FC<{
  expense: Expense;
  onPress: () => void;
  locale: string;
  colors: ThemeColors;
}> = ({ expense, onPress, locale, colors }) => {
  const overdue = isExpenseOverdue(expense);
  const statusLabel = overdue ? 'Vencida' : expenseStatusLabels[expense.status];
  const paid = expense.status === 'PAID';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card variant="elevated" style={styles.listItem}>
        <View style={styles.listItemContent}>
          {/* Status indicator */}
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(expense.status, overdue, colors) },
            ]}
          />

          {/* Main content */}
          <View style={styles.listItemMain}>
            <View style={styles.listItemHeader}>
              <Text variant="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                {expense.description}
              </Text>
              <Badge
                label={statusLabel}
                variant={getStatusBadgeVariant(expense.status, overdue)}
                size="small"
              />
            </View>

            <Text
              variant="h4"
              weight="bold"
              style={{ color: paid ? colors.success[600] : colors.text.primary }}
            >
              {formatCurrency(expense.amount, locale)}
            </Text>

            <View style={styles.listItemMeta}>
              {expense.supplier && (
                <View style={styles.metaItem}>
                  <Ionicons name="business-outline" size={14} color={colors.text.tertiary} />
                  <Text variant="caption" color="tertiary" style={{ marginLeft: 4 }}>
                    {expense.supplier.name}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={overdue ? colors.error[500] : colors.text.tertiary}
                />
                <Text
                  variant="caption"
                  style={{
                    marginLeft: 4,
                    color: overdue ? colors.error[500] : colors.text.tertiary,
                  }}
                >
                  {formatDate(expense.dueDate, locale)}
                </Text>
              </View>
            </View>

            {/* Category badge */}
            {expense.category && (
              <View style={styles.categoryContainer}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: expense.category.color || colors.gray[300] },
                  ]}
                />
                <Text variant="caption" color="secondary">
                  {expense.category.name}
                </Text>
              </View>
            )}

            {expense.paymentMethod && paid && (
              <Text variant="caption" color="tertiary" style={{ marginTop: 4 }}>
                Pago via {paymentMethodLabels[expense.paymentMethod]}
              </Text>
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
}> = ({ sortOrder, onToggle, colors }) => {
  const sortLabels: Record<SortOrder, string> = {
    dueDate: 'Vencimento',
    newest: 'Mais recentes',
    amount: 'Valor',
  };

  return (
    <TouchableOpacity
      style={[styles.sortToggle, { backgroundColor: colors.background.primary }]}
      onPress={onToggle}
    >
      <Ionicons name="swap-vertical" size={16} color={colors.primary[600]} />
      <Text variant="caption" weight="medium" style={{ color: colors.primary[600], marginLeft: 4 }}>
        {sortLabels[sortOrder]}
      </Text>
    </TouchableOpacity>
  );
};

const EmptyState: React.FC<{ hasFilter: boolean; colors: ThemeColors }> = ({
  hasFilter,
  colors,
}) => (
  <View style={styles.emptyState}>
    <Ionicons
      name="wallet-outline"
      size={64}
      color={colors.gray[400]}
      style={{ marginBottom: spacing[3] }}
    />
    <Text variant="body" weight="semibold" align="center">
      {hasFilter ? 'Nenhuma despesa encontrada' : 'Sem despesas'}
    </Text>
    <Text variant="bodySmall" color="secondary" align="center">
      {hasFilter
        ? 'Tente ajustar os filtros'
        : 'Cadastre sua primeira despesa tocando no botão +'}
    </Text>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ExpensesListScreen: React.FC<ExpensesListScreenProps> = ({
  onExpensePress,
  onNewExpense,
  preSelectedWorkOrderId,
}) => {
  const { locale } = useTranslation();
  const colors = useColors();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | 'ALL' | 'OVERDUE'>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('dueDate');
  const [error, setError] = useState<string | null>(null);

  // Toggle sort order
  const handleSortToggle = useCallback(() => {
    setSortOrder((prev) => {
      if (prev === 'dueDate') return 'newest';
      if (prev === 'newest') return 'amount';
      return 'dueDate';
    });
  }, []);

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.description.toLowerCase().includes(query) ||
          e.supplier?.name.toLowerCase().includes(query) ||
          e.category?.name.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'OVERDUE') {
        result = result.filter((e) => isExpenseOverdue(e));
      } else {
        result = result.filter((e) => e.status === selectedStatus);
      }
    }

    // Sort
    result.sort((a, b) => {
      if (sortOrder === 'dueDate') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortOrder === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.amount - a.amount;
    });

    return result;
  }, [expenses, searchQuery, selectedStatus, sortOrder]);

  // Load summary
  const loadSummary = async () => {
    try {
      const data = await ExpenseService.getExpenseSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error loading summary:', err);
    }
  };

  // Load expenses
  const loadExpenses = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const filters = preSelectedWorkOrderId ? { workOrderId: preSelectedWorkOrderId } : undefined;
      const data = await ExpenseService.listExpenses(filters);
      setExpenses(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('offline') ||
        errorMessage.toLowerCase().includes('internet') ||
        errorMessage.toLowerCase().includes('connection') ||
        errorMessage.toLowerCase().includes('fetch') ||
        errorMessage.toLowerCase().includes('timeout');

      if (isNetworkError) {
        setError('OFFLINE');
      } else {
        setError('GENERIC');
      }
    } finally {
      setLoading(false);
    }
  }, [preSelectedWorkOrderId]);

  // Initial load
  useEffect(() => {
    loadExpenses();
    loadSummary();
  }, [loadExpenses]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadExpenses(), loadSummary()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle expense press
  const handleExpensePress = (expense: Expense) => {
    if (onExpensePress) {
      onExpensePress(expense);
    }
  };

  const renderItem = ({ item }: { item: Expense }) => (
    <ExpenseListItem
      expense={item}
      onPress={() => handleExpensePress(item)}
      locale={locale}
      colors={colors}
    />
  );

  const renderHeader = () => {
    if (!summary) return null;
    return <FinancialSummaryCard summary={summary} locale={locale} colors={colors} />;
  };

  const hasFilter = searchQuery.trim() !== '' || selectedStatus !== 'ALL';

  if (error && !loading) {
    const isOfflineError = error === 'OFFLINE';

    return (
      <View
        style={[styles.container, styles.errorContainer, { backgroundColor: colors.background.secondary }]}
      >
        <Ionicons name="cloud-offline-outline" size={64} color={colors.error[400]} />
        <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing[4] }}>
          {isOfflineError ? 'Sem conexão' : 'Erro ao carregar despesas'}
        </Text>
        <Text variant="bodySmall" color="secondary" align="center" style={{ marginTop: spacing[2] }}>
          {isOfflineError
            ? 'Despesas requer conexão com a internet'
            : 'Não foi possível carregar as despesas. Tente novamente.'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary[600] }]}
          onPress={loadExpenses}
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
        placeholder="Buscar despesa..."
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
          data={filteredExpenses}
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
          ListEmptyComponent={<EmptyState hasFilter={hasFilter} colors={colors} />}
        />
      )}

      {/* FAB for new expense */}
      {onNewExpense && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary[600] }]}
          onPress={onNewExpense}
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
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  categoryBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
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

export default ExpensesListScreen;
