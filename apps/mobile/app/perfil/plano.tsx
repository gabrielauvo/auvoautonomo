/**
 * Plan Management Screen
 *
 * Tela de gestão do plano - upgrade, downgrade e cancelamento
 *
 * Modelo de Planos:
 * - TRIAL: 14 dias grátis com tudo liberado
 * - PRO: R$ 99,90/mês ou R$ 89,90/mês (anual)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import {
  PRO_PLAN_PRICING,
  TRIAL_DURATION_DAYS,
  calculateTrialDaysRemaining,
  BillingPeriod,
} from '../../src/services/BillingService';
import { useTranslation, useLocale } from '../../src/i18n';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAN_CARD_WIDTH = SCREEN_WIDTH * 0.75;

interface SubscriptionData {
  planKey: 'FREE' | 'PRO';
  planName: string;
  subscriptionStatus: 'FREE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'BLOCKED' | 'EXPIRED';
  billingPeriod?: BillingPeriod;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndAt?: string | null;
  trialDaysRemaining?: number;
  cancelAtPeriodEnd?: boolean;
  createdAt?: string;
  usage?: {
    clients: number;
    quotes: number;
    workOrders: number;
    payments: number;
  };
  limits?: {
    maxClients: number | null;
    maxQuotes: number | null;
    maxWorkOrders: number | null;
    maxInvoices: number | null;
  };
  paymentMethod?: string;
  creditCardLastFour?: string;
  creditCardBrand?: string;
}

// Feature keys for plan comparison (labels are translated in component)

export default function PlanoScreen() {
  const colors = useColors();
  const spacing = useSpacing();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const plansScrollRef = useRef<ScrollView>(null);

  // Translated plan features
  const PLAN_FEATURES = useMemo(() => [
    { key: 'clients', label: t('billing.features.clients'), freeLimit: 10, proLimit: null },
    { key: 'quotes', label: t('billing.features.quotes'), freeLimit: 10, proLimit: null },
    { key: 'workOrders', label: t('billing.features.workOrders'), freeLimit: 10, proLimit: null },
    { key: 'invoices', label: t('billing.features.invoices'), freeLimit: 5, proLimit: null },
    { key: 'templates', label: t('billing.features.customTemplates'), freeLimit: false, proLimit: true },
    { key: 'reports', label: t('billing.features.advancedReports'), freeLimit: false, proLimit: true },
    { key: 'support', label: t('billing.features.prioritySupport'), freeLimit: false, proLimit: true },
  ], [t, locale]);

  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<BillingPeriod>('YEARLY');

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

      // Load billing plan status
      const subRes = await fetch(`${API_URL}/billing/plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
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
      Alert.alert(t('common.error'), t('billing.checkout.cpfCnpjRequired'));
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
          billingPeriod: selectedBillingPeriod,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPixQrCode(data.pixQrCode);
        setPixCopyPaste(data.pixCopyPaste);
      } else {
        Alert.alert(t('common.error'), data.message || t('billing.checkout.pixGenerationError'));
      }
    } catch (error) {
      console.error('[Plano] Error generating PIX:', error);
      Alert.alert(t('common.error'), t('billing.checkout.pixGenerationError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutCreditCard = async () => {
    // Validações
    if (!cpfCnpj.trim()) {
      Alert.alert(t('common.error'), t('billing.checkout.cpfCnpjRequired'));
      return;
    }
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 13) {
      Alert.alert(t('common.error'), t('billing.checkout.invalidCardNumber'));
      return;
    }
    if (!cardExpiry.trim() || cardExpiry.length < 5) {
      Alert.alert(t('common.error'), t('billing.checkout.invalidExpiry'));
      return;
    }
    if (!cardCvv.trim() || cardCvv.length < 3) {
      Alert.alert(t('common.error'), t('billing.checkout.invalidCvv'));
      return;
    }
    if (!cardName.trim()) {
      Alert.alert(t('common.error'), t('billing.checkout.cardNameRequired'));
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
          billingPeriod: selectedBillingPeriod,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(t('common.success'), t('billing.checkout.paymentApproved'), [
          {
            text: 'OK',
            onPress: () => {
              setShowUpgradeModal(false);
              loadData();
            },
          },
        ]);
      } else {
        Alert.alert(t('common.error'), data.errorMessage || data.message || t('billing.checkout.paymentNotApproved'));
      }
    } catch (error) {
      console.error('[Plano] Error processing card:', error);
      Alert.alert(t('common.error'), t('billing.checkout.paymentError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      t('billing.cancelConfirmTitle'),
      t('billing.cancelConfirmMessage'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('billing.yesCancel'),
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
                Alert.alert(t('billing.subscriptionCancelled'), data.message);
                loadData();
              } else {
                Alert.alert(t('common.error'), data.message || t('billing.cancelError'));
              }
            } catch (error) {
              Alert.alert(t('common.error'), t('billing.cancelError'));
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
    if (limit === null || limit === undefined || limit === -1) return t('billing.unlimited');
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

  // Status calculations
  const status = subscription?.subscriptionStatus || 'TRIALING';
  const isTrialing = status === 'TRIALING';
  const isPro = status === 'ACTIVE';
  const isExpired = status === 'EXPIRED' || status === 'CANCELED';

  // Trial days remaining
  const trialDaysRemaining = subscription?.trialEndAt
    ? calculateTrialDaysRemaining(subscription.trialEndAt)
    : subscription?.trialDaysRemaining || 0;

  // Price based on selected billing period
  const selectedPrice = selectedBillingPeriod === 'YEARLY'
    ? PRO_PLAN_PRICING.YEARLY
    : PRO_PLAN_PRICING.MONTHLY;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text variant="h4" weight="semibold">
          {t('billing.planTitle')}
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
            <View style={[styles.planIconContainer, { backgroundColor: isPro ? colors.primary[100] : isTrialing ? colors.warning[100] : colors.gray[100] }]}>
              <Ionicons
                name={isPro ? 'star' : isTrialing ? 'time-outline' : 'star-outline'}
                size={28}
                color={isPro ? colors.primary[500] : isTrialing ? colors.warning[500] : colors.gray[500]}
              />
            </View>
            <View style={styles.planInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="h4" weight="bold">
                  {isPro ? t('billing.proPlan') : isTrialing ? t('billing.trialPeriod') : t('billing.expiredPlan')}
                </Text>
                <Badge variant={isPro ? 'primary' : isTrialing ? 'warning' : 'error'} size="sm">
                  {isPro ? 'PRO' : isTrialing ? t('billing.daysRemaining', { days: trialDaysRemaining }) : t('billing.expired')}
                </Badge>
              </View>
              <Text variant="body" color="secondary">
                {isPro
                  ? `R$ ${selectedPrice.toFixed(2).replace('.', ',')}/${t('billing.perMonth')}`
                  : isTrialing
                    ? t('billing.trialDescription')
                    : t('billing.subscribeToAccess')}
              </Text>
            </View>
          </View>

          {/* Trial Alert */}
          {isTrialing && trialDaysRemaining <= 3 && (
            <View style={[styles.statusBadge, { backgroundColor: colors.warning[50], marginTop: spacing[3] }]}>
              <Ionicons name="warning" size={18} color={colors.warning[500]} />
              <Text variant="caption" weight="medium" style={{ color: colors.warning[700], marginLeft: 6, flex: 1 }}>
                {trialDaysRemaining === 0
                  ? t('billing.trialEndsTodayAlert')
                  : t('billing.trialEndsInDaysAlert', { days: trialDaysRemaining })}
              </Text>
            </View>
          )}

          {/* Status for Active Subscription */}
          {isPro && subscription?.currentPeriodEnd && (
            <View style={[styles.statusBadge, { backgroundColor: colors.success[50], marginTop: spacing[3] }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
              <Text variant="caption" weight="medium" style={{ color: colors.success[700], marginLeft: 6 }}>
                {t('billing.nextBilling')}: {new Date(subscription.currentPeriodEnd).toLocaleDateString(locale)}
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
                  ? `${t('billing.checkout.card')} ${subscription.creditCardBrand || ''} •••• ${subscription.creditCardLastFour || ''}`
                  : 'PIX'}
              </Text>
            </View>
          )}
        </Card>

        {/* Usage Section - Show for trialing and active users */}
        {(isTrialing || isPro) && (
          <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
            <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
              {t('billing.planUsage')}
            </Text>
            <Card>
              {[
                { label: t('billing.features.clients'), value: subscription?.usage?.clients || 0, limit: (isTrialing || isPro) ? null : subscription?.limits?.maxClients },
                { label: t('billing.features.quotes'), value: subscription?.usage?.quotes || 0, limit: (isTrialing || isPro) ? null : subscription?.limits?.maxQuotes },
                { label: t('billing.features.workOrders'), value: subscription?.usage?.workOrders || 0, limit: (isTrialing || isPro) ? null : subscription?.limits?.maxWorkOrders },
                { label: t('billing.features.invoices'), value: subscription?.usage?.payments || 0, limit: (isTrialing || isPro) ? null : subscription?.limits?.maxInvoices },
              ].map((item, index) => {
                const limitText = formatLimit(item.limit);
                const isUnlimited = limitText === t('billing.unlimited');

                return (
                  <View key={item.label} style={[styles.usageRow, index > 0 && { marginTop: spacing[3] }]}>
                    <View style={styles.usageInfo}>
                      <Text variant="body" color="secondary">
                        {item.label}
                      </Text>
                      <Text variant="body" weight="semibold" style={{ color: colors.text.primary }}>
                        / {limitText}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Compare Plans - Horizontal Scroll */}
        <View style={{ marginTop: spacing[6] }}>
          <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3], paddingHorizontal: spacing[4] }}>
            {t('billing.availablePlans')}
          </Text>
          <Text variant="caption" color="tertiary" style={{ marginBottom: spacing[3], paddingHorizontal: spacing[4] }}>
            {t('billing.swipeToSeePlans')}
          </Text>

          <ScrollView
            ref={plansScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing[4], gap: spacing[3] }}
            decelerationRate="fast"
            snapToInterval={PLAN_CARD_WIDTH + spacing[3]}
          >
            {/* Pro Plan Card - Monthly */}
            <View
              style={[
                styles.comparePlanCard,
                {
                  width: PLAN_CARD_WIDTH,
                  backgroundColor: colors.background.primary,
                  borderColor: selectedBillingPeriod === 'MONTHLY' ? colors.primary[500] : colors.border.light,
                  borderWidth: selectedBillingPeriod === 'MONTHLY' ? 2 : 1,
                },
              ]}
            >
              <View style={styles.comparePlanHeader}>
                <Ionicons name="calendar-outline" size={32} color={colors.primary[500]} />
                <Text variant="h5" weight="bold" style={{ marginTop: spacing[2] }}>
                  {t('billing.monthlyPlan')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing[1] }}>
                  <Text variant="h3" weight="bold" style={{ color: colors.primary[600] }}>
                    R$ {PRO_PLAN_PRICING.MONTHLY.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text variant="caption" color="secondary">/{t('billing.perMonth')}</Text>
                </View>
                <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                  {t('billing.billedMonthly')}
                </Text>
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
                        {t('billing.unlimited')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {!isPro && (
                <Button
                  variant={selectedBillingPeriod === 'MONTHLY' ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => {
                    setSelectedBillingPeriod('MONTHLY');
                    handleUpgrade();
                  }}
                  style={{ marginTop: spacing[4] }}
                >
                  {t('billing.subscribeMonthly')}
                </Button>
              )}
            </View>

            {/* Pro Plan Card - Yearly */}
            <View
              style={[
                styles.comparePlanCard,
                {
                  width: PLAN_CARD_WIDTH,
                  backgroundColor: colors.background.primary,
                  borderColor: isPro || selectedBillingPeriod === 'YEARLY' ? colors.primary[500] : colors.primary[300],
                  borderWidth: isPro || selectedBillingPeriod === 'YEARLY' ? 2 : 1,
                },
              ]}
            >
              <View style={[styles.popularBadge, { backgroundColor: colors.primary[500] }]}>
                <Ionicons name="trending-up" size={12} color="#FFF" />
                <Text variant="caption" weight="semibold" style={{ color: '#FFF', marginLeft: 4 }}>
                  {isPro ? t('billing.currentPlan') : t('billing.mostPopular')}
                </Text>
              </View>

              <View style={styles.comparePlanHeader}>
                <Ionicons name="star" size={32} color={colors.primary[500]} />
                <Text variant="h5" weight="bold" style={{ marginTop: spacing[2] }}>
                  {t('billing.yearlyPlan')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: spacing[1] }}>
                  <Text variant="h3" weight="bold" style={{ color: colors.primary[600] }}>
                    R$ {PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text variant="caption" color="secondary">/{t('billing.perMonth')}</Text>
                </View>
                <Text variant="caption" color="tertiary" style={{ marginTop: spacing[1] }}>
                  R$ {PRO_PLAN_PRICING.YEARLY_TOTAL.toFixed(2).replace('.', ',')} {t('billing.billedYearly')}
                </Text>
                <View style={{ marginTop: spacing[2] }}>
                  <Badge variant="success" size="sm">
                    {`${t('billing.save')} R$ ${PRO_PLAN_PRICING.YEARLY_SAVINGS.toFixed(2).replace('.', ',')}`}
                  </Badge>
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
                        {t('billing.unlimited')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>

              {!isPro && (
                <Button
                  variant={selectedBillingPeriod === 'YEARLY' ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => {
                    setSelectedBillingPeriod('YEARLY');
                    handleUpgrade();
                  }}
                  style={{ marginTop: spacing[4] }}
                >
                  {t('billing.subscribeYearly')}
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
                {t('billing.cancelSubscription')}
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
              {t('billing.checkout.upgradeToPro')}
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
                      {t('billing.checkout.pixGenerated')}
                    </Text>
                    <Text variant="body" color="secondary" align="center" style={{ marginTop: spacing[2] }}>
                      {t('billing.checkout.scanOrCopyPix')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.copyButton, { backgroundColor: colors.primary[50] }]}
                      onPress={() => {
                        Alert.alert(t('billing.checkout.copied'), t('billing.checkout.pixCodeCopied'));
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
                      {t('billing.checkout.generateNewPix')}
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
                        { borderColor: paymentMethod === 'pix' ? colors.primary[500] : colors.border.default },
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
                        weight={paymentMethod === 'pix' ? 'semibold' : 'normal'}
                        style={{ color: paymentMethod === 'pix' ? colors.primary[600] : colors.text.secondary }}
                      >
                        PIX
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.paymentMethodOption,
                        { borderColor: paymentMethod === 'credit_card' ? colors.primary[500] : colors.border.default },
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
                        weight={paymentMethod === 'credit_card' ? 'semibold' : 'normal'}
                        style={{ color: paymentMethod === 'credit_card' ? colors.primary[600] : colors.text.secondary }}
                      >
                        {t('billing.checkout.card')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Common Fields */}
                  <Card style={{ marginTop: spacing[4] }}>
                    <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
                      {t('billing.checkout.billingData')}
                    </Text>

                    <View style={styles.inputGroup}>
                      <Text variant="caption" weight="medium" color="secondary">
                        {t('billing.checkout.cpfCnpj')} *
                      </Text>
                      <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                        {t('billing.checkout.phone')}
                      </Text>
                      <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                        {t('billing.checkout.cardData')}
                      </Text>

                      <View style={styles.inputGroup}>
                        <Text variant="caption" weight="medium" color="secondary">
                          {t('billing.checkout.cardName')} *
                        </Text>
                        <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
                          <TextInput
                            style={[styles.input, { color: colors.text.primary }]}
                            placeholder={t('billing.checkout.cardNamePlaceholder')}
                            placeholderTextColor={colors.text.tertiary}
                            value={cardName}
                            onChangeText={setCardName}
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>

                      <View style={[styles.inputGroup, { marginTop: spacing[3] }]}>
                        <Text variant="caption" weight="medium" color="secondary">
                          {t('billing.checkout.cardNumber')} *
                        </Text>
                        <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                            {t('billing.checkout.expiry')} *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                            {t('billing.checkout.cvv')} *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                            {t('billing.checkout.postalCode')} *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
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
                            {t('billing.checkout.addressNumber')} *
                          </Text>
                          <View style={[styles.inputContainer, { borderColor: colors.border.default }]}>
                            <TextInput
                              style={[styles.input, { color: colors.text.primary }]}
                              placeholder={t('billing.checkout.numberAbbrev')}
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

                  {/* Billing Period Selection */}
                  <Card style={{ marginTop: spacing[4] }}>
                    <Text variant="body" weight="semibold" style={{ marginBottom: spacing[3] }}>
                      {t('billing.checkout.billingPeriod')}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                      <TouchableOpacity
                        style={[
                          styles.billingPeriodOption,
                          {
                            flex: 1,
                            borderColor: selectedBillingPeriod === 'MONTHLY' ? colors.primary[500] : colors.border.default,
                            backgroundColor: selectedBillingPeriod === 'MONTHLY' ? colors.primary[50] : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedBillingPeriod('MONTHLY')}
                      >
                        <Text
                          variant="body"
                          weight={selectedBillingPeriod === 'MONTHLY' ? 'semibold' : 'normal'}
                          style={{ color: selectedBillingPeriod === 'MONTHLY' ? colors.primary[600] : colors.text.secondary }}
                        >
                          {t('billing.monthlyPlan')}
                        </Text>
                        <Text variant="caption" color="tertiary">
                          R$ {PRO_PLAN_PRICING.MONTHLY.toFixed(2).replace('.', ',')}/${t('billing.perMonth')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.billingPeriodOption,
                          {
                            flex: 1,
                            borderColor: selectedBillingPeriod === 'YEARLY' ? colors.primary[500] : colors.border.default,
                            backgroundColor: selectedBillingPeriod === 'YEARLY' ? colors.primary[50] : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedBillingPeriod('YEARLY')}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text
                            variant="body"
                            weight={selectedBillingPeriod === 'YEARLY' ? 'semibold' : 'normal'}
                            style={{ color: selectedBillingPeriod === 'YEARLY' ? colors.primary[600] : colors.text.secondary }}
                          >
                            {t('billing.yearlyPlan')}
                          </Text>
                          <Badge variant="success" size="sm">-10%</Badge>
                        </View>
                        <Text variant="caption" color="tertiary">
                          R$ {PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',')}/${t('billing.perMonth')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Card>

                  {/* Price Summary */}
                  <Card style={{ marginTop: spacing[4] }}>
                    <View style={styles.priceSummary}>
                      <Text variant="body" color="secondary">
                        {t('billing.proPlan')} ({selectedBillingPeriod === 'YEARLY' ? t('billing.yearlyPlan') : t('billing.monthlyPlan')})
                      </Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="h4" weight="bold" style={{ color: colors.primary[600] }}>
                          R$ {selectedBillingPeriod === 'YEARLY' ? PRO_PLAN_PRICING.YEARLY.toFixed(2).replace('.', ',') : PRO_PLAN_PRICING.MONTHLY.toFixed(2).replace('.', ',')}/${t('billing.perMonth')}
                        </Text>
                        {selectedBillingPeriod === 'YEARLY' && (
                          <Text variant="caption" color="tertiary">
                            {t('common.total')}: R$ {PRO_PLAN_PRICING.YEARLY_TOTAL.toFixed(2).replace('.', ',')} {t('billing.billedYearly')}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Card>

                  {/* Submit Button */}
                  <Button
                    variant="primary"
                    onPress={paymentMethod === 'pix' ? handleCheckoutPix : handleCheckoutCreditCard}
                    loading={isProcessing}
                    style={{ marginTop: spacing[4] }}
                  >
                    {paymentMethod === 'pix' ? t('billing.checkout.generatePix') : t('billing.checkout.payWithCard')}
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
  billingPeriodOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
});
