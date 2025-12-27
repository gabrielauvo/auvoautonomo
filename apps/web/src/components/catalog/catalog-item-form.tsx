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

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/i18n';
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
import { setInitialStock as setInitialStockApi } from '@/services/inventory.service';
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

// Type icons configuration
const typeIcons: Record<ItemType, React.ElementType> = {
  PRODUCT: Package,
  SERVICE: Wrench,
  BUNDLE: Layers,
};

export function CatalogItemForm({ item, bundleItems, onSuccess, onCancel }: CatalogItemFormProps) {
  const { t } = useTranslations('catalog');
  const router = useRouter();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createCategory = useCreateCategory();
  const { data: categories } = useCategories(true);

  const isEditing = !!item;

  // Memoized type config with translations
  const typeConfig = useMemo(() => ({
    PRODUCT: {
      icon: Package,
      label: t('form.itemType.product'),
      description: t('form.itemType.productDescription'),
    },
    SERVICE: {
      icon: Wrench,
      label: t('form.itemType.service'),
      description: t('form.itemType.serviceDescription'),
    },
    BUNDLE: {
      icon: Layers,
      label: t('form.itemType.bundle'),
      description: t('form.itemType.bundleDescription'),
    },
  }), [t]);

  // Memoized common units with translations
  const commonUnits = useMemo(() => [
    { value: 'un', label: t('form.units.unit') },
    { value: 'h', label: t('form.units.hour') },
    { value: 'm', label: t('form.units.meter') },
    { value: 'm²', label: t('form.units.squareMeter') },
    { value: 'm³', label: t('form.units.cubicMeter') },
    { value: 'kg', label: t('form.units.kilogram') },
    { value: 'L', label: t('form.units.liter') },
    { value: 'pç', label: t('form.units.piece') },
    { value: 'cx', label: t('form.units.box') },
    { value: 'mês', label: t('form.units.month') },
  ], [t]);

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
      newErrors.name = t('form.validation.nameRequired');
    }

    if (!type) {
      newErrors.type = t('form.validation.typeRequired');
    }

    const effectiveUnit = unit === 'custom' ? customUnit : unit;
    if (!effectiveUnit.trim()) {
      newErrors.unit = t('form.validation.unitRequired');
    }

    if (!basePrice || parseFloat(basePrice) < 0) {
      newErrors.basePrice = t('form.validation.basePriceRequired');
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

        // Se for produto e tiver quantidade inicial de estoque, definir estoque inicial
        if (type === 'PRODUCT' && initialStock && parseFloat(initialStock) > 0) {
          try {
            await setInitialStockApi(
              result.id,
              parseFloat(initialStock),
              t('form.initialStockNote'),
            );
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
        general: error.message || t('form.saveError'),
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
      setCategoryError(t('form.validation.categoryNameRequired'));
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
      setCategoryError(error.message || t('form.categoryCreateError'));
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
            {t('form.itemTypeTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(typeConfig) as ItemType[]).map((itemType) => {
              const config = typeConfig[itemType];
              const Icon = config.icon;
              const isSelected = type === itemType;
              const isDisabled = isEditing; // Não permite mudar tipo se editando

              return (
                <button
                  key={itemType}
                  type="button"
                  className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => !isDisabled && setType(itemType)}
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
          <CardTitle>{t('form.mainData')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('name')} required error={errors.name}>
              <Input
                placeholder={t('form.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={!!errors.name}
                disabled={isLoading}
              />
            </FormField>

            <FormField label={t('form.skuCode')}>
              <Input
                placeholder={t('form.skuPlaceholder')}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={isLoading}
              />
            </FormField>
          </div>

          <FormField label={t('description')}>
            <Textarea
              placeholder={t('form.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('category')}>
              <div className="flex gap-2">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <option value="">{t('noCategory')}</option>
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
                  title={t('form.createNewCategory')}
                  className="px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </FormField>

            <FormField label={t('unit')} required error={errors.unit}>
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
                  <option value="custom">{t('form.otherUnit')}</option>
                </Select>
                {unit === 'custom' && (
                  <Input
                    placeholder={t('form.customUnitPlaceholder')}
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
            {t('prices')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('form.basePrice')} required error={errors.basePrice}>
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

            <FormField label={t('costPrice')}>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={t('form.costPricePlaceholder')}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                disabled={isLoading}
                leftIcon={<span className="text-gray-400">R$</span>}
              />
            </FormField>
          </div>

          {/* Duração padrão (apenas para serviços) */}
          {type === 'SERVICE' && (
            <FormField label={t('defaultDuration')} hint={t('form.defaultDurationHint')}>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  min="0"
                  placeholder={t('form.durationPlaceholder')}
                  value={defaultDurationMinutes}
                  onChange={(e) => setDefaultDurationMinutes(e.target.value)}
                  disabled={isLoading}
                  className="w-40"
                />
                <span className="text-sm text-gray-500">{t('form.minutes')}</span>
              </div>
            </FormField>
          )}

          {/* Estoque inicial (apenas para produtos novos) */}
          {type === 'PRODUCT' && !isEditing && (
            <FormField
              label={t('form.initialStockLabel')}
              hint={t('form.initialStockHint')}
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
              {t('bundleComposition')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="info">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {t('form.bundleCompositionInfo')}
              </div>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Status (apenas para edição) */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>{t('status')}</CardTitle>
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
                <p className="font-medium text-gray-900">{t('form.itemActive')}</p>
                <p className="text-sm text-gray-500">
                  {t('form.itemActiveDescription')}
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
          {t('form.cancel')}
        </Button>
        <Button
          type="submit"
          loading={isLoading}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {isLoading ? t('form.saving') : isEditing ? t('form.saveChanges') : t('form.createItem')}
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
        title={t('form.newCategory')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('form.newCategoryDescription')}
          </p>

          {categoryError && (
            <Alert variant="error">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {categoryError}
              </div>
            </Alert>
          )}

          <FormField label={t('form.categoryName')} required>
            <Input
              placeholder={t('form.categoryNamePlaceholder')}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={createCategory.isPending}
              autoFocus
            />
          </FormField>

          <FormField label={t('form.categoryDescription')}>
            <Textarea
              placeholder={t('form.categoryDescriptionPlaceholder')}
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
              {t('form.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleCreateCategory}
              loading={createCategory.isPending}
              leftIcon={<FolderPlus className="h-4 w-4" />}
            >
              {t('form.createCategory')}
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}

export default CatalogItemForm;
