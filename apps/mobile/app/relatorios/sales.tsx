/**
 * Sales Report Screen
 *
 * Relatorio de vendas com orcamentos, conversao e ticket medio.
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
import { ReportsService, SalesReportData, ReportPeriod } from '../../src/services/ReportsService';
import { useLocale } from '../../src/i18n/I18nProvider';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

interface PeriodOption {
  key: ReportPeriod;
  labelKey: string;
}

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
  value: number | string;
  format: 'currency' | 'number' | 'percent' | 'text';
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBgColor: string;
  subtitle?: string;
  loading?: boolean;
  locale: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  format,
  icon,
  iconColor,
  iconBgColor,
  subtitle,
  loading,
  locale,
}) => {
  const themeColors = useColors();

  const formattedValue = useMemo(() => {
    if (format === 'text') return value as string;
    if (format === 'percent') return `${(value as number).toFixed(1)}%`;
    if (format === 'number') return (value as number).toLocaleString(locale);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 2,
    }).format(value as number);
  }, [value, format, locale]);

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
          <Text variant="h5" weight="bold" style={styles.kpiValue}>
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
// STATUS DISTRIBUTION COMPONENT
// =============================================================================

interface StatusItemProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

const StatusItem: React.FC<StatusItemProps> = ({ label, value, total, color }) => {
  const themeColors = useColors();
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <View style={styles.statusItem}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      <Text variant="body" weight="semibold">{value}</Text>
      <Text variant="caption" color="tertiary" style={{ marginLeft: spacing[2], minWidth: 45 }}>
        {percentage.toFixed(0)}%
      </Text>
    </View>
  );
};

// =============================================================================
// TOP SERVICE ROW COMPONENT
// =============================================================================

interface TopServiceRowProps {
  rank: number;
  name: string;
  quantity: number;
  value: number;
  locale: string;
  t: (key: string) => string;
}

const TopServiceRow: React.FC<TopServiceRowProps> = ({ rank, name, quantity, value, locale, t }) => {
  const themeColors = useColors();

  const formattedValue = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  }, [value, locale]);

  return (
    <View style={[styles.serviceRow, { borderBottomColor: themeColors.border.light }]}>
      <View style={[styles.rankBadge, { backgroundColor: themeColors.primary[50] }]}>
        <Text variant="caption" weight="bold" style={{ color: themeColors.primary[600] }}>
          {rank}
        </Text>
      </View>
      <View style={styles.serviceInfo}>
        <Text variant="body" weight="medium" numberOfLines={1}>{name}</Text>
        <Text variant="caption" color="tertiary">{quantity}x {t('reports.quantity')}</Text>
      </View>
      <Text variant="body" weight="semibold" style={{ color: colors.success[600] }}>
        {formattedValue}
      </Text>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SalesReportScreen() {
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('last_30_days');
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load data
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await ReportsService.getSalesReport(selectedPeriod);
      setData(result);
    } catch (error) {
      console.error('[SalesReportScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2], backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text variant="h5" weight="semibold">{t('reports.salesReport')}</Text>
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
            title={t('reports.totalQuotes')}
            value={data?.quotes?.total || 0}
            format="number"
            icon="document-text"
            iconColor={colors.primary[600]}
            iconBgColor={colors.primary[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.totalValue')}
            value={data?.quotes?.totalValue || 0}
            format="currency"
            icon="cash"
            iconColor={colors.success[600]}
            iconBgColor={colors.success[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.conversionRate')}
            value={data?.quotes?.conversionRate || 0}
            format="percent"
            icon="trending-up"
            iconColor={colors.info[600]}
            iconBgColor={colors.info[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.averageTicket')}
            value={data?.quotes?.averageTicket || 0}
            format="currency"
            icon="pricetag"
            iconColor={colors.warning[600]}
            iconBgColor={colors.warning[50]}
            loading={loading}
            locale={locale}
          />
        </View>

        {/* Distribution by Status */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pie-chart" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.distributionByStatus')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary[500]} style={{ marginVertical: spacing[4] }} />
          ) : (
            <View style={styles.statusList}>
              <StatusItem
                label={t('reports.approved')}
                value={data?.quotes?.approved || 0}
                total={data?.quotes?.total || 0}
                color={colors.success[500]}
              />
              <StatusItem
                label={t('reports.pending')}
                value={data?.quotes?.pending || 0}
                total={data?.quotes?.total || 0}
                color={colors.warning[500]}
              />
              <StatusItem
                label={t('reports.rejected')}
                value={data?.quotes?.rejected || 0}
                total={data?.quotes?.total || 0}
                color={colors.error[500]}
              />
              <StatusItem
                label={t('reports.expired')}
                value={data?.quotes?.expired || 0}
                total={data?.quotes?.total || 0}
                color={colors.gray[500]}
              />
            </View>
          )}
        </Card>

        {/* Average Approval Time */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.avgApprovalTime')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary[500]} style={{ marginVertical: spacing[4] }} />
          ) : (
            <View style={styles.avgTimeContainer}>
              <Text variant="h2" weight="bold" style={{ color: themeColors.primary[600] }}>
                {(data?.quotes?.avgApprovalDays || 0).toFixed(1)}
              </Text>
              <Text variant="body" color="secondary">{t('reports.days')}</Text>
            </View>
          )}
        </Card>

        {/* Top Services */}
        {data?.topServices && data.topServices.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="trophy" size={20} color={themeColors.primary[500]} />
              <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
                {t('reports.topServicesSold')}
              </Text>
            </View>

            <View style={styles.servicesList}>
              {data.topServices.slice(0, 5).map((service, index) => (
                <TopServiceRow
                  key={service.id}
                  rank={index + 1}
                  name={service.name}
                  quantity={service.quantity}
                  value={service.value}
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
  statusList: {
    gap: spacing[3],
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[3],
  },
  avgTimeContainer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  servicesList: {
    gap: spacing[2],
  },
  serviceRow: {
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
  serviceInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
  },
});
