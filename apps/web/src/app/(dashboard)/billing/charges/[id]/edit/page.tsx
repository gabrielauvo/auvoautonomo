'use client';

/**
 * Página de Edição de Cobrança
 *
 * Permite editar cobrança que esteja em status PENDING
 */

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { Button, Skeleton, Alert } from '@/components/ui';
import { ChargeForm } from '@/components/billing';
import { AppLayout } from '@/components/layout';
import { useCharge } from '@/hooks/use-charges';
import { canEditCharge, Charge } from '@/services/charges.service';

export default function EditChargePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: charge, isLoading, error } = useCharge(id);

  // Loading state
  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !charge) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Link href="/billing/charges">
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Cobrança não encontrada
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  // Check if can edit
  if (!canEditCharge(charge)) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Link href={`/billing/charges/${id}`}>
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
          <Alert variant="warning">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Esta cobrança não pode ser editada. Apenas cobranças pendentes podem ser modificadas.
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const handleSuccess = (updatedCharge: Charge) => {
    router.push(`/billing/charges/${updatedCharge.id}`);
  };

  const handleCancel = () => {
    router.push(`/billing/charges/${id}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/billing/charges/${id}`}>
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="h-4 w-4" />}>
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editar Cobrança
            </h1>
            <p className="text-sm text-gray-500">
              {charge.client?.name}
            </p>
          </div>
        </div>

        {/* Formulário */}
        <ChargeForm
          charge={charge}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </AppLayout>
  );
}
