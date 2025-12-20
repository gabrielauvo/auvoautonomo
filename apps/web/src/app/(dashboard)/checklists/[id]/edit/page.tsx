'use client';

/**
 * Edit Checklist Template Page
 *
 * Página para editar um template de checklist existente
 */

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Alert } from '@/components/ui';
import { AppLayout } from '@/components/layout';
import { ChecklistTemplateForm } from '@/components/checklists';
import { useChecklistTemplate } from '@/hooks/use-checklists';
import { useTranslations } from '@/i18n';

function EditChecklistTemplateLoading() {
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

function EditChecklistTemplateContent() {
  const params = useParams();
  const { t } = useTranslations('checklists');
  const templateId = params.id as string;

  const { data: template, isLoading, error } = useChecklistTemplate(templateId);

  if (isLoading) {
    return <EditChecklistTemplateLoading />;
  }

  if (error || !template) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/checklists">
              <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
                {t('back')}
              </Button>
            </Link>
          </div>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('templateNotFound')}
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/checklists/${template.id}`}>
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              {t('back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('editTemplate')}</h1>
            <p className="text-sm text-gray-500">
              {template.name}
            </p>
          </div>
        </div>

        {/* Form */}
        <ChecklistTemplateForm template={template} isEditing />
      </div>
    </AppLayout>
  );
}

export default function EditChecklistTemplatePage() {
  return (
    <Suspense fallback={<EditChecklistTemplateLoading />}>
      <EditChecklistTemplateContent />
    </Suspense>
  );
}
