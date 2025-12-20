'use client';

/**
 * Quotes List Page - Listagem de orçamentos
 *
 * Exibe:
 * - Filtros por status
 * - Barra de busca
 * - Tabela de orçamentos
 * - Paginação
 * - Banner de uso do plano
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { PlanLimitBanner, UpsellModal } from '@/components/billing';
import { QuoteStatusBadge } from '@/components/quotes';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Skeleton,
  Alert,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit,
  AlertCircle,
  User,
  Calendar,
  Filter,
} from 'lucide-react';
import { useQuotes } from '@/hooks/use-quotes';
import { useAuth } from '@/context/auth-context';
import { Quote, QuoteStatus } from '@/services/quotes.service';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import { useDebounce } from '@/hooks/use-debounce';

// Número de itens por página
const PAGE_SIZE = 10;

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
    year: 'numeric',
  });
}

// Componente de loading para Suspense
function QuotesListLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Componente interno que usa useSearchParams
function QuotesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t } = useTranslations('quotes');

  // Ler estado inicial da URL
  const initialSearch = searchParams.get('q') || '';
  const initialStatus = (searchParams.get('status') as QuoteStatus) || undefined;
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>(
    initialStatus || 'ALL'
  );
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [showUpsellModal, setShowUpsellModal] = useState(false);

  // Status disponíveis para filtro
  const STATUS_OPTIONS: { value: QuoteStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: t('all') },
    { value: 'DRAFT', label: t('draft') },
    { value: 'SENT', label: t('sent') },
    { value: 'APPROVED', label: t('approved') },
    { value: 'REJECTED', label: t('rejected') },
    { value: 'EXPIRED', label: t('expired') },
  ];

  // Atualiza URL quando filtros mudam
  const updateURL = useCallback(
    (newSearch: string, newStatus: QuoteStatus | 'ALL', newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set('q', newSearch);
      if (newStatus !== 'ALL') params.set('status', newStatus);
      if (newPage > 1) params.set('page', String(newPage));
      const query = params.toString();
      router.replace(`/quotes${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router]
  );

  // Atualiza URL quando busca muda (após debounce)
  useEffect(() => {
    setCurrentPage(1);
    updateURL(debouncedSearch, statusFilter, 1);
  }, [debouncedSearch]);

  // Handler de mudança de status
  const handleStatusChange = useCallback(
    (status: QuoteStatus | 'ALL') => {
      setStatusFilter(status);
      setCurrentPage(1);
      updateURL(debouncedSearch, status, 1);
    },
    [debouncedSearch, updateURL]
  );

  // Handler de mudança de página
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      updateURL(debouncedSearch, statusFilter, page);
    },
    [debouncedSearch, statusFilter, updateURL]
  );

  // Query de orçamentos
  const {
    data: quotes,
    isLoading,
    error,
  } = useQuotes({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  // Paginação local (frontend)
  const totalItems = quotes?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedQuotes = quotes?.slice(startIndex, startIndex + PAGE_SIZE) || [];

  // Verifica se está no limite
  const isAtLimit =
    billing?.planKey === 'FREE' &&
    billing?.usage &&
    billing?.limits &&
    (billing.usage.quotesCount ?? 0) >= (billing.limits.maxQuotes ?? Infinity);

  // Handler para novo orçamento
  const handleNewQuote = useCallback(() => {
    if (isAtLimit) {
      setShowUpsellModal(true);
    } else {
      router.push('/quotes/new');
    }
  }, [isAtLimit, router]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('description')}
            </p>
          </div>
          <Button onClick={handleNewQuote} leftIcon={<Plus className="h-4 w-4" />}>
            {t('newQuote')}
          </Button>
        </div>

        {/* Banner de uso do plano */}
        <PlanLimitBanner resource="quotes" />

        {/* Filtros e busca */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Busca */}
              <div className="flex-1">
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
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
                    {option.label}
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

        {/* Tabela de orçamentos */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : paginatedQuotes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={
                search || statusFilter !== 'ALL'
                  ? t('noQuotesFound')
                  : t('noQuotes')
              }
              description={
                search || statusFilter !== 'ALL'
                  ? t('tryAdjustingFilters')
                  : t('startCreating')
              }
              action={
                !search && statusFilter === 'ALL'
                  ? {
                      label: t('newQuote'),
                      onClick: handleNewQuote,
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('client')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead>{t('items')}</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      {/* Cliente */}
                      <TableCell>
                        <Link href={`/quotes/${quote.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 hover:text-primary hover:underline">
                              {quote.client?.name || t('client')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {quote.client?.phone || '-'}
                            </p>
                          </div>
                        </Link>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <QuoteStatusBadge status={quote.status} size="sm" />
                      </TableCell>

                      {/* Itens */}
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {quote._count?.items || quote.items?.length || 0} {t('itemsCount')}
                        </span>
                      </TableCell>

                      {/* Valor */}
                      <TableCell className="text-right">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(quote.totalValue)}
                        </span>
                        {quote.discountValue > 0 && (
                          <p className="text-xs text-error">
                            -{formatCurrency(quote.discountValue)} {t('discount')}
                          </p>
                        )}
                      </TableCell>

                      {/* Data */}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="h-3 w-3" />
                          {formatDate(quote.createdAt)}
                        </div>
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/quotes/${quote.id}`}>
                            <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {quote.status === 'DRAFT' && (
                            <Link href={`/quotes/${quote.id}/edit`}>
                              <Button variant="ghost" size="icon-sm" title={t('edit')}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    {t('showing')} {startIndex + 1} {t('to')}{' '}
                    {Math.min(startIndex + PAGE_SIZE, totalItems)} {t('of')} {totalItems}{' '}
                    {t('quotesCount')}
                  </p>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Modal de Upsell */}
        <UpsellModal
          isOpen={showUpsellModal}
          onClose={() => setShowUpsellModal(false)}
          resource="QUOTE"
          currentPlan={billing?.planKey || 'FREE'}
          max={billing?.limits?.maxQuotes || 20}
          current={billing?.usage?.quotesCount || 0}
        />
      </div>
    </AppLayout>
  );
}

// Export default com Suspense boundary para useSearchParams
export default function QuotesListPage() {
  return (
    <Suspense fallback={<QuotesListLoading />}>
      <QuotesListContent />
    </Suspense>
  );
}
