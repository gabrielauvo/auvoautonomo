'use client';

/**
 * Client Details Page - Página de detalhes do cliente
 *
 * Exibe:
 * - Dados principais
 * - KPIs resumidos
 * - Timeline de eventos
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { ClientTimeline } from '@/components/clients';
import { ChargeStatusBadge, BillingTypeBadge } from '@/components/billing';
import { useTranslations } from '@/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Alert,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from '@/components/ui';
import {
  ArrowLeft,
  Edit,
  FileText,
  Wrench,
  Phone,
  Mail,
  MapPin,
  Building,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  History,
  CreditCard,
  Calendar,
  Eye,
} from 'lucide-react';
import { useClient, useClientTimeline, useClientSummary } from '@/hooks/use-clients';
import { useClientCharges } from '@/hooks/use-charges';
import { formatDocument } from '@/lib/utils';

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatar data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function ClientDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('timeline');
  const { t } = useTranslations('clients');
  const { t: tc } = useTranslations('common');

  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { data: timeline, isLoading: timelineLoading } = useClientTimeline(id);
  const { data: summary, isLoading: summaryLoading } = useClientSummary(id);
  const { data: chargesResponse, isLoading: chargesLoading } = useClientCharges(id);

  const isLoading = clientLoading;
  const charges = chargesResponse?.data || [];

  // KPI Card component
  const KpiCard = ({
    label,
    value,
    icon: Icon,
    variant = 'default',
    loading = false,
  }: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    variant?: 'default' | 'success' | 'warning' | 'error';
    loading?: boolean;
  }) => {
    const colors = {
      default: 'text-gray-500',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-error',
    };

    if (loading) {
      return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <div className={`p-2 rounded-lg bg-white ${colors[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className={`text-lg font-semibold ${colors[variant]}`}>{value}</p>
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/clients">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{client?.name}</h1>
                    {summary && summary.totalOverdue > 0 ? (
                      <Badge variant="error">{t('overdue')}</Badge>
                    ) : (
                      <Badge variant="soft-success">{t('upToDate')}</Badge>
                    )}
                  </div>
                  <p className="text-gray-500 mt-1 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {client?.taxId && formatDocument(client.taxId)}
                    {client?.city && client?.state && (
                      <>
                        <span className="mx-2">•</span>
                        <MapPin className="h-4 w-4" />
                        {client.city} - {client.state}
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            <Link href={`/clients/${id}/edit`}>
              <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
                {tc('edit')}
              </Button>
            </Link>
            <Button
              variant="soft"
              leftIcon={<FileText className="h-4 w-4" />}
              onClick={() => router.push(`/quotes/new?clientId=${id}`)}
            >
              {t('createQuote')}
            </Button>
            <Button
              variant="soft"
              leftIcon={<Wrench className="h-4 w-4" />}
              onClick={() => router.push(`/work-orders/new?clientId=${id}`)}
            >
              {t('createWorkOrder')}
            </Button>
            <Button
              variant="soft"
              leftIcon={<DollarSign className="h-4 w-4" />}
              onClick={() => router.push(`/billing/charges/new?clientId=${id}`)}
            >
              {t('createCharge')}
            </Button>
          </div>
        </div>

        {/* Erro */}
        {clientError && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('loadError')}
            </div>
          </Alert>
        )}

        {/* Conteúdo principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna lateral - Dados e KPIs */}
          <div className="lg:col-span-1 space-y-6">
            {/* Dados de contato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('contactData')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </>
                ) : (
                  <>
                    {client?.phone && (
                      <a
                        href={`tel:${client.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Phone className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('phone')}</p>
                          <p className="text-sm font-medium text-primary hover:underline">{client.phone}</p>
                        </div>
                      </a>
                    )}
                    {client?.email && (
                      <a
                        href={`mailto:${client.email}`}
                        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Mail className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('email')}</p>
                          <p className="text-sm font-medium break-all text-primary hover:underline">{client.email}</p>
                        </div>
                      </a>
                    )}
                    {client?.address && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <MapPin className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{t('address')}</p>
                          <p className="text-sm font-medium">{client.address}</p>
                          {(client.city || client.state || client.zipCode) && (
                            <p className="text-sm text-gray-500">
                              {[client.city, client.state].filter(Boolean).join(' - ')}
                              {client.zipCode && ` • ${client.zipCode}`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {client?.createdAt && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          {t('clientSince')} {formatDate(client.createdAt)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('summary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard
                    label={t('quotes')}
                    value={summary?.totalQuotes || 0}
                    icon={FileText}
                    loading={summaryLoading}
                  />
                  <KpiCard
                    label={t('workOrders')}
                    value={summary?.totalWorkOrders || 0}
                    icon={Wrench}
                    loading={summaryLoading}
                  />
                </div>

                <KpiCard
                  label={t('receivedAmount')}
                  value={formatCurrency(summary?.totalReceived || 0)}
                  icon={TrendingUp}
                  variant="success"
                  loading={summaryLoading}
                />

                <KpiCard
                  label={t('pendingAmount')}
                  value={formatCurrency(summary?.totalPending || 0)}
                  icon={Clock}
                  variant="warning"
                  loading={summaryLoading}
                />

                {(summary?.totalOverdue || 0) > 0 && (
                  <KpiCard
                    label={t('overdueAmount')}
                    value={formatCurrency(summary?.totalOverdue || 0)}
                    icon={AlertCircle}
                    variant="error"
                    loading={summaryLoading}
                  />
                )}
              </CardContent>
            </Card>

            {/* Observações */}
            {client?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {client.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna principal - Tabs */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="timeline">
                  <History className="h-4 w-4 mr-2" />
                  {t('history')}
                </TabsTrigger>
                <TabsTrigger value="financeiro">
                  <CreditCard className="h-4 w-4 mr-2" />
                  {t('financial')}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Histórico */}
              <TabsContent value="timeline">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t('history')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ClientTimeline
                      events={timeline || []}
                      isLoading={timelineLoading}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Financeiro */}
              <TabsContent value="financeiro">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{t('charges')}</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => router.push(`/billing/charges/new?clientId=${id}`)}
                      >
                        {t('newCharge')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {chargesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-10 w-10 rounded" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-1/3" />
                              <Skeleton className="h-3 w-1/4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : charges.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('description')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead>{tc('status')}</TableHead>
                            <TableHead>{t('dueDate')}</TableHead>
                            <TableHead className="text-right">{t('value')}</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {charges.map((charge) => (
                            <TableRow
                              key={charge.id}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => router.push(`/billing/charges/${charge.id}`)}
                            >
                              <TableCell>
                                <p className="font-medium text-gray-900 text-sm">
                                  {charge.description || `#${charge.asaasId || charge.id.slice(0, 8)}`}
                                </p>
                              </TableCell>
                              <TableCell>
                                <BillingTypeBadge type={charge.billingType} size="sm" />
                              </TableCell>
                              <TableCell>
                                <ChargeStatusBadge status={charge.status} size="sm" />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(charge.dueDate).toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: 'short',
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-medium text-gray-900">
                                  {formatCurrency(charge.value)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/billing/charges/${charge.id}`);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <EmptyState
                        icon={DollarSign}
                        title={t('noCharges')}
                        description={t('noChargesDescription')}
                        action={{
                          label: t('createCharge'),
                          onClick: () => router.push(`/billing/charges/new?clientId=${id}`),
                        }}
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
