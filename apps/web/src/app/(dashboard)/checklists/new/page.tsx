'use client';

/**
 * New Checklist Template Page
 *
 * Página para criar um novo template de checklist
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { AppLayout } from '@/components/layout';
import { ChecklistTemplateForm } from '@/components/checklists';
import { useTranslations } from '@/i18n';

function NewChecklistTemplateLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-20" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </AppLayout>
  );
}

function NewChecklistTemplateContent() {
  const { t } = useTranslations('checklists');

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/checklists">
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {t('back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('newTemplateTitle')}</h1>
          <p className="text-sm text-gray-500">
            {t('newTemplateSubtitle')}
          </p>
        </div>
      </div>

      {/* Form */}
      <ChecklistTemplateForm />
      </div>
    </AppLayout>
  );
}

export default function NewChecklistTemplatePage() {
  return (
    <Suspense fallback={<NewChecklistTemplateLoading />}>
      <NewChecklistTemplateContent />
    </Suspense>
  );
}
