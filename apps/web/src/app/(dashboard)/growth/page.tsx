'use client';

/**
 * Growth Dashboard Page
 *
 * Dashboard de crescimento com métricas do Google Meu Negócio:
 * - KPIs de ações (ligações, rotas, cliques)
 * - Gráfico de série temporal
 * - Breakdown por canal
 * - Funil de conversão
 * - Insights automatizados
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/i18n';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Alert,
  EmptyState,
  Select,
} from '@/components/ui';
import {
  TrendingUp,
  TrendingDown,
  Phone,
  MapPin,
  Globe,
  MessageCircle,
  Eye,
  Search,
  RefreshCw,
  Settings,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  X,
  Check,
  Plug,
  Briefcase,
} from 'lucide-react';
import {
  useGrowthDashboard,
  useGrowthInsights,
  useTriggerMetricsSync,
  useDismissInsight,
  useGoogleBusinessStatus,
} from '@/hooks/use-integrations';
import { DashboardPeriod, KpiCard as KpiCardType, GrowthInsight } from '@/services/google-business.service';

// ============================================================================
// Components
// ============================================================================

function KpiCard({
  kpi,
  icon,
  iconBgColor = 'bg-primary-50',
  loading = false,
}: {
  kpi: KpiCardType;
  icon: React.ReactNode;
  iconBgColor?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : null;
  const trendColor = kpi.trend === 'up' ? 'text-success' : kpi.trend === 'down' ? 'text-error' : 'text-gray-500';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 ${iconBgColor} rounded-lg`}>
            {icon}
          </div>
          {kpi.change !== null && TrendIcon && (
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              <span>{Math.abs(kpi.change).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900">
            {kpi.value.toLocaleString('pt-BR')}
            {kpi.unit && <span className="text-sm font-normal text-gray-500 ml-1">{kpi.unit}</span>}
          </p>
          <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChannelBreakdownCard({
  channels,
  loading = false,
}: {
  channels: Array<{ channel: string; icon: string; clicks: number; percentage: number; color: string }>;
  loading?: boolean;
}) {
  const { t } = useTranslations('growth');

  const iconMap: Record<string, React.ReactNode> = {
    phone: <Phone className="h-5 w-5" />,
    'message-circle': <MessageCircle className="h-5 w-5" />,
    'map-pin': <MapPin className="h-5 w-5" />,
    globe: <Globe className="h-5 w-5" />,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('channelBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('channelBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title={t('noChannelData')}
            description={t('noChannelDataDescription')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('channelBreakdown')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {channels.map((channel) => (
            <div key={channel.channel} className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${channel.color}20` }}
              >
                <span style={{ color: channel.color }}>
                  {iconMap[channel.icon] || <Globe className="h-5 w-5" />}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{channel.channel}</span>
                  <span className="text-sm text-gray-500">
                    {channel.clicks.toLocaleString('pt-BR')} ({channel.percentage}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${channel.percentage}%`,
                      backgroundColor: channel.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionFunnelCard({
  funnel,
  loading = false,
}: {
  funnel: { stages: Array<{ stage: string; value: number; percentage: number; dropoff: number }>; overallConversionRate: number };
  loading?: boolean;
}) {
  const { t } = useTranslations('growth');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('conversionFunnel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('conversionFunnel')}</CardTitle>
          <Badge variant="info">
            {t('overallRate')}: {funnel.overallConversionRate.toFixed(2)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {funnel.stages.map((stage, index) => (
            <div key={stage.stage} className="relative">
              <div
                className="p-3 rounded-lg bg-gradient-to-r from-primary-50 to-transparent"
                style={{
                  width: `${Math.max(stage.percentage, 20)}%`,
                  minWidth: '120px',
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                  <span className="text-sm font-bold text-primary">
                    {stage.value.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              {index < funnel.stages.length - 1 && stage.dropoff > 0 && (
                <div className="absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2 px-2">
                  <span className="text-xs text-error">-{stage.dropoff}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: GrowthInsight;
  onDismiss: (id: string) => void;
}) {
  const severityColors = {
    INFO: 'border-l-blue-500 bg-blue-50',
    WARNING: 'border-l-warning bg-warning-50',
    CRITICAL: 'border-l-error bg-error-50',
    SUCCESS: 'border-l-success bg-success-50',
  };

  const severityIcons = {
    INFO: <Lightbulb className="h-5 w-5 text-blue-500" />,
    WARNING: <AlertCircle className="h-5 w-5 text-warning" />,
    CRITICAL: <AlertCircle className="h-5 w-5 text-error" />,
    SUCCESS: <Check className="h-5 w-5 text-success" />,
  };

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${severityColors[insight.severity]}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {severityIcons[insight.severity]}
          <div>
            <h4 className="font-medium text-gray-900">{insight.title}</h4>
            <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
            {insight.recommendations.length > 0 && (
              <ul className="mt-2 space-y-1">
                {insight.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    {rec}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          onClick={() => onDismiss(insight.id)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TimeSeriesChart({
  data,
  loading = false,
}: {
  data: Array<{
    date: string;
    calls: number;
    routes: number;
    websiteClicks: number;
    whatsappClicks: number;
    totalActions: number;
  }>;
  loading?: boolean;
}) {
  const { t } = useTranslations('growth');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('actionsOverTime')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('actionsOverTime')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<TrendingUp className="h-8 w-8" />}
            title={t('noTimeSeriesData')}
            description={t('noTimeSeriesDataDescription')}
          />
        </CardContent>
      </Card>
    );
  }

  // Simple bar chart using CSS
  const maxValue = Math.max(...data.map((d) => d.totalActions));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('actionsOverTime')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-48">
          {data.map((point, index) => (
            <div
              key={index}
              className="flex-1 flex flex-col items-center group"
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="w-full bg-primary rounded-t transition-all duration-300 group-hover:bg-primary-600"
                  style={{
                    height: `${maxValue > 0 ? (point.totalActions / maxValue) * 100 : 0}%`,
                    minHeight: point.totalActions > 0 ? '4px' : '0',
                  }}
                />
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {point.totalActions}
                </div>
              </div>
              {index % Math.ceil(data.length / 7) === 0 && (
                <span className="text-xs text-gray-500 mt-2 transform rotate-45 origin-left">
                  {new Date(point.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded" />
            <span className="text-gray-600">{t('totalActions')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function GrowthDashboardContent() {
  const { t } = useTranslations('growth');
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState<DashboardPeriod>('30d');

  // Queries
  const { data: googleStatus, isLoading: isLoadingStatus } = useGoogleBusinessStatus();
  const { data: dashboard, isLoading: isLoadingDashboard, refetch } = useGrowthDashboard({ period });
  const { data: insights, isLoading: isLoadingInsights } = useGrowthInsights();

  // Mutations
  const triggerSync = useTriggerMetricsSync();
  const dismissInsight = useDismissInsight();

  const isLoading = isLoadingDashboard || isLoadingStatus;
  const isConnected = googleStatus?.status === 'CONNECTED';

  const handleSync = async () => {
    await triggerSync.mutateAsync();
    refetch();
  };

  // If not connected to Google, show connection prompt
  if (!isLoadingStatus && !isConnected) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="page-header">
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">{t('subtitle')}</p>
          </div>

          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-4">
                  <Plug className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">{t('connectGoogle')}</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-4">{t('connectGoogleDescription')}</p>
                <Link href="/settings/integrations">
                  <Button leftIcon={<Settings className="h-4 w-4" />}>
                    {t('goToIntegrations')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const activeInsights = insights?.filter((i) => !i.isRead) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">
              {dashboard?.lastSyncAt ? (
                <>
                  {t('lastSync')}: {new Date(dashboard.lastSyncAt).toLocaleString('pt-BR')}
                </>
              ) : (
                t('subtitle')
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
              className="w-36"
            >
              <option value="7d">{t('last7days')}</option>
              <option value="30d">{t('last30days')}</option>
              <option value="90d">{t('last90days')}</option>
            </Select>
            <Button
              variant="outline"
              onClick={handleSync}
              loading={triggerSync.isPending}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              {t('sync')}
            </Button>
            <Link href="/google-business">
              <Button variant="primary" leftIcon={<Briefcase className="h-4 w-4" />}>
                {t('manageBusiness')}
              </Button>
            </Link>
            <Link href="/settings/integrations">
              <Button variant="ghost" leftIcon={<Settings className="h-4 w-4" />}>
                {t('settings')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Insights */}
        {activeInsights.length > 0 && (
          <div className="space-y-3">
            {activeInsights.slice(0, 3).map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={(id) => dismissInsight.mutate(id)}
              />
            ))}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            kpi={dashboard?.summary.totalActions || { label: t('totalActions'), value: 0, change: null, trend: 'neutral' }}
            icon={<TrendingUp className="h-6 w-6 text-primary" />}
            iconBgColor="bg-primary-50"
            loading={isLoading}
          />
          <KpiCard
            kpi={dashboard?.summary.calls || { label: t('calls'), value: 0, change: null, trend: 'neutral' }}
            icon={<Phone className="h-6 w-6 text-success" />}
            iconBgColor="bg-success-50"
            loading={isLoading}
          />
          <KpiCard
            kpi={dashboard?.summary.routes || { label: t('routes'), value: 0, change: null, trend: 'neutral' }}
            icon={<MapPin className="h-6 w-6 text-blue-500" />}
            iconBgColor="bg-blue-50"
            loading={isLoading}
          />
          <KpiCard
            kpi={dashboard?.summary.whatsappClicks || { label: t('whatsappClicks'), value: 0, change: null, trend: 'neutral' }}
            icon={<MessageCircle className="h-6 w-6 text-green-500" />}
            iconBgColor="bg-green-50"
            loading={isLoading}
          />
        </div>

        {/* Second row KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            kpi={dashboard?.summary.websiteClicks || { label: t('websiteClicks'), value: 0, change: null, trend: 'neutral' }}
            icon={<Globe className="h-6 w-6 text-purple-500" />}
            iconBgColor="bg-purple-50"
            loading={isLoading}
          />
          <KpiCard
            kpi={dashboard?.summary.profileViews || { label: t('profileViews'), value: 0, change: null, trend: 'neutral' }}
            icon={<Eye className="h-6 w-6 text-cyan-500" />}
            iconBgColor="bg-cyan-50"
            loading={isLoading}
          />
          <KpiCard
            kpi={dashboard?.summary.impressions || { label: t('impressions'), value: 0, change: null, trend: 'neutral' }}
            icon={<Search className="h-6 w-6 text-orange-500" />}
            iconBgColor="bg-orange-50"
            loading={isLoading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            data={dashboard?.timeSeries.data || []}
            loading={isLoading}
          />
          <ChannelBreakdownCard
            channels={dashboard?.channelBreakdown || []}
            loading={isLoading}
          />
        </div>

        {/* Conversion Funnel */}
        <ConversionFunnelCard
          funnel={dashboard?.conversionFunnel || { stages: [], overallConversionRate: 0 }}
          loading={isLoading}
        />
      </div>
    </AppLayout>
  );
}

export default function GrowthDashboardPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </AppLayout>
      }
    >
      <GrowthDashboardContent />
    </Suspense>
  );
}
