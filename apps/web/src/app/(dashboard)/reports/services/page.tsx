'use client';

/**
 * Services Report Page - Relatório de Serviços (OS por Tipo)
 *
 * Exibe métricas de ordens de serviço por tipo:
 * - Ranking de tipos mais utilizados
 * - Taxa de conclusão por tipo
 * - Top clientes por tipo
 * - Evolução temporal por tipo
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n';
import { useAuth } from '@/context/auth-context';
import { useFormatting } from '@/context/company-settings-context';
import { useServicesReport, useReportFilters } from '@/hooks/use-reports';
import { reportsService } from '@/services/reports.service';
import {
  KpiCard,
  ReportFilterBar,
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
  Badge,
} from '@/components/ui';
import {
  Tag,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Wrench,
  BarChart3,
} from 'lucide-react';

/**
 * Mock data para demonstração
 */
const MOCK_SERVICES_DATA = {
  summary: {
    totalWorkOrders: 234,
    completedWorkOrders: 189,
    typesUsed: 5,
    avgTimeToComplete: null,
  },
  workOrdersByType: [
    { typeId: '1', typeName: 'Instalação', typeColor: '#3B82F6', count: 85, completedCount: 72, completionRate: 85, totalValue: 42500 },
    { typeId: '2', typeName: 'Manutenção', typeColor: '#10B981', count: 65, completedCount: 58, completionRate: 89, totalValue: 19500 },
    { typeId: '3', typeName: 'Reparo', typeColor: '#F59E0B', count: 45, completedCount: 35, completionRate: 78, totalValue: 13500 },
    { typeId: '4', typeName: 'Visita técnica', typeColor: '#8B5CF6', count: 25, completedCount: 22, completionRate: 88, totalValue: 5000 },
    { typeId: null, typeName: 'Sem tipo definido', typeColor: '#6B7280', count: 14, completedCount: 2, completionRate: 14, totalValue: 2800 },
  ],
  topClientsByType: [
    {
      typeId: '1',
      typeName: 'Instalação',
      typeColor: '#3B82F6',
      clients: [
        { clientId: 'c1', clientName: 'Empresa ABC', count: 15, totalValue: 7500 },
        { clientId: 'c2', clientName: 'Loja XYZ', count: 12, totalValue: 6000 },
        { clientId: 'c3', clientName: 'Comércio 123', count: 8, totalValue: 4000 },
      ],
    },
    {
      typeId: '2',
      typeName: 'Manutenção',
      typeColor: '#10B981',
      clients: [
        { clientId: 'c4', clientName: 'Indústria ACME', count: 10, totalValue: 3000 },
        { clientId: 'c5', clientName: 'Shopping Center', count: 8, totalValue: 2400 },
      ],
    },
  ],
  typesByPeriod: [],
};

/**
 * Services Report Content - Componente interno
 */
function ServicesReportContent() {
  const searchParams = useSearchParams();
  const filters = useReportFilters(searchParams);
  const { billing } = useAuth();
  const { t } = useTranslations('reports');
  const { formatCurrency } = useFormatting();

  const isPro = true;

  const { data, isLoading, error, refetch } = useServicesReport(filters, isPro);

  // Usar dados reais ou mock
  const servicesData = data || MOCK_SERVICES_DATA;

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      // TODO: Implementar exportação específica para services
      console.log('Exportando relatório de serviços:', format);
    } catch (err) {
      console.error('Erro ao exportar:', err);
    }
  };

  // Prepare pie chart data
  const typeDistributionData = servicesData.workOrdersByType.map((item) => ({
    name: item.typeName,
    value: item.count,
    color: item.typeColor,
  }));

  const renderContent = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('totalWorkOrders')}
          value={servicesData.summary.totalWorkOrders}
          format="number"
          icon={<Wrench className="h-6 w-6" />}
          loading={isLoading}
        />
        <KpiCard
          title={t('completed')}
          value={servicesData.summary.completedWorkOrders}
          format="number"
          icon={<CheckCircle className="h-6 w-6" />}
          iconBgColor="bg-success-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('typesUsed')}
          value={servicesData.summary.typesUsed}
          format="number"
          icon={<Tag className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          loading={isLoading}
        />
        <KpiCard
          title={t('avgRate')}
          value={
            servicesData.workOrdersByType.length > 0
              ? Math.round(
                  servicesData.workOrdersByType.reduce((sum, t) => sum + t.completionRate, 0) /
                    servicesData.workOrdersByType.length
                )
              : 0
          }
          format="percent"
          icon={<TrendingUp className="h-6 w-6" />}
          iconBgColor="bg-amber-50"
          loading={isLoading}
        />
      </div>

      {/* Charts and Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <PieChart
          title={t('distributionByType')}
          subtitle={t('workOrdersByServiceType')}
          data={typeDistributionData}
          height={350}
          loading={isLoading}
          donut
        />

        {/* Ranking Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('typesRanking')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {servicesData.workOrdersByType.map((type, index) => (
                  <div
                    key={type.typeId || 'null'}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: type.typeColor }}
                      />
                      <div>
                        <p className="font-medium text-sm">{type.typeName}</p>
                        <p className="text-xs text-gray-500">{type.count} OS</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={type.completionRate >= 80 ? 'success' : type.completionRate >= 50 ? 'warning' : 'error'}
                      >
                        {type.completionRate}% {t('completedLower')}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{formatCurrency(type.totalValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Clients by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t('topClientsByType')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : servicesData.topClientsByType.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              {t('noClientsByTypeData')}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servicesData.topClientsByType.map((typeData) => (
                <div
                  key={typeData.typeId || 'null'}
                  className="border rounded-lg p-4"
                  style={{ borderLeftColor: typeData.typeColor, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: typeData.typeColor }}
                    />
                    <h4 className="font-semibold text-sm">{typeData.typeName}</h4>
                  </div>
                  <div className="space-y-2">
                    {typeData.clients.map((client, idx) => (
                      <div key={client.clientId} className="flex justify-between text-sm">
                        <span className="text-gray-600 truncate flex-1">
                          {idx + 1}. {client.clientName}
                        </span>
                        <span className="font-medium ml-2">{client.count} OS</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t('servicesInsights')}
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
              {/* Most popular type */}
              {servicesData.workOrdersByType[0] && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">{t('mostRequestedType')}</span>
                  </div>
                  <p className="text-xl font-bold text-blue-900">
                    {servicesData.workOrdersByType[0].typeName}
                  </p>
                  <p className="text-xs text-blue-700">
                    {t('workOrdersCount', { count: servicesData.workOrdersByType[0].count })}
                  </p>
                </div>
              )}

              {/* Best completion rate */}
              {(() => {
                const bestType = [...servicesData.workOrdersByType].sort(
                  (a, b) => b.completionRate - a.completionRate
                )[0];
                return bestType ? (
                  <div className="p-4 bg-success-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium text-success-800">{t('bestCompletionRate')}</span>
                    </div>
                    <p className="text-xl font-bold text-success-900">{bestType.typeName}</p>
                    <p className="text-xs text-success-700">{bestType.completionRate}% {t('completedLower')}</p>
                  </div>
                ) : null;
              })()}

              {/* Highest value type */}
              {(() => {
                const highestValueType = [...servicesData.workOrdersByType].sort(
                  (a, b) => b.totalValue - a.totalValue
                )[0];
                return highestValueType ? (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">{t('highestRevenue')}</span>
                    </div>
                    <p className="text-xl font-bold text-amber-900">{highestValueType.typeName}</p>
                    <p className="text-xs text-amber-700">{formatCurrency(highestValueType.totalValue)}</p>
                  </div>
                ) : null;
              })()}
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
            {t('errorLoadingServicesReport')}
          </div>
        </Alert>
      )}

      {/* Content - with PLG overlay for FREE users */}
      {isPro ? (
        renderContent()
      ) : (
        <ProFeatureOverlay
          title={t('detailedServicesReportTitle')}
          description={t('detailedServicesReportDescription')}
        >
          {renderContent()}
        </ProFeatureOverlay>
      )}
    </div>
  );
}

/**
 * Services Report Page - Wrapper com Suspense
 */
export default function ServicesReportPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      }
    >
      <ServicesReportContent />
    </Suspense>
  );
}
