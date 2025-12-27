/**
 * ChargeFormScreen
 *
 * Formulário para criação de cobranças.
 * Suporta criação a partir de orçamento (quote) ou work order.
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Input } from '../../design-system/components/Input';
import { Button } from '../../design-system/components/Button';
import { Divider } from '../../design-system';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { useTranslation } from '../../i18n';
import { ChargeService, ClientSearchResult } from './ChargeService';
import type { Charge, BillingType, CreateChargeDto } from './types';
import { billingTypeLabels } from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface ChargeFormScreenProps {
  onSuccess?: (charge: Charge) => void;
  onCancel?: () => void;
  // Pre-fill from quote or work order
  preSelectedClientId?: string;
  preSelectedClientName?: string;
  preSelectedQuoteId?: string;
  preSelectedWorkOrderId?: string;
  preSelectedValue?: number;
  preSelectedDescription?: string;
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

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string, locale: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// =============================================================================
// COMPONENTS
// =============================================================================

const BillingTypeSelector: React.FC<{
  selected: BillingType;
  onSelect: (type: BillingType) => void;
  colors: ThemeColors;
  showPIX: boolean;
}> = ({ selected, onSelect, colors, showPIX }) => {
  const { t } = useTranslation();
  const allTypes: { type: BillingType; icon: string; labelKey: string; ptBROnly?: boolean }[] = [
    { type: 'PIX', icon: 'qr-code-outline', labelKey: 'charges.billingTypes.pix', ptBROnly: true },
    { type: 'BOLETO', icon: 'document-text-outline', labelKey: 'charges.billingTypes.boleto' },
    { type: 'CREDIT_CARD', icon: 'card-outline', labelKey: 'charges.billingTypes.creditCard' },
  ];
  // Filter out PIX if not pt-BR
  const types = allTypes.filter(t => !t.ptBROnly || showPIX);

  return (
    <View style={styles.billingTypeContainer}>
      {types.map(({ type, icon, labelKey }) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.billingTypeButton,
            { borderColor: colors.border.light },
            selected === type && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
          ]}
          onPress={() => onSelect(type)}
        >
          <Ionicons
            name={icon as any}
            size={28}
            color={selected === type ? colors.primary[600] : colors.text.secondary}
          />
          <Text
            variant="bodySmall"
            weight={selected === type ? 'semibold' : 'normal'}
            style={{ marginTop: spacing[1], color: selected === type ? colors.primary[600] : colors.text.secondary }}
          >
            {t(labelKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const ClientSelector: React.FC<{
  selectedClient: ClientSearchResult | null;
  onSelectClient: () => void;
  colors: ThemeColors;
  disabled?: boolean;
  placeholder: string;
}> = ({ selectedClient, onSelectClient, colors, disabled, placeholder }) => (
  <TouchableOpacity
    style={[
      styles.clientSelector,
      { borderColor: colors.border.light, backgroundColor: colors.gray[100] },
      disabled && { opacity: 0.6 },
    ]}
    onPress={onSelectClient}
    disabled={disabled}
  >
    <Ionicons name="person-outline" size={20} color={colors.text.secondary} />
    {selectedClient ? (
      <View style={styles.clientInfo}>
        <Text variant="body" weight="medium">{selectedClient.name}</Text>
        {selectedClient.email && (
          <Text variant="caption" color="secondary">{selectedClient.email}</Text>
        )}
      </View>
    ) : (
      <Text variant="body" color="secondary" style={{ marginLeft: spacing[3] }}>
        {placeholder}
      </Text>
    )}
    {!disabled && (
      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
    )}
  </TouchableOpacity>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChargeFormScreen: React.FC<ChargeFormScreenProps> = ({
  onSuccess,
  onCancel,
  preSelectedClientId,
  preSelectedClientName,
  preSelectedQuoteId,
  preSelectedWorkOrderId,
  preSelectedValue,
  preSelectedDescription,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();

  // PIX is only available for pt-BR
  const showPIX = locale === 'pt-BR';

  // Form state
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(
    preSelectedClientId && preSelectedClientName
      ? { id: preSelectedClientId, name: preSelectedClientName } as ClientSearchResult
      : null
  );
  const [value, setValue] = useState(preSelectedValue?.toString() || '');
  // Default to BOLETO if PIX is not available
  const [billingType, setBillingType] = useState<BillingType>(showPIX ? 'PIX' : 'BOLETO');
  const [dueDate, setDueDate] = useState(formatDateForInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))); // Default: 7 days
  const [description, setDescription] = useState(preSelectedDescription || '');

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [discountDays, setDiscountDays] = useState('');
  const [fineValue, setFineValue] = useState('');
  const [fineType, setFineType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [interestValue, setInterestValue] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([]);
  const [allClients, setAllClients] = useState<ClientSearchResult[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Load all clients initially
  const loadAllClients = useCallback(async () => {
    try {
      setLoadingClients(true);
      const results = await ChargeService.listClients(50);
      setAllClients(results || []);
    } catch (err) {
      console.error('Error loading clients:', err);
      setAllClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  // Load clients when search modal opens
  useEffect(() => {
    if (showClientSearch && allClients.length === 0) {
      loadAllClients();
    }
  }, [showClientSearch, allClients.length, loadAllClients]);

  // Search clients via API
  const searchClients = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setClientResults([]);
      return;
    }

    try {
      setSearchingClients(true);
      const results = await ChargeService.searchClients(query.trim(), 10);
      setClientResults(results || []);
    } catch (err) {
      console.error('Error searching clients:', err);
      setClientResults([]);
    } finally {
      setSearchingClients(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(clientSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, searchClients]);

  // Handle client selection
  const handleSelectClient = useCallback((client: ClientSearchResult) => {
    setSelectedClient(client);
    setShowClientSearch(false);
    setClientSearchQuery('');
    setClientResults([]);
    setShowNewClientForm(false);
  }, []);

  // Handle create quick client
  const handleCreateQuickClient = useCallback(async () => {
    if (!newClientName.trim() || !newClientPhone.trim()) {
      Alert.alert(t('common.error'), t('charges.nameAndPhoneRequired'));
      return;
    }

    try {
      setCreatingClient(true);
      const newClient = await ChargeService.createQuickClient({
        name: newClientName.trim(),
        phone: newClientPhone.trim(),
      });

      // Add to list and select
      setAllClients(prev => [newClient, ...prev]);
      handleSelectClient(newClient);

      // Reset form
      setNewClientName('');
      setNewClientPhone('');
      setShowNewClientForm(false);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('charges.createClientError'));
    } finally {
      setCreatingClient(false);
    }
  }, [newClientName, newClientPhone, handleSelectClient]);

  // Parse currency value
  const parseValue = (text: string): number => {
    // Remove currency symbol and formatting
    const cleaned = text.replace(/[^0-9,\.]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Handle value change
  const handleValueChange = (text: string) => {
    // Allow only numbers and one decimal point
    const cleaned = text.replace(/[^0-9,\.]/g, '');
    setValue(cleaned);
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!selectedClient) {
      return t('charges.selectClientError');
    }

    const numValue = parseValue(value);
    if (numValue <= 0) {
      return t('charges.invalidValueError');
    }

    if (!dueDate) {
      return t('charges.dueDateRequiredError');
    }

    const dueDateObj = new Date(dueDate + 'T00:00:00');
    if (dueDateObj < new Date()) {
      return t('charges.futureDueDateError');
    }

    return null;
  };

  // Submit form
  const handleSubmit = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (loading) {
      return;
    }

    const error = validateForm();
    if (error) {
      Alert.alert(t('common.error'), error);
      return;
    }

    const numValue = parseValue(value);

    const data: CreateChargeDto = {
      clientId: selectedClient!.id,
      value: numValue,
      billingType,
      dueDate: new Date(dueDate + 'T00:00:00').toISOString(),
      description: description.trim() || undefined,
      quoteId: preSelectedQuoteId,
      workOrderId: preSelectedWorkOrderId,
    };

    // Add discount if configured
    if (discountValue && parseFloat(discountValue) > 0) {
      data.discount = {
        value: parseFloat(discountValue),
        type: discountType,
        dueDateLimitDays: discountDays ? parseInt(discountDays) : undefined,
      };
    }

    // Add fine if configured
    if (fineValue && parseFloat(fineValue) > 0) {
      data.fine = {
        value: parseFloat(fineValue),
        type: fineType,
      };
    }

    // Add interest if configured
    if (interestValue && parseFloat(interestValue) > 0) {
      data.interest = {
        value: parseFloat(interestValue),
        type: 'PERCENTAGE',
      };
    }

    try {
      setLoading(true);
      const charge = await ChargeService.createCharge(data);
      Alert.alert(
        t('common.success'),
        t('charges.chargeCreatedSuccess', { value: formatCurrency(charge.value, locale) }),
        [
          {
            text: 'OK',
            onPress: () => onSuccess?.(charge),
          },
        ]
      );
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('charges.createChargeError'));
    } finally {
      setLoading(false);
    }
  };

  // Determine which clients to display (search results or all clients)
  const displayClients = clientSearchQuery.length >= 2 ? clientResults : allClients;

  // Client search modal
  if (showClientSearch) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.searchHeader, { backgroundColor: colors.background.primary }]}>
          <TouchableOpacity onPress={() => { setShowClientSearch(false); setShowNewClientForm(false); }}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.searchInput,
              { color: colors.text.primary, backgroundColor: colors.gray[100] }
            ]}
            placeholder={t('charges.searchClient')}
            placeholderTextColor={colors.text.tertiary}
            value={clientSearchQuery}
            onChangeText={setClientSearchQuery}
          />
        </View>

        {/* New Client Form */}
        {showNewClientForm ? (
          <View style={[styles.newClientForm, { backgroundColor: colors.background.primary }]}>
            <Text variant="h6" weight="semibold" style={{ marginBottom: spacing[4] }}>
              {t('charges.createNewClient')}
            </Text>
            <TextInput
              style={[styles.newClientInput, { borderColor: colors.border.light, color: colors.text.primary, backgroundColor: colors.gray[100] }]}
              placeholder={t('charges.clientNamePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={newClientName}
              onChangeText={setNewClientName}
              autoFocus
            />
            <TextInput
              style={[styles.newClientInput, { borderColor: colors.border.light, color: colors.text.primary, backgroundColor: colors.gray[100] }]}
              placeholder={t('charges.phonePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={newClientPhone}
              onChangeText={setNewClientPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.newClientActions}>
              <TouchableOpacity
                style={styles.cancelNewClientButton}
                onPress={() => { setShowNewClientForm(false); setNewClientName(''); setNewClientPhone(''); }}
              >
                <Text variant="body" color="secondary">{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createNewClientButton, { backgroundColor: colors.primary[600] }, creatingClient && { opacity: 0.7 }]}
                onPress={handleCreateQuickClient}
                disabled={creatingClient}
              >
                {creatingClient ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text variant="body" weight="semibold" style={{ color: colors.white }}>{t('common.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Create New Client Button */}
            <TouchableOpacity
              style={[styles.createClientButton, { borderColor: colors.primary[500], backgroundColor: colors.primary[50] }]}
              onPress={() => setShowNewClientForm(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary[600]} />
              <Text variant="body" weight="semibold" style={{ color: colors.primary[600], marginLeft: spacing[2] }}>
                {t('charges.createNewClient')}
              </Text>
            </TouchableOpacity>

            {/* Client List */}
            {loadingClients || searchingClients ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text variant="caption" color="secondary" style={{ marginTop: spacing[2] }}>
                  {t('charges.loadingClients')}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.clientList} keyboardShouldPersistTaps="handled">
                {displayClients.map((client) => (
                  <TouchableOpacity
                    key={client.id}
                    style={[styles.clientItem, { borderBottomColor: colors.border.light }]}
                    onPress={() => handleSelectClient(client)}
                  >
                    <View style={[styles.clientAvatar, { backgroundColor: colors.primary[100] }]}>
                      <Ionicons name="person" size={18} color={colors.primary[600]} />
                    </View>
                    <View style={styles.clientItemInfo}>
                      <Text variant="body" weight="medium">{client.name}</Text>
                      {client.phone && (
                        <Text variant="caption" color="secondary">{client.phone}</Text>
                      )}
                      {client.email && (
                        <Text variant="caption" color="tertiary">{client.email}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                ))}
                {displayClients.length === 0 && (
                  <View style={styles.noResults}>
                    <Ionicons name="people-outline" size={48} color={colors.text.tertiary} style={{ marginBottom: spacing[2] }} />
                    <Text variant="body" color="secondary">
                      {clientSearchQuery.length >= 2
                        ? t('charges.noClientFound')
                        : t('charges.noClientsRegistered')}
                    </Text>
                    <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                      {clientSearchQuery.length >= 2
                        ? t('charges.tryAnotherSearchOrCreate')
                        : t('charges.createFirstClient')}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background.secondary }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Client Section */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={colors.text.secondary} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('charges.client')}
            </Text>
          </View>
          <ClientSelector
            selectedClient={selectedClient}
            onSelectClient={() => setShowClientSearch(true)}
            colors={colors}
            disabled={!!preSelectedClientId}
            placeholder={t('charges.searchClientPlaceholder')}
          />
        </Card>

        {/* Value and Due Date */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cash-outline" size={20} color={colors.text.secondary} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('charges.valueAndDueDate')}
            </Text>
          </View>

          <View style={styles.row}>
            <View style={styles.inputContainer}>
              <Text variant="caption" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('charges.value')} *
              </Text>
              <View style={[styles.valueInput, { borderColor: colors.border.light, backgroundColor: colors.gray[100] }]}>
                <Text variant="body" color="secondary">R$</Text>
                <TextInput
                  style={[styles.valueInputField, { color: colors.text.primary }]}
                  value={value}
                  onChangeText={handleValueChange}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>

            <View style={[styles.inputContainer, { marginLeft: spacing[4] }]}>
              <Text variant="caption" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('charges.dueDate')} *
              </Text>
              <TextInput
                style={[
                  styles.dateInput,
                  { borderColor: colors.border.light, backgroundColor: colors.gray[100], color: colors.text.primary }
                ]}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </View>
        </Card>

        {/* Payment Method */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={20} color={colors.text.secondary} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('charges.paymentMethod')}
            </Text>
          </View>
          <BillingTypeSelector
            selected={billingType}
            onSelect={setBillingType}
            colors={colors}
            showPIX={showPIX}
          />
        </Card>

        {/* Description */}
        <Card variant="elevated" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={colors.text.secondary} />
            <Text variant="h6" weight="semibold" style={{ marginLeft: spacing[2] }}>
              {t('charges.description')}
            </Text>
          </View>
          <TextInput
            style={[
              styles.descriptionInput,
              { borderColor: colors.border.light, backgroundColor: colors.gray[100], color: colors.text.primary }
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('charges.descriptionPlaceholder')}
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Advanced Options Toggle */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text variant="body" weight="medium" style={{ color: colors.primary[600] }}>
            {showAdvanced ? t('charges.hideAdvancedOptions') : t('charges.showAdvancedOptions')}
          </Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.primary[600]}
          />
        </TouchableOpacity>

        {/* Advanced Options */}
        {showAdvanced && (
          <Card variant="outlined" style={styles.section}>
            <Text variant="h6" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('charges.discountFineInterest')}
            </Text>

            {/* Discount */}
            <View style={styles.advancedRow}>
              <Text variant="bodySmall" color="secondary">{t('charges.earlyPaymentDiscount')}</Text>
              <View style={styles.advancedInputs}>
                <TextInput
                  style={[styles.advancedInput, { borderColor: colors.border.light, color: colors.text.primary }]}
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    discountType === 'PERCENTAGE' && { backgroundColor: colors.primary[100] }
                  ]}
                  onPress={() => setDiscountType('PERCENTAGE')}
                >
                  <Text variant="caption">%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    discountType === 'FIXED' && { backgroundColor: colors.primary[100] }
                  ]}
                  onPress={() => setDiscountType('FIXED')}
                >
                  <Text variant="caption">R$</Text>
                </TouchableOpacity>
              </View>
            </View>

            {discountValue && (
              <View style={styles.advancedRow}>
                <Text variant="bodySmall" color="secondary">{t('charges.daysBeforeDueDate')}</Text>
                <TextInput
                  style={[styles.advancedInput, { borderColor: colors.border.light, color: colors.text.primary }]}
                  value={discountDays}
                  onChangeText={setDiscountDays}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            )}

            <Divider style={{ marginVertical: spacing[3] }} />

            {/* Fine */}
            <View style={styles.advancedRow}>
              <Text variant="bodySmall" color="secondary">{t('charges.lateFine')}</Text>
              <View style={styles.advancedInputs}>
                <TextInput
                  style={[styles.advancedInput, { borderColor: colors.border.light, color: colors.text.primary }]}
                  value={fineValue}
                  onChangeText={setFineValue}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.text.tertiary}
                />
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    fineType === 'PERCENTAGE' && { backgroundColor: colors.primary[100] }
                  ]}
                  onPress={() => setFineType('PERCENTAGE')}
                >
                  <Text variant="caption">%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    fineType === 'FIXED' && { backgroundColor: colors.primary[100] }
                  ]}
                  onPress={() => setFineType('FIXED')}
                >
                  <Text variant="caption">R$</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Divider style={{ marginVertical: spacing[3] }} />

            {/* Interest */}
            <View style={styles.advancedRow}>
              <Text variant="bodySmall" color="secondary">{t('charges.monthlyInterest')}</Text>
              <TextInput
                style={[styles.advancedInput, { borderColor: colors.border.light, color: colors.text.primary }]}
                value={interestValue}
                onChangeText={setInterestValue}
                placeholder="0"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>
          </Card>
        )}

        {/* Source Info */}
        {(preSelectedQuoteId || preSelectedWorkOrderId) && (
          <Card variant="outlined" style={[styles.section, { borderColor: colors.primary[200] }]}>
            <View style={styles.sourceInfo}>
              <Ionicons name="link-outline" size={18} color={colors.primary[500]} />
              <Text variant="bodySmall" color="secondary" style={{ marginLeft: spacing[2] }}>
                {preSelectedQuoteId
                  ? t('charges.linkedToQuote')
                  : t('charges.linkedToWorkOrder')}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: colors.background.primary, borderTopColor: colors.border.light }]}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text variant="body" weight="medium" color="secondary">{t('common.cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary[600] },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text variant="body" weight="semibold" style={{ color: colors.white, marginLeft: spacing[2] }}>
                {t('charges.createCharge')}
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[24],
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  clientInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    flex: 1,
  },
  valueInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  valueInputField: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: spacing[2],
  },
  dateInput: {
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    fontSize: 16,
  },
  billingTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billingTypeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[4],
    marginHorizontal: spacing[1],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
  },
  descriptionInput: {
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    marginBottom: spacing[2],
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  advancedInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advancedInput: {
    width: 60,
    padding: spacing[2],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    textAlign: 'center',
    marginRight: spacing[2],
  },
  typeButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    marginLeft: spacing[1],
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: spacing[4],
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    marginLeft: spacing[3],
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing[3],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    fontSize: 16,
  },
  searchLoading: {
    padding: spacing[8],
    alignItems: 'center',
  },
  clientList: {
    flex: 1,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
  },
  clientItemInfo: {
    flex: 1,
    marginLeft: spacing[3],
  },
  noResults: {
    padding: spacing[8],
    alignItems: 'center',
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createClientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginTop: spacing[4],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  newClientForm: {
    padding: spacing[4],
    margin: spacing[4],
    borderRadius: borderRadius.lg,
  },
  newClientInput: {
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: spacing[3],
  },
  newClientActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  cancelNewClientButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
  },
  createNewClientButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    marginLeft: spacing[3],
  },
});

export default ChargeFormScreen;
