/**
 * Language Selection Screen
 *
 * Tela para selecionar o idioma do aplicativo
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';
import { useTranslation, useLocale, Locale } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface Language {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
];

export default function IdiomaScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const [isSaving, setIsSaving] = useState(false);

  const handleSelectLanguage = async (languageCode: Locale) => {
    if (languageCode === locale) return;

    setIsSaving(true);
    try {
      // Update i18n locale first (this updates the UI immediately)
      await setLocale(languageCode);

      // Also save to backend for sync across devices
      const token = await AuthService.getAccessToken();
      if (token) {
        await fetch(`${API_URL}/settings/profile`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: languageCode }),
        });
      }

      Alert.alert(
        t('common.success'),
        t('settings.languageChanged'),
        [{ text: t('common.confirm') }]
      );
    } catch (error) {
      console.error('[Idioma] Error saving language:', error);
      Alert.alert(t('common.error'), t('errors.generic'));
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
          {t('settings.language')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ padding: spacing[4] }}
      >
        <Card style={{ padding: 0 }}>
          {LANGUAGES.map((language, index) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageItem,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border.light },
                locale === language.code && { backgroundColor: colors.primary[50] },
              ]}
              onPress={() => handleSelectLanguage(language.code)}
              disabled={isSaving}
            >
              <View style={styles.languageInfo}>
                <Text style={styles.flag}>{language.flag}</Text>
                <View style={styles.languageText}>
                  <Text variant="body" weight={locale === language.code ? 'semibold' : 'normal'}>
                    {language.nativeName}
                  </Text>
                  <Text variant="caption" color="secondary">
                    {language.name}
                  </Text>
                </View>
              </View>
              {locale === language.code && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
              )}
              {isSaving && locale !== language.code && (
                <ActivityIndicator size="small" color={colors.primary[500]} />
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <Text variant="caption" color="tertiary" style={{ marginTop: spacing[4], paddingHorizontal: spacing[2] }}>
          {t('settings.languageNote')}
        </Text>
      </ScrollView>
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
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 28,
    marginRight: 12,
  },
  languageText: {},
});
