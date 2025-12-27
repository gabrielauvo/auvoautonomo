/**
 * Finance Report Screen
 *
 * Relatorio financeiro detalhado com receitas, cobrancas e vencidos.
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

import { Text, Card } from '../../src/design-system';
import { useColors } from '../../src/design-system/ThemeProvider';
import { colors, spacing, borderRadius } from '../../src/design-system/tokens';
import { useTranslation } from '../../src/i18n';
import { ReportsService, FinanceReportData, ReportPeriod } from '../../src/services/ReportsService';

const formatCacheAge = ReportsService.formatCacheAge;
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
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  valueColor?: string;
  loading?: boolean;
  locale: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBgColor,
  valueColor,
  loading,
  locale,
}) => {
  const themeColors = useColors();

  const formattedValue = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }, [value, locale]);

  return (
    <View style={[styles.kpiCard, { backgroundColor: themeColors.background.primary }]}>
      {loading ? (
        <ActivityIndicator size="small" color={themeColors.primary[500]} />
      ) : (
        <>
          <View style={styles.kpiHeader}>
            <View style={[styles.kpiIcon, { backgroundColor: iconBgColor }]}>
              <Ionicons name={icon} size={18} color={iconColor} />
            </View>
            <Text variant="caption" color="secondary" numberOfLines={1} style={{ flex: 1 }}>
              {title}
            </Text>
          </View>
          <Text
            variant="h5"
            weight="bold"
            style={[styles.kpiValue, valueColor ? { color: valueColor } : {}]}
          >
            {formattedValue}
          </Text>
          {subtitle && (
            <Text variant="caption" color="tertiary">{subtitle}</Text>
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
  total: number;
  color: string;
  locale: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, total, color, locale }) => {
  const themeColors = useColors();
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const formattedValue = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  }, [value, locale]);

  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text variant="body" weight="medium">{label}</Text>
        <Text variant="body" weight="semibold" style={{ color }}>{formattedValue}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: themeColors.gray[100] }]}>
        <View
          style={[styles.progressFill, { backgroundColor: color, width: `${Math.min(percentage, 100)}%` }]}
        />
      </View>
      <Text variant="caption" color="tertiary">{percentage.toFixed(1)}%</Text>
    </View>
  );
};

// =============================================================================
// TOP CLIENT ROW COMPONENT
// =============================================================================

interface TopClientRowProps {
  rank: number;
  name: string;
  revenue: number;
  chargesCount: number;
  locale: string;
  t: (key: string) => string;
}

const TopClientRow: React.FC<TopClientRowProps> = ({ rank, name, revenue, chargesCount, locale, t }) => {
  const themeColors = useColors();

  const formattedRevenue = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 0,
    }).format(revenue);
  }, [revenue, locale]);

  return (
    <View style={[styles.clientRow, { borderBottomColor: themeColors.border.light }]}>
      <View style={[styles.rankBadge, { backgroundColor: themeColors.primary[50] }]}>
        <Text variant="caption" weight="bold" style={{ color: themeColors.primary[600] }}>
          {rank}
        </Text>
      </View>
      <View style={styles.clientInfo}>
        <Text variant="body" weight="medium" numberOfLines={1}>{name}</Text>
        <Text variant="caption" color="tertiary">{chargesCount} {t('reports.charges')}</Text>
      </View>
      <Text variant="body" weight="semibold" style={{ color: colors.success[600] }}>
        {formattedRevenue}
      </Text>
    </View>
  );
};

// =============================================================================
// PAYMENT METHOD BAR COMPONENT
// =============================================================================

interface PaymentMethodBarProps {
  method: string;
  amount: number;
  count: number;
  maxAmount: number;
  locale: string;
  t: (key: string) => string;
}

const PaymentMethodBar: React.FC<PaymentMethodBarProps> = ({ method, amount, count, maxAmount, locale, t }) => {
  const themeColors = useColors();
  const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

  const methodColors: Record<string, string> = {
    pix: colors.success[500],
    boleto: colors.warning[500],
    credit_card: colors.primary[500],
    cash: colors.info[500],
  };

  const methodLabels: Record<string, string> = {
    pix: t('reports.pix'),
    boleto: t('reports.boleto'),
    credit_card: t('reports.creditCard'),
    cash: t('reports.cash'),
  };

  const formattedAmount = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 0,
    }).format(amount);
  }, [amount, locale]);

  return (
    <View style={styles.methodRow}>
      <View style={styles.methodInfo}>
        <Text variant="body" weight="medium">{methodLabels[method] || method}</Text>
        <Text variant="caption" color="tertiary">{count}x</Text>
      </View>
      <View style={styles.methodBarContainer}>
        <View style={[styles.methodTrack, { backgroundColor: themeColors.gray[100] }]}>
          <View
            style={[
              styles.methodFill,
              { backgroundColor: methodColors[method] || colors.gray[500], width: `${Math.min(percentage, 100)}%` },
            ]}
          />
        </View>
        <Text variant="caption" weight="semibold" style={{ minWidth: 80, textAlign: 'right' }}>
          {formattedAmount}
        </Text>
      </View>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FinanceReportScreen() {
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('last_30_days');
  const [data, setData] = useState<FinanceReportData | null>(null);
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

      const result = await ReportsService.getFinanceReport(selectedPeriod, { forceRefresh });
      setData(result.data);
      setFromCache(result.fromCache);
      setCacheAge(result.cacheAge);
    } catch (error) {
      console.error('[FinanceReportScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate max amount for payment methods chart
  const maxMethodAmount = useMemo(() => {
    if (!data?.chargesByMethod) return 0;
    return Math.max(...data.chargesByMethod.map(m => m.amount));
  }, [data]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2], backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text variant="h5" weight="semibold">{t('reports.financeReport')}</Text>
          {fromCache && cacheAge !== null && (
            <View style={styles.cacheIndicator}>
              <Ionicons name="cloud-offline-outline" size={12} color={themeColors.text.tertiary} />
              <Text variant="caption" color="tertiary" style={{ marginLeft: spacing[1] }}>
                {formatCacheAge(cacheAge)}
              </Text>
            </View>
          )}
        </View>
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
                selectedPeriod === option.key
                  ? { backgroundColor: themeColors.primary[500] }
                  : { backgroundColor: themeColors.gray[100] },
              ]}
              onPress={() => setSelectedPeriod(option.key)}
            >
              <Text
                variant="caption"
                weight="medium"
                style={{
                  color: selectedPeriod === option.key ? '#fff' : themeColors.text.secondary,
                }}
              >
                {t(option.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <KpiCard
            title={t('reports.totalRevenue')}
            value={data?.revenue?.total || 0}
            icon="cash"
            iconColor={colors.primary[600]}
            iconBgColor={colors.primary[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.totalReceived')}
            value={data?.revenue?.received || 0}
            subtitle={data?.revenue?.total ? `${((data.revenue.received / data.revenue.total) * 100).toFixed(0)}% ${t('reports.ofTotal')}` : undefined}
            icon="checkmark-circle"
            iconColor={colors.success[600]}
            iconBgColor={colors.success[50]}
            valueColor={colors.success[600]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.totalPending')}
            value={data?.revenue?.pending || 0}
            icon="time"
            iconColor={colors.warning[600]}
            iconBgColor={colors.warning[50]}
            valueColor={colors.warning[600]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.totalOverdue')}
            value={data?.revenue?.overdue || 0}
            subtitle={data?.revenue?.total ? `${((data.revenue.overdue / data.revenue.total) * 100).toFixed(0)}% ${t('reports.ofTotal')}` : undefined}
            icon="alert-circle"
            iconColor={colors.error[600]}
            iconBgColor={colors.error[50]}
            valueColor={colors.error[600]}
            loading={loading}
            locale={locale}
          />
        </View>

        {/* Revenue by Status */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pie-chart" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.revenueByStatus')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary[500]} style={{ marginVertical: spacing[4] }} />
          ) : (
            <View style={styles.progressList}>
              <ProgressBar
                label={t('reports.received')}
                value={data?.revenue?.received || 0}
                total={data?.revenue?.total || 0}
                color={colors.success[500]}
                locale={locale}
              />
              <ProgressBar
                label={t('reports.pending')}
                value={data?.revenue?.pending || 0}
                total={data?.revenue?.total || 0}
                color={colors.warning[500]}
                locale={locale}
              />
              <ProgressBar
                label={t('reports.overdue')}
                value={data?.revenue?.overdue || 0}
                total={data?.revenue?.total || 0}
                color={colors.error[500]}
                locale={locale}
              />
            </View>
          )}
        </Card>

        {/* Charges by Payment Method */}
        {data?.chargesByMethod && data.chargesByMethod.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="card" size={20} color={themeColors.primary[500]} />
              <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
                {t('reports.chargesByPaymentMethod')}
              </Text>
            </View>

            <View style={styles.methodsList}>
              {data.chargesByMethod.map((method, index) => (
                <PaymentMethodBar
                  key={`method-${index}-${method.method}`}
                  method={method.method}
                  amount={method.amount}
                  count={method.count}
                  maxAmount={maxMethodAmount}
                  locale={locale}
                  t={t}
                />
              ))}
            </View>
          </Card>
        )}

        {/* Top Clients */}
        {data?.topClients && data.topClients.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy" size={20} color={themeColors.primary[500]} />
              <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
                {t('reports.topClientsByRevenue')}
              </Text>
            </View>

            <View style={styles.clientsList}>
              {data.topClients.slice(0, 5).map((client, index) => (
                <TopClientRow
                  key={client.id || `client-${index}`}
                  rank={index + 1}
                  name={client.name || '-'}
                  revenue={client.revenue || 0}
                  chargesCount={client.chargesCount || 0}
                  locale={locale}
                  t={t}
                />
              ))}
            </View>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !data && (
          <Card style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={themeColors.text.tertiary} />
            <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
              {t('reports.noDataAvailable')}
            </Text>
          </Card>
        )}

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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: spacing[2],
    marginLeft: -spacing[2],
  },
  refreshButton: {
    padding: spacing[2],
    marginRight: -spacing[2],
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  periodContainer: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  periodScroll: {
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  periodChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.full,
    marginRight: spacing[2],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing[1],
    marginBottom: spacing[4],
  },
  kpiCard: {
    width: '50%',
    padding: spacing[1],
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },
  kpiValue: {
    marginBottom: spacing[1],
  },
  section: {
    marginBottom: spacing[4],
    padding: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  progressList: {
    gap: spacing[4],
  },
  progressItem: {
    gap: spacing[1],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  methodsList: {
    gap: spacing[3],
  },
  methodRow: {
    gap: spacing[1],
  },
  methodInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  methodTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  methodFill: {
    height: '100%',
    borderRadius: 4,
  },
  clientsList: {
    gap: spacing[2],
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  clientInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
});
