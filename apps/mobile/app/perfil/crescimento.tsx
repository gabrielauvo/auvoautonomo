/**
 * Growth Dashboard Screen
 *
 * Tela de dashboard de crescimento - métricas do Google Meu Negócio
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import {
  GrowthService,
  DashboardData,
  DashboardPeriod,
  KpiCard as KpiCardType,
  GrowthInsight,
} from '../../src/services';

// =============================================================================
// TYPES
// =============================================================================

type Period = '7d' | '30d' | '90d';

// =============================================================================
// HELPERS
// =============================================================================

const getPeriodLabel = (period: Period): string => {
  const labels: Record<Period, string> = {
    '7d': '7 dias',
    '30d': '30 dias',
    '90d': '90 dias',
  };
  return labels[period];
};

const getTrendIcon = (trend: 'up' | 'down' | 'neutral'): string => {
  const icons: Record<string, string> = {
    up: 'trending-up',
    down: 'trending-down',
    neutral: 'remove',
  };
  return icons[trend] || 'remove';
};

const getInsightIcon = (severity: GrowthInsight['severity']): string => {
  const icons: Record<GrowthInsight['severity'], string> = {
    INFO: 'bulb-outline',
    WARNING: 'warning-outline',
    CRITICAL: 'alert-circle-outline',
    SUCCESS: 'checkmark-circle-outline',
  };
  return icons[severity];
};

const getChannelIcon = (icon: string): string => {
  const icons: Record<string, string> = {
    phone: 'call-outline',
    'message-circle': 'logo-whatsapp',
    'map-pin': 'navigate-outline',
    globe: 'globe-outline',
  };
  return icons[icon] || 'ellipse-outline';
};

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

function KpiCardComponent({
  kpi,
  icon,
  iconColor,
  colors,
  spacing,
}: {
  kpi: KpiCardType;
  icon: string;
  iconColor: string;
  colors: ReturnType<typeof useColors>;
  spacing: ReturnType<typeof useSpacing>;
}) {
  const trendColor =
    kpi.trend === 'up'
      ? colors.success[500]
      : kpi.trend === 'down'
        ? colors.error[500]
        : colors.gray[400];

  return (
    <Card style={[styles.kpiCard, { flex: 1 }]}>
      <View style={styles.kpiHeader}>
        <View style={[styles.kpiIcon, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
        </View>
        {kpi.change !== null && (
          <View style={styles.kpiTrend}>
            <Ionicons
              name={getTrendIcon(kpi.trend) as any}
              size={14}
              color={trendColor}
            />
            <Text
              variant="caption"
              style={{ color: trendColor, marginLeft: 2 }}
            >
              {Math.abs(kpi.change).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text variant="h4" weight="bold" style={{ marginTop: spacing[2] }}>
        {kpi.value.toLocaleString('pt-BR')}
      </Text>
      <Text variant="caption" color="secondary" numberOfLines={1}>
        {kpi.label}
      </Text>
    </Card>
  );
}

// =============================================================================
// INSIGHT CARD COMPONENT
// =============================================================================

function InsightCardComponent({
  insight,
  onDismiss,
  colors,
  spacing,
}: {
  insight: GrowthInsight;
  onDismiss: (id: string) => void;
  colors: ReturnType<typeof useColors>;
  spacing: ReturnType<typeof useSpacing>;
}) {
  const severityColors: Record<GrowthInsight['severity'], string> = {
    INFO: colors.primary[500],
    WARNING: colors.warning[500],
    CRITICAL: colors.error[500],
    SUCCESS: colors.success[500],
  };

  const bgColors: Record<GrowthInsight['severity'], string> = {
    INFO: colors.primary[50],
    WARNING: colors.warning[50],
    CRITICAL: colors.error[50],
    SUCCESS: colors.success[50],
  };

  return (
    <View
      style={[
        styles.insightCard,
        {
          backgroundColor: bgColors[insight.severity],
          borderLeftColor: severityColors[insight.severity],
        },
      ]}
    >
      <View style={styles.insightContent}>
        <Ionicons
          name={getInsightIcon(insight.severity) as any}
          size={20}
          color={severityColors[insight.severity]}
        />
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text variant="body" weight="semibold">
            {insight.title}
          </Text>
          <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
            {insight.description}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(insight.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// CHANNEL BREAKDOWN COMPONENT
// =============================================================================

function ChannelBreakdownComponent({
  channels,
  colors,
  spacing,
}: {
  channels: DashboardData['channelBreakdown'];
  colors: ReturnType<typeof useColors>;
  spacing: ReturnType<typeof useSpacing>;
}) {
  if (channels.length === 0) {
    return (
      <Card style={{ padding: spacing[4] }}>
        <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
          Canais
        </Text>
        <View style={styles.emptyChannels}>
          <Ionicons name="bar-chart-outline" size={32} color={colors.gray[300]} />
          <Text variant="caption" color="secondary" style={{ marginTop: spacing[2] }}>
            Sem dados de canais
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card style={{ padding: spacing[4] }}>
      <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
        Canais
      </Text>
      {channels.map((channel, index) => (
        <View
          key={channel.channel}
          style={[
            styles.channelItem,
            index < channels.length - 1 && { marginBottom: spacing[3] },
          ]}
        >
          <View style={styles.channelHeader}>
            <View style={[styles.channelIcon, { backgroundColor: `${channel.color}20` }]}>
              <Ionicons
                name={getChannelIcon(channel.icon) as any}
                size={16}
                color={channel.color}
              />
            </View>
            <Text variant="body" weight="medium" style={{ flex: 1, marginLeft: spacing[2] }}>
              {channel.channel}
            </Text>
            <Text variant="caption" color="secondary">
              {channel.clicks.toLocaleString('pt-BR')} ({channel.percentage}%)
            </Text>
          </View>
          <View style={[styles.channelBar, { backgroundColor: colors.gray[100] }]}>
            <View
              style={[
                styles.channelBarFill,
                {
                  width: `${channel.percentage}%`,
                  backgroundColor: channel.color,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function GrowthDashboardScreen() {
  const colors = useColors();
  const spacing = useSpacing();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<GrowthInsight[]>([]);
  const [period, setPeriod] = useState<Period>('30d');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    try {
      // Check connection status first
      const connected = await GrowthService.isGoogleConnected();
      setIsConnected(connected);

      if (!connected) {
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      // Load dashboard data
      const [dashboardData, insightsData] = await Promise.all([
        GrowthService.getDashboardData({ period }),
        GrowthService.getInsights(),
      ]);

      setDashboard(dashboardData);
      setInsights(insightsData.filter((i) => !i.isRead));
    } catch (error) {
      console.error('[Growth] Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDismissInsight = useCallback(async (id: string) => {
    await GrowthService.dismissInsight(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSync = useCallback(async () => {
    setIsRefreshing(true);
    await GrowthService.triggerSync();
    await loadData();
  }, [loadData]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">
            Crescimento
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            Carregando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not connected state
  if (isConnected === false) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">
            Crescimento
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary[100] }]}>
            <Ionicons name="analytics-outline" size={40} color={colors.primary[500]} />
          </View>
          <Text variant="h5" weight="semibold" style={{ marginTop: spacing[4] }}>
            Conecte o Google Meu Negócio
          </Text>
          <Text
            variant="body"
            color="secondary"
            align="center"
            style={{ marginTop: spacing[2], paddingHorizontal: spacing[6] }}
          >
            Para ver suas métricas de crescimento, conecte sua conta do Google Meu Negócio
            nas configurações pelo computador.
          </Text>
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: colors.primary[500] }]}
            onPress={() => {
              Linking.openURL('https://app.auvo.com.br/settings/integrations');
            }}
          >
            <Ionicons name="settings-outline" size={18} color="#FFF" />
            <Text variant="body" weight="semibold" style={{ color: '#FFF', marginLeft: spacing[2] }}>
              Abrir Configurações
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeInsights = insights.slice(0, 2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          Crescimento
        </Text>
        <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
          <Ionicons name="refresh-outline" size={22} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Period Selector */}
        <View style={[styles.periodSelector, { paddingHorizontal: spacing[4], paddingTop: spacing[4] }]}>
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodButton,
                {
                  backgroundColor: period === p ? colors.primary[500] : colors.gray[100],
                },
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text
                variant="caption"
                weight="semibold"
                style={{ color: period === p ? '#FFF' : colors.text.secondary }}
              >
                {getPeriodLabel(p)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insights */}
        {activeInsights.length > 0 && (
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
            {activeInsights.map((insight) => (
              <InsightCardComponent
                key={insight.id}
                insight={insight}
                onDismiss={handleDismissInsight}
                colors={colors}
                spacing={spacing}
              />
            ))}
          </View>
        )}

        {/* KPI Cards - Row 1 */}
        <View style={[styles.kpiRow, { paddingHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <KpiCardComponent
            kpi={
              dashboard?.summary.totalActions || {
                label: 'Total de Ações',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="trending-up-outline"
            iconColor={colors.primary[500]}
            colors={colors}
            spacing={spacing}
          />
          <View style={{ width: spacing[3] }} />
          <KpiCardComponent
            kpi={
              dashboard?.summary.calls || {
                label: 'Ligações',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="call-outline"
            iconColor={colors.success[500]}
            colors={colors}
            spacing={spacing}
          />
        </View>

        {/* KPI Cards - Row 2 */}
        <View style={[styles.kpiRow, { paddingHorizontal: spacing[4], marginTop: spacing[3] }]}>
          <KpiCardComponent
            kpi={
              dashboard?.summary.routes || {
                label: 'Rotas',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="navigate-outline"
            iconColor="#3B82F6"
            colors={colors}
            spacing={spacing}
          />
          <View style={{ width: spacing[3] }} />
          <KpiCardComponent
            kpi={
              dashboard?.summary.whatsappClicks || {
                label: 'WhatsApp',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="logo-whatsapp"
            iconColor="#25D366"
            colors={colors}
            spacing={spacing}
          />
        </View>

        {/* KPI Cards - Row 3 */}
        <View style={[styles.kpiRow, { paddingHorizontal: spacing[4], marginTop: spacing[3] }]}>
          <KpiCardComponent
            kpi={
              dashboard?.summary.websiteClicks || {
                label: 'Site',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="globe-outline"
            iconColor="#8B5CF6"
            colors={colors}
            spacing={spacing}
          />
          <View style={{ width: spacing[3] }} />
          <KpiCardComponent
            kpi={
              dashboard?.summary.profileViews || {
                label: 'Visualizações',
                value: 0,
                change: null,
                trend: 'neutral',
              }
            }
            icon="eye-outline"
            iconColor="#06B6D4"
            colors={colors}
            spacing={spacing}
          />
        </View>

        {/* Impressions Card */}
        <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[3] }}>
          <Card style={[styles.impressionsCard, { padding: spacing[4] }]}>
            <View style={styles.impressionsHeader}>
              <View style={[styles.kpiIcon, { backgroundColor: `${colors.warning[500]}20` }]}>
                <Ionicons name="search-outline" size={20} color={colors.warning[500]} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing[3] }}>
                <Text variant="body" color="secondary">
                  Impressões (Pesquisa + Maps)
                </Text>
                <Text variant="h4" weight="bold">
                  {(dashboard?.summary.impressions.value || 0).toLocaleString('pt-BR')}
                </Text>
              </View>
              {dashboard?.summary.impressions.change !== null && (
                <View style={styles.kpiTrend}>
                  <Ionicons
                    name={getTrendIcon(dashboard.summary.impressions.trend) as any}
                    size={16}
                    color={
                      dashboard.summary.impressions.trend === 'up'
                        ? colors.success[500]
                        : dashboard.summary.impressions.trend === 'down'
                          ? colors.error[500]
                          : colors.gray[400]
                    }
                  />
                  <Text
                    variant="body"
                    weight="semibold"
                    style={{
                      color:
                        dashboard.summary.impressions.trend === 'up'
                          ? colors.success[500]
                          : dashboard.summary.impressions.trend === 'down'
                            ? colors.error[500]
                            : colors.gray[400],
                      marginLeft: 4,
                    }}
                  >
                    {Math.abs(dashboard.summary.impressions.change).toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>
          </Card>
        </View>

        {/* Channel Breakdown */}
        <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
          <ChannelBreakdownComponent
            channels={dashboard?.channelBreakdown || []}
            colors={colors}
            spacing={spacing}
          />
        </View>

        {/* Last Sync Info */}
        {dashboard?.lastSyncAt && (
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[4] }}>
            <Text variant="caption" color="tertiary" align="center">
              Última sincronização:{' '}
              {new Date(dashboard.lastSyncAt).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  syncButton: {
    padding: 8,
    marginRight: -8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  insightCard: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  kpiRow: {
    flexDirection: 'row',
  },
  kpiCard: {
    padding: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impressionsCard: {},
  impressionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelItem: {},
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  channelIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  channelBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyChannels: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
});
