'use client';

/**
 * Página de criação de Cobrança
 *
 * Suporta pré-seleção de cliente via ?clientId=XXX
 * Suporta vínculo com OS via ?workOrderId=XXX
 * Suporta vínculo com orçamento via ?quoteId=XXX
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { ChargeForm } from '@/components/billing';
import { AppLayout } from '@/components/layout';

function NewChargeContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId') || undefined;
  const workOrderId = searchParams.get('workOrderId') || undefined;
  const quoteId = searchParams.get('quoteId') || undefined;
  const valueParam = searchParams.get('value');
  const descriptionParam = searchParams.get('description');

  const defaultValue = valueParam ? parseFloat(valueParam) : undefined;
  const defaultDescription = descriptionParam ? decodeURIComponent(descriptionParam) : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/billing/charges">
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Cobrança</h1>
          <p className="text-sm text-gray-500">
            Crie uma nova cobrança para seu cliente
          </p>
        </div>
      </div>

      {/* Formulário */}
      <ChargeForm
        preselectedClientId={clientId}
        workOrderId={workOrderId}
        quoteId={quoteId}
        defaultValue={defaultValue}
        defaultDescription={defaultDescription}
      />
    </div>
  );
}

export default function NewChargePage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <NewChargeContent />
      </Suspense>
    </AppLayout>
  );
}
