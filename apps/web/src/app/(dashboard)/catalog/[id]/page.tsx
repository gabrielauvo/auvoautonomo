'use client';

/**
 * Catalog Item Details Page - Página de detalhes do item
 */

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Skeleton,
  Alert,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui';
import { useCatalogItem, useBundleItems, useDeleteItem, useToggleItemStatus } from '@/hooks/use-catalog';
import { calculateBundlePrice } from '@/services/catalog.service';
import {
  ChevronLeft,
  Edit,
  Trash2,
  Package,
  Wrench,
  Layers,
  Tag,
  DollarSign,
  Clock,
  Power,
  PowerOff,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n';
import { useFormatting } from '@/hooks/use-formatting';

// Configuração de tipos com ícones
const typeConfig = {
  PRODUCT: { icon: Package, color: 'bg-info-100 text-info' },
  SERVICE: { icon: Wrench, color: 'bg-success-100 text-success' },
  BUNDLE: { icon: Layers, color: 'bg-warning-100 text-warning' },
};

// Loading skeleton
function ItemDetailsSkeleton() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </AppLayout>
  );
}

export default function CatalogItemDetailsPage() {
  const { t } = useTranslations('catalog');
  const { formatCurrency, formatDateTime, locale } = useFormatting();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: item, isLoading, error } = useCatalogItem(id);
  const { data: bundleItems } = useBundleItems(item?.type === 'BUNDLE' ? id : undefined);
  const deleteItem = useDeleteItem();
  const toggleStatus = useToggleItemStatus();

  // Type labels (memoized with locale)
  const typeLabels = useMemo(() => ({
    PRODUCT: t('itemType.product'),
    SERVICE: t('itemType.service'),
    BUNDLE: t('itemType.bundle'),
  }), [t, locale]);

  // Handler para deletar
  const handleDelete = async () => {
    if (!item) return;

    const confirmed = window.confirm(t('deleteConfirmMessage', { name: item.name }));

    if (confirmed) {
      try {
        await deleteItem.mutateAsync(item.id);
        router.push('/catalog');
      } catch (error: any) {
        alert(error.message || t('deleteError'));
      }
    }
  };

  // Handler para toggle status
  const handleToggleStatus = async () => {
    if (!item) return;
    await toggleStatus.mutateAsync({ id: item.id, isActive: !item.isActive });
  };

  if (isLoading) {
    return <ItemDetailsSkeleton />;
  }

  if (error || !item) {
    return (
      <AppLayout>
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('itemNotFoundError')}
          </div>
        </Alert>
      </AppLayout>
    );
  }

  const config = typeConfig[item.type];
  const TypeIcon = config.icon;
  const bundleTotal = bundleItems ? calculateBundlePrice(bundleItems) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('backToCatalog')}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex items-center justify-center w-16 h-16 rounded-lg',
              config.color
            )}>
              <TypeIcon className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
                <Badge
                  variant={item.isActive ? 'soft-success' : 'soft'}
                  size="sm"
                >
                  {item.isActive ? t('active') : t('inactive')}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-gray-500">
                <Badge variant="soft" size="sm">
                  {typeLabels[item.type]}
                </Badge>
                {item.sku && (
                  <span className="font-mono text-sm">SKU: {item.sku}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleToggleStatus}
              disabled={toggleStatus.isPending}
              leftIcon={item.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            >
              {item.isActive ? t('deactivate') : t('activate')}
            </Button>
            <Link href={`/catalog/${item.id}/edit`}>
              <Button variant="outline" leftIcon={<Edit className="h-4 w-4" />}>
                {t('edit')}
              </Button>
            </Link>
            <Button
              variant="outline-error"
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              {t('delete')}
            </Button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                {t('generalInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {item.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500">{t('description')}</p>
                  <p className="mt-1 text-gray-900">{item.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">{t('category')}</p>
                  <p className="mt-1 text-gray-900">
                    {item.category?.name || t('noCategory')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{t('unit')}</p>
                  <p className="mt-1 text-gray-900">{item.unit}</p>
                </div>
              </div>

              {item.type === 'SERVICE' && item.defaultDurationMinutes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">{t('defaultDuration')}</p>
                  <p className="mt-1 text-gray-900 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t('durationMinutes', { minutes: item.defaultDurationMinutes })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preços */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t('prices')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">{t('salePrice')}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatCurrency(item.basePrice)}
                  </p>
                </div>
                {item.costPrice !== undefined && item.costPrice !== null && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">{t('costPrice')}</p>
                    <p className="mt-1 text-xl text-gray-700">
                      {formatCurrency(item.costPrice)}
                    </p>
                  </div>
                )}
              </div>

              {item.costPrice !== undefined && item.costPrice !== null && item.costPrice > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-gray-500">{t('profitMargin')}</p>
                  <p className="mt-1 text-lg font-medium text-success">
                    {((item.basePrice - item.costPrice) / item.costPrice * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Composição do Kit */}
        {item.type === 'BUNDLE' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                {t('bundleComposition')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bundleItems && bundleItems.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('item')}</TableHead>
                        <TableHead className="text-center">{t('quantity')}</TableHead>
                        <TableHead className="text-right">{t('unitPrice')}</TableHead>
                        <TableHead className="text-right">{t('subtotal')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(Array.isArray(bundleItems) ? bundleItems : []).map((bi) => {
                        const itemConfig = typeConfig[bi.item.type];
                        const ItemIcon = itemConfig.icon;
                        return (
                          <TableRow key={bi.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  'flex items-center justify-center w-8 h-8 rounded-lg',
                                  itemConfig.color
                                )}>
                                  <ItemIcon className="h-4 w-4" />
                                </div>
                                <span className="font-medium">{bi.item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {bi.quantity} {bi.item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(bi.item.basePrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(bi.quantity * bi.item.basePrice)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                      {t('itemsInBundle', { count: bundleItems.length })}
                    </p>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{t('calculatedValue')}:</p>
                      <p className="text-xl font-bold">{formatCurrency(bundleTotal)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  {t('noItemsInBundle')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metadados - inline compacto */}
        <div className="flex items-center justify-end gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
          <span>{t('created')}: {formatDateTime(new Date(item.createdAt))}</span>
          <span>·</span>
          <span>{t('updated')}: {formatDateTime(new Date(item.updatedAt))}</span>
        </div>
      </div>
    </AppLayout>
  );
}
