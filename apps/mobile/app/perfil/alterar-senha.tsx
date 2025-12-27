/**
 * Change Password Screen
 *
 * Tela para alterar senha do usuário
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';
import { useTranslation } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function AlterarSenhaScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isSaving) {
      return;
    }

    // Validações
    if (!currentPassword) {
      Alert.alert(t('common.error'), t('profile.changePassword.enterCurrentPassword'));
      return;
    }

    if (!newPassword) {
      Alert.alert(t('common.error'), t('profile.changePassword.enterNewPassword'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('profile.changePassword.minLength'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.changePassword.passwordsDoNotMatch'));
      return;
    }

    setIsSaving(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/settings/change-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(t('common.success'), t('profile.changePassword.success'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t('common.error'), data.message || t('profile.changePassword.error'));
      }
    } catch (error) {
      console.error('[AlterarSenha] Error:', error);
      Alert.alert(t('common.error'), t('profile.changePassword.error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          {t('profile.changePassword.title')}
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
            {/* Senha Atual */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.changePassword.currentPassword')} *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.changePassword.currentPasswordPlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nova Senha */}
            <View style={[styles.inputGroup, { marginTop: spacing[4] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.changePassword.newPassword')} *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="key-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.changePassword.newPasswordPlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <Ionicons
                    name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
              <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                {t('profile.changePassword.minLengthHint')}
              </Text>
            </View>

            {/* Confirmar Senha */}
            <View style={[styles.inputGroup, { marginTop: spacing[4] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.changePassword.confirmNewPassword')} *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.changePassword.confirmNewPasswordPlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.tertiary}
                  />
                </TouchableOpacity>
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
            {t('profile.changePassword.changePasswordButton')}
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
