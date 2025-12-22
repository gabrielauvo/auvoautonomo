'use client';

/**
 * Catalog Item Form - Formulário de item do catálogo
 *
 * Permite:
 * - Criar/editar produtos, serviços e kits
 * - Selecionar categoria
 * - Definir preços e unidades
 * - Gerenciar composição de kits
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Input,
  Textarea,
  FormField,
  Alert,
  Select,
  Modal,
} from '@/components/ui';
import { KitCompositionEditor } from '@/components/catalog';
import { useCategories, useCreateItem, useUpdateItem, useCreateCategory } from '@/hooks/use-catalog';
import {
  CatalogItem,
  ItemType,
  CreateItemDto,
  UpdateItemDto,
  BundleItem,
} from '@/services/catalog.service';
import { createInventoryMovement } from '@/services/inventory.service';
import {
  Save,
  X,
  Package,
  Wrench,
  Layers,
  Tag,
  DollarSign,
  Clock,
  AlertCircle,
  Plus,
  FolderPlus,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CatalogItemFormProps {
  item?: CatalogItem;
  bundleItems?: BundleItem[];
  onSuccess?: (item: CatalogItem) => void;
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  type?: string;
  unit?: string;
  basePrice?: string;
  general?: string;
}

// Configuração de tipos
const typeConfig: Record<ItemType, { icon: React.ElementType; label: string; description: string }> = {
  PRODUCT: {
    icon: Package,
    label: 'Produto',
    description: 'Item físico ou material',
  },
  SERVICE: {
    icon: Wrench,
    label: 'Serviço',
    description: 'Mão de obra ou prestação de serviço',
  },
  BUNDLE: {
    icon: Layers,
    label: 'Kit',
    description: 'Combinação de produtos e/ou serviços',
  },
};

// Unidades comuns
const commonUnits = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'h', label: 'Hora (h)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'm²', label: 'Metro quadrado (m²)' },
  { value: 'm³', label: 'Metro cúbico (m³)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'pç', label: 'Peça (pç)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'mês', label: 'Mês (mês)' },
];

export function CatalogItemForm({ item, bundleItems, onSuccess, onCancel }: CatalogItemFormProps) {
  const router = useRouter();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createCategory = useCreateCategory();
  const { data: categories } = useCategories(true);

  const isEditing = !!item;

  // Form state
  const [type, setType] = useState<ItemType>(item?.type || 'PRODUCT');
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [sku, setSku] = useState(item?.sku || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || '');
  const [unit, setUnit] = useState(item?.unit || 'un');
  const [customUnit, setCustomUnit] = useState('');
  const [basePrice, setBasePrice] = useState(item?.basePrice?.toString() || '');
  const [costPrice, setCostPrice] = useState(item?.costPrice?.toString() || '');
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(
    item?.defaultDurationMinutes?.toString() || ''
  );
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [initialStock, setInitialStock] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de nova categoria
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // Kit composition (será salvo após criação do item)
  const [kitItems, setKitItems] = useState<Array<{ itemId: string; quantity: number }>>([]);

  // Inicializa kitItems se editando um kit
  useEffect(() => {
    if (bundleItems && Array.isArray(bundleItems) && bundleItems.length > 0) {
      setKitItems(bundleItems.map(bi => ({ itemId: bi.itemId, quantity: bi.quantity })));
    }
  }, [bundleItems]);

  // Validação
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!type) {
      newErrors.type = 'Tipo é obrigatório';
    }

    const effectiveUnit = unit === 'custom' ? customUnit : unit;
    if (!effectiveUnit.trim()) {
      newErrors.unit = 'Unidade é obrigatória';
    }

    if (!basePrice || parseFloat(basePrice) < 0) {
      newErrors.basePrice = 'Preço base é obrigatório e deve ser maior ou igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Guard against duplicate submissions
    if (isSubmitting) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const effectiveUnit = unit === 'custom' ? customUnit : unit;

    try {
      let result: CatalogItem;

      if (isEditing && item) {
        const updateData: UpdateItemDto = {
          categoryId: categoryId || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          sku: sku.trim() || undefined,
          unit: effectiveUnit.trim(),
          basePrice: parseFloat(basePrice),
          costPrice: costPrice ? parseFloat(costPrice) : undefined,
          defaultDurationMinutes: defaultDurationMinutes
            ? parseInt(defaultDurationMinutes)
            : undefined,
          isActive,
        };
        result = await updateItem.mutateAsync({ id: item.id, data: updateData });
      } else {
        const createData: CreateItemDto = {
          categoryId: categoryId || undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          sku: sku.trim() || undefined,
          unit: effectiveUnit.trim(),
          basePrice: parseFloat(basePrice),
          costPrice: costPrice ? parseFloat(costPrice) : undefined,
          defaultDurationMinutes: defaultDurationMinutes
            ? parseInt(defaultDurationMinutes)
            : undefined,
        };
        result = await createItem.mutateAsync(createData);

        // Se for produto e tiver quantidade inicial de estoque, criar movimentação
        if (type === 'PRODUCT' && initialStock && parseFloat(initialStock) > 0) {
          try {
            await createInventoryMovement({
              itemId: result.id,
              type: 'ADJUSTMENT_IN',
              quantity: parseFloat(initialStock),
              notes: 'Estoque inicial',
            });
          } catch (stockError) {
            // Não bloqueia criação do produto se falhar estoque
            console.warn('Não foi possível adicionar estoque inicial:', stockError);
          }
        }
      }

      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/catalog/${result.id}`);
      }
    } catch (error: any) {
      setErrors({
        general: error.message || 'Erro ao salvar item. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler de cancelar
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  // Handler para criar nova categoria
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      setCategoryError('Nome da categoria é obrigatório');
      return;
    }

    setCategoryError('');

    try {
      const newCategory = await createCategory.mutateAsync({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
      });

      // Seleciona a categoria recém-criada
      setCategoryId(newCategory.id);

      // Fecha o modal e limpa os campos
      setShowCategoryModal(false);
      setNewCategoryName('');
      setNewCategoryDescription('');
    } catch (error: any) {
      setCategoryError(error.message || 'Erro ao criar categoria');
    }
  };

  const isLoading = isSubmitting || createItem.isPending || updateItem.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Erro geral */}
      {errors.general && (
        <Alert variant="error">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errors.general}
          </div>
        </Alert>
      )}

      {/* Tipo do item */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tipo do Item
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(typeConfig) as ItemType[]).map((t) => {
              const config = typeConfig[t];
              const Icon = config.icon;
              const isSelected = type === t;
              const isDisabled = isEditing; // Não permite mudar tipo se editando

              return (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => !isDisabled && setType(t)}
                  disabled={isDisabled}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-lg',
                      isSelected
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      'font-medium',
                      isSelected ? 'text-primary' : 'text-gray-900'
                    )}>
                      {config.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {errors.type && <p className="text-sm text-error mt-2">{errors.type}</p>}
        </CardContent>
      </Card>

      {/* Dados principais */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Principais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Nome" required error={errors.name}>
              <Input
                placeholder="Nome do item"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                disabled={isLoading}
              />
            </FormField>

            <FormField label="SKU / Código">
              <Input
                placeholder="Código interno (opcional)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={isLoading}
              />
            </FormField>
          </div>

          <FormField label="Descrição">
            <Textarea
              placeholder="Descrição detalhada do item (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Categoria">
              <div className="flex gap-2">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <option value="">Sem categoria</option>
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCategoryModal(true)}
                  disabled={isLoading}
                  title="Criar nova categoria"
                  className="px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormField>

            <FormField label="Unidade" required error={errors.unit}>
              <div className="flex gap-2">
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {commonUnits.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="custom">Outra...</option>
                </Select>
                {unit === 'custom' && (
                  <Input
                    placeholder="Ex: pacote"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    className="w-32"
                    disabled={isLoading}
                  />
                )}
              </div>
            </FormField>
          </div>
        </CardContent>
      </Card>

      {/* Preços */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Preços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Preço Base (Venda)" required error={errors.basePrice}>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                error={!!errors.basePrice}
                disabled={isLoading}
                leftIcon={<span className="text-gray-400">R$</span>}
              />
            </FormField>

            <FormField label="Preço de Custo">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00 (opcional)"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                disabled={isLoading}
                leftIcon={<span className="text-gray-400">R$</span>}
              />
            </FormField>
          </div>

          {/* Duração padrão (apenas para serviços) */}
          {type === 'SERVICE' && (
            <FormField label="Duração Padrão" hint="Tempo estimado para execução do serviço">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  placeholder="Em minutos (opcional)"
                  value={defaultDurationMinutes}
                  onChange={(e) => setDefaultDurationMinutes(e.target.value)}
                  disabled={isLoading}
                  className="w-40"
                />
                <span className="text-sm text-gray-500">minutos</span>
              </div>
            </FormField>
          )}

          {/* Estoque inicial (apenas para produtos novos) */}
          {type === 'PRODUCT' && !isEditing && (
            <FormField
              label="Quantidade Inicial em Estoque"
              hint="Define a quantidade inicial de estoque ao criar o produto (opcional)"
            >
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  disabled={isLoading}
                  className="w-40"
                />
                <span className="text-sm text-gray-500">{unit === 'custom' ? customUnit || 'un' : unit}</span>
              </div>
            </FormField>
          )}
        </CardContent>
      </Card>

      {/* Composição do Kit (apenas para kits) */}
      {type === 'BUNDLE' && isEditing && item && (
        <KitCompositionEditor
          bundleId={item.id}
          bundleItems={bundleItems || []}
        />
      )}

      {type === 'BUNDLE' && !isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Composição do Kit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="info">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Após criar o kit, você poderá adicionar os itens que o compõem.
              </div>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Status (apenas para edição) */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                disabled={isLoading}
              />
              <div>
                <p className="font-medium text-gray-900">Item ativo</p>
                <p className="text-sm text-gray-500">
                  Itens inativos não aparecem para seleção em orçamentos e OS
                </p>
              </div>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handleCancel}
          disabled={isLoading}
          leftIcon={<X className="h-4 w-4" />}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Item'}
        </Button>
      </div>

      {/* Modal de Nova Categoria */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setNewCategoryName('');
          setNewCategoryDescription('');
          setCategoryError('');
        }}
        title="Nova Categoria"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Crie uma nova categoria para organizar seus produtos e serviços.
          </p>

          {categoryError && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {categoryError}
              </div>
            </Alert>
          )}

          <FormField label="Nome da Categoria" required>
            <Input
              placeholder="Ex: Manutenção, Instalação, Peças..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={createCategory.isPending}
              autoFocus
            />
          </FormField>

          <FormField label="Descrição (opcional)">
            <Textarea
              placeholder="Descrição da categoria..."
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              disabled={createCategory.isPending}
              rows={2}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCategoryModal(false);
                setNewCategoryName('');
                setNewCategoryDescription('');
                setCategoryError('');
              }}
              disabled={createCategory.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              loading={createCategory.isPending}
              leftIcon={<FolderPlus className="h-4 w-4" />}
            >
              Criar Categoria
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}

export default CatalogItemForm;
