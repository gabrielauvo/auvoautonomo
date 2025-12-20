'use client';

/**
 * Catalog Select Modal - Modal de seleção de itens do catálogo
 *
 * Permite:
 * - Buscar produtos/serviços
 * - Filtrar por categoria e tipo
 * - Selecionar item com quantidade
 * - Adicionar item manual (sem catálogo)
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Button,
  Input,
  FormField,
  Badge,
  Skeleton,
} from '@/components/ui';
import { useCatalogItems, useCatalogCategories } from '@/hooks/use-quotes';
import {
  CatalogItem,
  QuoteItemType,
  AddQuoteItemDto,
} from '@/services/quotes.service';
import {
  X,
  Search,
  Package,
  Wrench,
  Layers,
  Plus,
  Minus,
  Check,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CatalogSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (data: AddQuoteItemDto) => void;
}

// Configuração de tipos
const typeConfig: Record<
  QuoteItemType | 'ALL',
  { icon: React.ElementType; label: string; color: string }
> = {
  ALL: { icon: Package, label: 'Todos', color: 'text-gray-500' },
  PRODUCT: { icon: Package, label: 'Produto', color: 'text-info' },
  SERVICE: { icon: Wrench, label: 'Serviço', color: 'text-success' },
  BUNDLE: { icon: Layers, label: 'Kit', color: 'text-warning' },
};

// Formatar valor em moeda
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Skeleton loader
function CatalogSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// Item card component
function CatalogItemCard({
  item,
  isSelected,
  quantity,
  onSelect,
  onQuantityChange,
}: {
  item: CatalogItem;
  isSelected: boolean;
  quantity: number;
  onSelect: (item: CatalogItem) => void;
  onQuantityChange: (quantity: number) => void;
}) {
  const config = typeConfig[item.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all',
        isSelected
          ? 'border-primary bg-primary-50 ring-1 ring-primary'
          : 'border-gray-200 hover:border-gray-300'
      )}
      onClick={() => onSelect(item)}
    >
      {/* Ícone do tipo */}
      <div
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100',
          config.color
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Informações */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.name}</p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{item.unit}</span>
          {item.category && (
            <>
              <span>•</span>
              <span>{item.category.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Preço */}
      <div className="text-right">
        <p className="font-medium text-gray-900">{formatCurrency(item.basePrice)}</p>
        <p className="text-xs text-gray-500">por {item.unit}</p>
      </div>

      {/* Quantity controls when selected */}
      {isSelected && (
        <div
          className="flex items-center gap-2 ml-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-medium">{quantity}</span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onQuantityChange(quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}

// Manual item form
function ManualItemForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: AddQuoteItemDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<QuoteItemType>('SERVICE');
  const [unit, setUnit] = useState('un');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = () => {
    if (!name.trim() || !unitPrice) return;

    onSubmit({
      name: name.trim(),
      type,
      unit,
      unitPrice: parseFloat(unitPrice),
      quantity,
    });
  };

  const isValid = name.trim() && unitPrice && parseFloat(unitPrice) > 0;

  return (
    <div className="space-y-4">
      <FormField label="Nome do item">
        <Input
          placeholder="Ex: Mão de obra adicional"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tipo
          </label>
          <div className="flex gap-2">
            {(['PRODUCT', 'SERVICE'] as QuoteItemType[]).map((t) => {
              const config = typeConfig[t];
              const Icon = config.icon;
              return (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    type === t
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                  onClick={() => setType(t)}
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        <FormField label="Unidade">
          <Input
            placeholder="un, h, m²"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Preço unitário">
          <Input
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </FormField>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Quantidade
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 text-center"
            />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1"
        >
          Adicionar item
        </Button>
      </div>
    </div>
  );
}

export function CatalogSelectModal({
  isOpen,
  onClose,
  onSelect,
}: CatalogSelectModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<QuoteItemType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showManualForm, setShowManualForm] = useState(false);

  // Queries
  const { data: items, isLoading: isLoadingItems } = useCatalogItems({
    type: selectedType === 'ALL' ? undefined : selectedType,
    categoryId: selectedCategory || undefined,
    search: search || undefined,
    isActive: true,
  });

  const { data: categories } = useCatalogCategories(true);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Reset state
      setSearch('');
      setSelectedType('ALL');
      setSelectedCategory('');
      setSelectedItem(null);
      setQuantity(1);
      setShowManualForm(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const handleSelectItem = (item: CatalogItem) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
    } else {
      setSelectedItem(item);
      setQuantity(1);
    }
  };

  const handleConfirm = () => {
    if (!selectedItem) return;

    // Envia dados completos do item para snapshot
    onSelect({
      itemId: selectedItem.id,
      name: selectedItem.name,
      type: selectedItem.type,
      unit: selectedItem.unit,
      unitPrice: selectedItem.basePrice,
      quantity,
    });

    handleClose();
  };

  const handleManualSubmit = (data: AddQuoteItemDto) => {
    onSelect(data);
    handleClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <Card
        className={cn(
          'relative w-full max-w-2xl z-10 transform transition-transform max-h-[90vh] flex flex-col',
          isVisible ? 'scale-100' : 'scale-95'
        )}
        variant="elevated"
        padding="none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {showManualForm ? 'Adicionar item manual' : 'Selecionar do catálogo'}
            </h2>
            <p className="text-sm text-gray-500">
              {showManualForm
                ? 'Adicione um item que não está no catálogo'
                : 'Escolha produtos ou serviços do seu catálogo'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {showManualForm ? (
          <CardContent className="p-4">
            <ManualItemForm
              onSubmit={handleManualSubmit}
              onCancel={() => setShowManualForm(false)}
            />
          </CardContent>
        ) : (
          <>
            {/* Search and filters */}
            <div className="p-4 border-b space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar produtos ou serviços..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Type filter */}
              <div className="flex gap-2">
                {(['ALL', 'PRODUCT', 'SERVICE', 'BUNDLE'] as const).map((t) => {
                  const config = typeConfig[t];
                  const Icon = config.icon;
                  return (
                    <button
                      key={t}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                        selectedType === t
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                      onClick={() => setSelectedType(t)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Category filter */}
              {categories && categories.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      !selectedCategory
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                    onClick={() => setSelectedCategory('')}
                  >
                    Todas categorias
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                        selectedCategory === cat.id
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingItems ? (
                <CatalogSkeleton />
              ) : items && items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((item) => (
                    <CatalogItemCard
                      key={item.id}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      quantity={selectedItem?.id === item.id ? quantity : 1}
                      onSelect={handleSelectItem}
                      onQuantityChange={setQuantity}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500">Nenhum item encontrado</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Tente ajustar os filtros ou adicione um item manual
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <Button
                variant="ghost"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => setShowManualForm(true)}
              >
                Adicionar item manual
              </Button>

              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedItem}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Adicionar ao orçamento
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export default CatalogSelectModal;
