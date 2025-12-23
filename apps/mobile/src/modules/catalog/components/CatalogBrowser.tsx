// @ts-nocheck
/**
 * CatalogBrowser - Modal para seleção de itens do catálogo
 *
 * Permite buscar e selecionar produtos, serviços e kits
 * para adicionar a orçamentos e OSs.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CatalogItem, ProductCategory, ItemType } from '../../../db/schema';
import { CatalogService } from '../CatalogService';
import { ItemSearchBar } from './ItemSearchBar';
import { CategoryFilter } from './CategoryFilter';
import { CatalogItemCard } from './CatalogItemCard';
import { useColors } from '../../../design-system/ThemeProvider';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

export interface CatalogBrowserResult {
  item: CatalogItem;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface CatalogBrowserProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (result: CatalogBrowserResult) => void;
  title?: string;
  allowManualItem?: boolean;
  /** technicianId para garantir que o serviço está configurado */
  technicianId?: string;
}

type TypeFilterValue = 'ALL' | ItemType;

// =============================================================================
// TYPE FILTER
// =============================================================================

const TYPE_FILTERS: { value: TypeFilterValue; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PRODUCT', label: 'Produtos' },
  { value: 'SERVICE', label: 'Serviços' },
  { value: 'BUNDLE', label: 'Kits' },
];

function TypeFilter({
  selected,
  onSelect,
  colors,
}: {
  selected: TypeFilterValue;
  onSelect: (value: TypeFilterValue) => void;
  colors?: ThemeColors;
}) {
  return (
    <View style={styles.typeFilterContainer}>
      {TYPE_FILTERS.map((filter) => {
        const isSelected = selected === filter.value;
        return (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.typeFilterButton,
              {
                backgroundColor: isSelected
                  ? colors?.primary[600] || '#7C3AED'
                  : colors?.gray[100] || '#F3F4F6',
                borderColor: isSelected
                  ? colors?.primary[600] || '#7C3AED'
                  : colors?.gray[200] || '#E5E7EB',
              },
            ]}
            onPress={() => onSelect(filter.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typeFilterText,
                {
                  color: isSelected
                    ? colors?.white || '#FFFFFF'
                    : colors?.text.secondary || '#6B7280',
                },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =============================================================================
// QUANTITY MODAL
// =============================================================================

interface QuantityModalProps {
  visible: boolean;
  item: CatalogItem | null;
  onClose: () => void;
  onConfirm: (quantity: number, unitPrice: number, discount?: number) => void;
  colors?: ThemeColors;
}

function QuantityModal({ visible, item, onClose, onConfirm, colors }: QuantityModalProps) {
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');

  useEffect(() => {
    if (item) {
      setQuantity('1');
      setUnitPrice(item.basePrice.toFixed(2).replace('.', ','));
      setDiscount('');
    }
  }, [item]);

  const handleConfirm = () => {
    const qty = parseFloat(quantity.replace(',', '.')) || 1;
    const price = parseFloat(unitPrice.replace(',', '.')) || item?.basePrice || 0;
    const disc = parseFloat(discount.replace(',', '.')) || 0;
    onConfirm(qty, price, disc > 0 ? disc : undefined);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity.replace(',', '.')) || 0;
    const price = parseFloat(unitPrice.replace(',', '.')) || 0;
    const disc = parseFloat(discount.replace(',', '.')) || 0;
    return qty * price - disc;
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.quantityModalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.quantityModalContainer}
        >
          <View style={[styles.quantityModalContent, { backgroundColor: colors?.background.primary || '#FFFFFF' }]}>
            {/* Header */}
            <View style={styles.quantityModalHeader}>
              <Text style={[styles.quantityModalTitle, { color: colors?.text.primary || '#111827' }]}>Adicionar Item</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors?.text.secondary || '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Item Info */}
            <View style={[styles.quantityItemInfo, { backgroundColor: colors?.background.secondary || '#F9FAFB' }]}>
              <Text style={[styles.quantityItemName, { color: colors?.text.primary || '#111827' }]}>{item.name}</Text>
              <Text style={[styles.quantityItemPrice, { color: colors?.text.secondary || '#6B7280' }]}>
                Preço base: {formatPrice(item.basePrice)}
                {item.unit ? `/${item.unit}` : ''}
              </Text>
            </View>

            {/* Inputs */}
            <View style={styles.quantityInputs}>
              {/* Quantidade */}
              <View style={styles.quantityInputGroup}>
                <Text style={[styles.quantityInputLabel, { color: colors?.text.secondary || '#374151' }]}>Quantidade</Text>
                <View style={styles.quantityInputRow}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors?.primary[50] || '#EFF6FF' }]}
                    onPress={() => {
                      const val = parseFloat(quantity.replace(',', '.')) || 0;
                      if (val > 1) setQuantity(String(val - 1));
                    }}
                  >
                    <Ionicons name="remove" size={20} color={colors?.primary[600] || '#3B82F6'} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.quantityInput, { borderColor: colors?.border.default || '#D1D5DB', color: colors?.text.primary || '#111827' }]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors?.primary[50] || '#EFF6FF' }]}
                    onPress={() => {
                      const val = parseFloat(quantity.replace(',', '.')) || 0;
                      setQuantity(String(val + 1));
                    }}
                  >
                    <Ionicons name="add" size={20} color={colors?.primary[600] || '#3B82F6'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Preço Unitário */}
              <View style={styles.quantityInputGroup}>
                <Text style={[styles.quantityInputLabel, { color: colors?.text.secondary || '#374151' }]}>Preço Unitário</Text>
                <View style={[styles.priceInputContainer, { borderColor: colors?.border.default || '#D1D5DB' }]}>
                  <Text style={[styles.currencyPrefix, { color: colors?.text.secondary || '#6B7280' }]}>R$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: colors?.text.primary || '#111827' }]}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                </View>
              </View>

              {/* Desconto */}
              <View style={styles.quantityInputGroup}>
                <Text style={[styles.quantityInputLabel, { color: colors?.text.secondary || '#374151' }]}>Desconto (R$)</Text>
                <View style={[styles.priceInputContainer, { borderColor: colors?.border.default || '#D1D5DB' }]}>
                  <Text style={[styles.currencyPrefix, { color: colors?.text.secondary || '#6B7280' }]}>R$</Text>
                  <TextInput
                    style={[styles.priceInput, { color: colors?.text.primary || '#111827' }]}
                    value={discount}
                    onChangeText={setDiscount}
                    keyboardType="decimal-pad"
                    placeholder="0,00"
                    placeholderTextColor={colors?.gray[400] || '#9CA3AF'}
                    selectTextOnFocus
                  />
                </View>
              </View>
            </View>

            {/* Total */}
            <View style={[styles.quantityTotalContainer, { borderTopColor: colors?.border.light || '#E5E7EB' }]}>
              <Text style={[styles.quantityTotalLabel, { color: colors?.text.secondary || '#374151' }]}>Total do Item:</Text>
              <Text style={[styles.quantityTotalValue, { color: colors?.text.primary || '#111827' }]}>
                {formatPrice(calculateTotal())}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.quantityActions}>
              <TouchableOpacity
                style={[styles.quantityCancelButton, { backgroundColor: colors?.gray[100] || '#F3F4F6' }]}
                onPress={onClose}
              >
                <Text style={[styles.quantityCancelText, { color: colors?.text.secondary || '#6B7280' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quantityConfirmButton, { backgroundColor: colors?.primary[600] || '#3B82F6' }]}
                onPress={handleConfirm}
              >
                <Ionicons name="checkmark" size={20} color={colors?.white || '#FFFFFF'} />
                <Text style={[styles.quantityConfirmText, { color: colors?.white || '#FFFFFF' }]}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CatalogBrowser({
  visible,
  onClose,
  onSelect,
  title = 'Selecionar Item',
  allowManualItem = true,
  technicianId,
}: CatalogBrowserProps) {
  // Theme
  const colors = useColors();

  // Configurar o serviço com technicianId quando o modal abrir
  useEffect(() => {
    if (visible && technicianId) {
      console.log('[CatalogBrowser] Configuring CatalogService with technicianId:', technicianId);
      CatalogService.configure(technicianId);
    }
  }, [visible, technicianId]);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<TypeFilterValue>('ALL');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);

  // Load categories
  useEffect(() => {
    if (visible) {
      loadCategories();
    }
  }, [visible]);

  // Load items when filters change
  useEffect(() => {
    if (visible) {
      loadItems();
    }
  }, [visible, searchQuery, selectedCategoryId, selectedType]);

  const loadCategories = async () => {
    try {
      const cats = await CatalogService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('[CatalogBrowser] Error loading categories:', error);
    }
  };

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[CatalogBrowser] loadItems called with:', {
        searchQuery,
        selectedCategoryId,
        selectedType,
        technicianId,
      });
      const results = await CatalogService.searchItems({
        query: searchQuery || undefined,
        categoryId: selectedCategoryId || undefined,
        type: selectedType === 'ALL' ? undefined : selectedType,
        limit: 100,
      });
      console.log('[CatalogBrowser] loadItems results:', results.length, 'items');
      setItems(results);
    } catch (error) {
      console.error('[CatalogBrowser] Error loading items:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategoryId, selectedType, technicianId]);

  // Handlers
  const handleItemPress = (item: CatalogItem) => {
    setSelectedItem(item);
    setShowQuantityModal(true);
  };

  const handleQuantityConfirm = (quantity: number, unitPrice: number, discount?: number) => {
    if (selectedItem) {
      onSelect({
        item: selectedItem,
        quantity,
        unitPrice,
        discount,
      });
      setShowQuantityModal(false);
      setSelectedItem(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategoryId(null);
    setSelectedType('ALL');
    onClose();
  };

  // Render item
  const renderItem = ({ item }: { item: CatalogItem }) => (
    <CatalogItemCard
      item={item}
      onPress={handleItemPress}
      showCategory={selectedCategoryId === null}
    />
  );

  // Empty state
  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Nenhum item encontrado</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? `Não encontramos resultados para "${searchQuery}"`
            : 'Não há itens cadastrados no catálogo'}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <ItemSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
        </View>

        {/* Type Filter */}
        <TypeFilter selected={selectedType} onSelect={setSelectedType} colors={colors} />

        {/* Category Filter */}
        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            selectedId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
          />
        )}

        {/* Items List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Carregando catálogo...</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={items.length === 0 && styles.emptyList}
          />
        )}

        {/* Manual Item Button */}
        {allowManualItem && (
          <TouchableOpacity
            style={[styles.manualItemButton, { borderTopColor: colors.border.light, backgroundColor: colors.background.secondary }]}
            onPress={() => {
              // Criar item manual vazio
              const manualItem: CatalogItem = {
                id: `manual-${Date.now()}`,
                name: 'Item Manual',
                type: 'PRODUCT',
                basePrice: 0,
                unit: 'UN',
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                technicianId: '',
              };
              setSelectedItem(manualItem);
              setShowQuantityModal(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary[600]} />
            <Text style={[styles.manualItemText, { color: colors.primary[600] }]}>Adicionar Item Manual</Text>
          </TouchableOpacity>
        )}

        {/* Quantity Modal */}
        <QuantityModal
          visible={showQuantityModal}
          item={selectedItem}
          onClose={() => {
            setShowQuantityModal(false);
            setSelectedItem(null);
          }}
          onConfirm={handleQuantityConfirm}
          colors={colors}
        />
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  typeFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typeFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeFilterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  manualItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  manualItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3B82F6',
    marginLeft: 8,
  },
  // Quantity Modal Styles
  quantityModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  quantityModalContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  quantityModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  quantityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  quantityItemInfo: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  quantityItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  quantityItemPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  quantityInputs: {
    gap: 16,
    marginBottom: 20,
  },
  quantityInputGroup: {
    gap: 8,
  },
  quantityInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  quantityInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 16,
    color: '#6B7280',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#111827',
  },
  quantityTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginBottom: 16,
  },
  quantityTotalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  quantityTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  quantityActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  quantityCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  quantityConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quantityConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CatalogBrowser;
