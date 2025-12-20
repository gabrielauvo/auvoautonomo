'use client';

/**
 * Edit Quote Page - Página de edição de orçamento
 */

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { QuoteForm } from '@/components/quotes';
import { Button, Skeleton, Alert } from '@/components/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useQuote } from '@/hooks/use-quotes';
import { useTranslations } from '@/i18n';

export default function EditQuotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t } = useTranslations('quotes');
  const { t: tCommon } = useTranslations('common');

  const { data: quote, isLoading, error } = useQuote(id);

  // Verifica se pode editar (apenas DRAFT)
  const canEdit = quote?.status === 'DRAFT';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !quote) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('quoteNotFound')}
            </div>
          </Alert>
          <Link href="/quotes">
            <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              {tCommon('backToList')}
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!canEdit) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Alert variant="warning">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('cannotEditQuote')}
            </div>
          </Alert>
          <Link href={`/quotes/${id}`}>
            <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              {t('viewDetails')}
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/quotes/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('editQuote')}</h1>
            <p className="text-gray-500 mt-1">
              {t('client')}: {quote.client?.name}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <QuoteForm quote={quote} />
      </div>
    </AppLayout>
  );
}
