/**
 * AdjustStockModal
 *
 * Modal para ajustar saldo de estoque de um produto.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../../i18n';
import { InventoryBalance } from '../InventoryRepository';

interface Props {
  visible: boolean;
  balance: InventoryBalance | null;
  allowNegativeStock?: boolean;
  onClose: () => void;
  onConfirm: (newQuantity: number, notes?: string) => Promise<void>;
}

export function AdjustStockModal({
  visible,
  balance,
  allowNegativeStock = false,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [newQuantity, setNewQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && balance) {
      setNewQuantity(balance.quantity.toString());
      setNotes('');
      setError(null);
    }
  }, [visible, balance]);

  const handleQuantityChange = (text: string) => {
    // Allow only numbers and decimal point
    const cleaned = text.replace(/[^0-9.-]/g, '');
    setNewQuantity(cleaned);
    setError(null);
  };

  const incrementQuantity = () => {
    const current = parseFloat(newQuantity) || 0;
    setNewQuantity((current + 1).toString());
    setError(null);
  };

  const decrementQuantity = () => {
    const current = parseFloat(newQuantity) || 0;
    const newValue = current - 1;
    if (newValue < 0 && !allowNegativeStock) {
      setError(t('inventory.negativeStockNotAllowed'));
      return;
    }
    setNewQuantity(newValue.toString());
    setError(null);
  };

  const handleConfirm = async () => {
    const qty = parseFloat(newQuantity);

    if (isNaN(qty)) {
      setError(t('inventory.invalidQuantity'));
      return;
    }

    if (qty < 0 && !allowNegativeStock) {
      setError(t('inventory.negativeStockNotAllowed'));
      return;
    }

    if (balance && qty === balance.quantity) {
      setError(t('inventory.sameBalance'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onConfirm(qty, notes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || t('inventory.adjustError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDifference = () => {
    if (!balance) return 0;
    const qty = parseFloat(newQuantity) || 0;
    return qty - balance.quantity;
  };

  const difference = getDifference();

  if (!balance) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('inventory.adjustStock')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.productInfo}>
            <Text style={styles.productName}>{balance.itemName}</Text>
            {balance.itemSku && (
              <Text style={styles.sku}>SKU: {balance.itemSku}</Text>
            )}
            <Text style={styles.currentStock}>
              {t('inventory.currentStock')} <Text style={styles.currentValue}>{balance.quantity}</Text>
              {balance.itemUnit && ` ${balance.itemUnit}`}
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>{t('inventory.newBalance')}</Text>
            <View style={styles.quantityInputContainer}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={decrementQuantity}
              >
                <Ionicons name="remove" size={24} color="#6366f1" />
              </TouchableOpacity>

              <TextInput
                style={styles.quantityInput}
                value={newQuantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
                selectTextOnFocus
              />

              <TouchableOpacity
                style={styles.stepButton}
                onPress={incrementQuantity}
              >
                <Ionicons name="add" size={24} color="#6366f1" />
              </TouchableOpacity>
            </View>

            {difference !== 0 && (
              <View style={styles.differenceContainer}>
                <Ionicons
                  name={difference > 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={16}
                  color={difference > 0 ? '#22c55e' : '#ef4444'}
                />
                <Text
                  style={[
                    styles.differenceText,
                    { color: difference > 0 ? '#22c55e' : '#ef4444' },
                  ]}
                >
                  {difference > 0 ? '+' : ''}
                  {difference.toFixed(difference % 1 === 0 ? 0 : 2)}
                  {balance.itemUnit && ` ${balance.itemUnit}`}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>{t('inventory.notesOptional')}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('inventory.notesPlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={2}
            />
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                isSubmitting && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  productInfo: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  currentStock: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  currentValue: {
    fontWeight: '600',
    color: '#1f2937',
  },
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1f2937',
  },
  differenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  differenceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AdjustStockModal;
