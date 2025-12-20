'use client';

/**
 * Edit Client Page - Página de edição de cliente
 */

import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { ClientForm } from '@/components/clients';
import { Button, Skeleton, Alert } from '@/components/ui';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useClient } from '@/hooks/use-clients';
import { useTranslations } from '@/i18n';

export default function EditClientPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: client, isLoading, error } = useClient(id);
  const { t } = useTranslations('clients');

  const handleSuccess = () => {
    router.push(`/clients/${id}`);
  };

  const handleCancel = () => {
    router.push(`/clients/${id}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/clients/${id}`}>
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('editClient')}</h1>
            <p className="text-gray-500 mt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-40" />
              ) : (
                client?.name || t('updateClientData')
              )}
            </p>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {/* Erro */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('loadError')}
            </div>
          </Alert>
        )}

        {/* Formulário */}
        {client && (
          <ClientForm
            client={client}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        )}
      </div>
    </AppLayout>
  );
}
