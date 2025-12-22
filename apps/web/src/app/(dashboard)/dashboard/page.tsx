'use client';

/**
 * Dashboard Page - Página principal do dashboard
 *
 * Exibe:
 * - Filtro de período
 * - Cards de métricas (orçamentos, OS, receita, ticket médio)
 * - Gráfico de receita
 * - Uso do plano (se FREE)
 * - Boas-vindas ao usuário
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useAnalyticsOverview, useRevenueByPeriod } from '@/hooks/use-analytics';
import { useExpenseSummary } from '@/hooks/use-expenses';
import { useReportFilters } from '@/hooks/use-reports';
import { AppLayout } from '@/components/layout';
import {
  KpiCard,
  ReportFilterBar,
  TimeSeriesChart,
} from '@/components/reports';
import {
  Card,
  CardContent,
  DashboardCard,
  Badge,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/ui';
import {
  FileText,
  Wrench,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Receipt,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  MinusCircle,
} from 'lucide-react';

/**
 * Formatar valor em moeda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Dashboard Content - Componente interno que usa useSearchParams
 */
function DashboardContent() {
  const { t } = useTranslations('dashboard');
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { user, billing } = useAuth();

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

  const revenueChartData = revenueData?.map((item) => ({
    date: item.period,
    label: item.period,
    received: item.received,
    pending: item.pending,
    overdue: item.overdue,
  })) || [];

  // Ticket médio vem calculado do backend (received / paidCount)
  const avgTicket = analytics?.revenue.averageTicket || 0;

  // Cálculos de Receita vs Despesa
  const totalRevenue = analytics?.revenue.received || 0;
  const totalExpenses = expenseSummary?.paid.amount || 0;
  const netResult = totalRevenue - totalExpenses;
  const pendingExpenses = expenseSummary?.pending.amount || 0;
  const overdueExpenses = expenseSummary?.overdue.amount || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header da página */}
        <div className="page-header">
          <h1 className="page-title">
            {t('welcome', { name: user?.name?.split(' ')[0] || t('user') })}
          </h1>
          <p className="page-subtitle">
            {t('subtitle')}
          </p>
        </div>

        {/* Filtro de Período */}
        <ReportFilterBar
          onRefresh={() => refetch()}
          showExport={false}
          isLoading={isLoading}
        />

        {/* Alerta de erro */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('errorLoading')}
            </div>
          </Alert>
        )}

        {/* Alerta de limite (se FREE) */}
        {billing?.planKey === 'FREE' && billing.usage && (
          <Card className="border-warning-200 bg-warning-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning-800">
                    {t('freePlan')}
                  </p>
                  <p className="text-xs text-warning-700 mt-1">
                    {t('usageMessage', { current: billing.usage?.clientsCount ?? 0, max: billing.limits?.maxClients ?? 0 })}
                    {' '}
                    <a href="/settings/plan" className="underline font-medium">
                      {t('upgradeLink')}
                    </a>
                    {' '}{t('unlimitedFeatures')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de estatísticas - Linha 1: Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title={t('totalRevenue')}
            value={analytics?.revenue.total || 0}
            format="currency"
            icon={<DollarSign className="h-6 w-6" />}
            loading={isLoading}
          />
          <KpiCard
            title={t('receivedRevenue')}
            value={analytics?.revenue.received || 0}
            change={analytics?.revenue.receivedRate}
            changeLabel={t('ofTotal')}
            format="currency"
            icon={<CheckCircle className="h-6 w-6" />}
            iconBgColor="bg-success-50"
            loading={isLoading}
          />
          <KpiCard
            title={t('pending')}
            value={analytics?.revenue.pending || 0}
            format="currency"
            icon={<Clock className="h-6 w-6" />}
            iconBgColor="bg-warning-50"
            loading={isLoading}
          />
          <KpiCard
            title={t('overdue')}
            value={analytics?.revenue.overdue || 0}
            change={analytics?.revenue.overdueRate ? -analytics.revenue.overdueRate : undefined}
            changeLabel={t('ofTotal')}
            format="currency"
            icon={<AlertCircle className="h-6 w-6" />}
            iconBgColor="bg-error-50"
            loading={isLoading}
          />
        </div>

        {/* Cards de estatísticas - Linha 2: Operacional */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title={t('quotes')}
            value={analytics?.quotes.total || 0}
            change={analytics?.quotes.conversionRate}
            changeLabel={t('conversion')}
            format="number"
            icon={<FileText className="h-6 w-6" />}
            loading={isLoading}
          />
          <KpiCard
            title={t('completedWorkOrders')}
            value={analytics?.workOrders.completed || 0}
            change={analytics?.workOrders.completionRate}
            changeLabel={t('completion')}
            format="number"
            icon={<Wrench className="h-6 w-6" />}
            iconBgColor="bg-blue-50"
            loading={isLoading}
          />
          <KpiCard
            title={t('activeClients')}
            value={analytics?.clients.active || 0}
            format="number"
            icon={<Users className="h-6 w-6" />}
            iconBgColor="bg-purple-50"
            loading={isLoading}
          />
          <KpiCard
            title={t('avgTicket')}
            value={avgTicket}
            format="currency"
            icon={<Receipt className="h-6 w-6" />}
            iconBgColor="bg-cyan-50"
            loading={isLoading}
          />
        </div>

        {/* Gráfico de Receita + Resumo Financeiro */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {revenueChartData.length > 0 || isLoadingRevenue ? (
              <TimeSeriesChart
                title={t('revenueByPeriod')}
                subtitle={t('monthlyEvolution')}
                data={revenueChartData}
                series={[
                  { key: 'received', name: t('received'), color: '#10B981', type: 'area' },
                  { key: 'pending', name: t('pending'), color: '#F59E0B', type: 'line' },
                  { key: 'overdue', name: t('overdue'), color: '#EF4444', type: 'line' },
                ]}
                height={300}
                loading={isLoadingRevenue}
                formatYAxis={(v) => formatCurrency(v)}
              />
            ) : (
              <Card>
                <CardContent className="py-12">
                  <EmptyState
                    icon={<BarChart3 className="h-12 w-12" />}
                    title={t('noRevenueData')}
                    description={t('noDataForPeriod')}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <DashboardCard
            title={t('financialSummary')}
            subtitle={t('overview')}
          >
            {isLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-gray-600">{t('received')}</span>
                  </div>
                  <span className="text-sm font-medium text-success">
                    {formatCurrency(analytics?.revenue.received || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-sm text-gray-600">{t('pending')}</span>
                  </div>
                  <span className="text-sm font-medium text-warning">
                    {formatCurrency(analytics?.revenue.pending || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-error" />
                    <span className="text-sm text-gray-600">{t('late')}</span>
                  </div>
                  <span className="text-sm font-medium text-error">
                    {formatCurrency(analytics?.revenue.overdue || 0)}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{t('total')}</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(analytics?.revenue.total || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Receita vs Despesa - Resultado Líquido */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card de Receita vs Despesa */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('revenueVsExpenses')}</h3>
                  <p className="text-sm text-gray-500">{t('periodComparison')}</p>
                </div>
                <Wallet className="h-8 w-8 text-primary" />
              </div>

              {isLoading || isLoadingExpenses ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Receita */}
                  <div className="flex items-center justify-between p-4 bg-success-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-success-100 rounded-lg">
                        <ArrowUpRight className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{t('receivedRevenue')}</p>
                        <p className="text-lg font-bold text-success">{formatCurrency(totalRevenue)}</p>
                      </div>
                    </div>
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>

                  {/* Despesas */}
                  <div className="flex items-center justify-between p-4 bg-error-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-error-100 rounded-lg">
                        <ArrowDownRight className="h-5 w-5 text-error" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{t('paidExpenses')}</p>
                        <p className="text-lg font-bold text-error">{formatCurrency(totalExpenses)}</p>
                      </div>
                    </div>
                    <TrendingDown className="h-6 w-6 text-error" />
                  </div>

                  {/* Resultado Líquido */}
                  <div className={`p-4 rounded-lg border-2 ${netResult >= 0 ? 'border-success bg-success-50' : 'border-error bg-error-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{t('netResult')}</p>
                        <p className={`text-2xl font-bold ${netResult >= 0 ? 'text-success' : 'text-error'}`}>
                          {formatCurrency(netResult)}
                        </p>
                      </div>
                      {netResult >= 0 ? (
                        <TrendingUp className="h-8 w-8 text-success" />
                      ) : (
                        <TrendingDown className="h-8 w-8 text-error" />
                      )}
                    </div>
                    {netResult >= 0 ? (
                      <p className="text-xs text-success mt-2">{t('positiveResult')}</p>
                    ) : (
                      <p className="text-xs text-error mt-2">{t('negativeResult')}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card de Resumo de Despesas */}
          <DashboardCard
            title={t('expensesSummary')}
            subtitle={t('expensesOverview')}
          >
            {isLoadingExpenses ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-gray-600">{t('paid')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-success">
                      {formatCurrency(expenseSummary?.paid.amount || 0)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({expenseSummary?.paid.count || 0})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-sm text-gray-600">{t('pendingExpenses')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-warning">
                      {formatCurrency(pendingExpenses)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({expenseSummary?.pending.count || 0})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-error" />
                    <span className="text-sm text-gray-600">{t('overdueExpenses')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-error">
                      {formatCurrency(overdueExpenses)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({expenseSummary?.overdue.count || 0})
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{t('totalExpenses')}</span>
                    <span className="text-base font-bold text-gray-900">
                      {formatCurrency(expenseSummary?.total.amount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Status dos Orçamentos e OS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DashboardCard
            title={t('quotesStatus')}
            subtitle={t('currentDistribution')}
          >
            {isLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : Object.keys(analytics?.quotes.byStatus || {}).length > 0 ? (
              <div className="space-y-3 py-2">
                {Object.entries(analytics?.quotes.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge
                      variant={
                        status === 'APPROVED' ? 'success' :
                        status === 'REJECTED' ? 'error' :
                        status === 'SENT' ? 'info' :
                        status === 'EXPIRED' ? 'warning' :
                        'default'
                      }
                      size="sm"
                    >
                      {status === 'DRAFT' && t('draft')}
                      {status === 'SENT' && t('sent')}
                      {status === 'APPROVED' && t('approved')}
                      {status === 'REJECTED' && t('rejected')}
                      {status === 'EXPIRED' && t('expired')}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('noQuotes')}
                description={t('noQuotesInPeriod')}
              />
            )}
          </DashboardCard>

          <DashboardCard
            title={t('workOrdersStatus')}
            subtitle={t('currentDistribution')}
          >
            {isLoading ? (
              <div className="space-y-3 py-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : Object.keys(analytics?.workOrders.byStatus || {}).length > 0 ? (
              <div className="space-y-3 py-2">
                {Object.entries(analytics?.workOrders.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge
                      variant={
                        status === 'DONE' ? 'success' :
                        status === 'IN_PROGRESS' ? 'warning' :
                        status === 'CANCELED' ? 'error' :
                        'info'
                      }
                      size="sm"
                    >
                      {status === 'SCHEDULED' && t('scheduled')}
                      {status === 'IN_PROGRESS' && t('inProgress')}
                      {status === 'DONE' && t('done')}
                      {status === 'CANCELED' && t('canceled')}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={t('noWorkOrders')}
                description={t('noWorkOrdersInPeriod')}
              />
            )}
          </DashboardCard>
        </div>

        {/* Inadimplência */}
        {analytics?.clients.withOverdue && analytics.clients.withOverdue > 0 && (
          <Alert variant="warning">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                {t('overdueClientsMessage', { count: analytics.clients.withOverdue })}
                {' '}
                <a href="/billing/charges?status=OVERDUE" className="underline font-medium">
                  {t('viewDetails')}
                </a>
              </span>
            </div>
          </Alert>
        )}
      </div>
    </AppLayout>
  );
}

/**
 * Dashboard Page - Wrapper com Suspense para useSearchParams
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    }>
      <DashboardContent />
    </Suspense>
  );
}
