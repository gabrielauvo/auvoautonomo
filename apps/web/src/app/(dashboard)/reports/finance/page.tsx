'use client';

/**
 * Finance Report Page - Relatório Financeiro
 *
 * Exibe métricas financeiras detalhadas:
 * - Receita total, recebida, pendente, em atraso
 * - Gráfico de receita por período
 * - Distribuição por status
 * - Top clientes por receita
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useFinanceReport, useReportFilters } from '@/hooks/use-reports';
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
} from '@/components/ui';
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
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
 * Mock data para demonstração
 */
const MOCK_FINANCE_DATA = {
  summary: {
    totalRevenue: 125000,
    totalReceived: 98500,
    totalPending: 18500,
    totalOverdue: 8000,
    receivedRate: 78.8,
    overdueRate: 6.4,
  },
  revenueByPeriod: [
    { date: '2024-07', label: 'Jul', received: 32000, pending: 5000, overdue: 2000 },
    { date: '2024-08', label: 'Ago', received: 28000, pending: 8000, overdue: 1500 },
    { date: '2024-09', label: 'Set', received: 35000, pending: 4000, overdue: 3000 },
    { date: '2024-10', label: 'Out', received: 38500, pending: 6500, overdue: 1500 },
  ],
  revenueByStatus: [
    { name: 'Recebido', value: 98500, color: '#10B981' },
    { name: 'Pendente', value: 18500, color: '#F59E0B' },
    { name: 'Em Atraso', value: 8000, color: '#EF4444' },
  ],
  topClients: [
    { clientId: '1', clientName: 'Empresa ABC Ltda', totalRevenue: 25000, chargesCount: 12 },
    { clientId: '2', clientName: 'Tech Solutions', totalRevenue: 18500, chargesCount: 8 },
    { clientId: '3', clientName: 'Comércio XYZ', totalRevenue: 15200, chargesCount: 15 },
    { clientId: '4', clientName: 'Indústria Beta', totalRevenue: 12800, chargesCount: 6 },
    { clientId: '5', clientName: 'Serviços Omega', totalRevenue: 9800, chargesCount: 10 },
  ],
  chargesByPaymentMethod: [
    { name: 'PIX', value: 45000 },
    { name: 'Boleto', value: 38000 },
    { name: 'Cartão', value: 25000 },
    { name: 'Dinheiro', value: 17000 },
  ],
};

/**
 * Finance Report Content - Componente interno
 */
function FinanceReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');

  const isPro = true;

  const { data, isLoading, error, refetch } = useFinanceReport(filters, isPro);

  // Usar dados reais ou mock
  const financeData = data || MOCK_FINANCE_DATA;

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const blob = await reportsService.exportReport('finance', format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-financeiro.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('totalRevenue')}
          value={financeData.summary.totalRevenue}
          format="currency"
          icon={<DollarSign className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('totalReceived')}
          value={financeData.summary.totalReceived}
          change={financeData.summary.receivedRate}
          changeLabel={t('ofTotal')}
          format="currency"
          icon={<CheckCircle className="h-6 w-6" />}
          iconBgColor="bg-success-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('totalPending')}
          value={financeData.summary.totalPending}
          format="currency"
          icon={<Clock className="h-6 w-6" />}
          iconBgColor="bg-warning-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('totalOverdue')}
          value={financeData.summary.totalOverdue}
          change={-financeData.summary.overdueRate}
          changeLabel={t('ofTotal')}
          format="currency"
          icon={<AlertCircle className="h-6 w-6" />}
          iconBgColor="bg-error-50"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title={t('revenueByPeriod')}
          subtitle={t('monthlyEvolution')}
          data={financeData.revenueByPeriod}
          series={[
            { key: 'received', name: t('received'), color: '#10B981', type: 'area' },
            { key: 'pending', name: t('pending'), color: '#F59E0B', type: 'line' },
            { key: 'overdue', name: t('overdue'), color: '#EF4444', type: 'line' },
          ]}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => formatCurrency(v)}
        />

        <PieChart
          title={t('revenueByStatus')}
          subtitle={t('currentRevenue')}
          data={financeData.revenueByStatus}
          height={300}
          loading={isLoading}
          donut
          formatValue={formatCurrency}
        />
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChart
          title={t('byPaymentMethod')}
          subtitle={t('distribution')}
          data={financeData.chargesByPaymentMethod}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => formatCurrency(v)}
        />

        {/* Top Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('topClients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('client')}</TableHead>
                    <TableHead className="text-right">{t('charges')}</TableHead>
                    <TableHead className="text-right">{t('revenue')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financeData.topClients.map((client, index) => (
                    <TableRow key={client.clientId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{client.clientName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-500">
                        {client.chargesCount}
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {formatCurrency(client.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
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

      {/* Error Alert - only show for PRO users since FREE users see mock data */}
      {error && isPro && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('errorLoadingFinanceReport')}
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title={t('detailedFinanceReportTitle')}
          description={t('detailedFinanceReportDescription')}
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Finance Report Page - Wrapper com Suspense
 */
export default function FinanceReportPage() {
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
      <FinanceReportContent />
    </Suspense>
  );
}
