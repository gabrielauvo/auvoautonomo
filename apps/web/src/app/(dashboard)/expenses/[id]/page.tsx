'use client';

/**
 * Expense Details Page - Página de detalhes da despesa
 *
 * Exibe:
 * - Dados da despesa
 * - Ações (editar, marcar como pago, excluir)
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Alert,
} from '@/components/ui';
import {
  ArrowLeft,
  Edit,
  Trash2,
  AlertCircle,
  Calendar,
  DollarSign,
  Building2,
  Folder,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { useExpense, useDeleteExpense, useMarkExpenseAsPaid } from '@/hooks/use-expenses';
import { getStatusColor } from '@/services/expenses.service';
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/hooks/use-formatting';

export default function ExpenseDetailsPage() {
  const { t } = useTranslations('expenses');
  const { formatCurrency, formatDate, locale } = useFormatting();
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);

  const { data: expense, isLoading, error } = useExpense(id);
  const deleteExpense = useDeleteExpense();
  const markAsPaid = useMarkExpenseAsPaid();

  // Payment method labels (memoized with locale)
  const paymentMethodLabels = useMemo(() => ({
    CASH: t('paymentMethod.cash'),
    PIX: t('paymentMethod.pix'),
    CREDIT_CARD: t('paymentMethod.creditCard'),
    DEBIT_CARD: t('paymentMethod.debitCard'),
    BANK_TRANSFER: t('paymentMethod.bankTransfer'),
    BOLETO: t('paymentMethod.boleto'),
    OTHER: t('paymentMethod.other'),
  }), [t, locale]);

  // Status labels (memoized with locale)
  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: t('status.draft'),
      PENDING: t('status.pending'),
      PAID: t('status.paid'),
      CANCELED: t('status.canceled'),
    };
    return statusMap[status] || status;
  };

  // Handler para deletar despesa
  const handleDelete = async () => {
    try {
      await deleteExpense.mutateAsync(id);
      router.push('/expenses');
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
    }
  };

  // Handler para marcar como pago
  const handleMarkAsPaid = async () => {
    try {
      await markAsPaid.mutateAsync({
        id,
        data: {
          paymentMethod: expense?.paymentMethod || 'PIX',
          paidAt: new Date().toISOString().split('T')[0]
        }
      });
      setShowPayConfirm(false);
    } catch (err) {
      console.error('Erro ao marcar como pago:', err);
    }
  };

  // Status icon
  const StatusIcon = () => {
    switch (expense?.status) {
      case 'PAID':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-warning" />;
      case 'CANCELED':
        return <XCircle className="h-5 w-5 text-error" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  // Status badge
  const StatusBadge = () => {
    if (!expense) return null;
    const color = getStatusColor(expense.status);
    const label = getStatusLabel(expense.status);

    const variants: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
      gray: 'default',
      yellow: 'warning',
      green: 'success',
      red: 'error',
    };

    return (
      <Badge variant={variants[color] || 'default'}>
        {label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/expenses">
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
                    <h1 className="text-2xl font-bold text-gray-900">{expense?.description}</h1>
                    <StatusBadge />
                  </div>
                  {expense?.invoiceNumber && (
                    <p className="text-gray-500 mt-1">
                      NF: {expense.invoiceNumber}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            {expense?.status === 'PENDING' && (
              <Button
                variant="soft"
                leftIcon={<CheckCircle2 className="h-4 w-4" />}
                onClick={() => setShowPayConfirm(true)}
              >
                {t('markAsPaid')}
              </Button>
            )}
            <Link href={`/expenses/${id}/edit`}>
              <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
                {t('edit')}
              </Button>
            </Link>
            <Button
              variant="ghost"
              leftIcon={<Trash2 className="h-4 w-4 text-error" />}
              onClick={() => setShowDeleteConfirm(true)}
            >
              {t('delete')}
            </Button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('errorLoading')}
            </div>
          </Alert>
        )}

        {/* Conteúdo principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dados da despesa */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('expenseInfo')}</CardTitle>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t('amount')}</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(expense?.amount || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t('dueDate')}</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-lg font-medium">
                            {expense?.dueDate ? formatDate(new Date(expense.dueDate)) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-4 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t('statusLabel')}</p>
                        <div className="flex items-center gap-2">
                          <StatusIcon />
                          <span className="font-medium">{getStatusLabel(expense?.status || 'DRAFT')}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t('paymentMethodLabel')}</p>
                        <span className="font-medium">
                          {expense?.paymentMethod ? paymentMethodLabels[expense.paymentMethod as keyof typeof paymentMethodLabels] : '-'}
                        </span>
                      </div>
                    </div>

                    {expense?.paymentDate && (
                      <div className="border-t pt-4">
                        <p className="text-xs text-gray-500 mb-1">{t('paymentDate')}</p>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="font-medium text-success">
                            {formatDate(new Date(expense.paymentDate))}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Observações */}
            {expense?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('notes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {expense.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coluna lateral */}
          <div className="space-y-6">
            {/* Fornecedor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {t('supplier')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-5 w-full" />
                ) : expense?.supplier ? (
                  <Link
                    href={`/suppliers/${expense.supplier.id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
                      {expense.supplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 hover:text-primary">
                        {expense.supplier.name}
                      </p>
                      {expense.supplier.document && (
                        <p className="text-xs text-gray-500">{expense.supplier.document}</p>
                      )}
                    </div>
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {t('noSupplierAssociated')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Categoria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  {t('category')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-5 w-full" />
                ) : expense?.category ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: expense.category.color || '#6B7280' }}
                    />
                    <span className="font-medium text-gray-900">
                      {expense.category.name}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {t('noCategory')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Informações adicionais */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('additionalInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {expense?.createdAt && (
                  <div>
                    <p className="text-xs text-gray-500">{t('createdAt')}</p>
                    <p className="text-sm">{formatDate(new Date(expense.createdAt))}</p>
                  </div>
                )}
                {expense?.updatedAt && (
                  <div>
                    <p className="text-xs text-gray-500">{t('updatedAt')}</p>
                    <p className="text-sm">{formatDate(new Date(expense.updatedAt))}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de confirmação de exclusão */}
        {showDeleteConfirm && (
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
                      {expense?.description}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteExpense.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDelete}
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

        {/* Modal de confirmação de pagamento */}
        {showPayConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success-100">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('markAsPaidQuestion')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {expense?.description} - {formatCurrency(expense?.amount || 0)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowPayConfirm(false)}
                    disabled={markAsPaid.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="soft"
                    onClick={handleMarkAsPaid}
                    loading={markAsPaid.isPending}
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    {t('confirmPayment')}
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
