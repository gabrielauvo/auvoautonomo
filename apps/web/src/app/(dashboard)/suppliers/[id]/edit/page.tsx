'use client';

/**
 * Edit Supplier Page - Página de edição de fornecedor
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { SupplierForm } from '@/components/suppliers';
import { Button, Skeleton, Alert, Card, CardContent } from '@/components/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useSupplier } from '@/hooks/use-suppliers';
import { useTranslations } from '@/i18n';

export default function EditSupplierPage() {
  const { t } = useTranslations('suppliers');
  const params = useParams();
  const id = params.id as string;

  const { data: supplier, isLoading, error } = useSupplier(id);

  if (isLoading) {
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

  if (error || !supplier) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/suppliers">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('editSupplier')}</h1>
            </div>
          </div>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('supplierNotFound')}
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
          <Link href={`/suppliers/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('editSupplier')}</h1>
            <p className="text-gray-500 mt-1">
              {supplier.name}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <SupplierForm supplier={supplier} />
      </div>
    </AppLayout>
  );
}
