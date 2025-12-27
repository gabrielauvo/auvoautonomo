'use client';

/**
 * Inventory Page
 *
 * Pagina principal de estoque:
 * - Resumo (SKUs, quantidade total, estoque baixo)
 * - Lista de produtos com saldos
 * - Modal de ajuste de estoque
 * - Historico de movimentacoes
 */

import { useState } from 'react';
import { useTranslations } from '@/i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Minus,
  AlertCircle,
  Settings,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Box,
  AlertTriangle,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Alert,
  Skeleton,
  Input,
  Modal,
  FormField,
  Textarea,
} from '@/components/ui';
import { AppLayout } from '@/components/layout';
import {
  getInventorySettings,
  getInventoryBalances,
  getInventoryMovements,
  createInventoryMovement,
  InventorySettings,
  InventoryBalanceList,
  InventoryBalance,
  MovementListResponse,
  CreateMovementDto,
} from '@/services/inventory.service';

export default function InventoryPage() {
  const { t } = useTranslations('inventory');
  const { t: tCommon } = useTranslations('common');
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryBalance | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Queries
  const { data: settings, isLoading: settingsLoading } = useQuery<InventorySettings>({
    queryKey: ['inventorySettings'],
    queryFn: getInventorySettings,
  });

  const { data: balances, isLoading: balancesLoading } = useQuery<InventoryBalanceList>({
    queryKey: ['inventoryBalances'],
    queryFn: getInventoryBalances,
    enabled: !!settings?.isEnabled,
  });

  const { data: movements } = useQuery<MovementListResponse>({
    queryKey: ['inventoryMovements', { limit: 5 }],
    queryFn: () => getInventoryMovements({ limit: 5 }),
    enabled: !!settings?.isEnabled,
  });

  // Mutation
  const createMovement = useMutation({
    mutationFn: (data: CreateMovementDto) => createInventoryMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryBalances'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      setShowAdjustModal(false);
      resetAdjustForm();
    },
  });

  const resetAdjustForm = () => {
    setSelectedProduct(null);
    setAdjustType('in');
    setAdjustQuantity('');
    setAdjustNotes('');
  };

  const handleAdjust = (product: InventoryBalance) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  const handleSubmitAdjust = async () => {
    if (!selectedProduct || !adjustQuantity) return;

    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty <= 0) return;

    await createMovement.mutateAsync({
      itemId: selectedProduct.itemId,
      type: adjustType === 'in' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      quantity: qty,
      notes: adjustNotes || undefined,
    });
  };

  // Filter products by search
  const filteredProducts = balances?.items.filter(
    (p) =>
      p.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.itemSku && p.itemSku.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  // Feature not enabled in plan
  if (settings && !settings.featureEnabled) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('inventoryControl')}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  {t('settings.featureDisabled')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Inventory not enabled by user
  if (settings && !settings.isEnabled) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {t('inventoryDisabled')}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  {t('inventoryDisabledDescription')}
                </p>
                <Link href="/settings/inventory">
                  <Button leftIcon={<Settings className="h-4 w-4" />}>
                    {t('configureInventory')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (settingsLoading || balancesLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Count stats
  const lowStockCount = balances?.items.filter((p) => p.quantity > 0 && p.quantity <= 5).length || 0;
  const outOfStockCount = balances?.items.filter((p) => p.quantity <= 0).length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="h-6 w-6" />
              {t('title')}
            </h1>
            <p className="text-gray-500 mt-1">{t('description')}</p>
          </div>
          <Link href="/settings/inventory">
            <Button variant="outline" leftIcon={<Settings className="h-4 w-4" />}>
              {t('configurations')}
            </Button>
          </Link>
        </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Box className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('dashboard.totalSkus')}</p>
                <p className="text-2xl font-bold">{balances?.totalSkus || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('dashboard.totalQuantity')}</p>
                <p className="text-2xl font-bold">{balances?.totalQuantity.toFixed(0) || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('dashboard.lowStock')}</p>
                <p className="text-2xl font-bold">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('dashboard.outOfStock')}</p>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('balances.title')}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder={t('searchProduct')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? t('noProductFound') : t('balances.noProducts')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                      {t('balances.product')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                      {t('balances.sku')}
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">
                      {t('balances.unit')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                      {t('balances.quantity')}
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">
                      {t('balances.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((product) => (
                    <tr key={product.itemId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-medium">{product.itemName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {product.itemSku || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {product.itemUnit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-bold ${
                            product.quantity <= 0
                              ? 'text-red-600'
                              : product.quantity <= 5
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {product.quantity.toFixed(product.quantity % 1 === 0 ? 0 : 2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjust(product)}
                        >
                          {t('balances.adjust')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent movements */}
      {movements && movements.items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t('dashboard.recentMovements')}
              </CardTitle>
              <Link href="/inventory/movements">
                <Button variant="ghost" size="sm">
                  {t('dashboard.viewAll')}
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movements.items.map((mov) => (
                <div
                  key={mov.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {mov.quantity > 0 ? (
                      <ArrowUpCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowDownCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{mov.itemName}</p>
                      <p className="text-xs text-gray-500">
                        {t(`movements.types.${mov.type}`)} - {t(`movements.sources.${mov.source}`)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        mov.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {mov.quantity > 0 ? '+' : ''}
                      {mov.quantity.toFixed(mov.quantity % 1 === 0 ? 0 : 2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('balanceAfter')}: {mov.balanceAfter.toFixed(0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adjust modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false);
          resetAdjustForm();
        }}
        title={t('adjust.title')}
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">{t('adjust.currentBalance')}</p>
              <p className="text-2xl font-bold">{selectedProduct.itemName}</p>
              <p className="text-lg">
                {selectedProduct.quantity.toFixed(0)} {selectedProduct.itemUnit}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant={adjustType === 'in' ? 'default' : 'outline'}
                onClick={() => setAdjustType('in')}
                leftIcon={<Plus className="h-4 w-4" />}
                className="flex-1"
              >
                {t('adjust.entry')}
              </Button>
              <Button
                variant={adjustType === 'out' ? 'default' : 'outline'}
                onClick={() => setAdjustType('out')}
                leftIcon={<Minus className="h-4 w-4" />}
                className="flex-1"
              >
                {t('adjust.exit')}
              </Button>
            </div>

            <FormField label={t('adjust.quantity')}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                placeholder="0"
              />
            </FormField>

            <FormField label={t('adjust.notes')}>
              <Textarea
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder={t('adjust.notesPlaceholder')}
                rows={2}
              />
            </FormField>

            {adjustQuantity && !isNaN(parseFloat(adjustQuantity)) && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600">{t('adjust.newBalance')}</p>
                <p className="text-xl font-bold text-blue-800">
                  {(
                    selectedProduct.quantity +
                    (adjustType === 'in' ? 1 : -1) * parseFloat(adjustQuantity || '0')
                  ).toFixed(0)}{' '}
                  {selectedProduct.itemUnit}
                </p>
              </div>
            )}

            {createMovement.error && (
              <Alert variant="error">
                <AlertCircle className="h-4 w-4" />
                <span>{t('adjust.insufficientStock')}</span>
              </Alert>
            )}

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAdjustModal(false);
                  resetAdjustForm();
                }}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleSubmitAdjust}
                loading={createMovement.isPending}
                disabled={!adjustQuantity || parseFloat(adjustQuantity) <= 0}
              >
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      </div>
    </AppLayout>
  );
}
