'use client';

/**
 * Catalog List Page - Listagem do Catálogo
 *
 * Exibe:
 * - Filtros por tipo (Produto, Serviço, Kit)
 * - Filtros por categoria e status
 * - Tabela de itens do catálogo
 * - Ações de edição e ativação/desativação
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
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
  Select,
} from '@/components/ui';
import {
  Plus,
  Search,
  Package,
  Wrench,
  Layers,
  Eye,
  Edit,
  AlertCircle,
  Power,
  PowerOff,
  Filter,
} from 'lucide-react';
import { useCatalogItems, useCategories, useToggleItemStatus } from '@/hooks/use-catalog';
import { CatalogItem, ItemType, formatItemType, getItemTypeBadgeColor } from '@/services/catalog.service';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import { useDebounce } from '@/hooks/use-debounce';

// Número de itens por página
const PAGE_SIZE = 15;

// Componente de loading
function CatalogListLoading() {
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
            <div className="flex gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-16" />
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
function CatalogListContent() {
  const { t } = useTranslations('catalog');
  const router = useRouter();
  const searchParams = useSearchParams();
  const toggleStatus = useToggleItemStatus();

  // Configuração de tipos com ícones
  const typeConfig: Record<ItemType | 'ALL', { icon: React.ElementType; label: string }> = {
    ALL: { icon: Package, label: t('all') },
    PRODUCT: { icon: Package, label: t('products') },
    SERVICE: { icon: Wrench, label: t('services') },
    BUNDLE: { icon: Layers, label: t('kits') },
  };

  // Ler estado inicial da URL
  const initialSearch = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as ItemType | 'ALL') || 'ALL';
  const initialCategory = searchParams.get('category') || '';
  const initialStatus = searchParams.get('status') || 'all';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  const [selectedType, setSelectedType] = useState<ItemType | 'ALL'>(initialType);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Atualiza URL quando filtros mudam
  const updateURL = useCallback((
    newSearch: string,
    newType: ItemType | 'ALL',
    newCategory: string,
    newStatus: string,
    newPage: number
  ) => {
    const params = new URLSearchParams();
    if (newSearch) params.set('q', newSearch);
    if (newType !== 'ALL') params.set('type', newType);
    if (newCategory) params.set('category', newCategory);
    if (newStatus !== 'all') params.set('status', newStatus);
    if (newPage > 1) params.set('page', String(newPage));
    const query = params.toString();
    router.replace(`/catalog${query ? `?${query}` : ''}`, { scroll: false });
  }, [router]);

  // Atualiza URL quando busca muda (após debounce)
  useEffect(() => {
    setCurrentPage(1);
    updateURL(debouncedSearch, selectedType, selectedCategory, selectedStatus, 1);
  }, [debouncedSearch]);

  // Handlers de filtro
  const handleTypeChange = useCallback((type: ItemType | 'ALL') => {
    setSelectedType(type);
    setCurrentPage(1);
    updateURL(debouncedSearch, type, selectedCategory, selectedStatus, 1);
  }, [debouncedSearch, selectedCategory, selectedStatus, updateURL]);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    updateURL(debouncedSearch, selectedType, category, selectedStatus, 1);
  }, [debouncedSearch, selectedType, selectedStatus, updateURL]);

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    updateURL(debouncedSearch, selectedType, selectedCategory, status, 1);
  }, [debouncedSearch, selectedType, selectedCategory, updateURL]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    updateURL(debouncedSearch, selectedType, selectedCategory, selectedStatus, page);
  }, [debouncedSearch, selectedType, selectedCategory, selectedStatus, updateURL]);

  // Queries
  const { data: categories } = useCategories();
  const {
    data: items,
    isLoading,
    error,
  } = useCatalogItems({
    type: selectedType === 'ALL' ? undefined : selectedType,
    categoryId: selectedCategory || undefined,
    search: debouncedSearch || undefined,
    isActive: selectedStatus === 'all' ? undefined : selectedStatus === 'active',
  });

  // Paginação local
  const totalItems = items?.length || 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedItems = items?.slice(startIndex, startIndex + PAGE_SIZE) || [];

  // Toggle status do item
  const handleToggleStatus = useCallback((item: CatalogItem) => {
    toggleStatus.mutate({ id: item.id, isActive: !item.isActive });
  }, [toggleStatus]);

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Ícone do tipo
  const getTypeIcon = (type: ItemType) => {
    const config = typeConfig[type];
    const Icon = config.icon;
    return Icon;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header da página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">
              {t('description')}
            </p>
          </div>
          <Link href="/catalog/new">
            <Button leftIcon={<Plus className="h-4 w-4" />}>
              {t('newItem')}
            </Button>
          </Link>
        </div>

        {/* Filtros por tipo (tabs) */}
        <div className="flex gap-2 border-b border-gray-200 pb-4">
          {(['ALL', 'PRODUCT', 'SERVICE', 'BUNDLE'] as const).map((type) => {
            const config = typeConfig[type];
            const Icon = config.icon;
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
                onClick={() => handleTypeChange(type)}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Barra de busca e filtros */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="flex gap-3">
                <Select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-40"
                >
                  <option value="">{t('allCategories')}</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <Select
                  value={selectedStatus}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-32"
                >
                  <option value="all">{t('all')}</option>
                  <option value="active">{t('activeItems')}</option>
                  <option value="inactive">{t('inactiveItems')}</option>
                </Select>
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

        {/* Tabela de itens */}
        <Card>
          {isLoading ? (
            <CardContent className="py-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : paginatedItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title={search || selectedType !== 'ALL' || selectedCategory || selectedStatus !== 'all'
                ? t('noItemsFound')
                : t('emptyCatalog')}
              description={
                search || selectedType !== 'ALL' || selectedCategory || selectedStatus !== 'all'
                  ? t('tryAdjustFilters')
                  : t('startAddingItems')
              }
              action={
                !(search || selectedType !== 'ALL' || selectedCategory || selectedStatus !== 'all')
                  ? {
                      label: t('newItem'),
                      onClick: () => router.push('/catalog/new'),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('type')}</TableHead>
                    <TableHead>{t('item')}</TableHead>
                    <TableHead>{t('sku')}</TableHead>
                    <TableHead>{t('category')}</TableHead>
                    <TableHead>{t('unit')}</TableHead>
                    <TableHead className="text-right">{t('basePrice')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const TypeIcon = getTypeIcon(item.type);
                    return (
                      <TableRow key={item.id} className={cn(!item.isActive && 'opacity-60')}>
                        <TableCell>
                          <div className={cn(
                            'flex items-center justify-center w-10 h-10 rounded-lg',
                            item.type === 'PRODUCT' && 'bg-info-100 text-info',
                            item.type === 'SERVICE' && 'bg-success-100 text-success',
                            item.type === 'BUNDLE' && 'bg-warning-100 text-warning'
                          )}>
                            <TypeIcon className="h-5 w-5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.sku ? (
                            <span className="font-mono text-sm">{item.sku}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.category ? (
                            <Badge variant="soft" size="sm">
                              {item.category.name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{formatCurrency(item.basePrice)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={item.isActive ? 'soft-success' : 'soft'}
                            size="sm"
                          >
                            {item.isActive ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/catalog/${item.id}`}>
                              <Button variant="ghost" size="icon-sm" title={t('viewDetails')}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/catalog/${item.id}/edit`}>
                              <Button variant="ghost" size="icon-sm" title={t('edit')}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title={item.isActive ? t('deactivate') : t('activate')}
                              onClick={() => handleToggleStatus(item)}
                              disabled={toggleStatus.isPending}
                            >
                              {item.isActive ? (
                                <PowerOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Power className="h-4 w-4 text-success" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
      </div>
    </AppLayout>
  );
}

// Export default com Suspense boundary para useSearchParams
export default function CatalogListPage() {
  return (
    <Suspense fallback={<CatalogListLoading />}>
      <CatalogListContent />
    </Suspense>
  );
}
