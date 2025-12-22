'use client';

/**
 * New Supplier Page - Página de criação de fornecedor
 */

import { AppLayout } from '@/components/layout';
import { SupplierForm } from '@/components/suppliers';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewSupplierPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Novo Fornecedor</h1>
            <p className="text-gray-500 mt-1">
              Preencha os dados do fornecedor
            </p>
          </div>
        </div>

        {/* Formulário */}
        <SupplierForm />
      </div>
    </AppLayout>
  );
}
