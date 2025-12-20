'use client';

/**
 * Reports Overview Page - Visão Geral dos Relatórios
 *
 * Exibe resumo de todos os relatórios com KPIs principais
 * e links para relatórios detalhados
 */

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useAnalyticsOverview, useRevenueByPeriod } from '@/hooks/use-analytics';
import { useReportFilters } from '@/hooks/use-reports';
import {
  KpiCard,
  ReportFilterBar,
  TimeSeriesChart,
  ProFeatureOverlay,
} from '@/components/reports';
import { Card, CardHeader, CardTitle, CardContent, Alert, Button } from '@/components/ui';
import {
  DollarSign,
  FileText,
  Wrench,
  Users,
  TrendingUp,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

/**
 * Formatar valor em moeda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ReportsOverviewPage() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');

  const isPro = billing?.planKey !== 'FREE';

  const { data: analytics, isLoading, error, refetch } = useAnalyticsOverview({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  const { data: revenueData, isLoading: isLoadingRevenue } = useRevenueByPeriod({
    startDate: filters.startDate,
    endDate: filters.endDate,
    groupBy: 'month',
  });

  const revenueChartData = revenueData?.map((item) => ({
    date: item.period,
    label: item.period,
    received: item.received,
    pending: item.pending,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <ReportFilterBar
        onRefresh={() => refetch()}
        showExport={false}
        isLoading={isLoading}
      />

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('errorLoadingData')}
          </div>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('totalRevenue')}
          value={analytics?.revenue.total || 0}
          change={12.5}
          format="currency"
          icon={<DollarSign className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('quotes')}
          value={analytics?.quotes.total || 0}
          change={analytics?.quotes.conversionRate}
          changeLabel={t('conversionRate')}
          format="number"
          icon={<FileText className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('completedWorkOrders')}
          value={analytics?.workOrders.completed || 0}
          change={analytics?.workOrders.completionRate}
          changeLabel={t('completionRate')}
          format="number"
          icon={<Wrench className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('activeClients')}
          value={analytics?.clients.active || 0}
          format="number"
          icon={<Users className="h-6 w-6" />}
          loading={isLoading}
        />
      </div>

      {/* Revenue Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isPro ? (
          <TimeSeriesChart
            title={t('revenueByPeriod')}
            subtitle={t('recentMonths')}
            data={revenueChartData}
            series={[
              { key: 'received', name: t('received'), color: '#10B981', type: 'area' },
              { key: 'pending', name: t('pending'), color: '#F59E0B', type: 'line' },
            ]}
            height={300}
            loading={isLoadingRevenue}
            formatYAxis={formatCurrency}
          />
        ) : (
          <ProFeatureOverlay
            title={t('advancedChartsTitle')}
            description={t('advancedChartsDescription')}
          >
            <TimeSeriesChart
              title={t('revenueByPeriod')}
              subtitle={t('recentMonths')}
              data={[
                { date: '2024-01', label: 'Jan', received: 45000, pending: 12000 },
                { date: '2024-02', label: 'Fev', received: 52000, pending: 8000 },
                { date: '2024-03', label: 'Mar', received: 48000, pending: 15000 },
              ]}
              series={[
                { key: 'received', name: t('received'), color: '#10B981', type: 'area' },
                { key: 'pending', name: t('pending'), color: '#F59E0B', type: 'line' },
              ]}
              height={300}
            />
          </ProFeatureOverlay>
        )}

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('detailedReports')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href="/reports/finance"
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('finance')}</p>
                  <p className="text-xs text-gray-500">{t('financeDescription')}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/reports/sales"
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('sales')}</p>
                  <p className="text-xs text-gray-500">{t('salesDescription')}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/reports/operations"
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('operations')}</p>
                  <p className="text-xs text-gray-500">{t('operationsDescription')}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
            </Link>

            <Link
              href="/reports/clients"
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('clients')}</p>
                  <p className="text-xs text-gray-500">{t('clientsDescription')}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* PLG Banner for FREE users */}
      {!isPro && (
        <Card className="border-primary-200 bg-gradient-to-r from-primary-50 to-blue-50">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-full">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {t('unlockAdvancedReports')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('unlockAdvancedReportsDescription')}
                  </p>
                </div>
              </div>
              <a href="/settings/plan">
                <Button>{t('viewPlans')}</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
