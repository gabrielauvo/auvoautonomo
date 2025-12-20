'use client';

/**
 * Página de Edição de Ordem de Serviço
 *
 * Permite editar OS que esteja em status SCHEDULED
 */

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { Button, Skeleton, Alert } from '@/components/ui';
import { WorkOrderForm } from '@/components/work-orders/work-order-form';
import { useWorkOrder } from '@/hooks/use-work-orders';
import { canEditWorkOrder, WorkOrder } from '@/services/work-orders.service';

export default function EditWorkOrderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t } = useTranslations('workOrders');
  const { t: tCommon } = useTranslations('common');

  const { data: workOrder, isLoading, error } = useWorkOrder(id);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (error || !workOrder) {
    return (
      <div className="space-y-6">
        <Link href="/work-orders">
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {tCommon('back')}
          </Button>
        </Link>
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('orderNotFound')}
          </div>
        </Alert>
      </div>
    );
  }

  // Check if can edit
  if (!canEditWorkOrder(workOrder)) {
    return (
      <div className="space-y-6">
        <Link href={`/work-orders/${id}`}>
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {tCommon('back')}
          </Button>
        </Link>
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('cannotEditOrder')}
          </div>
        </Alert>
      </div>
    );
  }

  const handleSuccess = (updatedWorkOrder: WorkOrder) => {
    router.push(`/work-orders/${updatedWorkOrder.id}`);
  };

  const handleCancel = () => {
    router.push(`/work-orders/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/work-orders/${id}`}>
          <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
            {tCommon('back')}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('editOrderNumber', { number: workOrder.number })}
          </h1>
          <p className="text-sm text-gray-500">
            {workOrder.client?.name}
          </p>
        </div>
      </div>

      {/* Formulário */}
      <WorkOrderForm
        workOrder={workOrder}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
