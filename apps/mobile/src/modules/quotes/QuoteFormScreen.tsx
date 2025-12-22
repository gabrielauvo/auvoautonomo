/**
 * QuoteFormScreen
 *
 * Formulario para criar/editar orcamentos.
 * Suporta adicao de itens do catálogo, selecao de cliente, e salvamento offline-first.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { Client, QuoteItem, CatalogItem } from '../../db/schema';
import { QuoteService, CreateQuoteInput, CreateQuoteItemInput, QuoteWithItems } from './QuoteService';
import { ClientRepository } from '../../db/repositories/ClientRepository';
import { useTranslation } from '../../i18n';
import { CatalogBrowser, CatalogBrowserResult } from '../catalog/components/CatalogBrowser';
import { QuickClientModal } from '../clients/components/QuickClientModal';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface QuoteFormScreenProps {
  quote?: QuoteWithItems;     // If provided, edit mode
  clientId?: string;          // Pre-selected client
  onSave?: (quote: QuoteWithItems) => void;
  onCancel?: () => void;
}

interface FormItem {
  id: string;
  itemId?: string;          // ID do item do catálogo (se vier do catálogo)
  name: string;
  type: 'SERVICE' | 'PRODUCT' | 'BUNDLE';
  unit: string;
  quantity: number;
  unitPrice: number;
  discountValue: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function calculateItemTotal(item: FormItem): number {
  return item.quantity * item.unitPrice - item.discountValue;
}

function calculateTotal(items: FormItem[], discount: number): number {
  const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  return itemsTotal - discount;
}

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
  colors?: ThemeColors;
}> = ({ label, required, children, colors }) => (
  <View style={styles.field}>
    <Text variant="caption" color="secondary" weight="semibold">
      {label} {required && <Text variant="caption" style={{ color: colors?.error[500] || '#EF4444' }}>*</Text>}
    </Text>
    {children}
  </View>
);

const ItemRow: React.FC<{
  item: FormItem;
  onEdit: () => void;
  onRemove: () => void;
  locale: string;
  t: (key: string) => string;
  colors: ThemeColors;
}> = ({ item, onEdit, onRemove, locale, t, colors }) => (
  <View style={[styles.itemRow, { borderBottomColor: colors.border.light }]}>
    <TouchableOpacity style={styles.itemInfo} onPress={onEdit}>
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {item.name}
      </Text>
      <Text variant="caption" color="secondary">
        {item.quantity} {item.unit} x {formatCurrency(item.unitPrice, locale)}
      </Text>
    </TouchableOpacity>
    <View style={styles.itemActions}>
      <Text variant="body" weight="semibold">
        {formatCurrency(calculateItemTotal(item), locale)}
      </Text>
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Text variant="body" style={{ color: colors.error[500] }}>✕</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ClientSelector: React.FC<{
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  onCreateNew: () => void;
  technicianId: string;
  t: (key: string) => string;
  colors: ThemeColors;
}> = ({ selectedClient, onSelect, onCreateNew, technicianId, t, colors }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadClients = async (query: string = '') => {
    if (!technicianId) {
      console.warn('[ClientSelector] No technicianId provided');
      return;
    }
    try {
      setLoading(true);
      const results = query
        ? await ClientRepository.search(technicianId, query, 20)
        : await ClientRepository.getAll(technicianId, { limit: 20 });
      setClients(results);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modalVisible) {
      loadClients();
    }
  }, [modalVisible]);

  useEffect(() => {
    if (modalVisible) {
      const timer = setTimeout(() => {
        loadClients(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, modalVisible]);

  return (
    <>
      <TouchableOpacity
        style={[styles.selectorButton, { backgroundColor: colors.gray[100] }]}
        onPress={() => setModalVisible(true)}
      >
        <Text
          variant="body"
          color={selectedClient ? 'primary' : 'tertiary'}
        >
          {selectedClient ? selectedClient.name : t('quotes.selectClient')}
        </Text>
        <Text variant="body" color="tertiary">▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
              <Text variant="h4" weight="bold">{t('quotes.selectClient')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text variant="body" color="tertiary">✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalSearch, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
              placeholder={t('clients.searchPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Botão de criar novo cliente */}
            <TouchableOpacity
              style={[styles.newClientButton, { backgroundColor: colors.primary[50], borderColor: colors.primary[200] }]}
              onPress={() => {
                setModalVisible(false);
                onCreateNew();
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary[600]} />
              <Text variant="body" weight="semibold" style={{ color: colors.primary[600], marginLeft: spacing[2] }}>
                {t('clients.createNew') || 'Novo Cliente'}
              </Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator size="small" color={colors.primary[600]} style={{ padding: spacing[4] }} />
            ) : (
              <ScrollView style={styles.modalList}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.modalItem, { borderBottomColor: colors.border.light }]}
                    onPress={() => {
                      onSelect(client);
                      setModalVisible(false);
                    }}
                  >
                    <Text variant="body" weight="semibold">{client.name}</Text>
                    {client.phone && (
                      <Text variant="caption" color="secondary">{client.phone}</Text>
                    )}
                  </TouchableOpacity>
                ))}
                {clients.length === 0 && (
                  <Text variant="body" color="tertiary" align="center" style={{ padding: spacing[4] }}>
                    {t('clients.noClientsFound')}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const ItemFormModal: React.FC<{
  visible: boolean;
  item: FormItem | null;
  onSave: (item: FormItem) => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: string;
  colors: ThemeColors;
}> = ({ visible, item, onSave, onClose, t, locale, colors }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'SERVICE' | 'PRODUCT'>('SERVICE');
  const [unit, setUnit] = useState('un');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discountValue, setDiscountValue] = useState('0');

  useEffect(() => {
    if (item) {
      setName(item.name);
      // BUNDLE items are treated as PRODUCT in the form (BUNDLE comes from catalog)
      setType(item.type === 'BUNDLE' ? 'PRODUCT' : item.type);
      setUnit(item.unit);
      setQuantity(String(item.quantity));
      setUnitPrice(String(item.unitPrice));
      setDiscountValue(String(item.discountValue));
    } else {
      setName('');
      setType('SERVICE');
      setUnit('un');
      setQuantity('1');
      setUnitPrice('');
      setDiscountValue('0');
    }
  }, [item, visible]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('validation.required'));
      return;
    }
    if (!unitPrice || parseFloat(unitPrice) <= 0) {
      Alert.alert(t('common.error'), t('validation.positive'));
      return;
    }

    onSave({
      id: item?.id || generateTempId(),
      name: name.trim(),
      type,
      unit,
      quantity: parseFloat(quantity) || 1,
      unitPrice: parseFloat(unitPrice) || 0,
      discountValue: parseFloat(discountValue) || 0,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background.primary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
            <Text variant="h4" weight="bold">
              {item ? t('common.edit') : t('quotes.addItem')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text variant="body" color="tertiary">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <FormField label={t('quotes.itemName')} required colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
                value={name}
                onChangeText={setName}
                placeholder={t('quotes.itemName')}
                placeholderTextColor={colors.gray[400]}
              />
            </FormField>

            <FormField label={t('quotes.itemType')} colors={colors}>
              <View style={styles.typeButtons}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { backgroundColor: colors.gray[100] },
                    type === 'SERVICE' && { backgroundColor: colors.primary[600] }
                  ]}
                  onPress={() => setType('SERVICE')}
                >
                  <Text
                    variant="bodySmall"
                    weight={type === 'SERVICE' ? 'semibold' : 'normal'}
                    style={{ color: type === 'SERVICE' ? colors.white : colors.text.secondary }}
                  >
                    {t('quotes.service')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    { backgroundColor: colors.gray[100] },
                    type === 'PRODUCT' && { backgroundColor: colors.primary[600] }
                  ]}
                  onPress={() => setType('PRODUCT')}
                >
                  <Text
                    variant="bodySmall"
                    weight={type === 'PRODUCT' ? 'semibold' : 'normal'}
                    style={{ color: type === 'PRODUCT' ? colors.white : colors.text.secondary }}
                  >
                    {t('quotes.product')}
                  </Text>
                </TouchableOpacity>
              </View>
            </FormField>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing[2] }}>
                <FormField label={t('common.quantity')} required colors={colors}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    placeholder="1"
                    placeholderTextColor={colors.gray[400]}
                  />
                </FormField>
              </View>
              <View style={{ flex: 1, marginLeft: spacing[2] }}>
                <FormField label={t('common.unit')} colors={colors}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="un"
                    placeholderTextColor={colors.gray[400]}
                  />
                </FormField>
              </View>
            </View>

            <FormField label={t('quotes.unitPrice')} required colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.gray[400]}
              />
            </FormField>

            <FormField label={t('common.discount')} colors={colors}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.gray[100], color: colors.text.primary }]}
                value={discountValue}
                onChangeText={setDiscountValue}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={colors.gray[400]}
              />
            </FormField>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.gray[100] }]}
                onPress={onClose}
              >
                <Text variant="body" weight="semibold" style={{ color: colors.text.secondary }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary[600] }]}
                onPress={handleSave}
              >
                <Text variant="body" weight="semibold" style={{ color: colors.white }}>
                  {t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuoteFormScreen: React.FC<QuoteFormScreenProps> = ({
  quote,
  clientId,
  onSave,
  onCancel,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [items, setItems] = useState<FormItem[]>([]);
  const [notes, setNotes] = useState('');
  const [discountValue, setDiscountValue] = useState('0');
  const [visitDate, setVisitDate] = useState('');
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FormItem | null>(null);

  // Novos estados para catálogo e cliente rápido
  const [catalogBrowserVisible, setCatalogBrowserVisible] = useState(false);
  const [quickClientModalVisible, setQuickClientModalVisible] = useState(false);

  // Obter technicianId do QuoteService
  const technicianId = QuoteService.getTechnicianId() || '';

  // Initialize form with existing quote or pre-selected client
  useEffect(() => {
    const initForm = async () => {
      if (quote) {
        // Edit mode
        setNotes(quote.notes || '');
        setDiscountValue(String(quote.discountValue || 0));
        setVisitDate(quote.visitScheduledAt || '');
        setItems(quote.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: (item.type as 'SERVICE' | 'PRODUCT') || 'SERVICE',
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue,
        })));

        // Load client
        if (quote.clientId) {
          const client = await ClientRepository.getById(quote.clientId);
          if (client) setSelectedClient(client);
        }
      } else if (clientId) {
        // Pre-selected client
        const client = await ClientRepository.getById(clientId);
        if (client) setSelectedClient(client);
      }
    };

    initForm();
  }, [quote, clientId]);

  const handleAddItem = () => {
    setEditingItem(null);
    setItemModalVisible(true);
  };

  const handleAddFromCatalog = () => {
    setCatalogBrowserVisible(true);
  };

  const handleCatalogItemSelected = (result: CatalogBrowserResult) => {
    const newItem: FormItem = {
      id: generateTempId(),
      itemId: result.item.id.startsWith('manual-') ? undefined : result.item.id,
      name: result.item.name,
      type: (result.item.type as 'SERVICE' | 'PRODUCT' | 'BUNDLE') || 'SERVICE',
      unit: result.item.unit || 'un',
      quantity: result.quantity,
      unitPrice: result.unitPrice,
      discountValue: result.discount || 0,
    };
    setItems([...items, newItem]);
    setCatalogBrowserVisible(false);
  };

  const handleEditItem = (item: FormItem) => {
    setEditingItem(item);
    setItemModalVisible(true);
  };

  const handleSaveItem = (item: FormItem) => {
    if (editingItem) {
      setItems(items.map((i) => (i.id === item.id ? item : i)));
    } else {
      setItems([...items, item]);
    }
    setItemModalVisible(false);
  };

  const handleClientCreated = (client: Client) => {
    setSelectedClient(client);
    setQuickClientModalVisible(false);
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      t('common.remove'),
      t('common.confirm') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: () => setItems(items.filter((i) => i.id !== itemId)),
        },
      ],
    );
  };

  const handleSave = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (loading) {
      return;
    }

    // Validation
    if (!selectedClient) {
      Alert.alert(t('common.error'), t('validation.required') + ': ' + t('quotes.client'));
      return;
    }
    if (items.length === 0) {
      Alert.alert(t('common.error'), t('quotes.noItems'));
      return;
    }

    // Validar que o desconto não é maior que o subtotal
    const subtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const discount = parseFloat(discountValue) || 0;
    if (discount > subtotal) {
      Alert.alert(
        t('common.error'),
        t('quotes.discountExceedsTotal') || 'O desconto não pode ser maior que o valor total dos itens'
      );
      return;
    }

    // Validar que o total não é negativo
    if (subtotal - discount < 0) {
      Alert.alert(
        t('common.error'),
        t('quotes.negativeTotalError') || 'O valor total não pode ser negativo'
      );
      return;
    }

    try {
      setLoading(true);

      const quoteItems: CreateQuoteItemInput[] = items.map((item) => ({
        name: item.name,
        type: item.type,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountValue: item.discountValue,
      }));

      let savedQuote: QuoteWithItems;

      if (quote) {
        // Update existing quote
        const updated = await QuoteService.updateQuote(quote.id, {
          notes: notes || undefined,
          discountValue: parseFloat(discountValue) || 0,
          visitScheduledAt: visitDate || undefined,
          items: quoteItems,
        });
        if (updated) {
          savedQuote = updated;
        } else {
          throw new Error(t('errors.generic'));
        }
      } else {
        // Create new quote
        savedQuote = await QuoteService.createQuote({
          clientId: selectedClient.id,
          notes: notes || undefined,
          discountValue: parseFloat(discountValue) || 0,
          visitScheduledAt: visitDate || undefined,
          items: quoteItems,
        });
      }

      Alert.alert(t('common.success'), t('quotes.saveSuccess'));
      onSave?.(savedQuote);
    } catch (error: any) {
      console.error('Error saving quote:', error);
      Alert.alert(t('common.error'), error.message || t('quotes.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const total = calculateTotal(items, parseFloat(discountValue) || 0);

  // Dynamic styles based on theme
  const dynamicStyles = {
    container: { backgroundColor: colors.background.secondary },
    input: { backgroundColor: colors.gray[100], color: colors.text.primary },
    totalBorder: { borderTopColor: colors.border.default },
    cancelButton: { backgroundColor: colors.gray[100], borderColor: colors.border.default },
    saveButton: { backgroundColor: colors.primary[600] },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]} contentContainerStyle={styles.content}>
      {/* Client Selection */}
      <Card style={styles.card}>
        <FormField label={t('quotes.client')} required colors={colors}>
          <ClientSelector
            selectedClient={selectedClient}
            onSelect={setSelectedClient}
            onCreateNew={() => setQuickClientModalVisible(true)}
            technicianId={technicianId}
            t={t}
            colors={colors}
          />
        </FormField>
      </Card>

      {/* Items */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text variant="body" weight="semibold">{t('quotes.items')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TouchableOpacity onPress={handleAddFromCatalog}>
              <Text variant="body" weight="semibold" style={{ color: colors.primary[500] }}>
                {t('quotes.fromCatalog')}
              </Text>
            </TouchableOpacity>
            <Text variant="body" color="tertiary">|</Text>
            <TouchableOpacity onPress={handleAddItem}>
              <Text variant="body" weight="semibold" style={{ color: colors.text.secondary }}>
                {t('quotes.manual')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {items.length === 0 ? (
          <Text variant="body" color="tertiary" style={{ marginTop: spacing[2] }}>
            {t('quotes.noItems')}
          </Text>
        ) : (
          items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={() => handleEditItem(item)}
              onRemove={() => handleRemoveItem(item.id)}
              locale={locale}
              t={t}
              colors={colors}
            />
          ))
        )}
      </Card>

      {/* Totals */}
      <Card style={styles.card}>
        <FormField label={t('common.discount')} colors={colors}>
          <TextInput
            style={[styles.input, dynamicStyles.input]}
            value={discountValue}
            onChangeText={setDiscountValue}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
          />
        </FormField>

        <View style={[styles.totalContainer, dynamicStyles.totalBorder]}>
          <Text variant="body" weight="bold">{t('common.total')}</Text>
          <Text variant="h3" weight="bold" style={{ color: total < 0 ? colors.error[500] : colors.success[500] }}>
            {formatCurrency(total, locale)}
          </Text>
        </View>
        {total < 0 && (
          <Text variant="caption" style={{ color: colors.error[500], marginTop: spacing[1] }}>
            {t('quotes.discountExceedsTotal') || 'O desconto não pode ser maior que o valor total'}
          </Text>
        )}
      </Card>

      {/* Notes */}
      <Card style={styles.card}>
        <FormField label={t('common.notes')} colors={colors}>
          <TextInput
            style={[styles.input, styles.textArea, dynamicStyles.input]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('common.notes')}
            placeholderTextColor={colors.gray[400]}
            multiline
            numberOfLines={3}
          />
        </FormField>
      </Card>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton, dynamicStyles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.text.secondary }}>
            {t('common.cancel')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton, dynamicStyles.saveButton]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text variant="body" weight="semibold" style={{ color: colors.white }}>
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Item Form Modal */}
      <ItemFormModal
        visible={itemModalVisible}
        item={editingItem}
        onSave={handleSaveItem}
        onClose={() => setItemModalVisible(false)}
        t={t}
        locale={locale}
        colors={colors}
      />

      {/* Catalog Browser Modal */}
      <CatalogBrowser
        visible={catalogBrowserVisible}
        onClose={() => setCatalogBrowserVisible(false)}
        onSelect={handleCatalogItemSelected}
        title={t('quotes.selectFromCatalog') || 'Selecionar do Catálogo'}
        allowManualItem={false}
        technicianId={technicianId}
      />

      {/* Quick Client Modal */}
      <QuickClientModal
        visible={quickClientModalVisible}
        onClose={() => setQuickClientModalVisible(false)}
        onClientCreated={handleClientCreated}
      />
    </ScrollView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },
  card: {
    marginBottom: spacing[3],
  },
  field: {
    marginBottom: spacing[3],
  },
  input: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 16,
    marginTop: spacing[1],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  removeButton: {
    padding: spacing[1],
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
  },
  typeButtons: {
    flexDirection: 'row',
    marginTop: spacing[1],
    gap: spacing[2],
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
  },
  modalSearch: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    margin: spacing[4],
    marginBottom: spacing[2],
    fontSize: 16,
  },
  newClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  modalForm: {
    padding: spacing[4],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
});

export default QuoteFormScreen;
