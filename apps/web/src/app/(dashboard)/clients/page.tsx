'use client';

/**
 * Clients List Page - Listagem de clientes
 *
 * Exibe:
 * - Barra de busca
 * - Tabela de clientes
 * - Paginação
 * - Banner de uso do plano
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
  Badge,
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
  Users,
  Eye,
  Edit,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  Upload,
  Trash2,
  X,
} from 'lucide-react';
import { useClients, useDeleteClients } from '@/hooks/use-clients';
import { useAuth } from '@/context/auth-context';
import { Client } from '@/services/clients.service';
import { useTranslations } from '@/i18n';
import { formatDocument } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

// Número de itens por página
const PAGE_SIZE = 10;

// Componente de loading para Suspense
function ClientsListLoading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
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
function ClientsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { billing } = useAuth();
  const { t } = useTranslations('clients');
  const { t: tCommon } = useTranslations('common');

  // Ler estado inicial da URL
  const initialSearch = searchParams.get('q') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Hook para deletar clientes em lote
  const deleteClients = useDeleteClients();

  // Atualiza URL quando busca ou página muda
  const updateURL = useCallback((newSearch: string, newPage: number) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('q', newSearch);
    if (newPage > 1) params.set('page', String(newPage));
    const query = params.toString();
    router.replace(`/clients${query ? `?${query}` : ''}`, { scroll: false });
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

  // Query de clientes
  const {
    data: clients,
    isLoading,
    error,
    refetch,
  } = useClients(debouncedSearch || undefined);

  // Paginação local (frontend)
  const totalItems = clients?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedClients = clients?.slice(startIndex, startIndex + PAGE_SIZE) || [];

  // Com o novo modelo de billing, não há limite de clientes
  // Trial e PRO têm tudo liberado
  const isAtLimit = false;

  // Handler para novo cliente
  const handleNewClient = useCallback(() => {
    if (isAtLimit) {
      setShowUpsellModal(true);
    } else {
      router.push('/clients/new');
    }
  }, [isAtLimit, router]);

  // Verificar se cliente tem pagamentos em atraso (simplificado)
  const hasOverdue = (client: Client) => {
    // TODO: Implementar verificação real quando tiver endpoint
    return false;
  };

  // Funções de seleção
  const toggleSelectClient = useCallback((id: string) => {
    setSelectedClients(prev => {
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
    if (selectedClients.size === paginatedClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(paginatedClients.map(c => c.id)));
    }
  }, [selectedClients.size, paginatedClients]);

  const clearSelection = useCallback(() => {
    setSelectedClients(new Set());
  }, []);

  // Handler para deletar clientes selecionados
  const handleDeleteSelected = useCallback(async () => {
    if (selectedClients.size === 0) return;

    try {
      await deleteClients.mutateAsync(Array.from(selectedClients));
      setSelectedClients(new Set());
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Erro ao excluir clientes:', error);
    }
  }, [selectedClients, deleteClients]);

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
          <div className="flex gap-2">
            <Link href="/clients/import">
              <Button variant="outline" leftIcon={<Upload className="h-4 w-4" />}>
                {t('importClients')}
              </Button>
            </Link>
            <Button onClick={handleNewClient} leftIcon={<Plus className="h-4 w-4" />}>
              {t('newClient')}
            </Button>
          </div>
        </div>

        {/* Banner de uso do plano */}
        <PlanLimitBanner resource="clients" />

        {/* Barra de seleção */}
        {selectedClients.size > 0 && (
          <Card className="border-primary bg-primary-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-primary">
                    {selectedClients.size} {selectedClients.size === 1 ? 'cliente selecionado' : 'clientes selecionados'}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-gray-600"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar seleção
                  </Button>
                </div>
                <Button
                  variant="error"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Excluir selecionados
                </Button>
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

        {/* Tabela de clientes */}
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
          ) : paginatedClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? t('noClientsFound') : t('noClients')}
              description={
                search
                  ? t('tryDifferentSearch')
                  : t('createFirstClient')
              }
              action={
                !search
                  ? {
                      label: t('newClient'),
                      onClick: handleNewClient,
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
                        checked={paginatedClients.length > 0 && selectedClients.size === paginatedClients.length}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>{t('client')}</TableHead>
                    <TableHead>{t('document')}</TableHead>
                    <TableHead>{t('contact')}</TableHead>
                    <TableHead>{t('location')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow key={client.id} className={selectedClients.has(client.id) ? 'bg-primary-50' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedClients.has(client.id)}
                          onChange={() => toggleSelectClient(client.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/clients/${client.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary font-medium">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 hover:text-primary hover:underline">{client.name}</p>
                            {client._count && (
                              <p className="text-xs text-gray-500">
                                {client._count.quotes} {t('quotes')} • {client._count.workOrders} {t('workOrders')}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {formatDocument(client.taxId)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.city || client.state ? (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <MapPin className="h-3 w-3" />
                            {[client.city, client.state].filter(Boolean).join(' - ')}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasOverdue(client) ? (
                          <Badge variant="error" size="sm">
                            {t('overdue')}
                          </Badge>
                        ) : (
                          <Badge variant="soft-success" size="sm">
                            {t('upToDate')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/clients/${client.id}`}>
                            <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/clients/${client.id}/edit`}>
                            <Button variant="ghost" size="icon-sm" title={tCommon('edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
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
                    {t('showing')} {startIndex + 1} {t('to')} {Math.min(startIndex + PAGE_SIZE, totalItems)} {t('of')} {totalItems} {t('clients')}
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
          resource="CLIENT"
          currentPlan={billing?.planKey || 'TRIAL'}
          max={-1}
          current={0}
        />

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
                      Excluir {selectedClients.size} {selectedClients.size === 1 ? 'cliente' : 'clientes'}?
                    </h3>
                    <p className="text-sm text-gray-500">
                      Esta ação não pode ser desfeita.
                    </p>
                  </div>
                </div>

                <Alert variant="warning" className="mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Atenção</p>
                      <p>
                        Todos os dados associados a estes clientes (orçamentos, OS, cobranças)
                        permanecerão no sistema, mas ficarão órfãos.
                      </p>
                    </div>
                  </div>
                </Alert>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteClients.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="error"
                    onClick={handleDeleteSelected}
                    loading={deleteClients.isPending}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Excluir {selectedClients.size} {selectedClients.size === 1 ? 'cliente' : 'clientes'}
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
export default function ClientsListPage() {
  return (
    <Suspense fallback={<ClientsListLoading />}>
      <ClientsListContent />
    </Suspense>
  );
}
