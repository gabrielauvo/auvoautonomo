'use client';

/**
 * New Quote Page - Página de criação de orçamento
 *
 * Suporta pré-seleção de cliente via ?clientId=XXX
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { QuoteForm } from '@/components/quotes';
import { Button, Skeleton } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/i18n';

function NewQuoteContent() {
  const { t } = useTranslations('quotes');
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId') || undefined;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/quotes">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('newQuote')}</h1>
          <p className="text-gray-500 mt-1">
            {t('createQuoteDescription')}
          </p>
        </div>
      </div>

      {/* Formulário */}
      <QuoteForm preselectedClientId={clientId} />
    </div>
  );
}

export default function NewQuotePage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="space-y-6 max-w-4xl mx-auto">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <NewQuoteContent />
      </Suspense>
    </AppLayout>
  );
}
