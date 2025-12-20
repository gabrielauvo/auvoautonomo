'use client';

/**
 * New Client Page - Página de criação de cliente
 */

import { AppLayout } from '@/components/layout';
import { ClientForm } from '@/components/clients';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from '@/i18n';

export default function NewClientPage() {
  const { t } = useTranslations('clients');

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('newClient')}</h1>
            <p className="text-gray-500 mt-1">
              {t('fillClientData')}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <ClientForm />
      </div>
    </AppLayout>
  );
}
