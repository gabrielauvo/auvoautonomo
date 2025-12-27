'use client';

/**
 * Edit Expense Page - Página de edição de despesa
 */

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { ExpenseForm } from '@/components/expenses';
import { Button, Skeleton, Alert, Card, CardContent } from '@/components/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useExpense } from '@/hooks/use-expenses';
import { useTranslations } from '@/i18n';

function EditExpenseLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="py-8">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function EditExpenseContent() {
  const { t } = useTranslations('expenses');
  const params = useParams();
  const id = params.id as string;

  const { data: expense, isLoading, error } = useExpense(id);

  if (isLoading) {
    return <EditExpenseLoading />;
  }

  if (error || !expense) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/expenses">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('editExpense')}</h1>
            </div>
          </div>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('expenseNotFound')}
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/expenses/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('editExpense')}</h1>
            <p className="text-gray-500 mt-1">
              {expense.description}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <ExpenseForm expense={expense} />
      </div>
    </AppLayout>
  );
}

export default function EditExpensePage() {
  return (
    <Suspense fallback={<EditExpenseLoading />}>
      <EditExpenseContent />
    </Suspense>
  );
}
