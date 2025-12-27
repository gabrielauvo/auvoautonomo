/**
 * Clients Report Screen
 *
 * Relatorio de clientes com base de clientes e retencao.
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
import { ReportsService, ClientsReportData, ReportPeriod } from '../../src/services/ReportsService';
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
  format: 'number' | 'percent' | 'currency';
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
    if (format === 'percent') return `${(value as number).toFixed(1)}%`;
    if (format === 'number') return (value as number).toLocaleString(locale);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: locale === 'en-US' ? 'USD' : locale === 'es' ? 'EUR' : 'BRL',
      minimumFractionDigits: 0,
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
// CITY BAR COMPONENT
// =============================================================================

interface CityBarProps {
  city: string;
  count: number;
  maxCount: number;
}

const CityBar: React.FC<CityBarProps> = ({ city, count, maxCount }) => {
  const themeColors = useColors();
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <View style={styles.cityRow}>
      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{city}</Text>
      <View style={styles.cityBarContainer}>
        <View style={[styles.cityTrack, { backgroundColor: themeColors.gray[100] }]}>
          <View
            style={[
              styles.cityFill,
              { backgroundColor: themeColors.primary[500], width: `${Math.min(percentage, 100)}%` },
            ]}
          />
        </View>
        <Text variant="caption" weight="semibold" style={{ minWidth: 30, textAlign: 'right' }}>
          {count}
        </Text>
      </View>
    </View>
  );
};

// =============================================================================
// TOP CLIENT ROW COMPONENT
// =============================================================================

interface TopClientRowProps {
  rank: number;
  name: string;
  quotesCount: number;
  workOrdersCount: number;
  revenue: number;
  locale: string;
  t: (key: string) => string;
}

const TopClientRow: React.FC<TopClientRowProps> = ({ rank, name, quotesCount, workOrdersCount, revenue, locale, t }) => {
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
        <Text variant="caption" color="tertiary">
          {quotesCount} {t('reports.quotesCount')} | {workOrdersCount} {t('reports.workOrdersCount')}
        </Text>
      </View>
      <Text variant="body" weight="semibold" style={{ color: colors.success[600] }}>
        {formattedRevenue}
      </Text>
    </View>
  );
};

// =============================================================================
// INSIGHT CARD COMPONENT
// =============================================================================

interface InsightCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const InsightCard: React.FC<InsightCardProps> = ({ title, value, subtitle, icon, color }) => {
  const themeColors = useColors();

  return (
    <View style={[styles.insightCard, { backgroundColor: themeColors.background.primary, borderColor: themeColors.border.light }]}>
      <View style={[styles.insightIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text variant="caption" color="secondary">{title}</Text>
      <Text variant="h6" weight="bold" style={{ color }}>{value}</Text>
      <Text variant="caption" color="tertiary">{subtitle}</Text>
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ClientsReportScreen() {
  const themeColors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('last_30_days');
  const [data, setData] = useState<ClientsReportData | null>(null);
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

      const result = await ReportsService.getClientsReport(selectedPeriod);
      setData(result);
    } catch (error) {
      console.error('[ClientsReportScreen] Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate max count for city chart
  const maxCityCount = useMemo(() => {
    if (!data?.clientsByCity) return 0;
    return Math.max(...data.clientsByCity.map(c => c.count));
  }, [data]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[2], backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text variant="h5" weight="semibold">{t('reports.clientsReport')}</Text>
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
            title={t('reports.totalClients')}
            value={data?.clients?.total || 0}
            format="number"
            icon="people"
            iconColor={colors.primary[600]}
            iconBgColor={colors.primary[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.activeClients')}
            value={data?.clients?.active || 0}
            format="number"
            icon="checkmark-circle"
            iconColor={colors.success[600]}
            iconBgColor={colors.success[50]}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.newClients')}
            value={data?.clients?.new || 0}
            format="number"
            icon="person-add"
            iconColor={colors.info[600]}
            iconBgColor={colors.info[50]}
            subtitle={t('reports.newInPeriod')}
            loading={loading}
            locale={locale}
          />
          <KpiCard
            title={t('reports.avgRevenuePerClient')}
            value={data?.clients?.avgRevenuePerClient || 0}
            format="currency"
            icon="cash"
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
                label={t('reports.active')}
                value={data?.clients?.active || 0}
                total={data?.clients?.total || 0}
                color={colors.success[500]}
              />
              <StatusItem
                label={t('reports.newClients')}
                value={data?.clients?.new || 0}
                total={data?.clients?.total || 0}
                color={colors.info[500]}
              />
              <StatusItem
                label={t('reports.inactive')}
                value={data?.clients?.inactive || 0}
                total={data?.clients?.total || 0}
                color={colors.gray[500]}
              />
            </View>
          )}
        </Card>

        {/* Retention Rate */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="repeat" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.retentionRate')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary[500]} style={{ marginVertical: spacing[4] }} />
          ) : (
            <View style={styles.retentionContainer}>
              <Text variant="h2" weight="bold" style={{ color: colors.success[600] }}>
                {(data?.clients?.retentionRate || 0).toFixed(1)}%
              </Text>
            </View>
          )}
        </Card>

        {/* Client Insights */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={20} color={themeColors.primary[500]} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('reports.clientInsights')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={themeColors.primary[500]} style={{ marginVertical: spacing[4] }} />
          ) : (
            <View style={styles.insightsGrid}>
              <InsightCard
                title={t('reports.activationRate')}
                value={`${data?.clients?.total ? ((data.clients.active / data.clients.total) * 100).toFixed(0) : 0}%`}
                subtitle={t('reports.active')}
                icon="checkmark-done"
                color={colors.success[500]}
              />
              <InsightCard
                title={t('reports.growth')}
                value={`+${data?.clients?.new || 0}`}
                subtitle={t('reports.newInPeriod')}
                icon="trending-up"
                color={colors.info[500]}
              />
              <InsightCard
                title={t('reports.churn')}
                value={`${data?.clients?.inactive || 0}`}
                subtitle={t('reports.inactive')}
                icon="trending-down"
                color={colors.warning[500]}
              />
            </View>
          )}
        </Card>

        {/* Clients by City */}
        {data?.clientsByCity && data.clientsByCity.length > 0 && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color={themeColors.primary[500]} />
              <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
                {t('reports.clientsByCity')}
              </Text>
            </View>

            <View style={styles.cityList}>
              {data.clientsByCity.slice(0, 5).map((city, index) => (
                <CityBar
                  key={city.city || index}
                  city={city.city || 'N/A'}
                  count={city.count}
                  maxCount={maxCityCount}
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
                {t('reports.topClientsTable')}
              </Text>
            </View>

            <View style={styles.clientsList}>
              {data.topClients.slice(0, 5).map((client, index) => (
                <TopClientRow
                  key={client.id}
                  rank={index + 1}
                  name={client.name}
                  quotesCount={client.quotesCount}
                  workOrdersCount={client.workOrdersCount}
                  revenue={client.revenue}
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
            <Ionicons name="people-outline" size={48} color={themeColors.text.tertiary} />
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
  retentionContainer: {
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  insightsGrid: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  insightCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  cityList: {
    gap: spacing[3],
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  cityBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  cityTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cityFill: {
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
