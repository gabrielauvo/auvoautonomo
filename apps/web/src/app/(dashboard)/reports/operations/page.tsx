'use client';

/**
 * Operations Report Page - Relatório Operacional
 *
 * Exibe métricas de ordens de serviço:
 * - Total de OS, concluídas, em andamento
 * - Tempo médio de conclusão
 * - Gráfico de OS por período
 * - Distribuição por status
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useOperationsReport, useReportFilters } from '@/hooks/use-reports';
import { reportsService } from '@/services/reports.service';
import {
  KpiCard,
  ReportFilterBar,
  TimeSeriesChart,
  BarChart,
  PieChart,
  ProFeatureOverlay,
} from '@/components/reports';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  Skeleton,
} from '@/components/ui';
import {
  Wrench,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  PlayCircle,
} from 'lucide-react';

/**
 * Mock data para demonstração
 */
const MOCK_OPERATIONS_DATA = {
  summary: {
    totalWorkOrders: 234,
    completedCount: 189,
    completionRate: 80.8,
    avgCompletionTime: 2.3,
    inProgressCount: 28,
    scheduledCount: 17,
  },
  workOrdersByPeriod: [
    { date: '2024-07', label: 'Jul', total: 52, completed: 45, inProgress: 5 },
    { date: '2024-08', label: 'Ago', total: 61, completed: 52, inProgress: 7 },
    { date: '2024-09', label: 'Set', total: 58, completed: 48, inProgress: 8 },
    { date: '2024-10', label: 'Out', total: 63, completed: 44, inProgress: 8 },
  ],
  workOrdersByStatus: [
    { name: 'completed', value: 189, color: '#10B981' },
    { name: 'inProgress', value: 28, color: '#F59E0B' },
    { name: 'scheduled', value: 17, color: '#3B82F6' },
  ],
  completionByPeriod: [
    { period: 'Jul', total: 52, completed: 45, rate: 86.5 },
    { period: 'Ago', total: 61, completed: 52, rate: 85.2 },
    { period: 'Set', total: 58, completed: 48, rate: 82.8 },
    { period: 'Out', total: 63, completed: 44, rate: 69.8 },
  ],
  avgTimeByMonth: [
    { month: 'Jul', avgDays: 1.8 },
    { month: 'Ago', avgDays: 2.1 },
    { month: 'Set', avgDays: 2.5 },
    { month: 'Out', avgDays: 2.8 },
  ],
};

/**
 * Operations Report Content - Componente interno
 */
function OperationsReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');

  const isPro = true;

  const { data, isLoading, error, refetch } = useOperationsReport(filters, isPro);

  // Usar dados reais ou mock
  const operationsData = data || MOCK_OPERATIONS_DATA;

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const blob = await reportsService.exportReport('operations', format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operations-report.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting:', err);
    }
  };

  // Prepare chart data
  const completionChartData = operationsData.completionByPeriod.map((item) => ({
    date: item.period,
    label: item.period,
    rate: item.rate,
  }));

  const avgTimeChartData = operationsData.avgTimeByMonth.map((item) => ({
    name: item.month,
    value: item.avgDays,
  }));

  // Translate status names for pie chart
  // Backend returns names in Portuguese ("Concluído", "Em Andamento", "Agendado")
  // But mock data uses English keys, so we translate them if needed
  const statusTranslations: Record<string, string> = {
    completed: t('completed'),
    inProgress: t('inProgress'),
    scheduled: t('scheduled'),
    DONE: t('completed'),
  };
  const translatedWorkOrdersByStatus = operationsData.workOrdersByStatus.map((item) => ({
    ...item,
    name: statusTranslations[item.name] || item.name,
  }));

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('totalWorkOrders')}
          value={operationsData.summary.totalWorkOrders}
          format="number"
          icon={<Wrench className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('completed')}
          value={operationsData.summary.completedCount}
          change={operationsData.summary.completionRate}
          changeLabel={t('completionRate')}
          format="number"
          icon={<CheckCircle className="h-6 w-6" />}
          iconBgColor="bg-success-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('inProgress')}
          value={operationsData.summary.inProgressCount}
          format="number"
          icon={<PlayCircle className="h-6 w-6" />}
          iconBgColor="bg-warning-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('scheduled')}
          value={operationsData.summary.scheduledCount}
          format="number"
          icon={<Calendar className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          loading={isLoading}
        />
      </div>

      {/* Tempo médio de conclusão */}
      {operationsData.summary.avgCompletionTime && (
        <Card className="border-info-200 bg-info-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm font-medium text-info-800">
                  {t('avgCompletionTime')}: <strong>{t('avgCompletionTimeDays', { days: operationsData.summary.avgCompletionTime })}</strong>
                </p>
                <p className="text-xs text-info-600">
                  {t('basedOnCompletedWO')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title={t('workOrdersByPeriod')}
          subtitle={t('monthlyEvolution')}
          data={operationsData.workOrdersByPeriod.map((item) => ({
            date: item.date,
            label: item.label,
            total: item.total,
            completed: item.completed,
          }))}
          series={[
            { key: 'total', name: t('total'), color: '#3B82F6', type: 'line' },
            { key: 'completed', name: t('completed'), color: '#10B981', type: 'area' },
          ]}
          height={300}
          loading={isLoading}
        />

        <PieChart
          title={t('distributionByStatus')}
          subtitle={t('currentWorkOrders')}
          data={translatedWorkOrdersByStatus}
          height={300}
          loading={isLoading}
          donut
          valueLabel={t('value')}
          totalLabel={t('total')}
        />
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title={t('completionRateEvolution')}
          subtitle={t('monthlyEvolution')}
          data={completionChartData}
          series={[
            { key: 'rate', name: `${t('completionRateEvolution')} (%)`, color: '#10B981', type: 'area' },
          ]}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => `${v}%`}
        />

        <BarChart
          title={t('avgCompletionTimeByMonth')}
          subtitle={t('daysByMonth')}
          data={avgTimeChartData}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => `${v} ${t('day')}`}
        />
      </div>

      {/* Productivity Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('productivityInsights')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-success-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-success-800">{t('efficiency')}</span>
                </div>
                <p className="text-2xl font-bold text-success-900">
                  {operationsData.summary.completionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-success-700">{t('completionRate')}</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">{t('speed')}</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {operationsData.summary.avgCompletionTime} {t('day')}
                </p>
                <p className="text-xs text-blue-700">{t('avgCompletionTime')}</p>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">{t('backlog')}</span>
                </div>
                <p className="text-2xl font-bold text-amber-900">
                  {operationsData.summary.inProgressCount + operationsData.summary.scheduledCount}
                </p>
                <p className="text-xs text-amber-700">{t('pendingWO')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <ReportFilterBar
        onRefresh={() => refetch()}
        onExport={isPro ? handleExport : undefined}
        showExport={isPro}
        isLoading={isLoading}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('errorLoadingOperationsReport')}
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title={t('detailedOperationsReportTitle')}
          description={t('detailedOperationsReportDescription')}
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Operations Report Page - Wrapper com Suspense
 */
export default function OperationsReportPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    }>
      <OperationsReportContent />
    </Suspense>
  );
}
