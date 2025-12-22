/**
 * Preferences Screen
 *
 * Tela para configurar preferências do app.
 * Inclui toggle para criar contatos na agenda automaticamente.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { Text, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { DeviceContactsService } from '../../src/services/DeviceContactsService';
import { SYNC_FLAGS } from '../../src/config/syncFlags';

// =============================================================================
// COMPONENT
// =============================================================================

export default function PreferenciasScreen() {
  const colors = useColors();
  const spacing = useSpacing();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [contactSyncEnabled, setContactSyncEnabled] = useState(false);
  const [hasContactPermission, setHasContactPermission] = useState(false);
  const [isTogglingContactSync, setIsTogglingContactSync] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Check if contact sync is enabled
      const enabled = await DeviceContactsService.isFeatureEnabled();
      setContactSyncEnabled(enabled);

      // Check if we have permission
      const hasPermission = await DeviceContactsService.hasPermission();
      setHasContactPermission(hasPermission);
    } catch (error) {
      console.error('[Preferences] Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleContactSync = useCallback(async (value: boolean) => {
    setIsTogglingContactSync(true);

    try {
      if (value) {
        // Trying to enable - request permission first
        const granted = await DeviceContactsService.requestPermission();

        if (!granted) {
          // Permission denied - show alert with option to open settings
          Alert.alert(
            'Permissao Necessaria',
            'Para salvar clientes na agenda automaticamente, e necessario permitir o acesso aos contatos.\n\nVoce pode habilitar nas configuracoes do dispositivo.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Abrir Configuracoes',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                },
              },
            ]
          );
          setIsTogglingContactSync(false);
          return;
        }

        setHasContactPermission(true);
      }

      // Update setting
      await DeviceContactsService.setFeatureEnabled(value);
      setContactSyncEnabled(value);

      if (value) {
        Alert.alert(
          'Ativado',
          'A partir de agora, ao criar um cliente com telefone, ele sera automaticamente adicionado a sua agenda de contatos.'
        );
      }
    } catch (error) {
      console.error('[Preferences] Error toggling contact sync:', error);
      Alert.alert('Erro', 'Nao foi possivel alterar a configuracao. Tente novamente.');
    } finally {
      setIsTogglingContactSync(false);
    }
  }, []);

  const handleOpenContactPermissionSettings = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  // Check if the feature flag is available
  const isFeatureFlagEnabled = SYNC_FLAGS.CREATE_CONTACT_ON_CLIENT_CREATE;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text variant="h4" weight="semibold">
            Preferencias
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          Preferencias
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Contacts Section */}
        <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
          <Text
            variant="caption"
            weight="semibold"
            color="tertiary"
            style={{ marginBottom: spacing[2], marginLeft: spacing[2] }}
          >
            AGENDA DE CONTATOS
          </Text>

          <Card style={styles.settingsCard}>
            {/* Contact Sync Toggle */}
            <View style={styles.settingItem}>
              <View style={[styles.settingIconContainer, { backgroundColor: colors.primary[50] }]}>
                <Ionicons name="person-add-outline" size={20} color={colors.primary[500]} />
              </View>

              <View style={styles.settingContent}>
                <View style={styles.settingTextContainer}>
                  <Text variant="body" weight="medium">
                    Salvar clientes na agenda
                  </Text>
                  <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                    Ao criar um cliente com telefone, ele sera adicionado automaticamente aos seus contatos
                  </Text>
                </View>

                {isFeatureFlagEnabled ? (
                  <Switch
                    value={contactSyncEnabled}
                    onValueChange={handleToggleContactSync}
                    disabled={isTogglingContactSync}
                    trackColor={{
                      false: colors.gray[300],
                      true: colors.primary[300],
                    }}
                    thumbColor={contactSyncEnabled ? colors.primary[500] : colors.gray[100]}
                    ios_backgroundColor={colors.gray[300]}
                  />
                ) : (
                  <View
                    style={[
                      styles.disabledBadge,
                      { backgroundColor: colors.gray[100] },
                    ]}
                  >
                    <Text variant="caption" color="tertiary">
                      Em breve
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Permission Status */}
            {isFeatureFlagEnabled && contactSyncEnabled && (
              <View
                style={[
                  styles.permissionBanner,
                  {
                    backgroundColor: hasContactPermission
                      ? colors.success[50]
                      : colors.warning[50],
                    borderTopWidth: 1,
                    borderTopColor: colors.border.light,
                  },
                ]}
              >
                <Ionicons
                  name={hasContactPermission ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={hasContactPermission ? colors.success[600] : colors.warning[600]}
                />
                <Text
                  variant="caption"
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    color: hasContactPermission ? colors.success[700] : colors.warning[700],
                  }}
                >
                  {hasContactPermission
                    ? 'Permissao concedida. Contatos serao criados automaticamente.'
                    : 'Permissao de contatos nao concedida.'}
                </Text>
                {!hasContactPermission && (
                  <TouchableOpacity onPress={handleOpenContactPermissionSettings}>
                    <Text
                      variant="caption"
                      weight="semibold"
                      style={{ color: colors.warning[700] }}
                    >
                      Configurar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card>

          {/* Info Card */}
          {isFeatureFlagEnabled && (
            <Card
              style={[
                styles.infoCard,
                { backgroundColor: colors.primary[50], marginTop: spacing[3] },
              ]}
            >
              <Ionicons name="information-circle" size={20} color={colors.primary[600]} />
              <View style={{ flex: 1, marginLeft: spacing[2] }}>
                <Text variant="caption" style={{ color: colors.primary[700] }}>
                  Os contatos criados incluem apenas nome e telefone do cliente. Contatos duplicados
                  (mesmo telefone) nao serao criados novamente.
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* Future settings sections can go here */}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  disabledBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
});
