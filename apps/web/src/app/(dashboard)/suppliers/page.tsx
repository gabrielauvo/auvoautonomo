'use client';

/**
 * Suppliers List Page - Listagem de fornecedores
 *
 * Exibe:
 * - Barra de busca
 * - Tabela de fornecedores
 * - Paginação
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import { PlanLimitBanner, UpsellModal } from '@/components/billing';
import {
  Card,
  CardContent,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Skeleton,
  Alert,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  Plus,
  Search,
  Building2,
  Eye,
  Edit,
  Phone,
  Mail,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useSuppliers, useDeleteSupplier } from '@/hooks/use-suppliers';
import { useAuth } from '@/context/auth-context';
import { Supplier } from '@/services/suppliers.service';
import { formatDocument } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useTranslations } from '@/i18n';

// Número de itens por página
const PAGE_SIZE = 10;

// Componente de loading para Suspense
function SuppliersListLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="py-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Componente interno que usa useSearchParams
function SuppliersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t } = useTranslations('suppliers');

  // Ler estado inicial da URL
  const initialSearch = searchParams.get('q') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Hook para deletar fornecedor
  const deleteSupplier = useDeleteSupplier();

  // Atualiza URL quando busca ou página muda
  const updateURL = useCallback((newSearch: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('q', newSearch);
    if (newPage > 1) params.set('page', String(newPage));
    const query = params.toString();
    router.replace(`/suppliers${query ? `?${query}` : ''}`, { scroll: false });
  }, [router]);

  // Atualiza URL quando busca muda (após debounce)
  useEffect(() => {
    setCurrentPage(1);
    updateURL(debouncedSearch, 1);
  }, [debouncedSearch]);

  // Atualiza URL quando página muda
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    updateURL(debouncedSearch, page);
  }, [debouncedSearch, updateURL]);

  // Query de fornecedores
  const {
    data: suppliers,
    isLoading,
    error,
  } = useSuppliers(debouncedSearch || undefined);

  // Paginação local (frontend)
  const totalItems = suppliers?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedSuppliers = suppliers?.slice(startIndex, startIndex + PAGE_SIZE) || [];

  // Com o novo modelo de billing, não há limite de fornecedores
  // Trial e PRO têm tudo liberado
  const isAtLimit = false;

  // Handler para novo fornecedor
  const handleNewSupplier = useCallback(() => {
    if (isAtLimit) {
      setShowUpsellModal(true);
    } else {
      router.push('/suppliers/new');
    }
  }, [isAtLimit, router]);

  // Funções de seleção
  const toggleSelectSupplier = useCallback((id: string) => {
    setSelectedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedSuppliers.size === paginatedSuppliers.length) {
      setSelectedSuppliers(new Set());
    } else {
      setSelectedSuppliers(new Set(paginatedSuppliers.map(s => s.id)));
    }
  }, [selectedSuppliers.size, paginatedSuppliers]);

  const clearSelection = useCallback(() => {
    setSelectedSuppliers(new Set());
  }, []);

  // Handler para deletar fornecedor
  const handleDeleteSupplier = useCallback(async () => {
    if (!supplierToDelete) return;

    try {
      await deleteSupplier.mutateAsync(supplierToDelete.id);
      setSupplierToDelete(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Erro ao excluir fornecedor:', error);
    }
  }, [supplierToDelete, deleteSupplier]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={handleNewSupplier} leftIcon={<Plus className="h-4 w-4" />}>
            {t('newSupplier')}
          </Button>
        </div>

        {/* Banner de uso do plano */}
        <PlanLimitBanner resource="suppliers" />

        {/* Barra de seleção */}
        {selectedSuppliers.size > 0 && (
          <Card className="border-primary bg-primary-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    {selectedSuppliers.size === 1
                      ? t('suppliersSelected', { count: selectedSuppliers.size })
                      : t('suppliersSelectedPlural', { count: selectedSuppliers.size })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-gray-600"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t('clearSelection')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Barra de busca */}
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Erro */}
        {error && (
          <Alert variant="error">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {t('errorLoading')}
            </div>
          </Alert>
        )}

        {/* Tabela de fornecedores */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : paginatedSuppliers.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search ? t('noSuppliersFound') : t('noSuppliers')}
              description={
                search
                  ? t('tryDifferentSearch')
                  : t('createFirstSupplier')
              }
              action={
                !search
                  ? {
                      label: t('newSupplier'),
                      onClick: handleNewSupplier,
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={paginatedSuppliers.length > 0 && selectedSuppliers.size === paginatedSuppliers.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t('supplier')}</TableHead>
                    <TableHead>{t('document')}</TableHead>
                    <TableHead>{t('contact')}</TableHead>
                    <TableHead>{t('expenses')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className={selectedSuppliers.has(supplier.id) ? 'bg-primary-50' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedSuppliers.has(supplier.id)}
                          onChange={() => toggleSelectSupplier(supplier.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/suppliers/${supplier.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
                            {supplier.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 hover:text-primary hover:underline">{supplier.name}</p>
                            {supplier.address && (
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                {supplier.address}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {supplier.document ? (
                          <span className="font-mono text-sm">
                            {formatDocument(supplier.document)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {supplier.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {supplier.phone}
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="h-3 w-3" />
                              {supplier.email}
                            </div>
                          )}
                          {!supplier.phone && !supplier.email && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {t('expensesCount', { count: supplier._count?.expenses || 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/suppliers/${supplier.id}`}>
                            <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/suppliers/${supplier.id}/edit`}>
                            <Button variant="ghost" size="icon-sm" title={t('edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={t('delete')}
                            onClick={() => {
                              setSupplierToDelete(supplier);
                              setShowDeleteConfirm(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-error" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    {t('showing', {
                      start: startIndex + 1,
                      end: Math.min(startIndex + PAGE_SIZE, totalItems),
                      total: totalItems
                    })}
                  </p>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </Card>

        {/* Modal de Upsell */}
        <UpsellModal
          isOpen={showUpsellModal}
          onClose={() => setShowUpsellModal(false)}
          resource="SUPPLIER"
          currentPlan={billing?.planKey || 'TRIAL'}
          max={-1}
          current={0}
        />

        {/* Modal de confirmação de exclusão */}
        {showDeleteConfirm && supplierToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error-100">
                    <Trash2 className="h-6 w-6 text-error" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {t('deleteSupplier')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {supplierToDelete.name}
                    </p>
                  </div>
                </div>

                {(supplierToDelete._count?.expenses || 0) > 0 && (
                  <Alert variant="warning" className="mb-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">{t('attention')}</p>
                        <p>
                          {t('supplierHasExpenses', { count: supplierToDelete._count?.expenses })}
                        </p>
                      </div>
                    </div>
                  </Alert>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setSupplierToDelete(null);
                    }}
                    disabled={deleteSupplier.isPending}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDeleteSupplier}
                    loading={deleteSupplier.isPending}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    {t('deleteConfirm')}
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

// Export default com Suspense boundary para useSearchParams
export default function SuppliersListPage() {
  return (
    <Suspense fallback={<SuppliersListLoading />}>
      <SuppliersListContent />
    </Suspense>
  );
}
