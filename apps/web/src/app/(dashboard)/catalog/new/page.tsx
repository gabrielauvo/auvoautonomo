'use client';

/**
 * New Catalog Item Page - Página de criação de item
 */

import { AppLayout } from '@/components/layout';
import { CatalogItemForm } from '@/components/catalog';
import { Card, CardContent, Skeleton } from '@/components/ui';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NewCatalogItemPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar para o catálogo
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Novo Item</h1>
          <p className="text-gray-500 mt-1">
            Adicione um novo produto, serviço ou kit ao seu catálogo
          </p>
        </div>

        {/* Formulário */}
        <CatalogItemForm />
      </div>
    </AppLayout>
  );
}
