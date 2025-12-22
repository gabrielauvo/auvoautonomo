/**
 * ChargeDetailScreen
 *
 * Tela de detalhes de uma cobrança.
 * Exibe informações completas e ações disponíveis.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { Divider } from '../../design-system';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { useTranslation } from '../../i18n';
import { ChargeService } from './ChargeService';
import type { Charge, ChargeStatus, BillingType } from './types';
import {
  chargeStatusLabels,
  billingTypeLabels,
  canCancelCharge,
  canRegisterManualPayment,
  isChargePaid,
} from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface ChargeDetailScreenProps {
  chargeId: string;
  onBack?: () => void;
  onChargeUpdated?: (charge: Charge) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: ChargeStatus, colors: ThemeColors): string {
  const statusColors: Record<ChargeStatus, string> = {
    PENDING: colors.warning[500],
    OVERDUE: colors.error[500],
    CONFIRMED: colors.success[500],
    RECEIVED: colors.success[600],
    RECEIVED_IN_CASH: colors.success[500],
    REFUNDED: colors.gray[500],
    CANCELED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: ChargeStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'CONFIRMED':
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return 'success';
    case 'OVERDUE':
    case 'CANCELED':
      return 'error';
    case 'PENDING':
      return 'warning';
    default:
      return 'default';
  }
}

function getBillingTypeIcon(type: BillingType): string {
  switch (type) {
    case 'PIX':
      return 'qr-code-outline';
    case 'BOLETO':
      return 'document-text-outline';
    case 'CREDIT_CARD':
      return 'card-outline';
    default:
      return 'help-circle-outline';
  }
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

function isOverdue(charge: Charge): boolean {
  if (charge.status !== 'PENDING') return false;
  const dueDate = new Date(charge.dueDate);
  return dueDate < new Date();
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ChargeDetailScreen: React.FC<ChargeDetailScreenProps> = ({
  chargeId,
  onBack,
  onChargeUpdated,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load charge details
  const loadCharge = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await ChargeService.getChargeById(chargeId);
      setCharge(data);
    } catch (err) {
      console.error('Error loading charge:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar cobrança');
    } finally {
      setLoading(false);
    }
  }, [chargeId]);

  useEffect(() => {
    loadCharge();
  }, [loadCharge]);

  // Share payment link
  const handleSharePayment = useCallback(async () => {
    if (!charge) return;

    const paymentUrl = charge.urls?.invoiceUrl;
    if (!paymentUrl) {
      Alert.alert('Erro', 'Link de pagamento não disponível');
      return;
    }

    const message = `Olá! Segue o link para pagamento da cobrança de ${formatCurrency(charge.value, locale)}:\n\n${paymentUrl}`;

    try {
      await Share.share({
        message,
        url: paymentUrl,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  }, [charge, locale]);

  // Open payment URL
  const handleOpenPaymentUrl = useCallback(async () => {
    if (!charge?.urls?.invoiceUrl) return;

    try {
      await Linking.openURL(charge.urls.invoiceUrl);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível abrir o link de pagamento');
    }
  }, [charge]);

  // Copy PIX code
  const handleCopyPixCode = useCallback(() => {
    if (!charge?.urls?.pixCopiaECola) return;

    Clipboard.setString(charge.urls.pixCopiaECola);
    Alert.alert('Copiado!', 'Código PIX copiado para a área de transferência');
  }, [charge]);

  // Open bank slip
  const handleOpenBankSlip = useCallback(async () => {
    if (!charge?.urls?.bankSlipUrl) return;

    try {
      await Linking.openURL(charge.urls.bankSlipUrl);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível abrir o boleto');
    }
  }, [charge]);

  // Register manual payment
  const handleManualPayment = useCallback(() => {
    if (!charge) return;

    Alert.alert(
      'Registrar Pagamento Manual',
      `Confirmar recebimento de ${formatCurrency(charge.value, locale)}?\n\nO pagamento será registrado como "Recebido em Dinheiro".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Recebimento',
          onPress: async () => {
            try {
              setActionLoading(true);
              const updatedCharge = await ChargeService.registerManualPayment(charge.id, {
                paymentDate: new Date().toISOString(),
                value: charge.value,
                paymentMethod: 'Dinheiro',
              });
              setCharge(updatedCharge);
              onChargeUpdated?.(updatedCharge);
              Alert.alert('Sucesso', 'Pagamento registrado com sucesso!');
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao registrar pagamento');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [charge, locale, onChargeUpdated]);

  // Cancel charge
  const handleCancelCharge = useCallback(() => {
    if (!charge) return;

    Alert.alert(
      'Cancelar Cobrança',
      'Tem certeza que deseja cancelar esta cobrança? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const updatedCharge = await ChargeService.cancelCharge(charge.id, {
                reason: 'Cancelado pelo usuário',
              });
              setCharge(updatedCharge);
              onChargeUpdated?.(updatedCharge);
              Alert.alert('Sucesso', 'Cobrança cancelada com sucesso!');
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao cancelar cobrança');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [charge, onChargeUpdated]);

  // Resend email
  const handleResendEmail = useCallback(async () => {
    if (!charge) return;

    try {
      setActionLoading(true);
      await ChargeService.resendChargeEmail(charge.id);
      Alert.alert('Sucesso', 'Email reenviado com sucesso!');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao reenviar email');
    } finally {
      setActionLoading(false);
    }
  }, [charge]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background.secondary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  // Error state
  if (error || !charge) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background.secondary }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[400]} />
        <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing[4] }}>
          {error || 'Cobrança não encontrada'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary[600] }]}
          onPress={loadCharge}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.white }}>
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const overdue = isOverdue(charge);
  const paid = isChargePaid(charge);
  const canCancel = canCancelCharge(charge);
  const canManualPay = canRegisterManualPayment(charge);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background.secondary }]}
      contentContainerStyle={styles.scrollContent}
    >
      {actionLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      )}

      {/* Main Info Card */}
      <Card variant="elevated" style={styles.mainCard}>
        <View style={styles.statusRow}>
          <Badge
            label={overdue ? 'Vencida' : chargeStatusLabels[charge.status]}
            variant={overdue ? 'error' : getStatusBadgeVariant(charge.status)}
          />
          <View style={styles.billingType}>
            <Ionicons name={getBillingTypeIcon(charge.billingType) as any} size={18} color={colors.text.secondary} />
            <Text variant="bodySmall" color="secondary" style={{ marginLeft: 4 }}>
              {billingTypeLabels[charge.billingType]}
            </Text>
          </View>
        </View>

        <Text variant="h2" weight="bold" style={[
          styles.value,
          { color: paid ? colors.success[600] : colors.text.primary }
        ]}>
          {formatCurrency(charge.value, locale)}
        </Text>

        {charge.description && (
          <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>
            {charge.description}
          </Text>
        )}

        <Divider style={{ marginVertical: spacing[4] }} />

        {/* Client Info */}
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color={colors.text.tertiary} />
          <View style={styles.infoContent}>
            <Text variant="caption" color="tertiary">Cliente</Text>
            <Text variant="body" weight="medium">{charge.client?.name || 'N/A'}</Text>
            {charge.client?.email && (
              <Text variant="bodySmall" color="secondary">{charge.client.email}</Text>
            )}
          </View>
        </View>

        {/* Due Date */}
        <View style={styles.infoRow}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={overdue ? colors.error[500] : colors.text.tertiary}
          />
          <View style={styles.infoContent}>
            <Text variant="caption" color={overdue ? 'error' : 'tertiary'}>
              Vencimento
            </Text>
            <Text
              variant="body"
              weight="medium"
              style={{ color: overdue ? colors.error[600] : colors.text.primary }}
            >
              {formatDate(charge.dueDate, locale)}
            </Text>
          </View>
        </View>

        {/* Payment Date (if paid) */}
        {charge.paymentDate && (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.success[500]} />
            <View style={styles.infoContent}>
              <Text variant="caption" color="tertiary">Pago em</Text>
              <Text variant="body" weight="medium" style={{ color: colors.success[600] }}>
                {formatDate(charge.paymentDate, locale)}
              </Text>
            </View>
          </View>
        )}

        {/* Created Date */}
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color={colors.text.tertiary} />
          <View style={styles.infoContent}>
            <Text variant="caption" color="tertiary">Criada em</Text>
            <Text variant="body" weight="medium">{formatDate(charge.createdAt, locale)}</Text>
          </View>
        </View>
      </Card>

      {/* Payment Actions (only if not paid) */}
      {!paid && (
        <Card variant="elevated" style={styles.actionsCard}>
          <Text variant="h6" weight="semibold" style={{ marginBottom: spacing[3] }}>
            Ações de Pagamento
          </Text>

          {/* Share Payment Link */}
          {charge.urls?.invoiceUrl && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary[50] }]}
              onPress={handleSharePayment}
            >
              <Ionicons name="share-outline" size={22} color={colors.primary[600]} />
              <Text variant="body" weight="medium" style={{ color: colors.primary[600], marginLeft: spacing[3] }}>
                Compartilhar Link de Pagamento
              </Text>
            </TouchableOpacity>
          )}

          {/* Open Payment URL */}
          {charge.urls?.invoiceUrl && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gray[100] }]}
              onPress={handleOpenPaymentUrl}
            >
              <Ionicons name="open-outline" size={22} color={colors.text.primary} />
              <Text variant="body" weight="medium" style={{ marginLeft: spacing[3] }}>
                Abrir Página de Pagamento
              </Text>
            </TouchableOpacity>
          )}

          {/* PIX Code */}
          {charge.billingType === 'PIX' && charge.urls?.pixCopiaECola && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gray[100] }]}
              onPress={handleCopyPixCode}
            >
              <Ionicons name="copy-outline" size={22} color={colors.text.primary} />
              <Text variant="body" weight="medium" style={{ marginLeft: spacing[3] }}>
                Copiar Código PIX
              </Text>
            </TouchableOpacity>
          )}

          {/* Bank Slip */}
          {charge.billingType === 'BOLETO' && charge.urls?.bankSlipUrl && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.gray[100] }]}
              onPress={handleOpenBankSlip}
            >
              <Ionicons name="document-text-outline" size={22} color={colors.text.primary} />
              <Text variant="body" weight="medium" style={{ marginLeft: spacing[3] }}>
                Abrir Boleto
              </Text>
            </TouchableOpacity>
          )}

          {/* Resend Email */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.gray[100] }]}
            onPress={handleResendEmail}
          >
            <Ionicons name="mail-outline" size={22} color={colors.text.primary} />
            <Text variant="body" weight="medium" style={{ marginLeft: spacing[3] }}>
              Reenviar por Email
            </Text>
          </TouchableOpacity>

          {/* Manual Payment */}
          {canManualPay && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success[50] }]}
              onPress={handleManualPayment}
            >
              <Ionicons name="cash-outline" size={22} color={colors.success[600]} />
              <Text variant="body" weight="medium" style={{ color: colors.success[600], marginLeft: spacing[3] }}>
                Registrar Pagamento Manual
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      )}

      {/* Danger Zone */}
      {canCancel && (
        <Card variant="outlined" style={[styles.dangerCard, { borderColor: colors.error[200] }]}>
          <Text variant="h6" weight="semibold" style={{ marginBottom: spacing[3], color: colors.error[600] }}>
            Zona de Perigo
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error[50] }]}
            onPress={handleCancelCharge}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.error[600]} />
            <Text variant="body" weight="medium" style={{ color: colors.error[600], marginLeft: spacing[3] }}>
              Cancelar Cobrança
            </Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Discount/Fine/Interest Info */}
      {(charge.discount || charge.fine || charge.interest) && (
        <Card variant="elevated" style={styles.extrasCard}>
          <Text variant="h6" weight="semibold" style={{ marginBottom: spacing[3] }}>
            Configurações
          </Text>

          {charge.discount && (
            <View style={styles.extraRow}>
              <Ionicons name="pricetag-outline" size={18} color={colors.success[500]} />
              <Text variant="body" style={{ marginLeft: spacing[2] }}>
                Desconto: {charge.discount.type === 'PERCENTAGE' ? `${charge.discount.value}%` : formatCurrency(charge.discount.value, locale)}
                {charge.discount.dueDateLimitDays && ` (até ${charge.discount.dueDateLimitDays} dias antes)`}
              </Text>
            </View>
          )}

          {charge.fine && (
            <View style={styles.extraRow}>
              <Ionicons name="alert-outline" size={18} color={colors.warning[500]} />
              <Text variant="body" style={{ marginLeft: spacing[2] }}>
                Multa: {charge.fine.type === 'PERCENTAGE' ? `${charge.fine.value}%` : formatCurrency(charge.fine.value, locale)}
              </Text>
            </View>
          )}

          {charge.interest && (
            <View style={styles.extraRow}>
              <Ionicons name="trending-up-outline" size={18} color={colors.error[500]} />
              <Text variant="body" style={{ marginLeft: spacing[2] }}>
                Juros: {charge.interest.value}% ao mês
              </Text>
            </View>
          )}
        </Card>
      )}
    </ScrollView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  retryButton: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  mainCard: {
    marginBottom: spacing[4],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  billingType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    marginTop: spacing[2],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  infoContent: {
    marginLeft: spacing[3],
    flex: 1,
  },
  actionsCard: {
    marginBottom: spacing[4],
  },
  dangerCard: {
    marginBottom: spacing[4],
    borderWidth: 1,
  },
  extrasCard: {
    marginBottom: spacing[4],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
});

export default ChargeDetailScreen;
