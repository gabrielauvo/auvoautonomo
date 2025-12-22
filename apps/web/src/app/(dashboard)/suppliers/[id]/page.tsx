'use client';

/**
 * Supplier Details Page - Página de detalhes do fornecedor
 *
 * Exibe:
 * - Dados principais
 * - Lista de despesas associadas
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Skeleton,
  Alert,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  Badge,
} from '@/components/ui';
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MapPin,
  Building2,
  AlertCircle,
  Plus,
  Receipt,
  Trash2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useSupplier, useDeleteSupplier } from '@/hooks/use-suppliers';
import { formatDocument } from '@/lib/utils';

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formatar data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function SupplierDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: supplier, isLoading, error } = useSupplier(id);
  const deleteSupplier = useDeleteSupplier();

  // Handler para deletar fornecedor
  const handleDelete = async () => {
    try {
      await deleteSupplier.mutateAsync(id);
      router.push('/suppliers');
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link href="/suppliers">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{supplier?.name}</h1>
                  </div>
                  <p className="text-gray-500 mt-1 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {supplier?.document ? formatDocument(supplier.document) : 'Sem documento'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            <Link href={`/suppliers/${id}/edit`}>
              <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
                Editar
              </Button>
            </Link>
            <Button
              variant="soft"
              leftIcon={<Receipt className="h-4 w-4" />}
              onClick={() => router.push(`/expenses/new?supplierId=${id}`)}
            >
              Nova Despesa
            </Button>
            <Button
              variant="ghost"
              leftIcon={<Trash2 className="h-4 w-4 text-error" />}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Excluir
            </Button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Erro ao carregar fornecedor
            </div>
          </Alert>
        )}

        {/* Conteúdo principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna lateral - Dados */}
          <div className="lg:col-span-1 space-y-6">
            {/* Dados de contato */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados de Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </>
                ) : (
                  <>
                    {supplier?.phone && (
                      <a
                        href={`tel:${supplier.phone.replace(/\D/g, '')}`}
                        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Phone className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Telefone</p>
                          <p className="text-sm font-medium text-primary hover:underline">{supplier.phone}</p>
                        </div>
                      </a>
                    )}
                    {supplier?.email && (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="flex items-center gap-3 hover:bg-gray-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Mail className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium break-all text-primary hover:underline">{supplier.email}</p>
                        </div>
                      </a>
                    )}
                    {supplier?.address && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <MapPin className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Endereço</p>
                          <p className="text-sm font-medium">{supplier.address}</p>
                        </div>
                      </div>
                    )}
                    {!supplier?.phone && !supplier?.email && !supplier?.address && (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Nenhum dado de contato cadastrado
                      </p>
                    )}
                    {supplier?.createdAt && (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Cadastrado em {formatDate(supplier.createdAt)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Observações */}
            {supplier?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {supplier.notes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Resumo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="p-2 rounded-lg bg-white text-gray-500">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total de Despesas</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {supplier?._count?.expenses || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coluna principal - Despesas */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Despesas</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => router.push(`/expenses/new?supplierId=${id}`)}
                  >
                    Nova Despesa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Receipt}
                  title="Nenhuma despesa cadastrada"
                  description="As despesas deste fornecedor aparecerão aqui"
                  action={{
                    label: 'Cadastrar Despesa',
                    onClick: () => router.push(`/expenses/new?supplierId=${id}`),
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modal de confirmação de exclusão */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error-100">
                    <Trash2 className="h-6 w-6 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Excluir fornecedor?
                    </h3>
                    <p className="text-sm text-gray-500">
                      {supplier?.name}
                    </p>
                  </div>
                </div>

                {(supplier?._count?.expenses || 0) > 0 && (
                  <Alert variant="warning" className="mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">Atenção</p>
                        <p>
                          Este fornecedor possui {supplier?._count?.expenses} despesa(s) associada(s).
                          As despesas permanecerão no sistema.
                        </p>
                      </div>
                    </div>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteSupplier.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDelete}
                    loading={deleteSupplier.isPending}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
