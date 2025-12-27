/**
 * Home Screen
 *
 * Tela inicial com dashboard completo do técnico.
 * Combina dados locais (SQLite) e dados financeiros da API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card, Badge, Avatar, Button } from '../../src/design-system';
import { useColors } from '../../src/design-system/ThemeProvider';
import { useAuth, DashboardService, DashboardOverview } from '../../src/services';
import { useSyncStatus } from '../../src/sync';
import { AppHeader } from '../../src/components';
import { spacing, borderRadius } from '../../src/design-system/tokens';
import { WorkOrder } from '../../src/db/schema';
import { workOrderRepository } from '../../src/modules/workorders/WorkOrderRepository';
import { QuoteRepository } from '../../src/modules/quotes/QuoteRepository';
import { getTodayLocalDate, extractDatePart } from '../../src/utils/dateUtils';
import { useTranslation } from '../../src/i18n';

// =============================================================================
// TYPES
// =============================================================================

type PeriodFilter = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'lastMonth';

interface LocalStats {
  osHoje: number;
  osAtrasadas: number;
  orcamentos: number;
  aReceber: number;
  osConcluidasMes: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return 'R$ ---';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// =============================================================================
// SKELETON COMPONENT
// =============================================================================

const SkeletonBox = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const colors = useColors();
  const animatedValue = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: colors.gray[200],
          borderRadius: 4,
          opacity: animatedValue,
        },
        style,
      ]}
    />
  );
};

// =============================================================================
// FINANCIAL CARD COMPONENT (Web-style)
// =============================================================================

interface FinancialCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  loading?: boolean;
}

const FinancialCard = ({ title, value, icon, iconBgColor, iconColor, loading }: FinancialCardProps) => {
  return (
    <View style={styles.financialCardWrapper}>
      <Card variant="elevated" style={styles.financialCard}>
        <View style={styles.financialCardContent}>
          <View style={styles.financialCardLeft}>
            <Text variant="caption" color="secondary">
              {title}
            </Text>
            {loading ? (
              <SkeletonBox width={90} height={24} style={{ marginTop: 4 }} />
            ) : (
              <Text variant="h5" style={styles.financialValue}>
                {value}
              </Text>
            )}
          </View>
          <View style={[styles.financialIcon, { backgroundColor: iconBgColor }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
        </View>
      </Card>
    </View>
  );
};

// =============================================================================
// QUICK STAT CARD COMPONENT
// =============================================================================

interface QuickStatCardProps {
  title: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  iconBgColor: string;
  iconColor: string;
  onPress?: () => void;
  subtitle?: string;
  subtitleColor?: string;
}

const QuickStatCard = ({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  onPress,
  subtitle,
  subtitleColor,
}: QuickStatCardProps) => {
  const colors = useColors();

  const content = (
    <Card variant="elevated" style={styles.quickStatCard}>
      <View style={[styles.quickStatIcon, { backgroundColor: iconBgColor }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text variant="h3" style={styles.quickStatValue}>
        {value}
      </Text>
      <Text variant="caption" color="secondary" align="center">
        {title}
      </Text>
      {subtitle && (
        <Text
          variant="caption"
          style={{ color: subtitleColor || colors.success[500], marginTop: 2, fontSize: 10 }}
        >
          {subtitle}
        </Text>
      )}
    </Card>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.quickStatCardWrapper} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.quickStatCardWrapper}>{content}</View>;
};

// =============================================================================
// PERIOD FILTER COMPONENT
// =============================================================================

const PeriodFilterBar = ({
  selected,
  onSelect,
}: {
  selected: PeriodFilter;
  onSelect: (period: PeriodFilter) => void;
}) => {
  const colors = useColors();
  const { t } = useTranslation();

  const PERIOD_OPTIONS: { label: string; value: PeriodFilter }[] = [
    { label: t('dashboard.today'), value: 'today' },
    { label: t('dashboard.yesterday'), value: 'yesterday' },
    { label: t('dashboard.days7'), value: '7days' },
    { label: t('dashboard.days30'), value: '30days' },
    { label: t('dashboard.thisMonth'), value: 'month' },
    { label: t('dashboard.lastMonth'), value: 'lastMonth' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.periodFilterContainer}
    >
      {PERIOD_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.periodChip,
            {
              backgroundColor: selected === option.value ? colors.gray[800] : colors.background.primary,
              borderColor: selected === option.value ? colors.gray[800] : colors.border.light,
            },
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text
            variant="caption"
            style={{ color: selected === option.value ? '#FFFFFF' : colors.text.secondary }}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline, isSyncing, lastSyncAt, sync } = useSyncStatus();
  const { t } = useTranslation();

  // State
  const [localStats, setLocalStats] = useState<LocalStats>({
    osHoje: 0,
    osAtrasadas: 0,
    orcamentos: 0,
    aReceber: 0,
    osConcluidasMes: 0,
  });
  const [financialData, setFinancialData] = useState<DashboardOverview | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [todayWorkOrders, setTodayWorkOrders] = useState<WorkOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('30days');

  // Calculate period dates
  const getPeriodDates = useCallback((period: PeriodFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate: Date;
    let endDate: Date = today;

    switch (period) {
      case 'today':
        startDate = today;
        break;
      case 'yesterday':
        startDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        endDate = startDate;
        break;
      case '7days':
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default:
        startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);

  // Load local dashboard data (SQLite - always available)
  const loadLocalData = useCallback(async () => {
    if (!user?.technicianId) return;

    try {
      const todayStr = getTodayLocalDate();

      // Parallel queries for better performance
      const [todayWOs, overdueResult, quotesCount, approvedQuotes, completedWOs] = await Promise.all([
        workOrderRepository.getByDay(user.technicianId, todayStr),
        workOrderRepository.list(user.technicianId, {
          status: ['SCHEDULED', 'IN_PROGRESS'],
          endDate: todayStr,
        }),
        QuoteRepository.count(user.technicianId),
        QuoteRepository.getByStatus(user.technicianId, 'APPROVED'),
        workOrderRepository.list(user.technicianId, { status: ['DONE'] }),
      ]);

      // Filter overdue (before today)
      const overdueWOs = overdueResult.items.filter((wo) => {
        const woDate = extractDatePart(wo.scheduledDate) || extractDatePart(wo.scheduledStartTime);
        return woDate && woDate < todayStr;
      });

      // Count completed this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const completedThisMonth = completedWOs.items.filter((wo) => {
        const completedDate = wo.completedAt ? extractDatePart(wo.completedAt) : null;
        return completedDate && completedDate >= monthStart;
      }).length;

      setLocalStats({
        osHoje: todayWOs.length,
        osAtrasadas: overdueWOs.length,
        orcamentos: quotesCount,
        aReceber: approvedQuotes.length,
        osConcluidasMes: completedThisMonth,
      });

      setTodayWorkOrders(todayWOs.slice(0, 5));
    } catch (error) {
      console.error('[HomeScreen] Error loading local data:', error);
    }
  }, [user?.technicianId]);

  // Load financial data (API with cache fallback)
  const loadFinancialData = useCallback(
    async (forceRefresh = false) => {
      setFinancialLoading(true);
      try {
        const { startDate, endDate } = getPeriodDates(selectedPeriod);
        const result = await DashboardService.getOverview('custom', {
          startDate,
          endDate,
          forceRefresh,
        });

        setFinancialData(result.data);
        setIsFromCache(result.fromCache);
        setCacheAge(result.cacheAge);
      } catch (error) {
        console.error('[HomeScreen] Error loading financial data:', error);
      } finally {
        setFinancialLoading(false);
      }
    },
    [selectedPeriod, getPeriodDates]
  );

  // Initial load
  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // Load financial data when period changes or online status changes
  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  // Pull to refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (isOnline) {
        await sync();
      }
      await Promise.all([loadLocalData(), loadFinancialData(true)]);
    } finally {
      setRefreshing(false);
    }
  };

  // Navigation handlers
  const navigateToOS = () => router.push('/(main)/os');
  const navigateToAgenda = () => router.push('/(main)/agenda');
  const navigateToOrcamentos = () => router.push('/orcamentos');
  const navigateToWorkOrder = (id: string) => router.push(`/os/${id}`);

  // Format time from ISO string
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'error' | 'primary' => {
    switch (status) {
      case 'SCHEDULED':
        return 'primary';
      case 'IN_PROGRESS':
        return 'warning';
      case 'DONE':
        return 'success';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'SCHEDULED':
        return t('workOrders.statuses.scheduled');
      case 'IN_PROGRESS':
        return t('workOrders.statuses.inProgress');
      case 'DONE':
        return t('workOrders.statuses.done');
      case 'CANCELLED':
        return t('workOrders.statuses.cancelled');
      default:
        return status;
    }
  };

  const showFinancialLoading = financialLoading && isOnline;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <AppHeader title={t('dashboard.title')} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Avatar name={user?.name} src={user?.avatarUrl} size="lg" />
          <View style={styles.welcomeText}>
            <Text variant="bodySmall" color="secondary">
              {t('dashboard.welcome')}
            </Text>
            <Text variant="h4">{user?.name || t('workOrders.technician')}</Text>
          </View>
        </View>

        {/* Period Filter */}
        <View style={styles.periodSection}>
          <View style={styles.periodHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary" style={{ marginLeft: 6 }}>
              {t('dashboard.period')}
            </Text>
          </View>
          <PeriodFilterBar selected={selectedPeriod} onSelect={setSelectedPeriod} />
        </View>

        {/* Offline/Cache Banner */}
        {!isOnline && financialData && isFromCache && (
          <View style={[styles.cacheBanner, { backgroundColor: colors.warning[100], borderColor: colors.warning[300] }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning[700]} />
            <Text variant="caption" style={{ color: colors.warning[700], marginLeft: spacing[2], flex: 1 }}>
              Você está offline. Dados financeiros {DashboardService.formatCacheAge(cacheAge)}.
            </Text>
          </View>
        )}
        {isOnline && isFromCache && cacheAge && cacheAge > 60000 && (
          <View style={[styles.cacheBanner, { backgroundColor: colors.info[50], borderColor: colors.info[200] }]}>
            <Ionicons name="time-outline" size={16} color={colors.info[600]} />
            <Text variant="caption" style={{ color: colors.info[600], marginLeft: spacing[2], flex: 1 }}>
              Dados do cache ({DashboardService.formatCacheAge(cacheAge)}). Puxe para atualizar.
            </Text>
          </View>
        )}

        {/* Financial Summary Cards (Web-style) */}
        <View style={styles.financialGrid}>
          <FinancialCard
            title={t('dashboard.totalRevenue')}
            value={formatCurrency(financialData?.totalExpected)}
            icon="cash-outline"
            iconBgColor={colors.primary[100]}
            iconColor={colors.primary[500]}
            loading={showFinancialLoading}
          />
          <FinancialCard
            title={t('dashboard.receivedRevenue')}
            value={formatCurrency(financialData?.received)}
            icon="checkmark-circle-outline"
            iconBgColor={colors.success[100]}
            iconColor={colors.success[500]}
            loading={showFinancialLoading}
          />
          <FinancialCard
            title={t('dashboard.pending')}
            value={formatCurrency(financialData?.pending)}
            icon="time-outline"
            iconBgColor={colors.warning[100]}
            iconColor={colors.warning[500]}
            loading={showFinancialLoading}
          />
          <FinancialCard
            title={t('dashboard.overdue')}
            value={formatCurrency(financialData?.overdue)}
            icon="alert-circle-outline"
            iconBgColor={colors.error[100]}
            iconColor={colors.error[500]}
            loading={showFinancialLoading}
          />
        </View>

        {/* Quick Stats Grid (Local data) */}
        <View style={styles.quickStatsGrid}>
          <QuickStatCard
            title={t('dashboard.workOrdersToday')}
            value={localStats.osHoje}
            icon="today"
            iconBgColor={colors.primary[100]}
            iconColor={colors.primary[500]}
            onPress={navigateToAgenda}
          />
          <QuickStatCard
            title={t('dashboard.overdueWorkOrders')}
            value={localStats.osAtrasadas}
            icon="alert-circle"
            iconBgColor={colors.error[100]}
            iconColor={colors.error[500]}
            onPress={navigateToOS}
          />
          <QuickStatCard
            title={t('dashboard.quotes')}
            value={localStats.orcamentos}
            icon="document-text"
            iconBgColor={colors.warning[100]}
            iconColor={colors.warning[500]}
            onPress={navigateToOrcamentos}
          />
          <QuickStatCard
            title={t('dashboard.toReceive')}
            value={localStats.aReceber}
            icon="cash"
            iconBgColor={colors.info[100]}
            iconColor={colors.info[500]}
            onPress={navigateToOrcamentos}
          />
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="h5">{t('dashboard.todaysAgenda')}</Text>
            <TouchableOpacity onPress={navigateToAgenda}>
              <Text variant="bodySmall" style={{ color: colors.primary[600] }}>
                {t('dashboard.viewAll')}
              </Text>
            </TouchableOpacity>
          </View>

          {todayWorkOrders.length === 0 ? (
            <Card variant="outlined" style={styles.scheduleCard}>
              <View style={styles.emptySchedule}>
                <Ionicons name="calendar-outline" size={32} color={colors.gray[400]} />
                <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
                  {t('dashboard.noEventsToday')}
                </Text>
                <TouchableOpacity onPress={navigateToOS} style={styles.emptyButton}>
                  <Text variant="bodySmall" style={{ color: colors.primary[600] }}>
                    {t('workOrders.viewAll')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          ) : (
            todayWorkOrders.map((wo) => (
              <TouchableOpacity key={wo.id} onPress={() => navigateToWorkOrder(wo.id)} activeOpacity={0.7}>
                <Card variant="outlined" style={styles.scheduleCard}>
                  <View style={styles.scheduleItem}>
                    <View style={[styles.scheduleTime, { backgroundColor: colors.primary[100] }]}>
                      <Text variant="caption" style={{ color: colors.primary[700] }}>
                        {formatTime(wo.scheduledDate)}
                      </Text>
                    </View>
                    <View style={styles.scheduleContent}>
                      <Text variant="body" numberOfLines={1}>
                        {wo.title}
                      </Text>
                      <Text variant="caption" color="secondary" numberOfLines={1}>
                        {wo.clientName || t('common.client')}
                        {wo.address ? ` - ${wo.address}` : ''}
                      </Text>
                    </View>
                    <Badge variant={getStatusVariant(wo.status)} size="sm">
                      {getStatusLabel(wo.status)}
                    </Badge>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Sync Status */}
        <Card variant="filled" style={styles.syncCard}>
          <View style={styles.syncContent}>
            <Ionicons name={isSyncing ? 'sync' : 'cloud-done'} size={20} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary" style={styles.syncText}>
              {isSyncing
                ? t('common.syncing')
                : lastSyncAt
                ? `${t('common.lastSync')}: ${new Date(lastSyncAt).toLocaleTimeString()}`
                : t('common.notSynced')}
            </Text>
          </View>
          <Button variant="ghost" size="sm" onPress={sync} disabled={isSyncing || !isOnline}>
            {t('common.sync')}
          </Button>
        </Card>
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
  scrollContent: {
    padding: spacing[4],
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  welcomeText: {
    marginLeft: spacing[3],
    flex: 1,
  },
  periodSection: {
    marginBottom: spacing[4],
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  periodFilterContainer: {
    gap: spacing[2],
  },
  periodChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  cacheBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  financialCardWrapper: {
    width: '47.5%',
  },
  financialCard: {
    padding: spacing[3],
  },
  financialCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  financialCardLeft: {
    flex: 1,
  },
  financialValue: {
    marginTop: 2,
  },
  financialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  quickStatCardWrapper: {
    width: '47.5%',
  },
  quickStatCard: {
    alignItems: 'center',
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[3],
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  quickStatValue: {
    marginBottom: spacing[1],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  scheduleCard: {
    marginBottom: spacing[2],
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleTime: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
    marginRight: spacing[3],
  },
  scheduleContent: {
    flex: 1,
  },
  syncCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    marginLeft: spacing[2],
  },
  emptySchedule: {
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  emptyButton: {
    marginTop: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
});
