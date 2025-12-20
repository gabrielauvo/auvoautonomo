/**
 * InvoiceFormScreen
 *
 * Formulario para criar/editar faturas.
 * Suporta selecao de cliente, valores e salvamento offline-first.
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
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { colors, spacing, borderRadius, shadows } from '../../design-system/tokens';
import { Client, Invoice } from '../../db/schema';
import { InvoiceService, CreateInvoiceInput, UpdateInvoiceInput } from './InvoiceService';
import { ClientRepository } from '../../db/repositories/ClientRepository';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceFormScreenProps {
  invoice?: Invoice;          // If provided, edit mode
  clientId?: string;          // Pre-selected client
  fromQuote?: {               // When converting from quote
    clientId: string;
    subtotal: number;
  };
  onSave?: (invoice: Invoice) => void;
  onCancel?: () => void;
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

function calculateTotal(subtotal: number, tax: number, discount: number): number {
  return subtotal + tax - discount;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  return isNaN(date.getTime()) ? null : date;
}

// =============================================================================
// COMPONENTS
// =============================================================================

const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, required, children }) => (
  <View style={styles.field}>
    <Text variant="caption" color="secondary" weight="semibold">
      {label} {required && <Text variant="caption" style={{ color: colors.error[500] }}>*</Text>}
    </Text>
    {children}
  </View>
);

const ClientSelector: React.FC<{
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  disabled?: boolean;
  t: (key: string) => string;
}> = ({ selectedClient, onSelect, disabled, t }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadClients = async (query: string = '') => {
    try {
      setLoading(true);
      const results = query
        ? await ClientRepository.search('', query, 20)
        : await ClientRepository.getAll('', { limit: 20 });
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
        style={[styles.selectorButton, disabled && styles.selectorDisabled]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <Text
          variant="body"
          color={selectedClient ? 'primary' : 'tertiary'}
        >
          {selectedClient ? selectedClient.name : t('invoices.selectClient')}
        </Text>
        {!disabled && <Text variant="body" color="tertiary">▼</Text>}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="h4" weight="bold">{t('invoices.selectClient')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text variant="body" color="tertiary">✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalSearch}
              placeholder={t('clients.searchPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {loading ? (
              <ActivityIndicator size="small" color={colors.primary[600]} style={{ padding: spacing[4] }} />
            ) : (
              <ScrollView style={styles.modalList}>
                {clients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={styles.modalItem}
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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const InvoiceFormScreen: React.FC<InvoiceFormScreenProps> = ({
  invoice,
  clientId,
  fromQuote,
  onSave,
  onCancel,
}) => {
  const { t, locale } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Initialize form
  useEffect(() => {
    const initForm = async () => {
      // Default due date: 30 days from now
      const defaultDueDate = new Date();
      defaultDueDate.setDate(defaultDueDate.getDate() + 30);
      setDueDate(formatDateForInput(defaultDueDate));

      if (invoice) {
        // Edit mode
        setSubtotal(String(invoice.subtotal));
        setTax(String(invoice.tax || 0));
        setDiscount(String(invoice.discount || 0));
        setDueDate(formatDateForInput(new Date(invoice.dueDate)));
        setNotes(invoice.notes || '');

        // Load client
        if (invoice.clientId) {
          const client = await ClientRepository.getById(invoice.clientId);
          if (client) setSelectedClient(client);
        }
      } else if (fromQuote) {
        // From quote conversion
        setSubtotal(String(fromQuote.subtotal));

        // Load client
        const client = await ClientRepository.getById(fromQuote.clientId);
        if (client) setSelectedClient(client);
      } else if (clientId) {
        // Pre-selected client
        const client = await ClientRepository.getById(clientId);
        if (client) setSelectedClient(client);
      }
    };

    initForm();
  }, [invoice, clientId, fromQuote]);

  const total = calculateTotal(
    parseFloat(subtotal) || 0,
    parseFloat(tax) || 0,
    parseFloat(discount) || 0
  );

  const handleSave = async () => {
    // Validation
    if (!selectedClient) {
      Alert.alert(t('common.error'), t('validation.required') + ': ' + t('invoices.client'));
      return;
    }
    if (!subtotal || parseFloat(subtotal) <= 0) {
      Alert.alert(t('common.error'), t('validation.positive') + ': ' + t('common.subtotal'));
      return;
    }
    if (!dueDate) {
      Alert.alert(t('common.error'), t('validation.required') + ': ' + t('invoices.dueDate'));
      return;
    }

    const parsedDueDate = parseDateInput(dueDate);
    if (!parsedDueDate) {
      Alert.alert(t('common.error'), t('validation.date'));
      return;
    }

    try {
      setLoading(true);

      let savedInvoice: Invoice | null;

      if (invoice) {
        // Update existing invoice
        const updateData: UpdateInvoiceInput = {
          subtotal: parseFloat(subtotal) || 0,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0,
          dueDate: parsedDueDate.toISOString(),
          notes: notes || undefined,
        };

        savedInvoice = await InvoiceService.updateInvoice(invoice.id, updateData);
      } else {
        // Create new invoice
        const createData: CreateInvoiceInput = {
          clientId: selectedClient.id,
          subtotal: parseFloat(subtotal) || 0,
          tax: parseFloat(tax) || 0,
          discount: parseFloat(discount) || 0,
          dueDate: parsedDueDate.toISOString(),
          notes: notes || undefined,
        };

        savedInvoice = await InvoiceService.createInvoice(createData);
      }

      if (savedInvoice) {
        Alert.alert(t('common.success'), t('invoices.saveSuccess'));
        onSave?.(savedInvoice);
      } else {
        throw new Error(t('errors.generic'));
      }
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      Alert.alert(t('common.error'), error.message || t('invoices.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Client Selection */}
      <Card style={styles.card}>
        <FormField label={t('invoices.client')} required>
          <ClientSelector
            selectedClient={selectedClient}
            onSelect={setSelectedClient}
            disabled={!!invoice || !!fromQuote}
            t={t}
          />
        </FormField>
      </Card>

      {/* Values */}
      <Card style={styles.card}>
        <FormField label={t('common.subtotal')} required>
          <TextInput
            style={styles.input}
            value={subtotal}
            onChangeText={setSubtotal}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
          />
        </FormField>

        <FormField label={t('common.tax')}>
          <TextInput
            style={styles.input}
            value={tax}
            onChangeText={setTax}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
          />
        </FormField>

        <FormField label={t('common.discount')}>
          <TextInput
            style={styles.input}
            value={discount}
            onChangeText={setDiscount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.gray[400]}
          />
        </FormField>

        <View style={styles.totalContainer}>
          <Text variant="body" weight="bold">{t('common.total')}</Text>
          <Text variant="h3" weight="bold" style={{ color: colors.success[600] }}>
            {formatCurrency(total, locale)}
          </Text>
        </View>
      </Card>

      {/* Due Date */}
      <Card style={styles.card}>
        <FormField label={t('invoices.dueDate')} required>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray[400]}
          />
          <Text variant="caption" color="tertiary" style={styles.hint}>
            {t('common.date')}: YYYY-MM-DD (ex: 2024-12-31)
          </Text>
        </FormField>
      </Card>

      {/* Notes */}
      <Card style={styles.card}>
        <FormField label={t('common.notes')}>
          <TextInput
            style={[styles.input, styles.textArea]}
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
          style={[styles.actionButton, styles.cancelButton]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.gray[600] }}>
            {t('common.cancel')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton]}
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
    </ScrollView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
    marginTop: spacing[1],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    marginTop: spacing[1],
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  selectorDisabled: {
    backgroundColor: colors.gray[200],
    opacity: 0.7,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 2,
    borderTopColor: colors.border.default,
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
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  saveButton: {
    backgroundColor: colors.primary[600],
    ...shadows.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
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
    borderBottomColor: colors.border.light,
  },
  modalSearch: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    margin: spacing[4],
    fontSize: 16,
    color: colors.text.primary,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
});

export default InvoiceFormScreen;
