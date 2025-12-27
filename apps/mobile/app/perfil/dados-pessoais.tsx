/**
 * Personal Data Screen
 *
 * Tela para editar dados pessoais do usuário
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';
import { useAuth } from '../../src/services/AuthProvider';
import { useTranslation } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function DadosPessoaisScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { updateUser } = useAuth();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/settings/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
      }
    } catch (error) {
      console.error('[DadosPessoais] Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isSaving) {
      return;
    }

    if (!name.trim()) {
      Alert.alert(t('common.error'), t('profile.personalData.nameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/settings/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone }),
      });

      if (response.ok) {
        // Update local auth context with new data
        await updateUser({ name, phone });

        Alert.alert(t('common.success'), t('profile.personalData.updateSuccess'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert(t('common.error'), error.message || t('profile.personalData.updateError'));
      }
    } catch (error) {
      console.error('[DadosPessoais] Error saving:', error);
      Alert.alert(t('common.error'), t('profile.personalData.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
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
          {t('profile.personalData.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ padding: spacing[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            {/* Nome */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.personalData.fullName')} *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.personalData.yourName')}
                  placeholderTextColor={colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email (read-only) */}
            <View style={[styles.inputGroup, { marginTop: spacing[4] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.personalData.email')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium, backgroundColor: colors.gray[50] }]}>
                <Ionicons name="mail-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.secondary }]}
                  value={email}
                  editable={false}
                />
                <Ionicons name="lock-closed-outline" size={16} color={colors.text.tertiary} />
              </View>
              <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                {t('profile.personalData.emailCannotBeChanged')}
              </Text>
            </View>

            {/* Telefone */}
            <View style={[styles.inputGroup, { marginTop: spacing[4] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.personalData.phone')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="call-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.text.tertiary}
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhone(text))}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            </View>
          </Card>

          {/* Save Button */}
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            style={{ marginTop: spacing[4] }}
          >
            {t('profile.personalData.saveChanges')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  inputGroup: {},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
