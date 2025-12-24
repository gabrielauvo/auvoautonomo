'use client';

/**
 * Work Orders List Page - Listagem de Ordens de Serviço
 *
 * Funcionalidades:
 * - Listagem com filtros por status
 * - Busca por cliente/título
 * - Filtro por período
 * - Paginação
 * - Banner de uso do plano
 */

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { WorkOrderStatusBadge } from '@/components/work-orders';
import { PlanLimitBanner } from '@/components/billing';
import {
  Card,
  CardContent,
  Button,
  Input,
  Skeleton,
  Alert,
  EmptyState,
  Pagination,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import {
  Plus,
  Search,
  Wrench,
  Calendar,
  AlertCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { PdfButton } from '@/components/pdf';
import { useWorkOrders } from '@/hooks/use-work-orders';
import { useAuth } from '@/context/auth-context';
import { WorkOrderStatus } from '@/services/work-orders.service';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import { useDebounce } from '@/hooks/use-debounce';

// Opções de status - As labels serão traduzidas no componente
const STATUS_OPTIONS: { value: WorkOrderStatus | 'ALL'; key: string }[] = [
  { value: 'ALL', key: 'all' },
  { value: 'SCHEDULED', key: 'scheduled' },
  { value: 'IN_PROGRESS', key: 'inProgress' },
  { value: 'DONE', key: 'completed' },
  { value: 'CANCELED', key: 'cancelled' },
];

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
    month: 'short',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Conteúdo principal (precisa de Suspense por causa de useSearchParams)
function WorkOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t } = useTranslations('workOrders');

  // Estados
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | 'ALL'>(
    (searchParams.get('status') as WorkOrderStatus) || 'ALL'
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );

  // Atualiza página quando busca muda (após debounce)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Atualizar URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = params.toString()
      ? `/work-orders?${params.toString()}`
      : '/work-orders';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, statusFilter, currentPage, router]);

  // Query
  const { data: workOrders, isLoading, error } = useWorkOrders({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  // Paginação local
  const pageSize = 10;
  const totalItems = workOrders?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedOrders = workOrders?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Handler de mudança de status
  const handleStatusChange = useCallback((status: WorkOrderStatus | 'ALL') => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  // Com o novo modelo de billing, não há limite de OS
  // Trial e PRO têm tudo liberado
  const isAtLimit = false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-1">
            {t('subtitle')}
          </p>
        </div>
        <Link href="/work-orders/new">
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            disabled={isAtLimit}
          >
            {t('newOrder')}
          </Button>
        </Link>
      </div>

      {/* Banner de limite removido - novo modelo sem limites */}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Busca */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro de status */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    statusFilter === option.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  onClick={() => handleStatusChange(option.value)}
                >
                  {t(option.key)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Erro */}
      {error && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('errorLoading')}
          </div>
        </Alert>
      )}

      {/* Lista */}
      {isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-4 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : paginatedOrders && paginatedOrders.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('orderNumber')}</TableHead>
                    <TableHead>{t('client')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('scheduledDate')}</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOrders.map((workOrder) => (
                    <TableRow
                      key={workOrder.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => router.push(`/work-orders/${workOrder.id}`)}
                    >
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              #{workOrder.number} - {workOrder.title}
                            </p>
                            {workOrder.workOrderType && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: workOrder.workOrderType.color || '#6B7280' }}
                              >
                                {workOrder.workOrderType.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('createdAt', { date: formatDate(workOrder.createdAt) })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-medium text-sm">
                            {workOrder.client?.name?.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <span className="text-sm text-gray-700">
                            {workOrder.client?.name || t('client')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <WorkOrderStatusBadge status={workOrder.status} />
                      </TableCell>
                      <TableCell>
                        {workOrder.scheduledDate ? (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {formatDateTime(workOrder.scheduledDate)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(workOrder.totalValue || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <PdfButton
                            entityType="WORK_ORDER"
                            entityId={workOrder.id}
                            variant="ghost"
                            size="icon"
                            showLabel={false}
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => router.push(`/work-orders/${workOrder.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Wrench}
          title={t('noOrders')}
          description={
            debouncedSearch || statusFilter !== 'ALL'
              ? t('noOrdersFiltered')
              : t('noOrdersCreate')
          }
          action={
            !debouncedSearch && statusFilter === 'ALL'
              ? {
                  label: t('createOrder'),
                  onClick: () => router.push('/work-orders/new'),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// Página com Suspense boundary
export default function WorkOrdersPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <WorkOrdersContent />
      </Suspense>
    </AppLayout>
  );
}
