// @ts-nocheck
/**
 * Client Details Screen
 *
 * Tela de detalhes e edição de cliente.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Badge, Avatar } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { ClientService, UpdateClientInput } from '../../src/modules/clients/ClientService';
import { Client } from '../../src/db/schema';
import { useTranslation } from '../../src/i18n';

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function ClienteDetalhesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();

  // State
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load client
  const loadClient = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const data = await ClientService.getClient(id);
      if (data) {
        setClient(data);
        // Set form values
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setTaxId(data.document || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setState(data.state || '');
        setZipCode(data.zipCode || '');
        setNotes(data.notes || '');

        // Check pending mutations
        const pending = await ClientService.hasPendingMutations(id);
        setHasPending(pending);
      }
    } catch (error) {
      console.error('[ClienteDetalhesScreen] Error loading client:', error);
      Alert.alert(t('common.error'), t('clients.couldNotLoadClient'));
      router.back();
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('clients.validation.nameRequired');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('clients.validation.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, t]);

  // Handle save
  const handleSave = useCallback(async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isSaving) return;

    if (!id || !validate()) return;

    setIsSaving(true);
    try {
      const input: UpdateClientInput = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        taxId: taxId.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      await ClientService.updateClient(id, input);
      setIsEditing(false);
      setHasPending(true);

      Alert.alert(t('common.success'), t('clients.clientUpdated'));
    } catch (error) {
      console.error('[ClienteDetalhesScreen] Error updating client:', error);
      Alert.alert(t('common.error'), t('clients.couldNotUpdateClient'));
    } finally {
      setIsSaving(false);
    }
  }, [id, validate, name, email, phone, taxId, address, city, state, zipCode, notes, t]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!id) return;

    Alert.alert(
      t('clients.deleteClient'),
      t('clients.deleteConfirmation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await ClientService.deleteClient(id);
              Alert.alert(t('common.success'), t('clients.clientDeleted'), [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('[ClienteDetalhesScreen] Error deleting client:', error);
              Alert.alert(t('common.error'), t('clients.couldNotDeleteClient'));
            }
          },
        },
      ]
    );
  }, [id, t]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    if (client) {
      setName(client.name || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setTaxId(client.document || '');
      setAddress(client.address || '');
      setCity(client.city || '');
      setState(client.state || '');
      setZipCode(client.zipCode || '');
      setNotes(client.notes || '');
    }
    setIsEditing(false);
    setErrors({});
  }, [client]);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found
  if (!client) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <Text variant="body" color="secondary">
            {t('clients.clientNotFound')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials =
    client.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'CL';

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? t('clients.editClient') : t('common.details'),
          headerRight: () =>
            !isEditing ? (
              <View style={styles.headerButtons}>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setIsEditing(true)}
                  style={{ marginRight: 8 }}
                >
                  {t('common.edit')}
                </Button>
              </View>
            ) : null,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background.primary }]}
        edges={['bottom']}
      >
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { padding: spacing[4] }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Header with avatar */}
            {!isEditing && (
              <View style={[styles.headerSection, { marginBottom: spacing[4] }]}>
                <Avatar size="xl" fallback={initials} />
                <View style={styles.headerInfo}>
                  <Text variant="h4" weight="semibold">
                    {client.name}
                  </Text>
                  {hasPending && (
                    <Badge variant="warning" size="sm">
                      {t('common.pendingSync')}
                    </Badge>
                  )}
                </View>
              </View>
            )}

            {/* Quick Action Buttons */}
            {!isEditing && (
              <View style={[styles.quickActions, { marginBottom: spacing[4] }]}>
                <QuickActionButton
                  icon="construct-outline"
                  label={t('clients.newWorkOrder')}
                  color={colors.primary[500]}
                  backgroundColor={colors.primary[50]}
                  onPress={() => router.push(`/os/novo?clientId=${id}&clientName=${encodeURIComponent(client.name)}`)}
                />
                <QuickActionButton
                  icon="document-text-outline"
                  label={t('clients.newQuote')}
                  color={colors.secondary[500]}
                  backgroundColor={colors.secondary[50]}
                  onPress={() => router.push(`/orcamentos/novo?clientId=${id}&clientName=${encodeURIComponent(client.name)}`)}
                />
                <QuickActionButton
                  icon="cash-outline"
                  label={t('clients.newCharge')}
                  color={colors.success[500]}
                  backgroundColor={colors.success[50]}
                  onPress={() => router.push(`/cobrancas/nova?clientId=${id}&clientName=${encodeURIComponent(client.name)}`)}
                />
              </View>
            )}

            {/* Basic Info */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                {t('clients.basicInfo')}
              </Text>

              {isEditing ? (
                <>
                  <Input
                    label={`${t('clients.name')} *`}
                    placeholder={t('clients.namePlaceholder')}
                    value={name}
                    onChangeText={setName}
                    error={errors.name}
                    autoCapitalize="words"
                  />
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label={t('clients.email')}
                    placeholder={t('clients.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    error={errors.email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label={t('clients.phone')}
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label={t('clients.taxId')}
                    placeholder="000.000.000-00"
                    value={taxId}
                    onChangeText={setTaxId}
                    keyboardType="numeric"
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    icon="mail-outline"
                    label={t('clients.email')}
                    value={client.email}
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                  <InfoRow
                    icon="call-outline"
                    label={t('clients.phone')}
                    value={client.phone}
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                  <InfoRow
                    icon="document-text-outline"
                    label={t('clients.taxId')}
                    value={client.document}
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                </>
              )}
            </Card>

            {/* Address */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                {t('clients.address')}
              </Text>

              {isEditing ? (
                <>
                  <Input
                    label={t('clients.address')}
                    placeholder={t('clients.addressPlaceholder')}
                    value={address}
                    onChangeText={setAddress}
                  />
                  <View style={{ height: spacing[3] }} />
                  <View style={styles.row}>
                    <View style={styles.flex2}>
                      <Input
                        label={t('clients.city')}
                        placeholder={t('clients.city')}
                        value={city}
                        onChangeText={setCity}
                      />
                    </View>
                    <View style={{ width: spacing[3] }} />
                    <View style={styles.flex1}>
                      <Input
                        label={t('clients.state')}
                        placeholder={t('clients.stateAbbrev')}
                        value={state}
                        onChangeText={setState}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  <View style={{ height: spacing[3] }} />
                  <Input
                    label={t('clients.zipCode')}
                    placeholder="00000-000"
                    value={zipCode}
                    onChangeText={setZipCode}
                    keyboardType="numeric"
                  />
                </>
              ) : (
                <>
                  <InfoRow
                    icon="location-outline"
                    label={t('clients.address')}
                    value={client.address}
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                  <InfoRow
                    icon="business-outline"
                    label={t('clients.cityState')}
                    value={
                      client.city && client.state
                        ? `${client.city} - ${client.state}`
                        : client.city || client.state
                    }
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                  <InfoRow
                    icon="map-outline"
                    label={t('clients.zipCode')}
                    value={client.zipCode}
                    colors={colors}
                    notInformedText={t('clients.notInformed')}
                  />
                </>
              )}
            </Card>

            {/* Notes */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                {t('clients.observations')}
              </Text>

              {isEditing ? (
                <Input
                  label={t('clients.notes')}
                  placeholder={t('clients.notesPlaceholder')}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                />
              ) : (
                <Text variant="body" color={client.notes ? 'primary' : 'tertiary'}>
                  {client.notes || t('clients.noObservations')}
                </Text>
              )}
            </Card>

            {/* Delete button */}
            {!isEditing && (
              <Button
                variant="ghost"
                onPress={handleDelete}
                style={{ marginTop: spacing[4] }}
              >
                <Text variant="body" style={{ color: colors.error[500] }}>
                  {t('clients.deleteClient')}
                </Text>
              </Button>
            )}
          </ScrollView>

          {/* Footer for editing */}
          {isEditing && (
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
                onPress={handleCancel}
                disabled={isSaving}
                style={styles.cancelButton}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleSave}
                loading={isSaving}
                style={styles.saveButton}
              >
                {t('common.save')}
              </Button>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

// =============================================================================
// QUICK ACTION BUTTON COMPONENT
// =============================================================================

function QuickActionButton({
  icon,
  label,
  color,
  backgroundColor,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onPress={onPress}
      style={[quickActionStyles.button, { backgroundColor }]}
    >
      <View style={quickActionStyles.content}>
        <Ionicons name={icon as any} size={24} color={color} />
        <Text variant="caption" weight="medium" style={{ color, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </Button>
  );
}

const quickActionStyles = StyleSheet.create({
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 80,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

// =============================================================================
// INFO ROW COMPONENT
// =============================================================================

function InfoRow({
  icon,
  label,
  value,
  colors,
  notInformedText,
}: {
  icon: string;
  label: string;
  value?: string | null;
  colors: any;
  notInformedText: string;
}) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon as any} size={20} color={colors.text.tertiary} />
      <View style={infoStyles.content}>
        <Text variant="caption" color="tertiary">
          {label}
        </Text>
        <Text variant="body" color={value ? 'primary' : 'tertiary'}>
          {value || notInformedText}
        </Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  content: {
    flex: 1,
    gap: 2,
  },
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerSection: {
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {
    alignItems: 'center',
    gap: 8,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  section: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
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
});
