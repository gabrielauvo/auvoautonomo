/**
 * Company Data Screen
 *
 * Tela para editar dados da empresa
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Text, Card, Button } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

const PIX_KEY_TYPES: { value: PixKeyType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'RANDOM', label: 'Chave aleatória' },
];

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
      Alert.alert('Erro', 'O nome fantasia é obrigatório');
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
        Alert.alert('Sucesso', 'Dados da empresa atualizados', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const error = await response.json();
        Alert.alert('Erro', error.message || 'Falha ao salvar dados');
      }
    } catch (error) {
      console.error('[Empresa] Error saving:', error);
      Alert.alert('Erro', 'Falha ao salvar dados');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à galeria para escolher uma imagem.');
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
      Alert.alert('Erro', 'Falha ao selecionar imagem');
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
        Alert.alert('Sucesso', 'Logo atualizada com sucesso');
      } else {
        const error = await response.json();
        Alert.alert('Erro', error.message || 'Falha ao atualizar logo');
      }
    } catch (error) {
      console.error('[Empresa] Error uploading logo:', error);
      Alert.alert('Erro', 'Falha ao enviar logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDeleteLogo = () => {
    Alert.alert(
      'Remover Logo',
      'Deseja remover a logo da empresa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
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
                Alert.alert('Sucesso', 'Logo removida');
              }
            } catch (error) {
              Alert.alert('Erro', 'Falha ao remover logo');
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
          Dados da Empresa
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
              Logo da Empresa
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
                      Adicionar Logo
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
                    Remover
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>

          {/* Company Info */}
          <Card style={{ marginBottom: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              Informações da Empresa
            </Text>

            {/* Nome Fantasia */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                Nome Fantasia *
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="Nome da sua empresa"
                  placeholderTextColor={colors.text.tertiary}
                  value={tradeName}
                  onChangeText={setTradeName}
                />
              </View>
            </View>

            {/* Razão Social */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                Razão Social
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="Razão social completa"
                  placeholderTextColor={colors.text.tertiary}
                  value={legalName}
                  onChangeText={setLegalName}
                />
              </View>
            </View>

            {/* CNPJ */}
            <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                CNPJ
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
                Inscrição Estadual
              </Text>
              <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="Inscrição estadual"
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
              Contato
            </Text>

            {/* Telefone */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                Telefone
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
              Endereço
            </Text>

            {/* CEP */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                CEP
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
                  Rua
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Nome da rua"
                    placeholderTextColor={colors.text.tertiary}
                    value={street}
                    onChangeText={setStreet}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  Nº
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Nº"
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
                  Complemento
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Apto, sala..."
                    placeholderTextColor={colors.text.tertiary}
                    value={complement}
                    onChangeText={setComplement}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  Bairro
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Bairro"
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
                  Cidade
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Cidade"
                    placeholderTextColor={colors.text.tertiary}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[2] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  UF
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="UF"
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
                    Recebimento via Pix
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
                    {pixKeyEnabled ? 'Ativado' : 'Desativado'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text variant="caption" color="tertiary" style={{ marginBottom: spacing[3] }}>
                Configure sua chave Pix para exibir nas cobranças e PDF.
              </Text>

              {/* Tipo da Chave */}
              <View style={styles.inputGroup}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  Tipo da chave
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
                    {pixKeyType ? PIX_KEY_TYPES.find(t => t.value === pixKeyType)?.label : 'Selecione o tipo'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              {/* Chave Pix */}
              <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                <Text variant="caption" weight="medium" color="secondary" style={{ marginBottom: spacing[1] }}>
                  Chave Pix
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
                      pixKeyType === 'RANDOM' ? 'Chave aleatória' :
                      'Digite sua chave Pix'
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
                  Nome do favorecido (opcional)
                </Text>
                <View style={[styles.inputContainer, { borderColor: colors.border.medium, opacity: pixKeyEnabled ? 1 : 0.5 }]}>
                  <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="Nome que aparece no Pix"
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
                    Chave Pix configurada! Será exibida nas cobranças.
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
                  <Text variant="body" weight="semibold">Tipo da Chave Pix</Text>
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
            Salvar Alterações
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
