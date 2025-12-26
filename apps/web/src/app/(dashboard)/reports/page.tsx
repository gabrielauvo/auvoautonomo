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
import { useFormatting } from '@/context/company-settings-context';
import { useAnalyticsOverview, useRevenueByPeriod } from '@/hooks/use-analytics';
import { useExpenseSummary } from '@/hooks/use-expenses';
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
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Receipt,
  Wallet,
  MinusCircle,
} from 'lucide-react';

export default function ReportsOverviewPage() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');
  const { formatCurrency } = useFormatting();

  const isPro = true;

  const { data: analytics, isLoading, error, refetch } = useAnalyticsOverview({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  const { data: revenueData, isLoading: isLoadingRevenue } = useRevenueByPeriod({
    startDate: filters.startDate,
    endDate: filters.endDate,
    groupBy: 'month',
  });

  const { data: expenseSummary, isLoading: isLoadingExpenses } = useExpenseSummary({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  // Financial calculations
  const totalRevenue = analytics?.revenue.received || 0;
  const totalExpenses = expenseSummary?.paid.amount || 0;
  const netResult = totalRevenue - totalExpenses;
  const pendingExpenses = expenseSummary?.pending.amount || 0;
  const overdueExpenses = expenseSummary?.overdue.amount || 0;
  const profitMargin = totalRevenue > 0 ? (netResult / totalRevenue) * 100 : 0;

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title={t('totalRevenue')}
          value={analytics?.revenue.total || 0}
          change={12.5}
          format="currency"
          icon={<DollarSign className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('totalExpenses')}
          value={expenseSummary?.total.amount || 0}
          format="currency"
          icon={<Wallet className="h-6 w-6" />}
          loading={isLoadingExpenses}
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

      {/* Revenue vs Expenses Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue vs Expenses Comparison Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('revenueVsExpenses')}
            </CardTitle>
            <p className="text-sm text-gray-500">{t('periodComparison')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Revenue Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">{t('receivedRevenue')}</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totalRevenue > 0 ? 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* Expenses Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">{t('paidExpenses')}</span>
                </div>
                <span className="text-sm font-semibold text-red-600">{formatCurrency(totalExpenses)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* Net Result */}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {netResult >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-900">{t('netResult')}</span>
                </div>
                <span className={`text-lg font-bold ${netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netResult)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {netResult >= 0 ? t('positiveResult') : t('negativeResult')}
                {totalRevenue > 0 && ` (${profitMargin.toFixed(1)}% ${t('profitMargin')})`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {t('expensesSummary')}
            </CardTitle>
            <p className="text-sm text-gray-500">{t('expensesOverview')}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Paid */}
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-gray-600">{t('paid')}</span>
                </div>
                <p className="text-lg font-semibold text-green-700">
                  {formatCurrency(expenseSummary?.paid.amount || 0)}
                </p>
                <p className="text-xs text-gray-500">
                  {expenseSummary?.paid.count || 0} {t('items')}
                </p>
              </div>

              {/* Pending */}
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-xs text-gray-600">{t('pendingExpenses')}</span>
                </div>
                <p className="text-lg font-semibold text-yellow-700">
                  {formatCurrency(pendingExpenses)}
                </p>
                <p className="text-xs text-gray-500">
                  {expenseSummary?.pending.count || 0} {t('items')}
                </p>
              </div>

              {/* Overdue */}
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-gray-600">{t('overdueExpenses')}</span>
                </div>
                <p className="text-lg font-semibold text-red-700">
                  {formatCurrency(overdueExpenses)}
                </p>
                <p className="text-xs text-gray-500">
                  {expenseSummary?.overdue.count || 0} {t('items')}
                </p>
              </div>

              {/* Total */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-xs text-gray-600">{t('totalExpenses')}</span>
                </div>
                <p className="text-lg font-semibold text-gray-700">
                  {formatCurrency(expenseSummary?.total.amount || 0)}
                </p>
                <p className="text-xs text-gray-500">
                  {expenseSummary?.total.count || 0} {t('items')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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

            <Link
              href="/reports/profit-loss"
              className="flex items-center justify-between p-3 rounded-lg border hover:border-primary hover:bg-primary-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{t('profitLoss')}</p>
                  <p className="text-xs text-gray-500">{t('profitLossDescription')}</p>
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
