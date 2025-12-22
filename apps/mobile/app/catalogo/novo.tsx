// @ts-nocheck
/**
 * New Catalog Item Screen
 *
 * Tela para criar novo produto, serviço ou kit.
 * Suporta:
 * - Seleção de tipo (Produto, Serviço, Kit)
 * - Campos específicos por tipo
 * - Composição de kit (bundle items)
 * - Salvamento offline-first
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { useAuth } from '../../src/services';
import { CatalogItemRepository, CategoryRepository } from '../../src/db/repositories';
import { CatalogItem, ProductCategory, ItemType } from '../../src/db/schema';
import { InventoryService } from '../../src/modules/inventory';

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

type FormItemType = 'PRODUCT' | 'SERVICE' | 'BUNDLE';

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_OPTIONS: { key: FormItemType; label: string; icon: string; description: string }[] = [
  {
    key: 'PRODUCT',
    label: 'Produto',
    icon: 'cube-outline',
    description: 'Item físico que pode ser vendido',
  },
  {
    key: 'SERVICE',
    label: 'Serviço',
    icon: 'construct-outline',
    description: 'Trabalho ou atendimento prestado',
  },
  {
    key: 'BUNDLE',
    label: 'Kit',
    icon: 'layers-outline',
    description: 'Combinação de produtos e serviços',
  },
];

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

export default function NovoCatalogoScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { user } = useAuth();

  // Form state
  const [itemType, setItemType] = useState<FormItemType>('PRODUCT');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('un');
  const [basePrice, setBasePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [defaultDuration, setDefaultDuration] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [initialStock, setInitialStock] = useState('');

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
    if (technicianId) {
      loadCategories();
    }
  }, [technicianId]);

  const loadCategories = async () => {
    if (!technicianId) return;
    try {
      const cats = await CategoryRepository.getAll(technicianId);
      setCategories(cats);
    } catch (error) {
      console.error('[NovoCatalogoScreen] Error loading categories:', error);
    }
  };

  const loadAvailableItems = useCallback(async (search?: string) => {
    if (!technicianId) return;
    try {
      const items = await CatalogItemRepository.getAvailableForBundle(
        technicianId,
        undefined,
        search
      );
      setAvailableItems(items);
    } catch (error) {
      console.error('[NovoCatalogoScreen] Error loading available items:', error);
    }
  }, [technicianId]);

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

    if (itemType === 'SERVICE' && defaultDuration) {
      const durationNum = parseInt(defaultDuration, 10);
      if (isNaN(durationNum) || durationNum < 0) {
        newErrors.defaultDuration = 'Duração inválida';
      }
    }

    if (itemType === 'BUNDLE' && bundleItems.length === 0) {
      newErrors.bundleItems = 'Adicione pelo menos um item ao kit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, basePrice, itemType, defaultDuration, bundleItems]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleSave = useCallback(async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isLoading) return;

    if (!validate() || !technicianId) return;

    setIsLoading(true);
    try {
      const selectedCategory = categories.find(c => c.id === categoryId);
      const priceValue = parseFloat(basePrice.replace(',', '.'));
      const costValue = costPrice ? parseFloat(costPrice.replace(',', '.')) : undefined;
      const durationValue = defaultDuration ? parseInt(defaultDuration, 10) : undefined;

      const createdItem = await CatalogItemRepository.create(technicianId, {
        name: name.trim(),
        type: itemType,
        unit,
        basePrice: priceValue,
        categoryId: categoryId || undefined,
        categoryName: selectedCategory?.name,
        categoryColor: selectedCategory?.color || undefined,
        description: description.trim() || undefined,
        sku: sku.trim() || undefined,
        costPrice: costValue,
        defaultDurationMinutes: durationValue,
        bundleItems: itemType === 'BUNDLE'
          ? bundleItems.map(bi => ({
              itemId: bi.itemId,
              quantity: bi.quantity,
            }))
          : undefined,
      });

      // Se for produto e tiver quantidade inicial de estoque, criar movimentação
      if (itemType === 'PRODUCT' && initialStock && parseFloat(initialStock) > 0) {
        try {
          InventoryService.configure(technicianId);
          await InventoryService.adjustStock({
            itemId: createdItem.id,
            newQuantity: parseFloat(initialStock),
            notes: 'Estoque inicial',
          });
        } catch (stockError) {
          // Não bloqueia criação do produto se falhar estoque
          console.warn('[NovoCatalogoScreen] Não foi possível adicionar estoque inicial:', stockError);
        }
      }

      Alert.alert('Sucesso', 'Item criado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('[NovoCatalogoScreen] Error creating item:', error);
      Alert.alert('Erro', 'Não foi possível criar o item. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [
    validate, technicianId, categories, categoryId, name, itemType, unit,
    basePrice, costPrice, description, sku, defaultDuration, bundleItems,
  ]);

  const handleAddBundleItem = (item: CatalogItem) => {
    const existing = bundleItems.find(bi => bi.itemId === item.id);
    if (existing) {
      // Increment quantity
      setBundleItems(bundleItems.map(bi =>
        bi.itemId === item.id
          ? { ...bi, quantity: bi.quantity + 1 }
          : bi
      ));
    } else {
      // Add new item
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

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Novo Item',
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
            {/* Type Selector */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[3] }}>
                Tipo de Item
              </Text>

              <View style={styles.typeSelector}>
                {TYPE_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.typeOption,
                      {
                        borderColor: itemType === option.key
                          ? colors.primary[500]
                          : colors.border.light,
                        backgroundColor: itemType === option.key
                          ? colors.primary[50]
                          : colors.background.primary,
                      },
                    ]}
                    onPress={() => setItemType(option.key)}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={24}
                      color={itemType === option.key ? colors.primary[500] : colors.text.secondary}
                    />
                    <Text
                      variant="body"
                      weight={itemType === option.key ? 'semibold' : 'regular'}
                      color={itemType === option.key ? 'primary' : undefined}
                      style={{ marginTop: spacing[1] }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

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
              {itemType === 'SERVICE' && (
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

              {/* Initial stock for products */}
              {itemType === 'PRODUCT' && (
                <>
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label="Quantidade Inicial em Estoque"
                    placeholder="0"
                    value={initialStock}
                    onChangeText={setInitialStock}
                    keyboardType="number-pad"
                    leftIcon={<Ionicons name="cube-outline" size={18} color={colors.text.tertiary} />}
                  />
                  <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                    Define a quantidade inicial de estoque (opcional)
                  </Text>
                </>
              )}
            </Card>

            {/* Bundle Items - Only for BUNDLE type */}
            {itemType === 'BUNDLE' && (
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
                O item será salvo localmente e sincronizado quando houver conexão.
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
              Salvar Item
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
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text variant="body" color="tertiary">
                      Nenhuma categoria cadastrada
                    </Text>
                  </View>
                }
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
                    <Text variant="caption" color="tertiary">
                      Cadastre produtos ou serviços primeiro
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

  // Type Selector
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
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
