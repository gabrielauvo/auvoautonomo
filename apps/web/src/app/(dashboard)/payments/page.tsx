'use client';

/**
 * Payments Page - Página de Financeiro
 *
 * Redireciona para a página de cobranças (/billing/charges)
 * O módulo financeiro principal é gerenciado em /billing/charges
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { Skeleton } from '@/components/ui';

export default function PaymentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/billing/charges');
  }, [router]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </AppLayout>
  );
}
