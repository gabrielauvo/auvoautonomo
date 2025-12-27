'use client';

/**
 * Profit/Loss Report Page - Relatório de Lucro/Prejuízo
 *
 * Exibe análise de lucratividade:
 * - Receitas vs Despesas
 * - Lucro líquido e margem
 * - Evolução por período
 * - Despesas por categoria
 * - Lucratividade por OS
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useProfitLossReport, useReportFilters } from '@/hooks/use-reports';
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
  Badge,
} from '@/components/ui';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertCircle,
  Percent,
  Wrench,
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
 * Formatar percentual
 */
function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Mock data para demonstração
 */
const MOCK_PROFIT_LOSS_DATA = {
  summary: {
    totalRevenue: 125000,
    totalExpenses: 45000,
    netProfit: 80000,
    profitMargin: 64,
  },
  byPeriod: [
    { date: '2024-07', label: 'Jul', revenue: 32000, expenses: 12000, profit: 20000 },
    { date: '2024-08', label: 'Ago', revenue: 28000, expenses: 10000, profit: 18000 },
    { date: '2024-09', label: 'Set', revenue: 35000, expenses: 13000, profit: 22000 },
    { date: '2024-10', label: 'Out', revenue: 30000, expenses: 10000, profit: 20000 },
  ],
  byCategory: [
    { categoryId: '1', categoryName: 'Material', totalAmount: 18000, percentage: 40, color: '#3B82F6' },
    { categoryId: '2', categoryName: 'Combustível', totalAmount: 9000, percentage: 20, color: '#10B981' },
    { categoryId: '3', categoryName: 'Manutenção', totalAmount: 6750, percentage: 15, color: '#F59E0B' },
    { categoryId: '4', categoryName: 'Serviços', totalAmount: 5625, percentage: 12.5, color: '#8B5CF6' },
    { categoryId: null, categoryName: 'Outros', totalAmount: 5625, percentage: 12.5, color: '#6B7280' },
  ],
  byWorkOrder: [
    { workOrderId: '1', workOrderNumber: 'OS-001', clientName: 'Empresa ABC', revenue: 15000, expenses: 4500, profit: 10500, profitMargin: 70 },
    { workOrderId: '2', workOrderNumber: 'OS-002', clientName: 'Tech Solutions', revenue: 12000, expenses: 3000, profit: 9000, profitMargin: 75 },
    { workOrderId: '3', workOrderNumber: 'OS-003', clientName: 'Comércio XYZ', revenue: 8500, expenses: 2800, profit: 5700, profitMargin: 67 },
    { workOrderId: '4', workOrderNumber: 'OS-004', clientName: 'Indústria Beta', revenue: 10000, expenses: 4200, profit: 5800, profitMargin: 58 },
    { workOrderId: '5', workOrderNumber: 'OS-005', clientName: 'Serviços Omega', revenue: 6500, expenses: 1500, profit: 5000, profitMargin: 77 },
  ],
  topExpenses: [
    { id: '1', description: 'Compra de equipamentos', amount: 5000, categoryName: 'Material', supplierName: 'Fornecedor A', dueDate: '2024-10-15' },
    { id: '2', description: 'Combustível frota', amount: 3500, categoryName: 'Combustível', supplierName: 'Posto XYZ', dueDate: '2024-10-10' },
    { id: '3', description: 'Manutenção veículo', amount: 2800, categoryName: 'Manutenção', supplierName: 'Oficina Central', dueDate: '2024-10-08' },
    { id: '4', description: 'Materiais diversos', amount: 2200, categoryName: 'Material', supplierName: 'Distribuidora B', dueDate: '2024-10-05' },
    { id: '5', description: 'Serviços contábeis', amount: 1800, categoryName: 'Serviços', supplierName: 'Contabilidade Ltda', dueDate: '2024-10-01' },
  ],
};

/**
 * Profit/Loss Report Content - Componente interno
 */
function ProfitLossReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();

  const isPro = true;

  const { data, isLoading, error, refetch } = useProfitLossReport(filters, isPro);

  // Usar dados reais ou mock
  const reportData = data || MOCK_PROFIT_LOSS_DATA;

  // Preparar dados para o gráfico de pizza
  const categoryChartData = reportData.byCategory.map((cat) => ({
    name: cat.categoryName,
    value: cat.totalAmount,
    color: cat.color,
  }));

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Receita Total"
          value={reportData.summary.totalRevenue}
          format="currency"
          icon={<DollarSign className="h-6 w-6" />}
          iconBgColor="bg-green-50"
          loading={isLoading}
        />
        <KpiCard
          title="Despesas Totais"
          value={reportData.summary.totalExpenses}
          format="currency"
          icon={<Receipt className="h-6 w-6" />}
          iconBgColor="bg-red-50"
          loading={isLoading}
        />
        <KpiCard
          title="Lucro Líquido"
          value={reportData.summary.netProfit}
          format="currency"
          icon={reportData.summary.netProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
          iconBgColor={reportData.summary.netProfit >= 0 ? 'bg-success-50' : 'bg-error-50'}
          loading={isLoading}
        />
        <KpiCard
          title="Margem de Lucro"
          value={reportData.summary.profitMargin}
          format="percent"
          icon={<Percent className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          loading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title="Evolução Receitas vs Despesas"
          subtitle="Histórico mensal"
          data={reportData.byPeriod}
          series={[
            { key: 'revenue', name: 'Receita', color: '#10B981', type: 'area' },
            { key: 'expenses', name: 'Despesas', color: '#EF4444', type: 'area' },
            { key: 'profit', name: 'Lucro', color: '#3B82F6', type: 'line' },
          ]}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => formatCurrency(v)}
        />

        <PieChart
          title={t('expensesByCategory')}
          subtitle={t('currentDistribution')}
          data={categoryChartData}
          height={300}
          loading={isLoading}
          donut
          formatValue={formatCurrency}
          valueLabel={t('value')}
          totalLabel={t('total')}
        />
      </div>

      {/* Work Order Profitability Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Lucratividade por Ordem de Serviço
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
                  <TableHead>OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.byWorkOrder.map((wo) => (
                  <TableRow key={wo.workOrderId}>
                    <TableCell>
                      <span className="font-mono text-sm font-medium">
                        {wo.workOrderNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{wo.clientName}</span>
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {formatCurrency(wo.revenue)}
                    </TableCell>
                    <TableCell className="text-right text-error font-medium">
                      {formatCurrency(wo.expenses)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={wo.profit >= 0 ? 'text-success font-medium' : 'text-error font-medium'}>
                        {formatCurrency(wo.profit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={wo.profitMargin >= 50 ? 'soft-success' : wo.profitMargin >= 30 ? 'soft-warning' : 'soft-error'}
                        size="sm"
                      >
                        {formatPercent(wo.profitMargin)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-error" />
            Maiores Despesas do Período
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
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.topExpenses.map((expense, index) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">
                          #{index + 1}
                        </span>
                        <span className="font-medium">{expense.description}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {expense.categoryName || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {expense.supplierName || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-error">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        showExport={isPro}
        isLoading={isLoading}
      />

      {/* Error Alert - only show for PRO users since FREE users see mock data */}
      {error && isPro && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Erro ao carregar relatório. Tente novamente.
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title="Relatório de Lucro/Prejuízo Detalhado"
          description="Faça upgrade para acessar análise completa de lucratividade, despesas por categoria e margem por OS."
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Profit/Loss Report Page - Wrapper com Suspense
 */
export default function ProfitLossReportPage() {
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
      <ProfitLossReportContent />
    </Suspense>
  );
}
