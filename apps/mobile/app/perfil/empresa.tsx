/**
 * Company Data Screen
 *
 * Tela para editar dados da empresa
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Text, Card, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';
import { useTranslation, useLocale } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

// PIX_KEY_TYPES will be created as useMemo inside the component for i18n support

interface CompanyData {
  tradeName: string;
  legalName: string | null;
  taxId: string | null;
  stateRegistration: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  logoUrl: string | null;
  address: {
    zipCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;
  // Pix settings
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  pixKeyOwnerName: string | null;
  pixKeyEnabled: boolean;
  pixKeyFeatureEnabled: boolean;
}

export default function EmpresaScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();
  const { locale } = useLocale();

  // PIX key types with translations
  const PIX_KEY_TYPES = useMemo(() => [
    { value: 'CPF' as PixKeyType, label: 'CPF' },
    { value: 'CNPJ' as PixKeyType, label: 'CNPJ' },
    { value: 'EMAIL' as PixKeyType, label: t('profile.companyData.pix.types.email') },
    { value: 'PHONE' as PixKeyType, label: t('profile.companyData.pix.types.phone') },
    { value: 'RANDOM' as PixKeyType, label: t('profile.companyData.pix.types.random') },
  ], [t, locale]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Form state
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Address
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  // Pix
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType | ''>('');
  const [pixKeyOwnerName, setPixKeyOwnerName] = useState('');
  const [pixKeyEnabled, setPixKeyEnabled] = useState(false);
  const [pixKeyFeatureEnabled, setPixKeyFeatureEnabled] = useState(true);
  const [showPixTypePicker, setShowPixTypePicker] = useState(false);

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/settings/company`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: CompanyData = await response.json();
        setTradeName(data.tradeName || '');
        setLegalName(data.legalName || '');
        setTaxId(data.taxId || '');
        setStateRegistration(data.stateRegistration || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setWhatsapp(data.whatsapp || '');
        setLogoUrl(data.logoUrl);

        if (data.address) {
          setZipCode(data.address.zipCode || '');
          setStreet(data.address.street || '');
          setNumber(data.address.number || '');
          setComplement(data.address.complement || '');
          setNeighborhood(data.address.neighborhood || '');
          setCity(data.address.city || '');
          setState(data.address.state || '');
        }

        // Load Pix data
        setPixKey(data.pixKey || '');
        setPixKeyType(data.pixKeyType || '');
        setPixKeyOwnerName(data.pixKeyOwnerName || '');
        setPixKeyEnabled(data.pixKeyEnabled || false);
        setPixKeyFeatureEnabled(data.pixKeyFeatureEnabled !== false);
      }
    } catch (error) {
      console.error('[Empresa] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // CRITICAL: Guard against duplicate submissions
    if (isSaving) {
      return;
    }

    if (!tradeName.trim()) {
      Alert.alert(t('common.error'), t('profile.companyData.tradeNameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/settings/company`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeName,
          legalName: legalName || null,
          taxId: taxId || null,
          stateRegistration: stateRegistration || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          address: {
            zipCode: zipCode || null,
            street: street || null,
            number: number || null,
            complement: complement || null,
            neighborhood: neighborhood || null,
            city: city || null,
            state: state || null,
          },
          // Pix settings
          pixKey: pixKey || null,
          pixKeyType: pixKeyType || null,
          pixKeyOwnerName: pixKeyOwnerName || null,
          pixKeyEnabled,
        }),
      });

      if (response.ok) {
        Alert.alert(t('common.success'), t('profile.companyData.updateSuccess'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert(t('common.error'), error.message || t('profile.companyData.saveError'));
      }
    } catch (error) {
      console.error('[Empresa] Error saving:', error);
      Alert.alert(t('common.error'), t('profile.companyData.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(t('profile.companyData.permissionRequired'), t('profile.companyData.galleryPermission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadLogo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('[Empresa] Error picking image:', error);
      Alert.alert(t('common.error'), t('profile.companyData.imageSelectError'));
    }
  };

  const uploadLogo = async (uri: string) => {
    setIsUploadingLogo(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('logo', {
        uri,
        type: 'image/jpeg',
        name: 'logo.jpg',
      } as any);

      const response = await fetch(`${API_URL}/settings/company/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setLogoUrl(data.logoUrl);
        Alert.alert(t('common.success'), t('profile.companyData.logoUpdateSuccess'));
      } else {
        const error = await response.json();
        Alert.alert(t('common.error'), error.message || t('profile.companyData.logoUpdateError'));
      }
    } catch (error) {
      console.error('[Empresa] Error uploading logo:', error);
      Alert.alert(t('common.error'), t('profile.companyData.logoUploadError'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteLogo = () => {
    Alert.alert(
      t('profile.companyData.removeLogo'),
      t('profile.companyData.removeLogoConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AuthService.getAccessToken();
              if (!token) return;

              const response = await fetch(`${API_URL}/settings/company/logo`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (response.ok) {
                setLogoUrl(null);
                Alert.alert(t('common.success'), t('profile.companyData.logoRemoved'));
              }
            } catch (error) {
              Alert.alert(t('common.error'), t('profile.companyData.logoRemoveError'));
            }
          },
        },
      ]
    );
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
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
          {t('profile.companyData.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ padding: spacing[4], paddingBottom: spacing[8] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Card style={{ marginBottom: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('profile.companyData.companyLogo')}
            </Text>
            <View style={styles.logoSection}>
              <TouchableOpacity
                style={[styles.logoContainer, { borderColor: colors.border.medium }]}
                onPress={handlePickLogo}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="business-outline" size={32} color={colors.text.tertiary} />
                    <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                      {t('profile.companyData.addLogo')}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {logoUrl && (
                <TouchableOpacity
                  style={[styles.removeLogo, { backgroundColor: colors.error[50] }]}
                  onPress={handleDeleteLogo}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error[500]} />
                  <Text variant="caption" style={{ color: colors.error[500], marginLeft: 4 }}>
                    {t('common.remove')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Company Info */}
          <Card style={{ marginBottom: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('profile.companyData.companyInfo')}
            </Text>

            {/* Nome Fantasia */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.tradeName')} *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.companyData.tradeNamePlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={tradeName}
                  onChangeText={setTradeName}
                />
              </View>
            </View>

            {/* Razão Social */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.legalName')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.companyData.legalNamePlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={legalName}
                  onChangeText={setLegalName}
                />
              </View>
            </View>

            {/* CNPJ */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.taxId')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="00.000.000/0000-00"
                  placeholderTextColor={colors.text.tertiary}
                  value={taxId}
                  onChangeText={(text) => setTaxId(formatCNPJ(text))}
                  keyboardType="numeric"
                  maxLength={18}
                />
              </View>
            </View>

            {/* Inscrição Estadual */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.stateRegistration')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder={t('profile.companyData.stateRegistrationPlaceholder')}
                  placeholderTextColor={colors.text.tertiary}
                  value={stateRegistration}
                  onChangeText={setStateRegistration}
                />
              </View>
            </View>
          </Card>

          {/* Contact */}
          <Card style={{ marginBottom: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('profile.companyData.contact')}
            </Text>

            {/* Telefone */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.phone')}
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

            {/* WhatsApp */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                WhatsApp
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <Ionicons name="logo-whatsapp" size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.text.tertiary}
                  value={whatsapp}
                  onChangeText={(text) => setWhatsapp(formatPhone(text))}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
            </View>
          </Card>

          {/* Address */}
          <Card style={{ marginBottom: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('profile.companyData.address')}
            </Text>

            {/* CEP */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                {t('profile.companyData.zipCode')}
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="00000-000"
                  placeholderTextColor={colors.text.tertiary}
                  value={zipCode}
                  onChangeText={(text) => setZipCode(formatCEP(text))}
                  keyboardType="numeric"
                  maxLength={9}
                />
              </View>
            </View>

            {/* Rua + Número */}
            <View style={[styles.row, { marginTop: spacing[3] }]}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.street')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.streetPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={street}
                    onChangeText={setStreet}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.number')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.numberPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={number}
                    onChangeText={setNumber}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* Complemento + Bairro */}
            <View style={[styles.row, { marginTop: spacing[3] }]}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.complement')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.complementPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={complement}
                    onChangeText={setComplement}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.neighborhood')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.neighborhoodPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={neighborhood}
                    onChangeText={setNeighborhood}
                  />
                </View>
              </View>
            </View>

            {/* Cidade + Estado */}
            <View style={[styles.row, { marginTop: spacing[3] }]}>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.city')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.cityPlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.state')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.statePlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={state}
                    onChangeText={setState}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>
          </Card>

          {/* Pix Settings */}
          {pixKeyFeatureEnabled && (
            <Card style={{ marginBottom: spacing[4] }}>
              <View style={styles.pixHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="qr-code-outline" size={20} color={colors.primary[500]} />
                  <Text variant="body" weight="semibold">
                    {t('profile.companyData.pix.title')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPixKeyEnabled(!pixKeyEnabled)}
                  style={[
                    styles.toggleButton,
                    { backgroundColor: pixKeyEnabled ? colors.success[100] : colors.neutral[100] }
                  ]}
                >
                  <Ionicons
                    name={pixKeyEnabled ? 'toggle' : 'toggle-outline'}
                    size={28}
                    color={pixKeyEnabled ? colors.success[500] : colors.neutral[400]}
                  />
                  <Text
                    variant="caption"
                    style={{ color: pixKeyEnabled ? colors.success[600] : colors.neutral[500] }}
                  >
                    {pixKeyEnabled ? t('common.enabled') : t('common.disabled')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text variant="caption" color="tertiary" style={{ marginBottom: spacing[3] }}>
                {t('profile.companyData.pix.description')}
              </Text>

              {/* Tipo da Chave */}
              <View style={styles.inputGroup}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.pix.keyType')}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.inputContainer,
                    {
                      borderColor: colors.border.medium,
                      opacity: pixKeyEnabled ? 1 : 0.5,
                    }
                  ]}
                  onPress={() => pixKeyEnabled && setShowPixTypePicker(true)}
                  disabled={!pixKeyEnabled}
                >
                  <Text
                    variant="body"
                    style={{ flex: 1, color: pixKeyType ? colors.text.primary : colors.text.tertiary }}
                  >
                    {pixKeyType ? PIX_KEY_TYPES.find(type => type.value === pixKeyType)?.label : t('profile.companyData.pix.selectType')}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              {/* Chave Pix */}
              <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.pix.pixKey')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium, opacity: pixKeyEnabled ? 1 : 0.5 }]}>
                  <Ionicons name="key-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={
                      pixKeyType === 'CPF' ? '000.000.000-00' :
                      pixKeyType === 'CNPJ' ? '00.000.000/0000-00' :
                      pixKeyType === 'EMAIL' ? 'email@exemplo.com' :
                      pixKeyType === 'PHONE' ? '+55 11 99999-9999' :
                      pixKeyType === 'RANDOM' ? t('profile.companyData.pix.types.random') :
                      t('profile.companyData.pix.enterPixKey')
                    }
                    placeholderTextColor={colors.text.tertiary}
                    value={pixKey}
                    onChangeText={setPixKey}
                    editable={pixKeyEnabled}
                    autoCapitalize={pixKeyType === 'EMAIL' ? 'none' : 'characters'}
                    keyboardType={
                      pixKeyType === 'EMAIL' ? 'email-address' :
                      pixKeyType === 'CPF' || pixKeyType === 'CNPJ' || pixKeyType === 'PHONE' ? 'phone-pad' :
                      'default'
                    }
                  />
                </View>
              </View>

              {/* Nome do Favorecido */}
              <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  {t('profile.companyData.pix.ownerName')}
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium, opacity: pixKeyEnabled ? 1 : 0.5 }]}>
                  <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder={t('profile.companyData.pix.ownerNamePlaceholder')}
                    placeholderTextColor={colors.text.tertiary}
                    value={pixKeyOwnerName}
                    onChangeText={setPixKeyOwnerName}
                    editable={pixKeyEnabled}
                  />
                </View>
              </View>

              {pixKeyEnabled && pixKey && (
                <View style={[styles.successMessage, { backgroundColor: colors.success[50], marginTop: spacing[3] }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success[500]} />
                  <Text variant="caption" style={{ color: colors.success[700], marginLeft: 6, flex: 1 }}>
                    {t('profile.companyData.pix.configured')}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Pix Type Picker Modal */}
          {showPixTypePicker && (
            <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <View style={[styles.pickerContainer, { backgroundColor: colors.background.primary }]}>
                <View style={styles.pickerHeader}>
                  <Text variant="body" weight="semibold">{t('profile.companyData.pix.keyTypeTitle')}</Text>
                  <TouchableOpacity onPress={() => setShowPixTypePicker(false)}>
                    <Ionicons name="close" size={24} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
                {PIX_KEY_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.pickerOption,
                      { borderBottomColor: colors.border.light },
                      pixKeyType === type.value && { backgroundColor: colors.primary[50] }
                    ]}
                    onPress={() => {
                      setPixKeyType(type.value);
                      setShowPixTypePicker(false);
                    }}
                  >
                    <Text
                      variant="body"
                      style={{ color: pixKeyType === type.value ? colors.primary[600] : colors.text.primary }}
                    >
                      {type.label}
                    </Text>
                    {pixKeyType === type.value && (
                      <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Save Button */}
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
          >
            {t('profile.companyData.saveChanges')}
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
  logoSection: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholder: {
    alignItems: 'center',
  },
  removeLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
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
  row: {
    flexDirection: 'row',
  },
  pixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  pickerContainer: {
    width: '85%',
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
});
