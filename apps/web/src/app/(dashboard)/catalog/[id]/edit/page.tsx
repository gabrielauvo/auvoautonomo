'use client';

/**
 * Edit Catalog Item Page - Página de edição de item
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { CatalogItemForm } from '@/components/catalog';
import { Card, CardContent, Skeleton, Alert } from '@/components/ui';
import { useCatalogItem, useBundleItems } from '@/hooks/use-catalog';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/i18n';

// Loading skeleton
function EditItemSkeleton() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardContent className="py-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function EditCatalogItemPage() {
  const { t } = useTranslations('catalog');
  const params = useParams();
  const id = params.id as string;

  const { data: item, isLoading, error } = useCatalogItem(id);
  const { data: bundleItems, isLoading: isLoadingBundle } = useBundleItems(
    item?.type === 'BUNDLE' ? id : undefined
  );

  if (isLoading || (item?.type === 'BUNDLE' && isLoadingBundle)) {
    return <EditItemSkeleton />;
  }

  if (error || !item) {
    return (
      <AppLayout>
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('itemNotFoundError')}
          </div>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href={`/catalog/${item.id}`}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('backToDetails')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('editItem')}</h1>
          <p className="text-gray-500 mt-1">
            {item.name}
          </p>
        </div>

        {/* Formulário */}
        <CatalogItemForm item={item} bundleItems={bundleItems} />
      </div>
    </AppLayout>
  );
}
