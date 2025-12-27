'use client';

/**
 * Expenses List Page - Listagem de despesas
 *
 * Exibe:
 * - KPIs de resumo
 * - Filtros por status, período e categoria
 * - Tabela de despesas
 * - Paginação
 */

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { UpsellModal } from '@/components/billing';
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
  Select,
} from '@/components/ui';
import {
  Plus,
  Search,
  Receipt,
  Eye,
  Edit,
  AlertCircle,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { useExpenses, useExpenseSummary, useDeleteExpense } from '@/hooks/use-expenses';
import { useExpenseCategories } from '@/hooks/use-expense-categories';
import { useAuth } from '@/context/auth-context';
import { Expense, ExpenseStatus, getStatusColor } from '@/services/expenses.service';
import { useDebounce } from '@/hooks/use-debounce';
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/context/company-settings-context';

// Número de itens por página
const PAGE_SIZE = 10;

// Status badge component
function StatusBadge({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslations('expenses');
  const color = getStatusColor(status);
  const statusKey = status.toLowerCase() as 'draft' | 'pending' | 'paid' | 'canceled';

  const variants: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
    gray: 'default',
    yellow: 'warning',
    green: 'success',
    red: 'error',
  };

  return (
    <Badge variant={variants[color] || 'default'} size="sm">
      {t(`status.${statusKey}`)}
    </Badge>
  );
}

// Componente de loading para Suspense
function ExpensesListLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Componente interno que usa useSearchParams
function ExpensesListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t, locale } = useTranslations('expenses');
  const { formatCurrency, formatDate } = useFormatting();

  // Ler estado inicial da URL
  const initialSearch = searchParams.get('q') || '';
  const initialStatus = (searchParams.get('status') as ExpenseStatus | 'ALL') || 'ALL';
  const initialCategory = searchParams.get('category') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'ALL'>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Hooks
  const deleteExpense = useDeleteExpense();
  const { data: categories } = useExpenseCategories();

  // Status options for filter (memoized with locale)
  const statusOptions = useMemo(() => [
    { value: 'ALL', label: t('allStatus') },
    { value: 'DRAFT', label: t('status.draft') },
    { value: 'PENDING', label: t('status.pending') },
    { value: 'PAID', label: t('status.paid') },
    { value: 'CANCELED', label: t('status.canceled') },
  ], [t, locale]);

  // Build filters
  const filters = {
    search: debouncedSearch || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    categoryId: categoryFilter || undefined,
  };

  // Query de despesas
  const {
    data: expenses,
    isLoading,
    error,
  } = useExpenses(filters);

  // Query de resumo
  const { data: summary, isLoading: summaryLoading } = useExpenseSummary(filters);

  // Atualiza URL quando filtros mudam
  const updateURL = useCallback((params: Record<string, string>) => {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    const query = urlParams.toString();
    router.replace(`/expenses${query ? `?${query}` : ''}`, { scroll: false });
  }, [router]);

  // Atualiza URL quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
    updateURL({
      q: debouncedSearch,
      status: statusFilter !== 'ALL' ? statusFilter : '',
      category: categoryFilter,
    });
  }, [debouncedSearch, statusFilter, categoryFilter, updateURL]);

  // Paginação local (frontend)
  const totalItems = expenses?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedExpenses = expenses?.slice(startIndex, startIndex + PAGE_SIZE) || [];

  // Handler para nova despesa
  const handleNewExpense = useCallback(() => {
    router.push('/expenses/new');
  }, [router]);

  // Handler para deletar despesa
  const handleDeleteExpense = useCallback(async () => {
    if (!expenseToDelete) return;

    try {
      await deleteExpense.mutateAsync(expenseToDelete.id);
      setExpenseToDelete(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Erro ao excluir despesa:', err);
    }
  }, [expenseToDelete, deleteExpense]);

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
        <Card>
          <CardContent className="pt-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`h-4 w-4 ${colors[variant]}`} />
            <span className="text-sm text-gray-500">{label}</span>
          </div>
          <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={handleNewExpense} leftIcon={<Plus className="h-4 w-4" />}>
            {t('newExpense')}
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label={t('kpi.total')}
            value={formatCurrency(summary?.total?.amount ?? 0)}
            icon={DollarSign}
            loading={summaryLoading}
          />
          <KpiCard
            label={t('kpi.pending')}
            value={formatCurrency(summary?.pending?.amount ?? 0)}
            icon={Clock}
            variant="warning"
            loading={summaryLoading}
          />
          <KpiCard
            label={t('kpi.paid')}
            value={formatCurrency(summary?.paid?.amount ?? 0)}
            icon={CheckCircle2}
            variant="success"
            loading={summaryLoading}
          />
          <KpiCard
            label={t('kpi.overdue')}
            value={formatCurrency(summary?.overdue?.amount ?? 0)}
            icon={AlertCircle}
            variant="error"
            loading={summaryLoading}
          />
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | 'ALL')}
                className="w-full md:w-48"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full md:w-48"
              >
                <option value="">{t('allCategories')}</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
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

        {/* Tabela de despesas */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          ) : paginatedExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={search || statusFilter !== 'ALL' || categoryFilter ? t('noExpensesFound') : t('noExpenses')}
              description={
                search || statusFilter !== 'ALL' || categoryFilter
                  ? t('tryAdjustFilters')
                  : t('createFirstExpense')
              }
              action={
                !(search || statusFilter !== 'ALL' || categoryFilter)
                  ? {
                      label: t('newExpense'),
                      onClick: handleNewExpense,
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('description')}</TableHead>
                    <TableHead>{t('supplier')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('dueDate')}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">{t('value')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Link href={`/expenses/${expense.id}`} className="hover:text-primary hover:underline">
                          <p className="font-medium text-gray-900">{expense.description}</p>
                          {expense.invoiceNumber && (
                            <p className="text-xs text-gray-500">NF: {expense.invoiceNumber}</p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {expense.supplier ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{expense.supplier.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.category ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: expense.category.color || '#6B7280' }}
                            />
                            <span className="text-sm">{expense.category.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(expense.dueDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/expenses/${expense.id}`}>
                            <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/expenses/${expense.id}/edit`}>
                            <Button variant="ghost" size="icon-sm" title={t('edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={t('delete')}
                            onClick={() => {
                              setExpenseToDelete(expense);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-error" />
                          </Button>
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
                    {t('showing', {
                      start: startIndex + 1,
                      end: Math.min(startIndex + PAGE_SIZE, totalItems),
                      total: totalItems
                    })}
                  </p>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Modal de confirmação de exclusão */}
        {showDeleteConfirm && expenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error-100">
                    <Trash2 className="h-6 w-6 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('deleteExpense')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {expenseToDelete.description}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setExpenseToDelete(null);
                    }}
                    disabled={deleteExpense.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDeleteExpense}
                    loading={deleteExpense.isPending}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    {t('deleteConfirm')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// Export default com Suspense boundary para useSearchParams
export default function ExpensesListPage() {
  return (
    <Suspense fallback={<ExpensesListLoading />}>
      <ExpensesListContent />
    </Suspense>
  );
}
