'use client';

/**
 * Kit Composition Editor - Editor de composição de kits
 *
 * Permite:
 * - Adicionar produtos/serviços ao kit
 * - Definir quantidades
 * - Remover itens do kit
 * - Visualizar preço total calculado
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Alert,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import {
  useCatalogItems,
  useBundleItems,
  useAddBundleItem,
  useRemoveBundleItem,
} from '@/hooks/use-catalog';
import {
  BundleItem,
  CatalogItem,
  ItemType,
  calculateBundlePrice,
} from '@/services/catalog.service';
import {
  Layers,
  Plus,
  Minus,
  Trash2,
  Search,
  Package,
  Wrench,
  AlertCircle,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KitCompositionEditorProps {
  bundleId: string;
  bundleItems: BundleItem[];
}

// Configuração de tipos com ícones
const typeConfig: Record<ItemType, { icon: React.ElementType; color: string }> = {
  PRODUCT: { icon: Package, color: 'text-info' },
  SERVICE: { icon: Wrench, color: 'text-success' },
  BUNDLE: { icon: Layers, color: 'text-warning' },
};

// Formatar moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Modal de seleção de item
function ItemSelectModal({
  isOpen,
  onClose,
  onSelect,
  excludeIds,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: CatalogItem) => void;
  excludeIds: string[];
}) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'PRODUCT' | 'SERVICE' | 'ALL'>('ALL');

  // Busca itens (apenas PRODUCT e SERVICE, não BUNDLE)
  const { data: items, isLoading } = useCatalogItems({
    type: selectedType === 'ALL' ? undefined : selectedType,
    search: search || undefined,
    isActive: true,
  });

  // Filtra bundles e itens já adicionados
  const availableItems = useMemo(() => {
    if (!items) return [];
    return items.filter(
      (item) => item.type !== 'BUNDLE' && !excludeIds.includes(item.id)
    );
  }, [items, excludeIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <Card className="relative w-full max-w-lg z-10 max-h-[80vh] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle>Adicionar Item ao Kit</CardTitle>
        </CardHeader>

        <div className="p-4 border-b space-y-3">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar produto ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros de tipo */}
          <div className="flex gap-2">
            {(['ALL', 'PRODUCT', 'SERVICE'] as const).map((type) => {
              const label = type === 'ALL' ? 'Todos' : type === 'PRODUCT' ? 'Produtos' : 'Serviços';
              return (
                <button
                  key={type}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    selectedType === type
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                  onClick={() => setSelectedType(type)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : availableItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhum item disponível</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableItems.map((item) => {
                const config = typeConfig[item.type];
                const Icon = config.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary-50 transition-colors text-left"
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100',
                      config.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatCurrency(item.basePrice)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Componente de linha do item do kit
function KitItemRow({
  bundleItem,
  onRemove,
  isRemoving,
}: {
  bundleItem: BundleItem;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const config = typeConfig[bundleItem.item.type];
  const Icon = config.icon;
  const totalPrice = bundleItem.quantity * bundleItem.item.basePrice;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100',
            config.color
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{bundleItem.item.name}</p>
            <p className="text-xs text-gray-500">{bundleItem.item.unit}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <span className="font-mono">{bundleItem.quantity}</span>
      </TableCell>
      <TableCell className="text-right">
        {formatCurrency(bundleItem.item.basePrice)}
      </TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(totalPrice)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={isRemoving}
          title="Remover do kit"
        >
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function KitCompositionEditor({ bundleId, bundleItems }: KitCompositionEditorProps) {
  const [showItemModal, setShowItemModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState('1');

  const addBundleItem = useAddBundleItem();
  const removeBundleItem = useRemoveBundleItem();

  // IDs já no kit (para excluir da seleção)
  const excludeIds = useMemo(() => {
    return [bundleId, ...bundleItems.map((bi) => bi.itemId)];
  }, [bundleId, bundleItems]);

  // Preço total do kit
  const totalPrice = useMemo(() => {
    return calculateBundlePrice(bundleItems);
  }, [bundleItems]);

  // Handler para adicionar item
  const handleAddItem = async () => {
    if (!pendingItem || !quantity) return;

    try {
      await addBundleItem.mutateAsync({
        bundleId,
        data: {
          itemId: pendingItem.id,
          quantity: parseFloat(quantity),
        },
      });
      setPendingItem(null);
      setQuantity('1');
    } catch (error) {
      console.error('Error adding bundle item:', error);
    }
  };

  // Handler para remover item
  const handleRemoveItem = async (bundleItemId: string) => {
    try {
      await removeBundleItem.mutateAsync({ bundleItemId, bundleId });
    } catch (error) {
      console.error('Error removing bundle item:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Composição do Kit
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowItemModal(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Adicionar Item
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Item pendente para adicionar */}
        {pendingItem && (
          <div className="mb-4 p-4 bg-primary-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{pendingItem.name}</p>
                <p className="text-sm text-gray-500">{formatCurrency(pendingItem.basePrice)} / {pendingItem.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Qtd:</label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-20"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPendingItem(null);
                    setQuantity('1');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  loading={addBundleItem.isPending}
                  leftIcon={<Check className="h-4 w-4" />}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de itens */}
        {bundleItems.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Kit vazio"
            description="Adicione produtos ou serviços para compor este kit"
            action={{
              label: 'Adicionar Item',
              onClick: () => setShowItemModal(true),
            }}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundleItems.map((bi) => (
                  <KitItemRow
                    key={bi.id}
                    bundleItem={bi}
                    onRemove={() => handleRemoveItem(bi.id)}
                    isRemoving={removeBundleItem.isPending}
                  />
                ))}
              </TableBody>
            </Table>

            {/* Total */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {bundleItems.length} {bundleItems.length === 1 ? 'item' : 'itens'} no kit
                </p>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Valor total do kit:</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(totalPrice)}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Alerta informativo */}
        <Alert variant="info" className="mt-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Sobre o preço do kit:</p>
              <p className="mt-1 text-gray-600">
                O valor calculado acima é baseado nos preços dos itens.
                Você pode definir um preço diferente para o kit no campo "Preço Base".
              </p>
            </div>
          </div>
        </Alert>
      </CardContent>

      {/* Modal de seleção */}
      <ItemSelectModal
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSelect={(item) => {
          setPendingItem(item);
          setQuantity('1');
        }}
        excludeIds={excludeIds}
      />
    </Card>
  );
}

export default KitCompositionEditor;
