/**
 * Reports Screen
 *
 * Tela de relatorios com visao geral de KPIs, receitas vs despesas,
 * resumo de despesas e grafico de receita por periodo.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Text, Card, Badge } from '../../src/design-system';
import { useColors } from '../../src/design-system/ThemeProvider';
import { colors, spacing, borderRadius, shadows } from '../../src/design-system/tokens';
import { useTranslation } from '../../src/i18n';
import { ReportsService, ReportsData, ReportPeriod } from '../../src/services/ReportsService';
import { useLocale } from '../../src/i18n/I18nProvider';

// =============================================================================
// TYPES
// =============================================================================

interface PeriodOption {
  key: ReportPeriod;
  labelKey: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'today', labelKey: 'reports.today' },
  { key: 'yesterday', labelKey: 'reports.yesterday' },
  { key: 'last_7_days', labelKey: 'reports.last7Days' },
  { key: 'last_30_days', labelKey: 'reports.last30Days' },
  { key: 'this_month', labelKey: 'reports.thisMonth' },
  { key: 'last_month', labelKey: 'reports.lastMonth' },
  { key: 'this_year', labelKey: 'reports.thisYear' },
];

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

interface KpiCardProps {
  title: string;
  value: number;
  format: 'currency' | 'number';
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  change?: number;
  changeLabel?: string;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  format,
  icon,
  iconColor,
  iconBgColor,
  change,
  changeLabel,
  loading,
}) => {
  const themeColors = useColors();
  const { locale } = useLocale();

  const formattedValue = useMemo(() => {
    if (format === 'currency') {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
        minimumFractionDigits: 2,
      }).format(value);
    }
    return value.toLocaleString(locale);
  }, [value, format, locale]);

  return (
    <View style={[styles.kpiCard, { backgroundColor: themeColors.background.primary }]}>
      {loading ? (
        <ActivityIndicator size="small" color={themeColors.primary[500]} />
      ) : (
        <>
          <View style={styles.kpiHeader}>
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.kpiIconContainer, { backgroundColor: iconBgColor }]}>
              <Ionicons name={icon} size={18} color={iconColor} />
            </View>
          </View>
          <Text variant="h4" weight="bold" style={styles.kpiValue}>
            {formattedValue}
          </Text>
          {change !== undefined && (
            <View style={styles.kpiChange}>
              <Ionicons
                name={change >= 0 ? 'trending-up' : 'trending-down'}
                size={14}
                color={change >= 0 ? colors.success[500] : colors.error[500]}
              />
              <Text
                variant="caption"
                style={{ color: change >= 0 ? colors.success[600] : colors.error[600], marginLeft: 2 }}
              >
                {change >= 0 ? '+' : ''}{change.toFixed(1)}% {changeLabel}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
};

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

interface ProgressBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  maxValue,
  color,
  icon,
  iconColor,
}) => {
  const { locale } = useLocale();
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;

  const formattedValue = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
    minimumFractionDigits: 2,
  }).format(value);

  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarHeader}>
        <View style={styles.progressBarLabel}>
          <Ionicons name={icon} size={16} color={iconColor} />
          <Text variant="body" style={{ marginLeft: spacing[2] }}>{label}</Text>
        </View>
        <Text variant="body" weight="semibold" style={{ color }}>{formattedValue}</Text>
      </View>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

// =============================================================================
// EXPENSE SUMMARY CARD COMPONENT
// =============================================================================

interface ExpenseSummaryItemProps {
  label: string;
  value: number;
  count: number;
  color: string;
  bgColor: string;
}

const ExpenseSummaryItem: React.FC<ExpenseSummaryItemProps> = ({
  label,
  value,
  count,
  color,
  bgColor,
}) => {
  const { locale } = useLocale();
  const { t } = useTranslation();

  const formattedValue = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
    minimumFractionDigits: 2,
  }).format(value);

  return (
    <View style={[styles.expenseItem, { backgroundColor: bgColor }]}>
      <View style={styles.expenseItemHeader}>
        <View style={[styles.expenseDot, { backgroundColor: color }]} />
        <Text variant="caption" color="secondary">{label}</Text>
      </View>
      <Text variant="h5" weight="semibold" style={{ color }}>{formattedValue}</Text>
      <Text variant="caption" color="tertiary">{count} {t('reports.items')}</Text>
    </View>
  );
};

// =============================================================================
// DETAILED REPORT LINK COMPONENT
// =============================================================================

interface DetailedReportLinkProps {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  onPress: () => void;
}

const DetailedReportLink: React.FC<DetailedReportLinkProps> = ({
  title,
  description,
  icon,
  iconColor,
  iconBgColor,
  onPress,
}) => {
  const themeColors = useColors();

  return (
    <TouchableOpacity
      style={[styles.reportLink, { borderColor: themeColors.border.light }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.reportLinkIcon, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.reportLinkContent}>
        <Text variant="body" weight="medium">{title}</Text>
        <Text variant="caption" color="secondary">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={themeColors.text.tertiary} />
    </TouchableOpacity>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ReportsScreen() {
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('last_30_days');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  // Load data
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await ReportsService.getReportsData(selectedPeriod, { forceRefresh });
      setData(result.data);
      setFromCache(result.fromCache);
      setCacheAge(result.cacheAge);
    } catch (error) {
      console.error('[ReportsScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial calculations
  const totalRevenue = data?.analytics?.revenue.received || 0;
  const totalExpenses = data?.expenses?.paid.amount || 0;
  const netResult = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;

  // Format currency helper
  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }, [locale]);

  const handleComingSoon = useCallback((feature: string) => {
    // TODO: Navigate to detailed report when implemented
    console.log('Navigate to:', feature);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2], backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text variant="h5" weight="semibold">{t('reports.title')}</Text>
        <TouchableOpacity onPress={() => loadData(true)} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color={themeColors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <View style={[styles.periodContainer, { backgroundColor: themeColors.background.primary }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScroll}
        >
          {PERIOD_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.periodChip,
                selectedPeriod === option.key && styles.periodChipActive,
                { borderColor: selectedPeriod === option.key ? themeColors.primary[500] : themeColors.border.light },
              ]}
              onPress={() => setSelectedPeriod(option.key)}
            >
              <Text
                variant="caption"
                weight={selectedPeriod === option.key ? 'semibold' : 'normal'}
                style={{ color: selectedPeriod === option.key ? themeColors.primary[600] : themeColors.text.secondary }}
              >
                {t(option.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Cache Banner */}
      {fromCache && cacheAge && (
        <View style={[styles.cacheBanner, { backgroundColor: colors.warning[50] }]}>
          <Ionicons name="cloud-offline" size={16} color={colors.warning[600]} />
          <Text variant="caption" style={{ color: colors.warning[700], marginLeft: spacing[2] }}>
            {t('reports.fromCache')} ({t('reports.cacheAge', { time: ReportsService.formatCacheAge(cacheAge) })})
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            colors={[themeColors.primary[500]]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiScroll}
        >
          <KpiCard
            title={t('reports.totalRevenue')}
            value={data?.analytics?.revenue.total || 0}
            format="currency"
            icon="cash"
            iconColor={colors.success[600]}
            iconBgColor={colors.success[50]}
            loading={loading}
          />
          <KpiCard
            title={t('reports.totalExpenses')}
            value={data?.expenses?.total.amount || 0}
            format="currency"
            icon="wallet"
            iconColor={colors.error[600]}
            iconBgColor={colors.error[50]}
            loading={loading}
          />
          <KpiCard
            title={t('reports.quotes')}
            value={data?.analytics?.quotes.total || 0}
            format="number"
            icon="document-text"
            iconColor={colors.primary[600]}
            iconBgColor={colors.primary[50]}
            change={data?.analytics?.quotes.conversionRate}
            changeLabel={t('reports.conversionRate')}
            loading={loading}
          />
          <KpiCard
            title={t('reports.completedWorkOrders')}
            value={data?.analytics?.workOrders.completed || 0}
            format="number"
            icon="construct"
            iconColor={colors.warning[600]}
            iconBgColor={colors.warning[50]}
            change={data?.analytics?.workOrders.completionRate}
            changeLabel={t('reports.completionRate')}
            loading={loading}
          />
          <KpiCard
            title={t('reports.activeClients')}
            value={data?.analytics?.clients.active || 0}
            format="number"
            icon="people"
            iconColor={colors.info[600]}
            iconBgColor={colors.info[50]}
            loading={loading}
          />
        </ScrollView>

        {/* Revenue vs Expenses */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.revenueVsExpenses')}
            </Text>
          </View>
          <Text variant="caption" color="secondary" style={{ marginBottom: spacing[4] }}>
            {t('reports.periodComparison')}
          </Text>

          <ProgressBar
            label={t('reports.receivedRevenue')}
            value={totalRevenue}
            maxValue={Math.max(totalRevenue, totalExpenses) || 1}
            color={colors.success[500]}
            icon="arrow-up"
            iconColor={colors.success[600]}
          />

          <ProgressBar
            label={t('reports.paidExpenses')}
            value={totalExpenses}
            maxValue={Math.max(totalRevenue, totalExpenses) || 1}
            color={colors.error[500]}
            icon="arrow-down"
            iconColor={colors.error[600]}
          />

          <View style={[styles.netResultContainer, { borderTopColor: themeColors.border.light }]}>
            <View style={styles.netResultLabel}>
              <Ionicons
                name={netResult >= 0 ? 'trending-up' : 'trending-down'}
                size={20}
                color={netResult >= 0 ? colors.success[600] : colors.error[600]}
              />
              <Text variant="body" weight="semibold" style={{ marginLeft: spacing[2] }}>
                {t('reports.netResult')}
              </Text>
            </View>
            <Text
              variant="h5"
              weight="bold"
              style={{ color: netResult >= 0 ? colors.success[600] : colors.error[600] }}
            >
              {formatCurrency(netResult)}
            </Text>
          </View>
          <Text variant="caption" color="secondary">
            {netResult >= 0 ? t('reports.positiveResult') : t('reports.negativeResult')}
            {totalRevenue > 0 && ` (${profitMargin.toFixed(1)}% ${t('reports.profitMargin')})`}
          </Text>
        </Card>

        {/* Expenses Summary */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.expensesSummary')}
            </Text>
          </View>
          <Text variant="caption" color="secondary" style={{ marginBottom: spacing[4] }}>
            {t('reports.expensesOverview')}
          </Text>

          <View style={styles.expenseGrid}>
            <ExpenseSummaryItem
              label={t('reports.paid')}
              value={data?.expenses?.paid.amount || 0}
              count={data?.expenses?.paid.count || 0}
              color={colors.success[600]}
              bgColor={colors.success[50]}
            />
            <ExpenseSummaryItem
              label={t('reports.pending')}
              value={data?.expenses?.pending.amount || 0}
              count={data?.expenses?.pending.count || 0}
              color={colors.warning[600]}
              bgColor={colors.warning[50]}
            />
            <ExpenseSummaryItem
              label={t('reports.overdue')}
              value={data?.expenses?.overdue.amount || 0}
              count={data?.expenses?.overdue.count || 0}
              color={colors.error[600]}
              bgColor={colors.error[50]}
            />
            <ExpenseSummaryItem
              label={t('reports.totalExpenses')}
              value={data?.expenses?.total.amount || 0}
              count={data?.expenses?.total.count || 0}
              color={colors.gray[600]}
              bgColor={colors.gray[100]}
            />
          </View>
        </Card>

        {/* Detailed Reports */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.detailedReports')}
            </Text>
          </View>

          <View style={styles.reportLinks}>
            <DetailedReportLink
              title={t('reports.finance')}
              description={t('reports.financeDescription')}
              icon="cash"
              iconColor={colors.success[600]}
              iconBgColor={colors.success[50]}
              onPress={() => handleComingSoon('finance')}
            />
            <DetailedReportLink
              title={t('reports.sales')}
              description={t('reports.salesDescription')}
              icon="document-text"
              iconColor={colors.primary[600]}
              iconBgColor={colors.primary[50]}
              onPress={() => handleComingSoon('sales')}
            />
            <DetailedReportLink
              title={t('reports.operations')}
              description={t('reports.operationsDescription')}
              icon="construct"
              iconColor={colors.warning[600]}
              iconBgColor={colors.warning[50]}
              onPress={() => handleComingSoon('operations')}
            />
            <DetailedReportLink
              title={t('reports.clients')}
              description={t('reports.clientsDescription')}
              icon="people"
              iconColor={colors.info[600]}
              iconBgColor={colors.info[50]}
              onPress={() => handleComingSoon('clients')}
            />
          </View>
        </Card>

        {/* Bottom spacing */}
        <View style={{ height: spacing[8] }} />
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    ...shadows.sm,
  },
  backButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },
  refreshButton: {
    padding: spacing[2],
    marginRight: -spacing[2],
  },
  periodContainer: {
    paddingVertical: spacing[3],
    ...shadows.sm,
  },
  periodScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  periodChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  periodChipActive: {
    backgroundColor: colors.primary[50],
  },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: spacing[4],
  },
  kpiScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  kpiCard: {
    width: 160,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    marginBottom: spacing[1],
  },
  kpiChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    padding: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  progressBarContainer: {
    marginBottom: spacing[4],
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  progressBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarTrack: {
    height: 12,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  netResultContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing[4],
    marginTop: spacing[2],
    borderTopWidth: 1,
  },
  netResultLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  expenseItem: {
    flex: 1,
    minWidth: '45%',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  expenseItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  expenseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  reportLinks: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  reportLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportLinkContent: {
    flex: 1,
    marginLeft: spacing[3],
  },
});
