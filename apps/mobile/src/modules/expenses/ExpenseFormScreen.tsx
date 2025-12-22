/**
 * ExpenseFormScreen
 *
 * Formulário para criar e editar despesas.
 * Suporta seleção de fornecedor, categoria, ordem de serviço.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { useTranslation } from '../../i18n';
import { ExpenseService } from './ExpenseService';
import type {
  Expense,
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseStatus,
  ExpensePaymentMethod,
  Supplier,
  ExpenseCategoryFull,
} from './types';
import { expenseStatusLabels, paymentMethodLabels } from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseFormScreenProps {
  expense?: Expense;
  preSelectedWorkOrderId?: string;
  onSave?: (expense: Expense) => void;
  onCancel?: () => void;
}

interface FormData {
  description: string;
  amount: string;
  dueDate: string;
  supplierId: string;
  categoryId: string;
  workOrderId: string;
  status: ExpenseStatus;
  paymentMethod: ExpensePaymentMethod | '';
  notes: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

// =============================================================================
// COMPONENTS
// =============================================================================

const SelectButton: React.FC<{
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  colors: ThemeColors;
}> = ({ label, value, placeholder, onPress, colors }) => (
  <View style={styles.selectContainer}>
    <Text variant="caption" color="secondary" style={styles.inputLabel}>
      {label}
    </Text>
    <TouchableOpacity
      style={[
        styles.selectButton,
        { backgroundColor: colors.gray[100], borderColor: colors.border.light },
      ]}
      onPress={onPress}
    >
      <Text
        variant="body"
        style={{ color: value ? colors.text.primary : colors.text.tertiary, flex: 1 }}
      >
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  </View>
);

const OptionPicker: React.FC<{
  title: string;
  options: { label: string; value: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  colors: ThemeColors;
  allowEmpty?: boolean;
}> = ({ title, options, selectedValue, onSelect, onClose, colors, allowEmpty }) => (
  <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
    <View style={[styles.pickerContainer, { backgroundColor: colors.background.primary }]}>
      <View style={styles.pickerHeader}>
        <Text variant="h5" weight="semibold">
          {title}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.pickerOptions}>
        {allowEmpty && (
          <TouchableOpacity
            style={[
              styles.pickerOption,
              { borderBottomColor: colors.border.light },
              selectedValue === '' && { backgroundColor: colors.primary[50] },
            ]}
            onPress={() => {
              onSelect('');
              onClose();
            }}
          >
            <Text
              variant="body"
              style={{ color: selectedValue === '' ? colors.primary[600] : colors.text.secondary }}
            >
              Nenhum
            </Text>
          </TouchableOpacity>
        )}
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              { borderBottomColor: colors.border.light },
              selectedValue === option.value && { backgroundColor: colors.primary[50] },
            ]}
            onPress={() => {
              onSelect(option.value);
              onClose();
            }}
          >
            <Text
              variant="body"
              weight={selectedValue === option.value ? 'semibold' : 'normal'}
              style={{
                color: selectedValue === option.value ? colors.primary[600] : colors.text.primary,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ExpenseFormScreen: React.FC<ExpenseFormScreenProps> = ({
  expense,
  preSelectedWorkOrderId,
  onSave,
  onCancel,
}) => {
  const { locale } = useTranslation();
  const colors = useColors();
  const isEditing = !!expense;

  const [formData, setFormData] = useState<FormData>({
    description: expense?.description || '',
    amount: expense?.amount?.toString() || '',
    dueDate: expense?.dueDate
      ? expense.dueDate.split('T')[0]
      : formatDateForInput(new Date()),
    supplierId: expense?.supplierId || '',
    categoryId: expense?.categoryId || '',
    workOrderId: expense?.workOrderId || preSelectedWorkOrderId || '',
    status: expense?.status || 'PENDING',
    paymentMethod: expense?.paymentMethod || '',
    notes: expense?.notes || '',
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryFull[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState<
    'supplier' | 'category' | 'status' | 'paymentMethod' | null
  >(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Load suppliers and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersData, categoriesData] = await Promise.all([
          ExpenseService.listSuppliers(),
          ExpenseService.listExpenseCategories(),
        ]);
        setSuppliers(suppliersData);
        setCategories(categoriesData);
      } catch (err) {
        console.error('Error loading form data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Descrição é obrigatória';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valor deve ser maior que zero';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Data de vencimento é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (saving) {
      return;
    }

    if (!validate()) return;

    setSaving(true);
    try {
      const dto: CreateExpenseDto | UpdateExpenseDto = {
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate,
        supplierId: formData.supplierId || undefined,
        categoryId: formData.categoryId || undefined,
        workOrderId: formData.workOrderId || undefined,
        status: formData.status,
        paymentMethod: formData.paymentMethod || undefined,
        notes: formData.notes.trim() || undefined,
      };

      let savedExpense: Expense;
      if (isEditing && expense) {
        savedExpense = await ExpenseService.updateExpense(expense.id, dto);
      } else {
        savedExpense = await ExpenseService.createExpense(dto as CreateExpenseDto);
      }

      Alert.alert('Sucesso', isEditing ? 'Despesa atualizada!' : 'Despesa criada!', [
        { text: 'OK', onPress: () => onSave?.(savedExpense) },
      ]);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao salvar despesa');
    } finally {
      setSaving(false);
    }
  };

  const getSelectedSupplierName = () => {
    return suppliers.find((s) => s.id === formData.supplierId)?.name;
  };

  const getSelectedCategoryName = () => {
    return categories.find((c) => c.id === formData.categoryId)?.name;
  };

  const statusOptions = [
    { label: expenseStatusLabels.PENDING, value: 'PENDING' },
    { label: expenseStatusLabels.PAID, value: 'PAID' },
    { label: expenseStatusLabels.CANCELED, value: 'CANCELED' },
  ];

  const paymentMethodOptions = Object.entries(paymentMethodLabels).map(([value, label]) => ({
    label,
    value,
  }));

  if (loadingData) {
    return (
      <View
        style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background.secondary }]}
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card variant="elevated" style={styles.formCard}>
            {/* Description */}
            <View style={styles.inputGroup}>
              <Text variant="caption" color="secondary" style={styles.inputLabel}>
                Descrição *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: errors.description ? colors.error[500] : colors.border.light },
                ]}
                placeholder="Ex: Compra de materiais"
                placeholderTextColor={colors.text.tertiary}
                value={formData.description}
                onChangeText={(value) => handleChange('description', value)}
              />
              {errors.description && (
                <Text variant="caption" style={{ color: colors.error[500], marginTop: 4 }}>
                  {errors.description}
                </Text>
              )}
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text variant="caption" color="secondary" style={styles.inputLabel}>
                Valor *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: errors.amount ? colors.error[500] : colors.border.light },
                ]}
                placeholder="0,00"
                placeholderTextColor={colors.text.tertiary}
                value={formData.amount}
                onChangeText={(value) => handleChange('amount', value.replace(',', '.'))}
                keyboardType="decimal-pad"
              />
              {errors.amount && (
                <Text variant="caption" style={{ color: colors.error[500], marginTop: 4 }}>
                  {errors.amount}
                </Text>
              )}
            </View>

            {/* Due Date */}
            <View style={styles.inputGroup}>
              <Text variant="caption" color="secondary" style={styles.inputLabel}>
                Data de Vencimento *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: errors.dueDate ? colors.error[500] : colors.border.light },
                ]}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.text.tertiary}
                value={formData.dueDate}
                onChangeText={(value) => handleChange('dueDate', value)}
              />
              {errors.dueDate && (
                <Text variant="caption" style={{ color: colors.error[500], marginTop: 4 }}>
                  {errors.dueDate}
                </Text>
              )}
            </View>

            {/* Status */}
            <SelectButton
              label="Status"
              value={expenseStatusLabels[formData.status]}
              placeholder="Selecione o status"
              onPress={() => setShowPicker('status')}
              colors={colors}
            />

            {/* Payment Method */}
            <SelectButton
              label="Forma de Pagamento"
              value={formData.paymentMethod ? paymentMethodLabels[formData.paymentMethod] : undefined}
              placeholder="Selecione (opcional)"
              onPress={() => setShowPicker('paymentMethod')}
              colors={colors}
            />

            {/* Supplier */}
            <SelectButton
              label="Fornecedor"
              value={getSelectedSupplierName()}
              placeholder="Selecione (opcional)"
              onPress={() => setShowPicker('supplier')}
              colors={colors}
            />

            {/* Category */}
            <SelectButton
              label="Categoria"
              value={getSelectedCategoryName()}
              placeholder="Selecione (opcional)"
              onPress={() => setShowPicker('category')}
              colors={colors}
            />

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text variant="caption" color="secondary" style={styles.inputLabel}>
                Observações
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.gray[100], color: colors.text.primary, borderColor: colors.border.light },
                ]}
                placeholder="Observações adicionais (opcional)"
                placeholderTextColor={colors.text.tertiary}
                value={formData.notes}
                onChangeText={(value) => handleChange('notes', value)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </Card>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={onCancel}
              style={{ flex: 1, marginRight: spacing[2] }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              loading={saving}
              style={{ flex: 1, marginLeft: spacing[2] }}
            >
              {isEditing ? 'Salvar' : 'Criar Despesa'}
            </Button>
          </View>
        </ScrollView>

        {/* Pickers */}
        {showPicker === 'supplier' && (
          <OptionPicker
            title="Selecionar Fornecedor"
            options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
            selectedValue={formData.supplierId}
            onSelect={(value) => handleChange('supplierId', value)}
            onClose={() => setShowPicker(null)}
            colors={colors}
            allowEmpty
          />
        )}

        {showPicker === 'category' && (
          <OptionPicker
            title="Selecionar Categoria"
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
            selectedValue={formData.categoryId}
            onSelect={(value) => handleChange('categoryId', value)}
            onClose={() => setShowPicker(null)}
            colors={colors}
            allowEmpty
          />
        )}

        {showPicker === 'status' && (
          <OptionPicker
            title="Selecionar Status"
            options={statusOptions}
            selectedValue={formData.status}
            onSelect={(value) => handleChange('status', value)}
            onClose={() => setShowPicker(null)}
            colors={colors}
          />
        )}

        {showPicker === 'paymentMethod' && (
          <OptionPicker
            title="Forma de Pagamento"
            options={paymentMethodOptions}
            selectedValue={formData.paymentMethod}
            onSelect={(value) => handleChange('paymentMethod', value)}
            onClose={() => setShowPicker(null)}
            colors={colors}
            allowEmpty
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  formCard: {
    marginBottom: spacing[4],
  },
  inputGroup: {
    marginBottom: spacing[4],
  },
  inputLabel: {
    marginBottom: spacing[1],
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing[3],
  },
  selectContainer: {
    marginBottom: spacing[4],
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  actions: {
    flexDirection: 'row',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '60%',
    ...shadows.lg,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  pickerOptions: {
    padding: spacing[2],
  },
  pickerOption: {
    padding: spacing[4],
    borderBottomWidth: 1,
    borderRadius: borderRadius.md,
  },
});

export default ExpenseFormScreen;
