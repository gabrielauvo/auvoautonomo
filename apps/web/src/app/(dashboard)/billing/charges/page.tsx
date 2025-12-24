'use client';

/**
 * Charges List Page - Listagem de Cobranças
 *
 * Funcionalidades:
 * - Listagem com filtros por status
 * - Busca por cliente/ID
 * - Filtro por tipo de pagamento
 * - Filtro por período
 * - Paginação
 * - Banner de uso do plano
 */

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { ChargeStatusBadge, BillingTypeBadge, PlanLimitBanner } from '@/components/billing';
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
  DollarSign,
  Calendar,
  AlertCircle,
  Eye,
  Filter,
} from 'lucide-react';
import { useCharges } from '@/hooks/use-charges';
import { useAuth } from '@/context/auth-context';
import { ChargeStatus, BillingType } from '@/services/charges.service';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import { useDebounce } from '@/hooks/use-debounce';

// Helper function to get status options with translations
function getStatusOptions(t: (key: string) => string): { value: ChargeStatus | 'ALL'; label: string }[] {
  return [
    { value: 'ALL', label: t('all') },
    { value: 'PENDING', label: t('pending') },
    { value: 'OVERDUE', label: t('overdue') },
    { value: 'CONFIRMED', label: t('paid') },
    { value: 'RECEIVED_IN_CASH', label: t('cash') },
    { value: 'CANCELED', label: t('cancelled') },
  ];
}

// Helper function to get type options with translations
function getTypeOptions(t: (key: string) => string): { value: BillingType | 'ALL'; label: string }[] {
  return [
    { value: 'ALL', label: t('all') },
    { value: 'PIX', label: 'PIX' },
    { value: 'BOLETO', label: t('boleto') },
    { value: 'CREDIT_CARD', label: t('creditCard') },
  ];
}

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

// Conteúdo principal
function ChargesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t } = useTranslations('billing');

  // Get translated options
  const STATUS_OPTIONS = getStatusOptions(t);
  const TYPE_OPTIONS = getTypeOptions(t);

  // Estados
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<ChargeStatus | 'ALL'>(
    (searchParams.get('status') as ChargeStatus) || 'ALL'
  );
  const [typeFilter, setTypeFilter] = useState<BillingType | 'ALL'>(
    (searchParams.get('type') as BillingType) || 'ALL'
  );
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [showFilters, setShowFilters] = useState(false);

  // Atualiza página quando busca muda (após debounce)
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Atualizar URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (currentPage > 1) params.set('page', currentPage.toString());

    const newUrl = params.toString()
      ? `/billing/charges?${params.toString()}`
      : '/billing/charges';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, statusFilter, typeFilter, startDate, endDate, currentPage, router]);

  // Query
  const { data: chargesResponse, isLoading, error } = useCharges({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    billingType: typeFilter !== 'ALL' ? typeFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page: currentPage,
    pageSize: 10,
  });

  // Handlers
  const handleStatusChange = useCallback((status: ChargeStatus | 'ALL') => {
    setStatusFilter(status);
    setCurrentPage(1);
  }, []);

  const handleTypeChange = useCallback((type: BillingType | 'ALL') => {
    setTypeFilter(type);
    setCurrentPage(1);
  }, []);

  const handleDateChange = useCallback((type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setCurrentPage(1);
  }, []);

  // Com o novo modelo de billing, não há limite de cobranças
  // Trial e PRO têm tudo liberado
  const isAtLimit = false;

  const charges = chargesResponse?.data || [];
  const totalPages = chargesResponse?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('charges')}</h1>
          <p className="text-gray-500 mt-1">
            {t('chargesSubtitle')}
          </p>
        </div>
        <Link href="/billing/charges/new">
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            disabled={isAtLimit}
          >
            {t('newCharge')}
          </Button>
        </Link>
      </div>

      {/* Banner de limite removido - novo modelo sem limites */}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Busca e toggle de filtros */}
            <div className="flex gap-4">
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
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                leftIcon={<Filter className="h-4 w-4" />}
              >
                {t('filters')}
              </Button>
            </div>

            {/* Filtros expandidos */}
            {showFilters && (
              <div className="pt-4 border-t space-y-4">
                {/* Filtro de status */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {t('status')}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                          statusFilter === option.value
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                        onClick={() => handleStatusChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de tipo */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {t('paymentMethod')}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                          typeFilter === option.value
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                        onClick={() => handleTypeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de período */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    {t('period')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => handleDateChange('start', e.target.value)}
                        className="pl-10"
                        placeholder={t('startDate')}
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => handleDateChange('end', e.target.value)}
                        className="pl-10"
                        placeholder={t('endDate')}
                      />
                    </div>
                  </div>
                </div>

                {/* Limpar filtros */}
                {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || startDate || endDate) && (
                  <div className="pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-gray-500"
                    >
                      {t('clearFilters')}
                    </Button>
                  </div>
                )}
              </div>
            )}
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
      ) : charges.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('client')}</TableHead>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('dueDate')}</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                    <TableHead className="w-16"></TableHead>
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
                        <div>
                          <p className="font-medium text-gray-900">
                            {charge.client?.name || t('client')}
                          </p>
                          <p className="text-xs text-gray-500">
                            {charge.description || `#${charge.asaasId || charge.id.slice(0, 8)}`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <BillingTypeBadge type={charge.billingType} size="sm" />
                      </TableCell>
                      <TableCell>
                        <ChargeStatusBadge status={charge.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {formatDate(charge.dueDate)}
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
          icon={DollarSign}
          title={t('noCharges')}
          description={
            debouncedSearch || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? t('noChargesFiltered')
              : t('noChargesDescription')
          }
          action={
            !debouncedSearch && statusFilter === 'ALL' && typeFilter === 'ALL'
              ? {
                  label: t('createCharge'),
                  onClick: () => router.push('/billing/charges/new'),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

// Página com Suspense boundary
export default function ChargesPage() {
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
        <ChargesContent />
      </Suspense>
    </AppLayout>
  );
}
