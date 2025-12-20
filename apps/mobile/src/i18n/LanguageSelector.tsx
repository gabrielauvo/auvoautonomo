/**
 * Language Selector Component
 *
 * Componente para selecao de idioma no menu de perfil.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';

import {
  Locale,
  locales,
  localeNames,
  localeFlags,
  getLocaleDisplayName,
} from './config';
import { useLocale, useTranslation } from './I18nProvider';

// =============================================================================
// TYPES
// =============================================================================

interface LanguageSelectorProps {
  onClose?: () => void;
}

interface LanguageItemProps {
  locale: Locale;
  isSelected: boolean;
  onSelect: (locale: Locale) => void;
}

// =============================================================================
// LANGUAGE ITEM
// =============================================================================

function LanguageItem({ locale, isSelected, onSelect }: LanguageItemProps) {
  return (
    <TouchableOpacity
      style={[styles.languageItem, isSelected && styles.languageItemSelected]}
      onPress={() => onSelect(locale)}
      activeOpacity={0.7}
    >
      <Text style={styles.languageFlag}>{localeFlags[locale]}</Text>
      <Text style={[styles.languageName, isSelected && styles.languageNameSelected]}>
        {localeNames[locale]}
      </Text>
      {isSelected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// LANGUAGE SELECTOR BUTTON
// =============================================================================

export function LanguageSelectorButton() {
  const [modalVisible, setModalVisible] = useState(false);
  const { locale } = useLocale();
  const { t } = useTranslation();

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectorButtonIcon}>🌐</Text>
        <View style={styles.selectorButtonContent}>
          <Text style={styles.selectorButtonLabel}>{t('settings.language')}</Text>
          <Text style={styles.selectorButtonValue}>{getLocaleDisplayName(locale)}</Text>
        </View>
        <Text style={styles.selectorButtonArrow}>›</Text>
      </TouchableOpacity>

      <LanguageSelectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

// =============================================================================
// LANGUAGE SELECTOR MODAL
// =============================================================================

interface LanguageSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSelectorModal({ visible, onClose }: LanguageSelectorModalProps) {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  const handleSelect = async (selectedLocale: Locale) => {
    await setLocale(selectedLocale);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('settings.selectLanguage')}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={[...locales]}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <LanguageItem
              locale={item}
              isSelected={item === locale}
              onSelect={handleSelect}
            />
          )}
          contentContainerStyle={styles.languageList}
        />
      </SafeAreaView>
    </Modal>
  );
}

// =============================================================================
// INLINE LANGUAGE SELECTOR (for settings screen)
// =============================================================================

export function LanguageSelectorInline() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  return (
    <View style={styles.inlineContainer}>
      <Text style={styles.inlineTitle}>{t('settings.language')}</Text>
      <View style={styles.inlineOptions}>
        {locales.map((loc) => (
          <TouchableOpacity
            key={loc}
            style={[
              styles.inlineOption,
              locale === loc && styles.inlineOptionSelected,
            ]}
            onPress={() => setLocale(loc)}
            activeOpacity={0.7}
          >
            <Text style={styles.inlineOptionFlag}>{localeFlags[loc]}</Text>
            <Text
              style={[
                styles.inlineOptionText,
                locale === loc && styles.inlineOptionTextSelected,
              ]}
            >
              {localeNames[loc]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Selector Button
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginVertical: 8,
  },
  selectorButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  selectorButtonContent: {
    flex: 1,
  },
  selectorButtonLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  selectorButtonValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectorButtonArrow: {
    fontSize: 24,
    color: '#999',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },

  // Language List
  languageList: {
    padding: 16,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f7ff',
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  languageName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  languageNameSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Inline Selector
  inlineContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
  },
  inlineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  inlineOptions: {
    gap: 8,
  },
  inlineOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inlineOptionSelected: {
    backgroundColor: '#f0f7ff',
    borderColor: '#007AFF',
  },
  inlineOptionFlag: {
    fontSize: 20,
    marginRight: 10,
  },
  inlineOptionText: {
    fontSize: 15,
    color: '#333',
  },
  inlineOptionTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
});
