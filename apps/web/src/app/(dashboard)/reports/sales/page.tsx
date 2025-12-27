'use client';

/**
 * Sales Report Page - Relatório de Vendas
 *
 * Exibe métricas de vendas/orçamentos:
 * - Total de orçamentos, valor, conversão
 * - Gráfico de orçamentos por período
 * - Taxa de conversão por período
 * - Top serviços vendidos
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useFormatting } from '@/context/company-settings-context';
import { useSalesReport, useReportFilters } from '@/hooks/use-reports';
import { reportsService } from '@/services/reports.service';
import {
  KpiCard,
  ReportFilterBar,
  TimeSeriesChart,
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
  Badge,
} from '@/components/ui';
import {
  FileText,
  TrendingUp,
  Target,
  Clock,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

/**
 * Mock data para demonstração
 */
const MOCK_SALES_DATA = {
  summary: {
    totalQuotes: 156,
    totalValue: 285000,
    approvedCount: 89,
    approvedValue: 178500,
    conversionRate: 57.1,
    avgTicket: 2005,
    avgTimeToApproval: 3.5,
  },
  quotesByPeriod: [
    { date: '2024-07', label: 'Jul', total: 35, approved: 18, value: 65000 },
    { date: '2024-08', label: 'Ago', total: 42, approved: 25, value: 72000 },
    { date: '2024-09', label: 'Set', total: 38, approved: 22, value: 68000 },
    { date: '2024-10', label: 'Out', total: 41, approved: 24, value: 80000 },
  ],
  quotesByStatus: [
    { name: 'approved', value: 89, color: '#10B981' },
    { name: 'pending', value: 32, color: '#F59E0B' },
    { name: 'rejected', value: 28, color: '#EF4444' },
    { name: 'expired', value: 7, color: '#6B7280' },
  ],
  conversionByPeriod: [
    { period: 'Jul', total: 35, approved: 18, rate: 51.4 },
    { period: 'Ago', total: 42, approved: 25, rate: 59.5 },
    { period: 'Set', total: 38, approved: 22, rate: 57.9 },
    { period: 'Out', total: 41, approved: 24, rate: 58.5 },
  ],
  topServices: [
    { serviceName: 'Manutenção Preventiva', count: 45, totalValue: 67500 },
    { serviceName: 'Instalação de Equipamentos', count: 32, totalValue: 96000 },
    { serviceName: 'Reparo de Emergência', count: 28, totalValue: 42000 },
    { serviceName: 'Consultoria Técnica', count: 18, totalValue: 36000 },
    { serviceName: 'Treinamento', count: 12, totalValue: 18000 },
  ],
};

/**
 * Sales Report Content - Componente interno
 */
function SalesReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');
  const { formatCurrency } = useFormatting();

  const isPro = true;

  const { data, isLoading, error, refetch } = useSalesReport(filters, isPro);

  // Usar dados reais ou mock
  const salesData = data || MOCK_SALES_DATA;

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const blob = await reportsService.exportReport('sales', format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting:', err);
    }
  };

  // Prepare conversion chart data
  const conversionChartData = salesData.conversionByPeriod.map((item) => ({
    date: item.period,
    label: item.period,
    rate: item.rate,
    total: item.total,
    approved: item.approved,
  }));

  // Translate status names for pie chart
  // Backend returns names in Portuguese ("Rascunho", "Enviado", "Aprovado", etc.)
  // Mock data uses English keys, so we handle both cases
  const statusTranslations: Record<string, string> = {
    // English keys (mock data)
    approved: t('approved'),
    pending: t('pending'),
    rejected: t('rejected'),
    expired: t('expired'),
    draft: t('draft'),
    sent: t('sent'),
    // Portuguese keys (backend data)
    Aprovado: t('approved'),
    Pendente: t('pending'),
    Recusado: t('rejected'),
    Expirado: t('expired'),
    Rascunho: t('draft'),
    Enviado: t('sent'),
  };
  const translatedQuotesByStatus = salesData.quotesByStatus.map((item) => ({
    ...item,
    name: statusTranslations[item.name] || item.name,
  }));

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('totalQuotes')}
          value={salesData.summary.totalQuotes}
          format="number"
          icon={<FileText className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('totalValue')}
          value={salesData.summary.totalValue}
          format="currency"
          icon={<DollarSign className="h-6 w-6" />}
          iconBgColor="bg-green-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('conversionRateEvolution')}
          value={salesData.summary.conversionRate}
          format="percent"
          icon={<Target className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('avgTicket')}
          value={salesData.summary.avgTicket}
          format="currency"
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-purple-50"
          loading={isLoading}
        />
      </div>

      {/* Tempo médio para aprovação */}
      {salesData.summary.avgTimeToApproval && (
        <Card className="border-info-200 bg-info-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-info" />
              <div>
                <p className="text-sm font-medium text-info-800">
                  {t('avgTimeToApproval')}: <strong>{t('avgTimeToApprovalDays', { days: salesData.summary.avgTimeToApproval })}</strong>
                </p>
                <p className="text-xs text-info-600">
                  {t('basedOnApprovedQuotes')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title={t('quotesByPeriod')}
          subtitle={t('monthlyEvolution')}
          data={salesData.quotesByPeriod.map((item) => ({
            date: item.date,
            label: item.label,
            total: item.total,
            approved: item.approved,
          }))}
          series={[
            { key: 'total', name: t('total'), color: '#3B82F6', type: 'line' },
            { key: 'approved', name: t('approved'), color: '#10B981', type: 'area' },
          ]}
          height={300}
          loading={isLoading}
        />

        <PieChart
          title={t('distributionByStatus')}
          subtitle={t('currentQuotes')}
          data={translatedQuotesByStatus}
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
          title={t('conversionRateEvolution')}
          subtitle={t('monthlyEvolution')}
          data={conversionChartData}
          series={[
            { key: 'rate', name: `${t('conversionRateEvolution')} (%)`, color: '#8B5CF6', type: 'area' },
          ]}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => `${v}%`}
        />

        {/* Top Services Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('topServicesSold')}
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
                    <TableHead>{t('service')}</TableHead>
                    <TableHead className="text-right">{t('qty')}</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.topServices.map((service, index) => (
                    <TableRow key={service.serviceName}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" size="sm">
                            #{index + 1}
                          </Badge>
                          <span className="font-medium text-sm">{service.serviceName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-gray-500">
                        {service.count}
                      </TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {formatCurrency(service.totalValue)}
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

      {/* Error Alert */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('errorLoadingSalesReport')}
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title={t('detailedSalesReportTitle')}
          description={t('detailedSalesReportDescription')}
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Sales Report Page - Wrapper com Suspense
 */
export default function SalesReportPage() {
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
      <SalesReportContent />
    </Suspense>
  );
}
