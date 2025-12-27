// @ts-nocheck
/**
 * QuickClientModal - Cadastro rápido de cliente inline
 *
 * Modal para cadastrar um novo cliente rapidamente durante
 * a criação de orçamentos ou OSs, sem precisar navegar
 * para outra tela.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClientService, CreateClientInput } from '../ClientService';
import { Client } from '../../../db/schema';
import { useColors } from '../../../design-system/ThemeProvider';
import { useTranslation } from '../../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface QuickClientModalProps {
  visible: boolean;
  onClose: () => void;
  onClientCreated: (client: Client) => void;
  initialName?: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

// Formatar telefone brasileiro
function formatPhone(value: string): string {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

// Validar email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function QuickClientModal({
  visible,
  onClose,
  onClientCreated,
  initialName = '',
}: QuickClientModalProps) {
  // Theme
  const colors = useColors();
  const { t } = useTranslation();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Refs
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhone('');
      setEmail('');
      setAddress('');
      setCity('');
      setNotes('');
      setErrors({});
      setShowAdvanced(false);
    }
  }, [visible, initialName]);

  // Handlers
  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }));
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    // Nome é obrigatório
    if (!name.trim()) {
      newErrors.name = t('clients.validation.nameRequired');
    } else if (name.trim().length < 2) {
      newErrors.name = t('clients.validation.nameMinLength');
    }

    // Email opcional, mas se preenchido deve ser válido
    if (email && !isValidEmail(email)) {
      newErrors.email = t('clients.validation.emailInvalid');
    }

    // Telefone opcional, mas se preenchido deve ter formato válido
    const phoneNumbers = phone.replace(/\D/g, '');
    if (phone && phoneNumbers.length < 10) {
      newErrors.phone = t('clients.validation.phoneInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isLoading) {
      return;
    }

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const input: CreateClientInput = {
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        city: city || undefined,
        notes: notes || undefined,
      };

      const client = await ClientService.createClient(input);

      console.log('[QuickClientModal] Client created:', client.id);

      // Notificar sucesso
      onClientCreated(client);
      onClose();
    } catch (error) {
      console.error('[QuickClientModal] Error creating client:', error);
      Alert.alert(
        t('common.error'),
        t('clients.createError'),
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;

    // Verificar se tem dados preenchidos
    if (name || phone || email) {
      Alert.alert(
        t('clients.discardChangesTitle'),
        t('clients.discardChangesMessage'),
        [
          { text: t('clients.continueEditing'), style: 'cancel' },
          { text: t('clients.discard'), style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background.primary }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isLoading}
          >
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('clients.newClient')}</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.saveButton, { backgroundColor: colors.primary[600] }, isLoading && styles.saveButtonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.saveButtonText, { color: colors.white }]}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nome */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>
              {t('clients.name')} <Text style={[styles.required, { color: colors.error[500] }]}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }, errors.name && { borderColor: colors.error[500], backgroundColor: colors.error[50] }]}
              value={name}
              onChangeText={handleNameChange}
              placeholder={t('clients.placeholders.name')}
              placeholderTextColor={colors.gray[400]}
              autoFocus
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            {errors.name && (
              <Text style={[styles.errorText, { color: colors.error[500] }]}>{errors.name}</Text>
            )}
          </View>

          {/* Telefone */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>{t('clients.phone')}</Text>
            <TextInput
              ref={phoneRef}
              style={[styles.input, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }, errors.phone && { borderColor: colors.error[500], backgroundColor: colors.error[50] }]}
              value={phone}
              onChangeText={handlePhoneChange}
              placeholder={t('clients.placeholders.phone')}
              placeholderTextColor={colors.gray[400]}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            {errors.phone && (
              <Text style={[styles.errorText, { color: colors.error[500] }]}>{errors.phone}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>{t('clients.email')}</Text>
            <TextInput
              ref={emailRef}
              style={[styles.input, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }, errors.email && { borderColor: colors.error[500], backgroundColor: colors.error[50] }]}
              value={email}
              onChangeText={handleEmailChange}
              placeholder={t('clients.placeholders.email')}
              placeholderTextColor={colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => {
                if (showAdvanced) {
                  addressRef.current?.focus();
                }
              }}
            />
            {errors.email && (
              <Text style={[styles.errorText, { color: colors.error[500] }]}>{errors.email}</Text>
            )}
          </View>

          {/* Toggle campos adicionais */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Ionicons
              name={showAdvanced ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.text.secondary}
            />
            <Text style={[styles.advancedToggleText, { color: colors.text.secondary }]}>
              {showAdvanced ? t('clients.hideAdditionalFields') : t('clients.moreFieldsOptional')}
            </Text>
          </TouchableOpacity>

          {/* Campos adicionais */}
          {showAdvanced && (
            <>
              {/* Endereço */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>{t('clients.address')}</Text>
                <TextInput
                  ref={addressRef}
                  style={[styles.input, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t('clients.placeholders.address')}
                  placeholderTextColor={colors.gray[400]}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => cityRef.current?.focus()}
                />
              </View>

              {/* Cidade */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>{t('clients.city')}</Text>
                <TextInput
                  ref={cityRef}
                  style={[styles.input, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }]}
                  value={city}
                  onChangeText={setCity}
                  placeholder={t('clients.placeholders.city')}
                  placeholderTextColor={colors.gray[400]}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => notesRef.current?.focus()}
                />
              </View>

              {/* Observações */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>{t('clients.notes')}</Text>
                <TextInput
                  ref={notesRef}
                  style={[styles.input, styles.textArea, { borderColor: colors.border.default, color: colors.text.primary, backgroundColor: colors.background.primary }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('clients.placeholders.notes')}
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </>
          )}

          {/* Info offline */}
          <View style={[styles.offlineInfo, { backgroundColor: colors.background.secondary }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.text.tertiary} />
            <Text style={[styles.offlineInfoText, { color: colors.text.secondary }]}>
              {t('clients.offlineSaveMessage')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  advancedToggleText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  offlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  offlineInfoText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
});

export default QuickClientModal;
