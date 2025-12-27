/**
 * Regional Settings Screen
 *
 * Tela para configurar país, moeda e fuso horário da empresa
 * Sincroniza automaticamente com o web através da API
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import {
  RegionalService,
  RegionalSettings,
  CountryInfo,
  CurrencyInfo,
  TimezoneInfo,
} from '../../src/services/RegionalService';
import { useTranslation, useLocale } from '../../src/i18n';

// =============================================================================
// TYPES
// =============================================================================

type SelectType = 'country' | 'currency' | 'timezone';

interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
  icon?: string;
  extra?: string;
}

// =============================================================================
// REGIONAL SCREEN
// =============================================================================

export default function RegionalScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<RegionalSettings>({
    country: 'BR',
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
  });
  const [originalSettings, setOriginalSettings] = useState<RegionalSettings | null>(null);

  // Data lists
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [timezones, setTimezones] = useState<TimezoneInfo[]>([]);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<SelectType>('country');
  const [searchQuery, setSearchQuery] = useState('');

  // Check if there are changes
  const hasChanges = useMemo(() => {
    if (!originalSettings) return false;
    return (
      settings.country !== originalSettings.country ||
      settings.currency !== originalSettings.currency ||
      settings.timezone !== originalSettings.timezone
    );
  }, [settings, originalSettings]);

  // =============================================================================
  // LOAD DATA
  // =============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load all data in parallel
      const [settingsData, countriesData, currenciesData] = await Promise.all([
        RegionalService.getSettings(),
        RegionalService.getCountries(),
        RegionalService.getCurrencies(),
      ]);

      setSettings(settingsData);
      setOriginalSettings(settingsData);
      setCountries(countriesData);
      setCurrencies(currenciesData);

      // Load timezones for the current country
      if (settingsData.country) {
        const timezonesData = await RegionalService.getTimezones(settingsData.country);
        setTimezones(timezonesData);
      }
    } catch (error) {
      console.error('[Regional] Error loading data:', error);
      Alert.alert(t('common.error'), t('profile.regional.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleCountryChange = async (countryCode: string) => {
    const country = countries.find((c) => c.code === countryCode);
    if (!country) return;

    // Update settings with country defaults
    setSettings((prev) => ({
      ...prev,
      country: countryCode,
      currency: country.currency,
      timezone: country.timezone,
    }));

    // Load timezones for the new country
    try {
      const timezonesData = await RegionalService.getTimezones(countryCode);
      setTimezones(timezonesData);
    } catch (error) {
      console.error('[Regional] Error loading timezones:', error);
    }

    setModalVisible(false);
  };

  const handleCurrencyChange = (currencyCode: string) => {
    setSettings((prev) => ({ ...prev, currency: currencyCode }));
    setModalVisible(false);
  };

  const handleTimezoneChange = (timezoneId: string) => {
    setSettings((prev) => ({ ...prev, timezone: timezoneId }));
    setModalVisible(false);
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const updatedSettings = await RegionalService.updateSettings(settings);
      setSettings(updatedSettings);
      setOriginalSettings(updatedSettings);
      Alert.alert(t('common.success'), t('profile.regional.updateSuccess'));
    } catch (error) {
      console.error('[Regional] Error saving settings:', error);
      Alert.alert(t('common.error'), t('profile.regional.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = (type: SelectType) => {
    setModalType(type);
    setSearchQuery('');
    setModalVisible(true);
  };

  // =============================================================================
  // MODAL DATA
  // =============================================================================

  const getModalTitle = useCallback(() => {
    switch (modalType) {
      case 'country':
        return t('profile.regional.selectCountry');
      case 'currency':
        return t('profile.regional.selectCurrency');
      case 'timezone':
        return t('profile.regional.selectTimezone');
    }
  }, [modalType, t, locale]);

  const getSearchPlaceholder = useCallback(() => {
    switch (modalType) {
      case 'country':
        return t('profile.regional.searchCountry');
      case 'currency':
        return t('profile.regional.searchCurrency');
      case 'timezone':
        return t('profile.regional.searchTimezone');
    }
  }, [modalType, t, locale]);

  const getModalOptions = (): SelectOption[] => {
    const query = searchQuery.toLowerCase();

    switch (modalType) {
      case 'country':
        return countries
          .filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.localName.toLowerCase().includes(query) ||
              c.code.toLowerCase().includes(query)
          )
          .map((c) => ({
            id: c.code,
            label: c.localName,
            sublabel: c.name,
            icon: c.flag,
            extra: c.code,
          }));

      case 'currency':
        return currencies
          .filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.code.toLowerCase().includes(query) ||
              c.symbol.toLowerCase().includes(query)
          )
          .map((c) => ({
            id: c.code,
            label: c.name,
            sublabel: c.code,
            icon: c.symbol,
          }));

      case 'timezone':
        return timezones
          .filter(
            (t) =>
              t.name.toLowerCase().includes(query) ||
              t.id.toLowerCase().includes(query) ||
              t.offset.includes(query)
          )
          .map((t) => ({
            id: t.id,
            label: t.name,
            sublabel: t.id,
            extra: t.offset,
          }));
    }
  };

  const getCurrentValue = () => {
    switch (modalType) {
      case 'country':
        return settings.country;
      case 'currency':
        return settings.currency;
      case 'timezone':
        return settings.timezone;
    }
  };

  const handleSelect = (id: string) => {
    switch (modalType) {
      case 'country':
        handleCountryChange(id);
        break;
      case 'currency':
        handleCurrencyChange(id);
        break;
      case 'timezone':
        handleTimezoneChange(id);
        break;
    }
  };

  // =============================================================================
  // DISPLAY VALUES
  // =============================================================================

  const selectedCountry = countries.find((c) => c.code === settings.country);
  const selectedCurrency = currencies.find((c) => c.code === settings.currency);
  const selectedTimezone = timezones.find((t) => t.id === settings.timezone);

  // =============================================================================
  // RENDER
  // =============================================================================

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
            {t('common.loading')}
          </Text>
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
          {t('profile.regional.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ padding: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Country Select */}
        <Text variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: spacing[2] }}>
          {t('profile.regional.country').toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing[4] }}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => openModal('country')}
          >
            <View style={styles.selectContent}>
              {selectedCountry ? (
                <>
                  <Text style={styles.flag}>{selectedCountry.flag}</Text>
                  <View style={styles.selectText}>
                    <Text variant="body" weight="medium">
                      {selectedCountry.localName}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {selectedCountry.code}
                    </Text>
                  </View>
                </>
              ) : (
                <Text variant="body" color="secondary">
                  {t('profile.regional.selectCountry')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Currency Select */}
        <Text variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: spacing[2] }}>
          {t('profile.regional.currency').toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing[4] }}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => openModal('currency')}
          >
            <View style={styles.selectContent}>
              {selectedCurrency ? (
                <>
                  <View style={[styles.currencyIcon, { backgroundColor: colors.primary[50] }]}>
                    <Text variant="body" weight="bold" style={{ color: colors.primary[600] }}>
                      {selectedCurrency.symbol}
                    </Text>
                  </View>
                  <View style={styles.selectText}>
                    <Text variant="body" weight="medium">
                      {selectedCurrency.name}
                    </Text>
                    <Text variant="caption" color="secondary">
                      {selectedCurrency.code}
                    </Text>
                  </View>
                </>
              ) : (
                <Text variant="body" color="secondary">
                  {t('profile.regional.selectCurrency')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Timezone Select */}
        <Text variant="caption" weight="semibold" color="tertiary" style={{ marginBottom: spacing[2] }}>
          {t('profile.regional.timezone').toUpperCase()}
        </Text>
        <Card style={{ marginBottom: spacing[4] }}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => openModal('timezone')}
            disabled={timezones.length === 0}
          >
            <View style={styles.selectContent}>
              {selectedTimezone ? (
                <>
                  <View style={[styles.timezoneIcon, { backgroundColor: colors.gray[100] }]}>
                    <Ionicons name="time-outline" size={20} color={colors.gray[600]} />
                  </View>
                  <View style={styles.selectText}>
                    <Text variant="body" weight="medium">
                      {selectedTimezone.name}
                    </Text>
                    <Text variant="caption" color="secondary">
                      UTC {selectedTimezone.offset}
                    </Text>
                  </View>
                </>
              ) : (
                <Text variant="body" color="secondary">
                  {timezones.length === 0 ? t('profile.regional.selectCountryFirst') : t('profile.regional.selectTimezone')}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Info Note */}
        <View style={[styles.infoBox, { backgroundColor: colors.primary[50] }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary[600]} />
          <Text variant="caption" style={{ color: colors.primary[700], flex: 1, marginLeft: spacing[2] }}>
            {t('profile.regional.currencyNote')}
          </Text>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            style={{ marginTop: spacing[4] }}
          >
            {isSaving ? t('common.saving') : t('profile.regional.saveChanges')}
          </Button>
        )}
      </ScrollView>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background.primary }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.light }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text variant="h5" weight="semibold">
              {getModalTitle()}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Search Input */}
          <View style={[styles.searchContainer, { backgroundColor: colors.background.secondary }]}>
            <Ionicons name="search" size={20} color={colors.text.tertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder={getSearchPlaceholder()}
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Options List */}
          <FlatList
            data={getModalOptions()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = item.id === getCurrentValue();
              return (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    { borderBottomColor: colors.border.light },
                    isSelected && { backgroundColor: colors.primary[50] },
                  ]}
                  onPress={() => handleSelect(item.id)}
                >
                  <View style={styles.optionContent}>
                    {item.icon && (
                      modalType === 'country' ? (
                        <Text style={styles.optionFlag}>{item.icon}</Text>
                      ) : (
                        <View style={[styles.optionIcon, { backgroundColor: colors.gray[100] }]}>
                          <Text variant="caption" weight="bold" style={{ color: colors.gray[700] }}>
                            {item.icon}
                          </Text>
                        </View>
                      )
                    )}
                    {modalType === 'timezone' && (
                      <View style={[styles.optionIcon, { backgroundColor: colors.gray[100] }]}>
                        <Ionicons name="time-outline" size={18} color={colors.gray[600]} />
                      </View>
                    )}
                    <View style={styles.optionText}>
                      <Text
                        variant="body"
                        weight={isSelected ? 'semibold' : 'normal'}
                        style={isSelected ? { color: colors.primary[700] } : undefined}
                      >
                        {item.label}
                      </Text>
                      {item.sublabel && (
                        <Text variant="caption" color="secondary">
                          {item.sublabel}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.optionRight}>
                    {item.extra && (
                      <Text variant="caption" color="secondary" style={{ marginRight: spacing[2] }}>
                        {item.extra}
                      </Text>
                    )}
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary[500]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text variant="body" color="secondary">
                  {modalType === 'country' && t('profile.regional.noCountryFound')}
                  {modalType === 'currency' && t('profile.regional.noCurrencyFound')}
                  {modalType === 'timezone' && t('profile.regional.noTimezoneFound')}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectText: {
    flex: 1,
  },
  flag: {
    fontSize: 32,
    marginRight: 12,
  },
  currencyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timezoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyList: {
    padding: 32,
    alignItems: 'center',
  },
});
