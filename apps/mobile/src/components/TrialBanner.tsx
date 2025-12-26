/**
 * TrialBanner Component
 *
 * Faixa fixa que mostra os dias restantes do trial.
 * Exibida em todas as telas quando o usuário está no período de teste.
 *
 * Cores:
 * - Roxo (normal): mais de 7 dias
 * - Amarelo (warning): 7 dias ou menos
 * - Vermelho (urgent): 3 dias ou menos
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../design-system';
import { useColors } from '../design-system/ThemeProvider';
import { spacing, borderRadius, zIndex } from '../design-system/tokens';
import {
  BillingStatus,
  BillingService,
  calculateTrialDaysRemaining,
} from '../services/BillingService';
import { useTranslation } from '../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface TrialBannerProps {
  /** If provided, uses this data instead of fetching */
  billing?: BillingStatus | null;
  /** Callback when banner is dismissed */
  onDismiss?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TrialBanner({ billing: propBilling, onDismiss }: TrialBannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [billing, setBilling] = useState<BillingStatus | null>(propBilling || null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(!propBilling);

  // Fetch billing status if not provided via props
  useEffect(() => {
    if (propBilling !== undefined) {
      setBilling(propBilling);
      return;
    }

    let mounted = true;

    const fetchBilling = async () => {
      try {
        const status = await BillingService.getBillingStatus();
        if (mounted) {
          setBilling(status);
          setLoading(false);
        }
      } catch (error) {
        console.error('[TrialBanner] Error fetching billing:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchBilling();

    return () => {
      mounted = false;
    };
  }, [propBilling]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  const handleSubscribe = useCallback(() => {
    // Open web settings page for subscription
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3000';
    Linking.openURL(`${webUrl}/settings/plan`);
  }, []);

  // Don't show if:
  // - Loading
  // - Not on trial
  // - Dismissed
  // - No billing data
  if (loading || dismissed || !billing) {
    return null;
  }

  if (billing.subscriptionStatus !== 'TRIALING') {
    return null;
  }

  // Calculate days remaining
  const daysRemaining = billing.trialDaysRemaining ??
    calculateTrialDaysRemaining(billing.trialEndAt);

  // Determine urgency level
  const isUrgent = daysRemaining <= 3;
  const isWarning = daysRemaining <= 7 && !isUrgent;

  // Colors based on urgency
  const getBannerColors = () => {
    if (isUrgent) {
      return {
        background: colors.error[500],
        text: colors.white,
        iconColor: colors.white,
        buttonBg: colors.white,
        buttonText: colors.error[600],
      };
    }
    if (isWarning) {
      return {
        background: colors.warning[500],
        text: colors.warning[900],
        iconColor: colors.warning[900],
        buttonBg: colors.warning[900],
        buttonText: colors.white,
      };
    }
    // Normal - purple
    return {
      background: colors.primary[600],
      text: colors.white,
      iconColor: colors.white,
      buttonBg: colors.white,
      buttonText: colors.primary[700],
    };
  };

  const bannerColors = getBannerColors();

  // Message based on days remaining
  const getMessage = () => {
    if (daysRemaining <= 0) {
      return t('billing.trialEnded');
    }
    if (daysRemaining === 1) {
      return t('billing.lastTrialDay');
    }
    return t('billing.trialDaysRemaining', { days: daysRemaining });
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bannerColors.background,
          paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + spacing[1],
        },
      ]}
    >
      <View style={styles.content}>
        {/* Icon */}
        <Ionicons
          name={isUrgent ? 'warning' : 'time-outline'}
          size={18}
          color={bannerColors.iconColor}
          style={styles.icon}
        />

        {/* Message */}
        <Text
          variant="bodySmall"
          weight="medium"
          style={[styles.message, { color: bannerColors.text }]}
          numberOfLines={1}
        >
          {getMessage()}
        </Text>

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            { backgroundColor: bannerColors.buttonBg },
          ]}
          onPress={handleSubscribe}
          activeOpacity={0.8}
        >
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: bannerColors.buttonText }}
          >
            {t('billing.subscribe')}
          </Text>
        </TouchableOpacity>

        {/* Dismiss Button */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={bannerColors.iconColor} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    zIndex: zIndex.banner,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 44,
  },
  icon: {
    marginRight: spacing[2],
  },
  message: {
    flex: 1,
  },
  subscribeButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    marginLeft: spacing[2],
  },
  dismissButton: {
    padding: spacing[1],
    marginLeft: spacing[1],
  },
});

export default TrialBanner;
