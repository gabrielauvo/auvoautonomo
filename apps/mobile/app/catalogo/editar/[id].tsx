// @ts-nocheck
/**
 * Edit Catalog Item Screen
 *
 * Tela para editar um produto, serviço ou kit existente.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card } from '../../../src/design-system';
import { useColors, useSpacing } from '../../../src/design-system/ThemeProvider';
import { useAuth } from '../../../src/services';
import { CatalogItemRepository, CategoryRepository } from '../../../src/db/repositories';
import { CatalogItem, ProductCategory, BundleItem, ItemType } from '../../../src/db/schema';

// =============================================================================
// TYPES
// =============================================================================

interface BundleItemEntry {
  itemId: string;
  itemName: string;
  itemUnit: string;
  itemBasePrice: number;
  quantity: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_LABELS: Record<ItemType, string> = {
  PRODUCT: 'Produto',
  SERVICE: 'Serviço',
  BUNDLE: 'Kit',
};

const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'h', label: 'Hora (h)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'm2', label: 'Metro quadrado (m²)' },
  { value: 'l', label: 'Litro (L)' },
  { value: 'pç', label: 'Peça (pç)' },
  { value: 'cx', label: 'Caixa (cx)' },
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function EditarCatalogoScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Original item
  const [originalItem, setOriginalItem] = useState<(CatalogItem & { bundleItems?: BundleItem[] }) | null>(null);
  const [isLoadingItem, setIsLoadingItem] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('un');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [defaultDuration, setDefaultDuration] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  // Bundle items state
  const [bundleItems, setBundleItems] = useState<BundleItemEntry[]>([]);
  const [showBundleItemPicker, setShowBundleItemPicker] = useState(false);
  const [availableItems, setAvailableItems] = useState<CatalogItem[]>([]);
  const [bundleItemSearch, setBundleItemSearch] = useState('');

  // UI state
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const technicianId = user?.id;

  // =============================================================================
  // DATA LOADING
  // =============================================================================

  useEffect(() => {
    if (id && technicianId) {
      loadItem();
      loadCategories();
    }
  }, [id, technicianId]);

  const loadItem = async () => {
    if (!id) return;

    try {
      const data = await CatalogItemRepository.getByIdWithBundleItems(id);
      if (data) {
        setOriginalItem(data);
        // Populate form
        setName(data.name);
        setDescription(data.description || '');
        setSku(data.sku || '');
        setUnit(data.unit);
        setBasePrice(data.basePrice.toString().replace('.', ','));
        setCostPrice(data.costPrice ? data.costPrice.toString().replace('.', ',') : '');
        setDefaultDuration(data.defaultDurationMinutes?.toString() || '');
        setCategoryId(data.categoryId || null);
        setIsActive(data.isActive === 1 || data.isActive === true);

        // Populate bundle items
        if (data.type === 'BUNDLE' && data.bundleItems) {
          setBundleItems(data.bundleItems.map(bi => ({
            itemId: bi.itemId,
            itemName: bi.itemName,
            itemUnit: bi.itemUnit,
            itemBasePrice: bi.itemBasePrice,
            quantity: bi.quantity,
          })));
        }
      }
    } catch (error) {
      console.error('[EditarCatalogoScreen] Error loading item:', error);
      Alert.alert('Erro', 'Não foi possível carregar o item.');
    } finally {
      setIsLoadingItem(false);
    }
  };

  const loadCategories = async () => {
    if (!technicianId) return;
    try {
      const cats = await CategoryRepository.getAll(technicianId);
      setCategories(cats);
    } catch (error) {
      console.error('[EditarCatalogoScreen] Error loading categories:', error);
    }
  };

  const loadAvailableItems = useCallback(async (search?: string) => {
    if (!technicianId || !id) return;
    try {
      const items = await CatalogItemRepository.getAvailableForBundle(
        technicianId,
        id, // Exclude current item
        search
      );
      setAvailableItems(items);
    } catch (error) {
      console.error('[EditarCatalogoScreen] Error loading available items:', error);
    }
  }, [technicianId, id]);

  useEffect(() => {
    if (showBundleItemPicker) {
      loadAvailableItems(bundleItemSearch);
    }
  }, [showBundleItemPicker, bundleItemSearch, loadAvailableItems]);

  // =============================================================================
  // VALIDATION
  // =============================================================================

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!basePrice.trim()) {
      newErrors.basePrice = 'Preço é obrigatório';
    } else if (isNaN(parseFloat(basePrice.replace(',', '.')))) {
      newErrors.basePrice = 'Preço inválido';
    }

    if (originalItem?.type === 'SERVICE' && defaultDuration) {
      const durationNum = parseInt(defaultDuration, 10);
      if (isNaN(durationNum) || durationNum < 0) {
        newErrors.defaultDuration = 'Duração inválida';
      }
    }

    if (originalItem?.type === 'BUNDLE' && bundleItems.length === 0) {
      newErrors.bundleItems = 'Adicione pelo menos um item ao kit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, basePrice, originalItem, defaultDuration, bundleItems]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleSave = useCallback(async () => {
    if (!validate() || !technicianId || !id) return;

    setIsLoading(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const priceValue = parseFloat(basePrice.replace(',', '.'));
      const costValue = costPrice ? parseFloat(costPrice.replace(',', '.')) : null;
      const durationValue = defaultDuration ? parseInt(defaultDuration, 10) : null;

      await CatalogItemRepository.updateItem(id, technicianId, {
        name: name.trim(),
        unit,
        basePrice: priceValue,
        categoryId: categoryId || null,
        categoryName: selectedCategory?.name || null,
        categoryColor: selectedCategory?.color || null,
        description: description.trim() || null,
        sku: sku.trim() || null,
        costPrice: costValue,
        defaultDurationMinutes: durationValue,
        isActive,
        bundleItems: originalItem?.type === 'BUNDLE'
          ? bundleItems.map(bi => ({
              itemId: bi.itemId,
              quantity: bi.quantity,
            }))
          : undefined,
      });

      Alert.alert('Sucesso', 'Item atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('[EditarCatalogoScreen] Error updating item:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o item. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [
    validate, technicianId, id, categories, categoryId, name, unit,
    basePrice, costPrice, description, sku, defaultDuration, isActive, bundleItems, originalItem,
  ]);

  const handleAddBundleItem = (item: CatalogItem) => {
    const existing = bundleItems.find(bi => bi.itemId === item.id);
    if (existing) {
      setBundleItems(bundleItems.map(bi =>
        bi.itemId === item.id
          ? { ...bi, quantity: bi.quantity + 1 }
          : bi
      ));
    } else {
      setBundleItems([
        ...bundleItems,
        {
          itemId: item.id,
          itemName: item.name,
          itemUnit: item.unit,
          itemBasePrice: item.basePrice,
          quantity: 1,
        },
      ]);
    }
    setShowBundleItemPicker(false);
    setBundleItemSearch('');
  };

  const handleUpdateBundleItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveBundleItem(itemId);
    } else {
      setBundleItems(bundleItems.map(bi =>
        bi.itemId === itemId ? { ...bi, quantity } : bi
      ));
    }
  };

  const handleRemoveBundleItem = (itemId: string) => {
    setBundleItems(bundleItems.filter(bi => bi.itemId !== itemId));
  };

  const calculateBundleTotal = () => {
    return bundleItems.reduce((sum, bi) => sum + (bi.itemBasePrice * bi.quantity), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedUnit = UNIT_OPTIONS.find(u => u.value === unit);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoadingItem) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
          Carregando...
        </Text>
      </View>
    );
  }

  if (!originalItem) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.text.tertiary} />
        <Text variant="h5" color="secondary" style={{ marginTop: spacing[3] }}>
          Item não encontrado
        </Text>
        <Button variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
          Voltar
        </Button>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `Editar ${TYPE_LABELS[originalItem.type]}`,
          headerBackTitle: 'Voltar',
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background.primary }]}
        edges={['bottom']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { padding: spacing[4] }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Basic Info */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                Informações Básicas
              </Text>

              <Input
                label="Nome *"
                placeholder="Nome do item"
                value={name}
                onChangeText={setName}
                error={errors.name}
              />

              <View style={{ height: spacing[3] }} />

              <Input
                label="Descrição"
                placeholder="Descrição do item..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <View style={{ height: spacing[3] }} />

              <Input
                label="SKU / Código"
                placeholder="Código único do item"
                value={sku}
                onChangeText={setSku}
                autoCapitalize="characters"
              />

              <View style={{ height: spacing[3] }} />

              {/* Category Picker */}
              <Text variant="caption" color="secondary" style={{ marginBottom: spacing[1] }}>
                Categoria
              </Text>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { borderColor: colors.border.default, backgroundColor: colors.background.secondary },
                ]}
                onPress={() => setShowCategoryPicker(true)}
              >
                {selectedCategory ? (
                  <View style={styles.pickerContent}>
                    {selectedCategory.color && (
                      <View style={[styles.categoryDot, { backgroundColor: selectedCategory.color }]} />
                    )}
                    <Text variant="body">{selectedCategory.name}</Text>
                  </View>
                ) : (
                  <Text variant="body" color="tertiary">Selecionar categoria...</Text>
                )}
                <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <View style={{ height: spacing[3] }} />

              {/* Status Toggle */}
              <TouchableOpacity
                style={[
                  styles.statusToggle,
                  { borderColor: isActive ? colors.success[500] : colors.border.default },
                ]}
                onPress={() => setIsActive(!isActive)}
              >
                <View style={styles.statusToggleContent}>
                  <Ionicons
                    name={isActive ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={isActive ? colors.success[500] : colors.text.tertiary}
                  />
                  <View style={{ marginLeft: spacing[2] }}>
                    <Text variant="body" weight="medium">
                      {isActive ? 'Item Ativo' : 'Item Inativo'}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {isActive
                        ? 'Visível no catálogo'
                        : 'Não aparece no catálogo'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Card>

            {/* Pricing */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                Preço e Unidade
              </Text>

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Input
                    label="Preço de Venda *"
                    placeholder="0,00"
                    value={basePrice}
                    onChangeText={setBasePrice}
                    keyboardType="decimal-pad"
                    error={errors.basePrice}
                    leftIcon={<Text color="secondary">R$</Text>}
                  />
                </View>
                <View style={{ width: spacing[3] }} />
                <View style={styles.flex1}>
                  <Input
                    label="Custo"
                    placeholder="0,00"
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="decimal-pad"
                    leftIcon={<Text color="secondary">R$</Text>}
                  />
                </View>
              </View>

              <View style={{ height: spacing[3] }} />

              {/* Unit Picker */}
              <Text variant="caption" color="secondary" style={{ marginBottom: spacing[1] }}>
                Unidade de Medida
              </Text>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  { borderColor: colors.border.default, backgroundColor: colors.background.secondary },
                ]}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text variant="body">{selectedUnit?.label || unit}</Text>
                <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              {/* Duration for services */}
              {originalItem.type === 'SERVICE' && (
                <>
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label="Duração Padrão (minutos)"
                    placeholder="60"
                    value={defaultDuration}
                    onChangeText={setDefaultDuration}
                    keyboardType="number-pad"
                    error={errors.defaultDuration}
                  />
                </>
              )}
            </Card>

            {/* Bundle Items - Only for BUNDLE type */}
            {originalItem.type === 'BUNDLE' && (
              <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
                <View style={styles.sectionHeader}>
                  <Text variant="subtitle" weight="semibold">
                    Composição do Kit
                  </Text>
                  <TouchableOpacity
                    style={[styles.addBundleButton, { backgroundColor: colors.primary[500] }]}
                    onPress={() => setShowBundleItemPicker(true)}
                  >
                    <Ionicons name="add" size={20} color={colors.background.primary} />
                  </TouchableOpacity>
                </View>

                {errors.bundleItems && (
                  <Text variant="caption" color="error" style={{ marginBottom: spacing[2] }}>
                    {errors.bundleItems}
                  </Text>
                )}

                {bundleItems.length === 0 ? (
                  <View style={[styles.emptyBundle, { backgroundColor: colors.background.secondary }]}>
                    <Ionicons name="layers-outline" size={32} color={colors.text.tertiary} />
                    <Text variant="body" color="tertiary" style={{ marginTop: spacing[2] }}>
                      Adicione produtos ou serviços ao kit
                    </Text>
                  </View>
                ) : (
                  <>
                    {bundleItems.map(bi => (
                      <View
                        key={bi.itemId}
                        style={[styles.bundleItem, { borderColor: colors.border.light }]}
                      >
                        <View style={styles.bundleItemInfo}>
                          <Text variant="body" weight="medium" numberOfLines={1}>
                            {bi.itemName}
                          </Text>
                          <Text variant="caption" color="secondary">
                            {formatCurrency(bi.itemBasePrice)} / {bi.itemUnit}
                          </Text>
                        </View>

                        <View style={styles.bundleItemControls}>
                          <TouchableOpacity
                            style={[styles.qtyButton, { borderColor: colors.border.default }]}
                            onPress={() => handleUpdateBundleItemQuantity(bi.itemId, bi.quantity - 1)}
                          >
                            <Ionicons name="remove" size={16} color={colors.text.secondary} />
                          </TouchableOpacity>

                          <Text variant="body" weight="medium" style={styles.qtyText}>
                            {bi.quantity}
                          </Text>

                          <TouchableOpacity
                            style={[styles.qtyButton, { borderColor: colors.border.default }]}
                            onPress={() => handleUpdateBundleItemQuantity(bi.itemId, bi.quantity + 1)}
                          >
                            <Ionicons name="add" size={16} color={colors.text.secondary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoveBundleItem(bi.itemId)}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.error[500]} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <View style={[styles.bundleTotal, { borderTopColor: colors.border.light }]}>
                      <Text variant="body" color="secondary">Total do Kit:</Text>
                      <Text variant="h5" weight="bold" color="primary">
                        {formatCurrency(calculateBundleTotal())}
                      </Text>
                    </View>
                  </>
                )}
              </Card>
            )}

            {/* Offline notice */}
            <View style={[styles.offlineNotice, { backgroundColor: colors.info[50] }]}>
              <Text variant="caption" color="secondary">
                As alterações serão salvas localmente e sincronizadas quando houver conexão.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.background.primary,
                borderTopColor: colors.border.light,
                padding: spacing[4],
              },
            ]}
          >
            <Button
              variant="ghost"
              onPress={() => router.back()}
              disabled={isLoading}
              style={styles.cancelButton}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              loading={isLoading}
              style={styles.saveButton}
            >
              Salvar Alterações
            </Button>
          </View>
        </KeyboardAvoidingView>

        {/* Category Picker Modal */}
        <Modal
          visible={showCategoryPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
              <View style={styles.modalHeader}>
                <Text variant="h5" weight="semibold">Selecionar Categoria</Text>
                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.modalOption, { borderBottomColor: colors.border.light }]}
                onPress={() => {
                  setCategoryId(null);
                  setShowCategoryPicker(false);
                }}
              >
                <Text variant="body" color={!categoryId ? 'primary' : undefined}>
                  Sem categoria
                </Text>
                {!categoryId && (
                  <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                )}
              </TouchableOpacity>

              <FlatList
                data={categories}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalOption, { borderBottomColor: colors.border.light }]}
                    onPress={() => {
                      setCategoryId(item.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={styles.pickerContent}>
                      {item.color && (
                        <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                      )}
                      <Text
                        variant="body"
                        color={categoryId === item.id ? 'primary' : undefined}
                      >
                        {item.name}
                      </Text>
                    </View>
                    {categoryId === item.id && (
                      <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Unit Picker Modal */}
        <Modal
          visible={showUnitPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowUnitPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
              <View style={styles.modalHeader}>
                <Text variant="h5" weight="semibold">Unidade de Medida</Text>
                <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={UNIT_OPTIONS}
                keyExtractor={item => item.value}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalOption, { borderBottomColor: colors.border.light }]}
                    onPress={() => {
                      setUnit(item.value);
                      setShowUnitPicker(false);
                    }}
                  >
                    <Text
                      variant="body"
                      color={unit === item.value ? 'primary' : undefined}
                    >
                      {item.label}
                    </Text>
                    {unit === item.value && (
                      <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        {/* Bundle Item Picker Modal */}
        <Modal
          visible={showBundleItemPicker}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowBundleItemPicker(false);
            setBundleItemSearch('');
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
              <View style={styles.modalHeader}>
                <Text variant="h5" weight="semibold">Adicionar ao Kit</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowBundleItemPicker(false);
                    setBundleItemSearch('');
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBox, { backgroundColor: colors.background.secondary }]}>
                <Ionicons name="search" size={20} color={colors.text.tertiary} />
                <Input
                  placeholder="Buscar produto ou serviço..."
                  value={bundleItemSearch}
                  onChangeText={setBundleItemSearch}
                  style={styles.searchInput}
                />
              </View>

              <FlatList
                data={availableItems}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isAdded = bundleItems.some(bi => bi.itemId === item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.bundlePickerItem,
                        { borderBottomColor: colors.border.light },
                        isAdded && { backgroundColor: colors.primary[50] },
                      ]}
                      onPress={() => handleAddBundleItem(item)}
                    >
                      <View style={styles.bundlePickerInfo}>
                        <Text variant="body" weight="medium">{item.name}</Text>
                        <Text variant="caption" color="secondary">
                          {item.type === 'PRODUCT' ? 'Produto' : 'Serviço'} - {formatCurrency(item.basePrice)} / {item.unit}
                        </Text>
                      </View>
                      {isAdded ? (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                      ) : (
                        <Ionicons name="add-circle-outline" size={24} color={colors.text.tertiary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Ionicons name="cube-outline" size={48} color={colors.text.tertiary} />
                    <Text variant="body" color="tertiary" style={{ marginTop: spacing[2] }}>
                      Nenhum item encontrado
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },

  // Picker Button
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Status Toggle
  statusToggle: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Bundle Items
  addBundleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBundle: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 8,
  },
  bundleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  bundleItemInfo: {
    flex: 1,
  },
  bundleItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    width: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
    marginLeft: 8,
  },
  bundleTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },

  // Footer
  offlineNotice: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  emptyList: {
    alignItems: 'center',
    padding: 32,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  bundlePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  bundlePickerInfo: {
    flex: 1,
  },
});
