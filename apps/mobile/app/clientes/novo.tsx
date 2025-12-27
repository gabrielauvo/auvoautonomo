// @ts-nocheck
/**
 * New Client Screen
 *
 * Tela de criação de novo cliente.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Text, Button, Input, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { ClientService, CreateClientInput } from '../../src/modules/clients/ClientService';
import { useTranslation } from '../../src/i18n';

// =============================================================================
// MAIN SCREEN
// =============================================================================

export default function NovoClienteScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();

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
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (isLoading) return;

    if (!validate()) return;

    setIsLoading(true);
    try {
      const input: CreateClientInput = {
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

      await ClientService.createClient(input);

      Alert.alert(t('common.success'), t('clients.clientCreated'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('[NovoClienteScreen] Error creating client:', error);
      Alert.alert(t('common.error'), t('clients.couldNotCreateClient'));
    } finally {
      setIsLoading(false);
    }
  }, [validate, name, email, phone, taxId, address, city, state, zipCode, notes]);

  return (
    <>
      <Stack.Screen
        options={{
          title: t('clients.newClient'),
          headerBackTitle: t('common.back'),
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
                {t('clients.basicInfo')}
              </Text>

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
            </Card>

            {/* Address */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                {t('clients.address')}
              </Text>

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
            </Card>

            {/* Notes */}
            <Card variant="outlined" style={[styles.section, { marginBottom: spacing[4] }]}>
              <Text variant="subtitle" weight="semibold" style={{ marginBottom: spacing[4] }}>
                {t('clients.observations')}
              </Text>

              <Input
                label={t('clients.notes')}
                placeholder={t('clients.notesPlaceholder')}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />
            </Card>

            {/* Offline notice */}
            <View style={[styles.offlineNotice, { backgroundColor: colors.info[50] }]}>
              <Text variant="caption" color="secondary">
                {t('clients.offlineSaveNotice')}
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onPress={handleSave}
              loading={isLoading}
              style={styles.saveButton}
            >
              {t('clients.saveClient')}
            </Button>
          </View>
        </KeyboardAvoidingView>
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
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  flex2: {
    flex: 2,
  },
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
});
