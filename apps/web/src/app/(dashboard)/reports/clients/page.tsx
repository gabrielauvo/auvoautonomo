'use client';

/**
 * Clients Report Page - Relatório de Clientes
 *
 * Exibe métricas de clientes:
 * - Total, ativos, novos, inativos
 * - Top clientes por receita
 * - Distribuição por cidade
 * - Taxa de retenção
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useClientsReport, useReportFilters } from '@/hooks/use-reports';
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
  Avatar,
} from '@/components/ui';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  TrendingUp,
  AlertCircle,
  MapPin,
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
const MOCK_CLIENTS_DATA = {
  summary: {
    totalClients: 156,
    activeClients: 128,
    newClients: 23,
    inactiveClients: 28,
    withOverdue: 8,
    avgRevenuePerClient: 1850,
  },
  clientsByPeriod: [
    { date: '2024-07', label: 'Jul', total: 138, new: 12 },
    { date: '2024-08', label: 'Ago', total: 145, new: 8 },
    { date: '2024-09', label: 'Set', total: 151, new: 7 },
    { date: '2024-10', label: 'Out', total: 156, new: 6 },
  ],
  clientsByStatus: [
    { name: 'Ativos', value: 128, color: '#10B981' },
    { name: 'Novos', value: 23, color: '#3B82F6' },
    { name: 'Inativos', value: 28, color: '#6B7280' },
  ],
  topClientsByRevenue: [
    { clientId: '1', clientName: 'Empresa ABC Ltda', totalRevenue: 35000, quotesCount: 15, workOrdersCount: 28 },
    { clientId: '2', clientName: 'Tech Solutions', totalRevenue: 28500, quotesCount: 12, workOrdersCount: 22 },
    { clientId: '3', clientName: 'Comércio XYZ', totalRevenue: 22800, quotesCount: 18, workOrdersCount: 35 },
    { clientId: '4', clientName: 'Indústria Beta', totalRevenue: 18200, quotesCount: 8, workOrdersCount: 15 },
    { clientId: '5', clientName: 'Serviços Omega', totalRevenue: 15500, quotesCount: 10, workOrdersCount: 18 },
  ],
  clientsByCity: [
    { name: 'São Paulo', value: 45 },
    { name: 'Rio de Janeiro', value: 28 },
    { name: 'Belo Horizonte', value: 22 },
    { name: 'Curitiba', value: 18 },
    { name: 'Porto Alegre', value: 15 },
    { name: 'Outros', value: 28 },
  ],
  retentionRate: [
    { month: 'Jul', rate: 92.5 },
    { month: 'Ago', rate: 94.2 },
    { month: 'Set', rate: 91.8 },
    { month: 'Out', rate: 93.1 },
  ],
};

/**
 * Clients Report Content - Componente interno
 */
function ClientsReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();

  const isPro = billing?.planKey !== 'FREE';

  const { data, isLoading, error, refetch } = useClientsReport(filters, isPro);

  // Usar dados reais ou mock
  const clientsData = data || MOCK_CLIENTS_DATA;

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const blob = await reportsService.exportReport('clients', format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-clientes.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  // Prepare chart data
  const retentionChartData = clientsData.retentionRate.map((item) => ({
    date: item.month,
    label: item.month,
    rate: item.rate,
  }));

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total de Clientes"
          value={clientsData.summary.totalClients}
          format="number"
          icon={<Users className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title="Clientes Ativos"
          value={clientsData.summary.activeClients}
          format="number"
          icon={<UserCheck className="h-6 w-6" />}
          iconBgColor="bg-success-50"
          loading={isLoading}
        />
        <KpiCard
          title="Novos Clientes"
          value={clientsData.summary.newClients}
          format="number"
          icon={<UserPlus className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          loading={isLoading}
        />
        <KpiCard
          title="Receita Média"
          value={clientsData.summary.avgRevenuePerClient}
          format="currency"
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-purple-50"
          loading={isLoading}
        />
      </div>

      {/* Warning for clients with overdue */}
      {clientsData.summary.withOverdue > 0 && (
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>
              <strong>{clientsData.summary.withOverdue}</strong> cliente(s) com pagamentos em atraso.
              {' '}
              <a href="/payments?status=OVERDUE" className="underline font-medium">
                Ver detalhes
              </a>
            </span>
          </div>
        </Alert>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title="Evolução da Base de Clientes"
          subtitle="Crescimento mensal"
          data={clientsData.clientsByPeriod.map((item) => ({
            date: item.date,
            label: item.label,
            total: item.total,
            new: item.new,
          }))}
          series={[
            { key: 'total', name: 'Total', color: '#3B82F6', type: 'area' },
            { key: 'new', name: 'Novos', color: '#10B981', type: 'line' },
          ]}
          height={300}
          loading={isLoading}
        />

        <PieChart
          title="Distribuição por Status"
          subtitle="Base atual"
          data={clientsData.clientsByStatus}
          height={300}
          loading={isLoading}
          donut
        />
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart
          title="Taxa de Retenção"
          subtitle="Evolução mensal"
          data={retentionChartData}
          series={[
            { key: 'rate', name: 'Taxa (%)', color: '#8B5CF6', type: 'area' },
          ]}
          height={300}
          loading={isLoading}
          formatYAxis={(v) => `${v}%`}
        />

        <BarChart
          title="Clientes por Cidade"
          subtitle="Distribuição geográfica"
          data={clientsData.clientsByCity}
          height={300}
          horizontal
          loading={isLoading}
        />
      </div>

      {/* Top Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Top Clientes por Receita
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-center">Orçamentos</TableHead>
                  <TableHead className="text-center">OS</TableHead>
                  <TableHead className="text-right">Receita Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsData.topClientsByRevenue.map((client, index) => (
                  <TableRow key={client.clientId}>
                    <TableCell>
                      <Badge
                        variant={index === 0 ? 'success' : index === 1 ? 'info' : 'default'}
                        size="sm"
                      >
                        {index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar fallback={client.clientName} size="sm" />
                        <span className="font-medium">{client.clientName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-gray-500">
                      {client.quotesCount}
                    </TableCell>
                    <TableCell className="text-center text-gray-500">
                      {client.workOrdersCount}
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

      {/* Client Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Insights da Base de Clientes
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
                  <UserCheck className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium text-success-800">Ativação</span>
                </div>
                <p className="text-2xl font-bold text-success-900">
                  {((clientsData.summary.activeClients / clientsData.summary.totalClients) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-success-700">Clientes ativos</p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Crescimento</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  +{clientsData.summary.newClients}
                </p>
                <p className="text-xs text-blue-700">Novos no período</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserX className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">Churn</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {clientsData.summary.inactiveClients}
                </p>
                <p className="text-xs text-gray-700">Clientes inativos</p>
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
            Erro ao carregar relatório de clientes. Tente novamente.
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title="Relatório de Clientes Detalhado"
          description="Faça upgrade para acessar análises de retenção, top clientes e exportação de dados."
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Clients Report Page - Wrapper com Suspense
 */
export default function ClientsReportPage() {
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
      <ClientsReportContent />
    </Suspense>
  );
}
