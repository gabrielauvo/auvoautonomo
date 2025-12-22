'use client';

/**
 * New Expense Page - Página de criação de despesa
 */

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { ExpenseForm } from '@/components/expenses';
import { Button, Skeleton, Card, CardContent } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function NewExpenseLoading() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
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

function NewExpenseContent() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/expenses">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nova Despesa</h1>
            <p className="text-gray-500 mt-1">
              Cadastre uma nova conta a pagar
            </p>
          </div>
        </div>

        {/* Formulário */}
        <ExpenseForm />
      </div>
    </AppLayout>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={<NewExpenseLoading />}>
      <NewExpenseContent />
    </Suspense>
  );
}
