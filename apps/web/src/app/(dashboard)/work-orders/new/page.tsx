'use client';

/**
 * Página de criação de Ordem de Serviço
 *
 * Suporta conversão de orçamento via ?quoteId=XXX
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, FileText, ArrowRight } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { Button, Skeleton, Badge } from '@/components/ui';
import { AppLayout } from '@/components/layout';
import { WorkOrderForm } from '@/components/work-orders/work-order-form';
import { useQuote } from '@/hooks/use-quotes';

function NewWorkOrderContent() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get('quoteId');
  const clientId = searchParams.get('clientId') || undefined;
  const { data: quote, isLoading: isLoadingQuote } = useQuote(quoteId || undefined);
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/work-orders">
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {tCommon('back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('newOrder')}</h1>
          <p className="text-sm text-gray-500">
            {t('fillDataToCreateNewOrder')}
          </p>
        </div>
      </div>

      {/* Banner de conversão de orçamento */}
      {quoteId && (
        <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-primary-900">
                {t('convertingQuoteToOrder')}
              </h3>
              {isLoadingQuote ? (
                <Skeleton className="h-4 w-48 mt-1" />
              ) : quote ? (
                <div className="mt-1 text-sm text-primary-700">
                  <span className="flex items-center gap-2">
                    {t('quoteNumber', { number: quote.number })}
                    <ArrowRight className="h-3 w-3" />
                    {t('newOrderFor', { client: quote.client?.name })}
                  </span>
                  <p className="mt-1">
                    {t('quoteItemsLoadedAutomatically')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-primary-700 mt-1">
                  {t('quoteNotFound')}
                </p>
              )}
            </div>
            {quote && (
              <Badge variant="primary">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(quote.totalValue)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Formulário */}
      <WorkOrderForm preselectedClientId={clientId} />
    </div>
  );
}

export default function NewWorkOrderPage() {
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
        <NewWorkOrderContent />
      </Suspense>
    </AppLayout>
  );
}
