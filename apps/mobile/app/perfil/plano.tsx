/**
 * Plan Management Screen
 *
 * Tela de gestão do plano - upgrade, downgrade e cancelamento
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, Card, Button, Badge } from '../../src/design-system';
import { useColors, useSpacing } from '../../src/design-system/ThemeProvider';
import { AuthService } from '../../src/services/AuthService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAN_CARD_WIDTH = SCREEN_WIDTH * 0.75;

interface PlanInfo {
  type: string;
  name: string;
  price: number;
  features?: string[];
  limits?: {
    maxClients: number | null;
    maxQuotes: number | null;
    maxWorkOrders: number | null;
    maxInvoices: number | null;
  };
}

interface SubscriptionData {
  plan: PlanInfo;
  usage: {
    clients: number;
    quotes: number;
    workOrders: number;
    payments: number;
  };
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: string;
  creditCardLastFour?: string;
  creditCardBrand?: string;
}

// Feature list for plan comparison
const PLAN_FEATURES = [
  { key: 'clients', label: 'Clientes', freeLimit: 10, proLimit: null },
  { key: 'quotes', label: 'Orçamentos', freeLimit: 10, proLimit: null },
  { key: 'workOrders', label: 'Ordens de Serviço', freeLimit: 10, proLimit: null },
  { key: 'invoices', label: 'Cobranças', freeLimit: 5, proLimit: null },
  { key: 'templates', label: 'Templates personalizados', freeLimit: false, proLimit: true },
  { key: 'reports', label: 'Relatórios avançados', freeLimit: false, proLimit: true },
  { key: 'support', label: 'Suporte prioritário', freeLimit: false, proLimit: true },
];

export default function PlanoScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const plansScrollRef = useRef<ScrollView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [availablePlans, setAvailablePlans] = useState<PlanInfo[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');

  // PIX state
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);

  // Credit card state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      // Load subscription
      const subRes = await fetch(`${API_URL}/billing/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }

      // Load available plans
      const plansRes = await fetch(`${API_URL}/billing/plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setAvailablePlans(plansData);
      }
    } catch (error) {
      console.error('[Plano] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleCheckoutPix = async () => {
    if (!cpfCnpj.trim()) {
      Alert.alert('Erro', 'Informe seu CPF ou CNPJ');
      return;
    }

    setIsProcessing(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/billing/checkout/pix`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPixQrCode(data.pixQrCode);
        setPixCopyPaste(data.pixCopyPaste);
      } else {
        Alert.alert('Erro', data.message || 'Falha ao gerar PIX');
      }
    } catch (error) {
      console.error('[Plano] Error generating PIX:', error);
      Alert.alert('Erro', 'Falha ao gerar pagamento PIX');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutCreditCard = async () => {
    // Validações
    if (!cpfCnpj.trim()) {
      Alert.alert('Erro', 'Informe seu CPF ou CNPJ');
      return;
    }
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert('Erro', 'Número do cartão inválido');
      return;
    }
    if (!cardExpiry.trim() || cardExpiry.length < 5) {
      Alert.alert('Erro', 'Data de validade inválida');
      return;
    }
    if (!cardCvv.trim() || cardCvv.length < 3) {
      Alert.alert('Erro', 'CVV inválido');
      return;
    }
    if (!cardName.trim()) {
      Alert.alert('Erro', 'Informe o nome no cartão');
      return;
    }

    setIsProcessing(true);
    try {
      const token = await AuthService.getAccessToken();
      if (!token) return;

      const user = await AuthService.getUser();
      const [expiryMonth, expiryYear] = cardExpiry.split('/');

      const response = await fetch(`${API_URL}/billing/checkout/credit-card`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpfCnpj: cpfCnpj.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          name: cardName,
          email: user?.email,
          postalCode: postalCode.replace(/\D/g, ''),
          addressNumber,
          cardHolderName: cardName,
          cardNumber: cardNumber.replace(/\s/g, ''),
          expiryMonth,
          expiryYear: `20${expiryYear}`,
          ccv: cardCvv,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Sucesso', 'Pagamento aprovado! Seu plano foi atualizado.', [
          {
            text: 'OK',
            onPress: () => {
              setShowUpgradeModal(false);
              loadData();
            },
          },
        ]);
      } else {
        Alert.alert('Erro', data.errorMessage || data.message || 'Pagamento não aprovado');
      }
    } catch (error) {
      console.error('[Plano] Error processing card:', error);
      Alert.alert('Erro', 'Falha ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Assinatura',
      'Tem certeza que deseja cancelar sua assinatura? Você voltará para o plano gratuito e perderá acesso aos recursos PRO.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const token = await AuthService.getAccessToken();
              if (!token) return;

              const response = await fetch(`${API_URL}/billing/cancel`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              const data = await response.json();

              if (data.success) {
                Alert.alert('Assinatura Cancelada', data.message);
                loadData();
              } else {
                Alert.alert('Erro', data.message || 'Falha ao cancelar');
              }
            } catch (error) {
              Alert.alert('Erro', 'Falha ao cancelar assinatura');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const groups = numbers.match(/.{1,4}/g);
    return groups ? groups.join(' ') : numbers;
  };

  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
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

  const formatLimit = (limit: number | null | undefined) => {
    if (limit === null || limit === undefined || limit === -1) return 'Ilimitado';
    return limit.toString();
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

  const isPro = subscription?.plan?.type === 'PRO';
  const proPlan = availablePlans.find((p) => p.type === 'PRO');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          Meu Plano
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan Card */}
        <Card style={[styles.currentPlanCard, { marginHorizontal: spacing[4], marginTop: spacing[4] }]}>
          <View style={styles.planHeader}>
            <View style={[styles.planIconContainer, { backgroundColor: isPro ? colors.primary[100] : colors.warning[100] }]}>
              <Ionicons
                name={isPro ? 'star' : 'star-outline'}
                size={28}
                color={isPro ? colors.primary[500] : colors.warning[500]}
              />
            </View>
            <View style={styles.planInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="h4" weight="bold">
                  Plano {subscription?.plan?.name || 'Gratuito'}
                </Text>
                <Badge variant={isPro ? 'primary' : 'warning'} size="sm">
                  {isPro ? 'PRO' : 'FREE'}
                </Badge>
              </View>
              {isPro && (
                <Text variant="body" color="secondary">
                  R$ {subscription?.plan?.price?.toFixed(2).replace('.', ',')}/mês
                </Text>
              )}
            </View>
          </View>

          {/* Status */}
          {isPro && subscription?.currentPeriodEnd && (
            <View style={[styles.statusBadge, { backgroundColor: colors.success[50] }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
              <Text variant="caption" weight="medium" style={{ color: colors.success[700], marginLeft: 6 }}>
                Próxima cobrança: {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}

          {isPro && subscription?.paymentMethod && (
            <View style={[styles.statusBadge, { backgroundColor: colors.gray[100], marginTop: spacing[2] }]}>
              <Ionicons
                name={subscription.paymentMethod === 'CREDIT_CARD' ? 'card' : 'qr-code'}
                size={18}
                color={colors.text.secondary}
              />
              <Text variant="caption" color="secondary" style={{ marginLeft: 6 }}>
                {subscription.paymentMethod === 'CREDIT_CARD'
                  ? `Cartão ${subscription.creditCardBrand || ''} •••• ${subscription.creditCardLastFour || ''}`
                  : 'PIX'}
              </Text>
            </View>
          )}
        </Card>

        {/* Usage Section */}
        {subscription?.usage && (
          <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              Uso do Plano
            </Text>
            <Card>
              {[
                { label: 'Clientes', value: subscription.usage.clients, limit: subscription.plan?.limits?.maxClients },
                { label: 'Orçamentos', value: subscription.usage.quotes, limit: subscription.plan?.limits?.maxQuotes },
                { label: 'Ordens de Serviço', value: subscription.usage.workOrders, limit: subscription.plan?.limits?.maxWorkOrders },
                { label: 'Cobranças', value: subscription.usage.payments, limit: subscription.plan?.limits?.maxInvoices },
              ].map((item, index) => {
                const limitText = formatLimit(item.limit);
                const isUnlimited = limitText === 'Ilimitado';
                const percentage = isUnlimited ? 0 : (item.value / (item.limit || 1)) * 100;
                const isNearLimit = !isUnlimited && percentage >= 80;

                return (
                  <View key={item.label} style={[styles.usageRow, index > 0 && { marginTop: spacing[3] }]}>
                    <View style={styles.usageInfo}>
                      <Text variant="body" color="secondary">
                        {item.label}
                      </Text>
                      <Text variant="body" weight="semibold" style={{ color: isNearLimit ? colors.warning[600] : colors.text.primary }}>
                        {item.value} / {limitText}
                      </Text>
                    </View>
                    {!isUnlimited && (
                      <View style={[styles.progressBar, { backgroundColor: colors.gray[200] }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(percentage, 100)}%`,
                              backgroundColor: isNearLimit ? colors.warning[500] : colors.primary[500],
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Compare Plans - Horizontal Scroll */}
        <View style={{ marginTop: spacing[6] }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3], paddingHorizontal: spacing[4] }}>
            Comparar Planos
          </Text>
          <Text variant="caption" color="tertiary" style={{ marginBottom: spacing[3], paddingHorizontal: spacing[4] }}>
            Deslize para ver todos os planos
          </Text>

          <ScrollView
            ref={plansScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
            decelerationRate="fast"
            snapToInterval={PLAN_CARD_WIDTH + spacing[3]}
          >
            {/* Free Plan Card */}
            <View
              style={[
                styles.comparePlanCard,
                {
                  width: PLAN_CARD_WIDTH,
                  backgroundColor: colors.background.primary,
                  borderColor: !isPro ? colors.primary[500] : colors.border.light,
                  borderWidth: !isPro ? 2 : 1,
                },
              ]}
            >
              {!isPro && (
                <View style={[styles.currentPlanBadge, { backgroundColor: colors.primary[500] }]}>
                  <Text variant="caption" weight="semibold" style={{ color: '#FFF' }}>
                    Plano Atual
                  </Text>
                </View>
              )}

              <View style={styles.comparePlanHeader}>
                <Ionicons name="star-outline" size={32} color={colors.warning[500]} />
                <Text variant="h5" weight="bold" style={{ marginTop: spacing[2] }}>
                  Gratuito
                </Text>
                <Text variant="h3" weight="bold" style={{ marginTop: spacing[1] }}>
                  Grátis
                </Text>
              </View>

              <View style={styles.comparePlanFeatures}>
                {PLAN_FEATURES.map((feature) => (
                  <View key={feature.key} style={styles.featureRow}>
                    <Ionicons
                      name={feature.freeLimit !== false ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={feature.freeLimit !== false ? colors.success[500] : colors.gray[400]}
                    />
                    <Text
                      variant="caption"
                      style={{
                        marginLeft: 8,
                        flex: 1,
                        color: feature.freeLimit !== false ? colors.text.primary : colors.text.tertiary,
                      }}
                    >
                      {feature.label}
                    </Text>
                    {typeof feature.freeLimit === 'number' && (
                      <Text variant="caption" weight="medium" color="secondary">
                        {feature.freeLimit}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {isPro && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={handleCancel}
                  style={{ marginTop: spacing[4] }}
                >
                  Fazer Downgrade
                </Button>
              )}
            </View>

            {/* Pro Plan Card */}
            <View
              style={[
                styles.comparePlanCard,
                {
                  width: PLAN_CARD_WIDTH,
                  backgroundColor: colors.background.primary,
                  borderColor: isPro ? colors.primary[500] : colors.primary[300],
                  borderWidth: isPro ? 2 : 1,
                },
              ]}
            >
              <View style={[styles.popularBadge, { backgroundColor: colors.primary[500] }]}>
                <Ionicons name="trending-up" size={12} color="#FFF" />
                <Text variant="caption" weight="semibold" style={{ color: '#FFF', marginLeft: 4 }}>
                  {isPro ? 'Plano Atual' : 'Mais Popular'}
                </Text>
              </View>

              <View style={styles.comparePlanHeader}>
                <Ionicons name="star" size={32} color={colors.primary[500]} />
                <Text variant="h5" weight="bold" style={{ marginTop: spacing[2] }}>
                  Profissional
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing[1] }}>
                  <Text variant="h3" weight="bold" style={{ color: colors.primary[600] }}>
                    R$ {proPlan?.price?.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text variant="caption" color="secondary">/mês</Text>
                </View>
              </View>

              <View style={styles.comparePlanFeatures}>
                {PLAN_FEATURES.map((feature) => (
                  <View key={feature.key} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
                    <Text variant="caption" style={{ marginLeft: 8, flex: 1 }}>
                      {feature.label}
                    </Text>
                    {feature.proLimit === null && (
                      <Text variant="caption" weight="medium" style={{ color: colors.primary[600] }}>
                        Ilimitado
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {!isPro && (
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleUpgrade}
                  style={{ marginTop: spacing[4] }}
                >
                  Fazer Upgrade
                </Button>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Cancel Button */}
        {isPro && (
          <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.error[300] }]}
              onPress={handleCancel}
            >
              <Ionicons name="close-circle-outline" size={20} color={colors.error[500]} />
              <Text variant="body" style={{ color: colors.error[500], marginLeft: 8 }}>
                Cancelar Assinatura
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background.primary }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUpgradeModal(false)}>
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </TouchableOpacity>
            <Text variant="h4" weight="semibold">
              Upgrade para PRO
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing[4] }}
              keyboardShouldPersistTaps="handled"
            >
              {/* PIX QR Code */}
              {pixQrCode ? (
                <Card>
                  <View style={styles.pixContainer}>
                    <Ionicons name="qr-code" size={48} color={colors.primary[500]} />
                    <Text variant="h5" weight="semibold" style={{ marginTop: spacing[3] }}>
                      PIX Gerado!
                    </Text>
                    <Text variant="body" color="secondary" align="center" style={{ marginTop: spacing[2] }}>
                      Escaneie o QR Code ou copie o código abaixo para pagar
                    </Text>
                    <TouchableOpacity
                      style={[styles.copyButton, { backgroundColor: colors.primary[50] }]}
                      onPress={() => {
                        Alert.alert('Copiado!', 'Código PIX copiado para a área de transferência');
                      }}
                    >
                      <Text variant="caption" style={{ color: colors.primary[600] }} numberOfLines={2}>
                        {pixCopyPaste?.substring(0, 50)}...
                      </Text>
                      <Ionicons name="copy-outline" size={20} color={colors.primary[500]} />
                    </TouchableOpacity>
                    <Button
                      variant="outline"
                      onPress={() => {
                        setPixQrCode(null);
                        setPixCopyPaste(null);
                      }}
                      style={{ marginTop: spacing[4] }}
                    >
                      Gerar Novo PIX
                    </Button>
                  </View>
                </Card>
              ) : (
                <>
                  {/* Payment Method Selection */}
                  <View style={styles.paymentMethodSelector}>
                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        { borderColor: paymentMethod === 'pix' ? colors.primary[500] : colors.border.medium },
                        paymentMethod === 'pix' && { backgroundColor: colors.primary[50] },
                      ]}
                      onPress={() => setPaymentMethod('pix')}
                    >
                      <Ionicons
                        name="qr-code-outline"
                        size={24}
                        color={paymentMethod === 'pix' ? colors.primary[500] : colors.text.secondary}
                      />
                      <Text
                        variant="body"
                        weight={paymentMethod === 'pix' ? 'semibold' : 'regular'}
                        style={{ color: paymentMethod === 'pix' ? colors.primary[600] : colors.text.secondary }}
                      >
                        PIX
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        { borderColor: paymentMethod === 'credit_card' ? colors.primary[500] : colors.border.medium },
                        paymentMethod === 'credit_card' && { backgroundColor: colors.primary[50] },
                      ]}
                      onPress={() => setPaymentMethod('credit_card')}
                    >
                      <Ionicons
                        name="card-outline"
                        size={24}
                        color={paymentMethod === 'credit_card' ? colors.primary[500] : colors.text.secondary}
                      />
                      <Text
                        variant="body"
                        weight={paymentMethod === 'credit_card' ? 'semibold' : 'regular'}
                        style={{ color: paymentMethod === 'credit_card' ? colors.primary[600] : colors.text.secondary }}
                      >
                        Cartão
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Common Fields */}
                  <Card style={{ marginTop: spacing[4] }}>
                    <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
                      Dados de Cobrança
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text variant="caption" weight="medium" color="secondary">
                        CPF/CNPJ *
                      </Text>
                      <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                        <TextInput
                          style={[styles.input, { color: colors.text.primary }]}
                          placeholder="000.000.000-00"
                          placeholderTextColor={colors.text.tertiary}
                          value={cpfCnpj}
                          onChangeText={(text) => setCpfCnpj(formatCPF(text))}
                          keyboardType="numeric"
                          maxLength={14}
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                      <Text variant="caption" weight="medium" color="secondary">
                        Telefone
                      </Text>
                      <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
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

                  {/* Credit Card Fields */}
                  {paymentMethod === 'credit_card' && (
                    <Card style={{ marginTop: spacing[4] }}>
                      <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
                        Dados do Cartão
                      </Text>

                      <View style={styles.inputGroup}>
                        <Text variant="caption" weight="medium" color="secondary">
                          Nome no Cartão *
                        </Text>
                        <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                          <TextInput
                            style={[styles.input, { color: colors.text.primary }]}
                            placeholder="Nome como está no cartão"
                            placeholderTextColor={colors.text.tertiary}
                            value={cardName}
                            onChangeText={setCardName}
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>

                      <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                        <Text variant="caption" weight="medium" color="secondary">
                          Número do Cartão *
                        </Text>
                        <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                          <TextInput
                            style={[styles.input, { color: colors.text.primary }]}
                            placeholder="0000 0000 0000 0000"
                            placeholderTextColor={colors.text.tertiary}
                            value={cardNumber}
                            onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                            keyboardType="numeric"
                            maxLength={19}
                          />
                        </View>
                      </View>

                      <View style={[styles.row, { marginTop: spacing[3] }]}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <Text variant="caption" weight="medium" color="secondary">
                            Validade *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                            <TextInput
                              style={[styles.input, { color: colors.text.primary }]}
                              placeholder="MM/AA"
                              placeholderTextColor={colors.text.tertiary}
                              value={cardExpiry}
                              onChangeText={(text) => setCardExpiry(formatExpiry(text))}
                              keyboardType="numeric"
                              maxLength={5}
                            />
                          </View>
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[3] }]}>
                          <Text variant="caption" weight="medium" color="secondary">
                            CVV *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                            <TextInput
                              style={[styles.input, { color: colors.text.primary }]}
                              placeholder="000"
                              placeholderTextColor={colors.text.tertiary}
                              value={cardCvv}
                              onChangeText={setCardCvv}
                              keyboardType="numeric"
                              maxLength={4}
                              secureTextEntry
                            />
                          </View>
                        </View>
                      </View>

                      <View style={[styles.row, { marginTop: spacing[3] }]}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <Text variant="caption" weight="medium" color="secondary">
                            CEP *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                            <TextInput
                              style={[styles.input, { color: colors.text.primary }]}
                              placeholder="00000-000"
                              placeholderTextColor={colors.text.tertiary}
                              value={postalCode}
                              onChangeText={(text) => setPostalCode(formatCEP(text))}
                              keyboardType="numeric"
                              maxLength={9}
                            />
                          </View>
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing[3] }]}>
                          <Text variant="caption" weight="medium" color="secondary">
                            Número *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.medium }]}>
                            <TextInput
                              style={[styles.input, { color: colors.text.primary }]}
                              placeholder="Nº"
                              placeholderTextColor={colors.text.tertiary}
                              value={addressNumber}
                              onChangeText={setAddressNumber}
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    </Card>
                  )}

                  {/* Price Summary */}
                  <Card style={{ marginTop: spacing[4] }}>
                    <View style={styles.priceSummary}>
                      <Text variant="body" color="secondary">
                        Plano Profissional
                      </Text>
                      <Text variant="h4" weight="bold" style={{ color: colors.primary[600] }}>
                        R$ {proPlan?.price?.toFixed(2).replace('.', ',')}/mês
                      </Text>
                    </View>
                  </Card>

                  {/* Submit Button */}
                  <Button
                    variant="primary"
                    onPress={paymentMethod === 'pix' ? handleCheckoutPix : handleCheckoutCreditCard}
                    loading={isProcessing}
                    style={{ marginTop: spacing[4] }}
                  >
                    {paymentMethod === 'pix' ? 'Gerar PIX' : 'Pagar com Cartão'}
                  </Button>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  currentPlanCard: {
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
    marginLeft: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  usageRow: {},
  usageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  comparePlanCard: {
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  currentPlanBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    alignItems: 'center',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparePlanHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  comparePlanFeatures: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  paymentMethodSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  inputGroup: {},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
  },
  priceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pixContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: '100%',
  },
});
