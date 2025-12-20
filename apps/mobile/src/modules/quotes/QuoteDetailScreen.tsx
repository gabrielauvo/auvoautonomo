/**
 * QuoteDetailScreen
 *
 * Tela de detalhes do Orcamento.
 * Permite visualizar dados, itens e mudar status (offline-first).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { Quote, QuoteStatus, QuoteItem } from '../../db/schema';
import { QuoteService, QuoteWithItems } from './QuoteService';
import { useTranslation } from '../../i18n';
import { ShareService } from '../../services';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface QuoteDetailScreenProps {
  quoteId: string;
  onStatusChange?: (updatedQuote: Quote) => void;
  onEdit?: (quote: QuoteWithItems) => void;
  onDelete?: () => void;
  onConvertToInvoice?: (quote: QuoteWithItems) => void;
  onConvertToWorkOrder?: (quote: QuoteWithItems) => void;
  onCollectSignature?: (quote: QuoteWithItems) => void;
  onBack?: () => void;
  /** When this value changes, the screen will reload the quote data */
  refreshTrigger?: number;
  /** Phone number of the client for WhatsApp sharing */
  clientPhone?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: QuoteStatus, colors: ThemeColors): string {
  const statusColors: Record<QuoteStatus, string> = {
    DRAFT: colors.gray[500],
    SENT: colors.primary[500],
    APPROVED: colors.success[500],
    REJECTED: colors.error[500],
    EXPIRED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: QuoteStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'APPROVED': return 'success';
    case 'REJECTED': return 'error';
    case 'SENT': return 'warning';
    default: return 'default';
  }
}

function formatDateTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
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

function canEditQuote(status: QuoteStatus): boolean {
  return status === 'DRAFT';
}

function canDeleteQuote(status: QuoteStatus): boolean {
  return status === 'DRAFT';
}

function canSendQuote(status: QuoteStatus): boolean {
  return status === 'DRAFT';
}

function canApproveOrReject(status: QuoteStatus): boolean {
  return status === 'SENT';
}

function canCollectSignature(status: QuoteStatus): boolean {
  return status === 'DRAFT' || status === 'SENT';
}

function canConvertToInvoice(status: QuoteStatus): boolean {
  return status === 'APPROVED';
}

function canReactivateQuote(status: QuoteStatus): boolean {
  return status === 'EXPIRED';
}

function canShareQuote(status: QuoteStatus): boolean {
  // Pode compartilhar em DRAFT (para enviar), SENT (lembrete) ou APPROVED (comprovante)
  return status === 'DRAFT' || status === 'SENT' || status === 'APPROVED';
}

// =============================================================================
// COMPONENTS
// =============================================================================

const InfoSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <View style={styles.section}>
    <Text variant="caption" color="secondary" weight="semibold" style={styles.sectionTitle}>
      {title.toUpperCase()}
    </Text>
    {children}
  </View>
);

const InfoRow: React.FC<{
  icon: string;
  label: string;
  value: string;
}> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Text variant="body" style={styles.infoIcon}>{icon}</Text>
    <View style={styles.infoContent}>
      <Text variant="caption" color="secondary">{label}</Text>
      <Text variant="body">{value}</Text>
    </View>
  </View>
);

const QuoteItemRow: React.FC<{
  item: QuoteItem;
  locale: string;
  t: (key: string) => string;
  colors: ThemeColors;
}> = ({ item, locale, t, colors }) => (
  <View style={[styles.itemRow, { borderBottomColor: colors.border.light }]}>
    <View style={styles.itemInfo}>
      <Text variant="body" weight="semibold" numberOfLines={1}>
        {item.name}
      </Text>
      <Text variant="caption" color="secondary">
        {item.quantity} {item.unit} x {formatCurrency(item.unitPrice, locale)}
      </Text>
    </View>
    <View style={styles.itemPrice}>
      <Text variant="body" weight="semibold">
        {formatCurrency(item.totalPrice, locale)}
      </Text>
      {item.discountValue > 0 && (
        <Text variant="caption" color="tertiary">
          -{formatCurrency(item.discountValue, locale)}
        </Text>
      )}
    </View>
  </View>
);

const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: string;
  colors: ThemeColors;
}> = ({ label, onPress, loading, variant = 'primary', icon, colors }) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return { backgroundColor: colors.error[500] };
      case 'success':
        return { backgroundColor: colors.success[500] };
      case 'secondary':
        return { backgroundColor: colors.gray[500] };
      default:
        return { backgroundColor: colors.primary[600] };
    }
  };

  return (
    <TouchableOpacity
      style={[styles.actionButton, getButtonStyle()]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Text variant="body" weight="semibold" style={{ color: colors.white }}>
          {icon ? `${icon} ${label}` : label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const QuoteDetailScreen: React.FC<QuoteDetailScreenProps> = ({
  quoteId,
  onStatusChange,
  onEdit,
  onDelete,
  onConvertToInvoice,
  onConvertToWorkOrder,
  onCollectSignature,
  onBack,
  refreshTrigger,
  clientPhone,
}) => {
  const { t, locale } = useTranslation();
  const colors = useColors();
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load quote with items (on mount and when refreshTrigger changes)
  useEffect(() => {
    loadQuote();
  }, [quoteId, refreshTrigger]);

  const loadQuote = async () => {
    try {
      setLoading(true);
      const data = await QuoteService.getQuoteWithItems(quoteId);
      setQuote(data);
    } catch (error) {
      console.error('Error loading quote:', error);
      Alert.alert(t('common.error'), t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = useCallback(async (newStatus: QuoteStatus) => {
    if (!quote) return;

    try {
      setActionLoading(newStatus);
      const updated = await QuoteService.updateStatus(quote.id, newStatus);
      if (updated) {
        const updatedWithItems = await QuoteService.getQuoteWithItems(quote.id);
        setQuote(updatedWithItems);
        onStatusChange?.(updated);
      }
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error.message || t('errors.generic'),
      );
    } finally {
      setActionLoading(null);
    }
  }, [quote, onStatusChange, t]);

  const handleSendQuote = () => {
    Alert.alert(
      t('quotes.sendQuote'),
      t('quotes.sendQuote') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => handleStatusChange('SENT') },
      ],
    );
  };

  const handleApproveQuote = () => {
    Alert.alert(
      t('quotes.approveQuote'),
      t('quotes.approveQuote') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => handleStatusChange('APPROVED') },
      ],
    );
  };

  const handleRejectQuote = () => {
    Alert.alert(
      t('quotes.rejectQuote'),
      t('quotes.rejectQuote') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => handleStatusChange('REJECTED'),
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!quote) return;

    Alert.alert(
      t('common.delete'),
      t('quotes.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('delete');
              await QuoteService.deleteQuote(quote.id);
              onDelete?.();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('errors.generic'));
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleConvertToInvoice = () => {
    if (!quote) return;

    Alert.alert(
      t('quotes.convertToInvoice'),
      t('quotes.convertToInvoice') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => onConvertToInvoice?.(quote) },
      ],
    );
  };

  const handleReactivateQuote = () => {
    Alert.alert(
      t('quotes.reactivateQuote') || 'Reativar Orçamento',
      t('quotes.reactivateConfirm') || 'Deseja reativar este orçamento? Ele voltará para o status Rascunho.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => handleStatusChange('DRAFT') },
      ],
    );
  };

  const handleShareWhatsApp = async () => {
    if (!quote) return;

    // Verificar se tem telefone do cliente
    const phone = clientPhone;
    if (!phone) {
      Alert.alert(
        t('common.error'),
        t('quotes.noClientPhone') || 'Cliente não possui telefone cadastrado',
      );
      return;
    }

    try {
      setActionLoading('share');

      // Mensagem diferente para orçamento aprovado
      if (quote.status === 'APPROVED') {
        // Para aprovados, usar mensagem de confirmação
        await ShareService.shareApprovedQuoteViaWhatsApp(
          quote.id,
          phone,
          quote.clientName || t('quotes.client'),
          formatCurrency(quote.totalValue, locale),
        );
      } else {
        await ShareService.shareQuoteViaWhatsApp(
          quote.id,
          phone,
          quote.clientName || t('quotes.client'),
          formatCurrency(quote.totalValue, locale),
        );
        // Atualiza status para SENT se estava em DRAFT
        if (quote.status === 'DRAFT') {
          await handleStatusChange('SENT');
        }
      }
    } catch (error: any) {
      console.error('Error sharing quote:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('quotes.shareError') || 'Erro ao compartilhar orçamento',
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToWorkOrder = () => {
    if (!quote) return;

    Alert.alert(
      t('quotes.convertToWorkOrder') || 'Converter em OS',
      t('quotes.convertToWorkOrderConfirm') || 'Deseja criar uma Ordem de Serviço a partir deste orçamento?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => onConvertToWorkOrder?.(quote) },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color="secondary">{t('errors.notFound')}</Text>
      </View>
    );
  }

  const statusLabel = t(`quotes.${quote.status.toLowerCase()}`);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background.secondary }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card variant="elevated" style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Badge
              label={statusLabel}
              variant={getStatusBadgeVariant(quote.status)}
            />
          </View>

          <Text variant="h3" weight="bold" style={styles.title}>
            {quote.clientName || t('quotes.client')}
          </Text>

          <Text variant="h2" weight="bold" style={{ color: colors.success[600] }}>
            {formatCurrency(quote.totalValue, locale)}
          </Text>

          {quote.notes && (
            <Text variant="body" color="secondary" style={styles.description}>
              {quote.notes}
            </Text>
          )}
        </View>
      </Card>

      {/* Items */}
      <Card style={styles.card}>
        <InfoSection title={t('quotes.items')}>
          {quote.items.length === 0 ? (
            <Text variant="body" color="tertiary">{t('quotes.noItems')}</Text>
          ) : (
            <>
              {quote.items.map((item) => (
                <QuoteItemRow key={item.id} item={item} locale={locale} t={t} colors={colors} />
              ))}
              <View style={[styles.totalsContainer, { borderTopColor: colors.border.default }]}>
                {quote.discountValue > 0 && (
                  <View style={styles.totalRow}>
                    <Text variant="body" color="secondary">{t('common.discount')}</Text>
                    <Text variant="body" color="error">
                      -{formatCurrency(quote.discountValue, locale)}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text variant="body" weight="bold">{t('common.total')}</Text>
                  <Text variant="body" weight="bold" style={{ color: colors.success[600] }}>
                    {formatCurrency(quote.totalValue, locale)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </InfoSection>
      </Card>

      {/* Details */}
      <Card style={styles.card}>
        <InfoSection title={t('common.details')}>
          <InfoRow
            icon="📅"
            label={t('common.date')}
            value={formatDate(quote.createdAt, locale)}
          />
          {quote.visitScheduledAt && (
            <InfoRow
              icon="🗓️"
              label={t('quotes.visitDate')}
              value={formatDate(quote.visitScheduledAt, locale)}
            />
          )}
          {quote.sentAt && (
            <InfoRow
              icon="✉️"
              label={t('quotes.sentDate')}
              value={formatDateTime(quote.sentAt, locale)}
            />
          )}
        </InfoSection>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Share via WhatsApp - primary action for DRAFT/SENT */}
        {canShareQuote(quote.status) && clientPhone && (
          <ActionButton
            label={t('quotes.shareWhatsApp') || 'Enviar via WhatsApp'}
            icon="📱"
            onPress={handleShareWhatsApp}
            loading={actionLoading === 'share'}
            variant="success"
            colors={colors}
          />
        )}

        {/* Send Quote (fallback when no phone) */}
        {canSendQuote(quote.status) && !clientPhone && (
          <ActionButton
            label={t('quotes.sendQuote')}
            icon="✉️"
            onPress={handleSendQuote}
            loading={actionLoading === 'SENT'}
            colors={colors}
          />
        )}

        {/* Collect Signature (primary action for SENT status) */}
        {canCollectSignature(quote.status) && onCollectSignature && (
          <ActionButton
            label={t('quotes.collectSignature') || 'Coletar Assinatura'}
            icon="✍️"
            onPress={() => onCollectSignature(quote)}
            variant="success"
            colors={colors}
          />
        )}

        {/* Approve/Reject (alternative to signature) */}
        {canApproveOrReject(quote.status) && (
          <>
            <ActionButton
              label={t('quotes.approveQuote')}
              icon="✅"
              onPress={handleApproveQuote}
              loading={actionLoading === 'APPROVED'}
              variant="secondary"
              colors={colors}
            />
            <ActionButton
              label={t('quotes.rejectQuote')}
              icon="❌"
              onPress={handleRejectQuote}
              loading={actionLoading === 'REJECTED'}
              variant="danger"
              colors={colors}
            />
          </>
        )}

        {/* Convert to Work Order */}
        {canConvertToInvoice(quote.status) && onConvertToWorkOrder && (
          <ActionButton
            label={t('quotes.convertToWorkOrder') || 'Converter em OS'}
            icon="🔧"
            onPress={handleConvertToWorkOrder}
            variant="primary"
            colors={colors}
          />
        )}

        {/* Convert to Invoice */}
        {canConvertToInvoice(quote.status) && onConvertToInvoice && (
          <ActionButton
            label={t('quotes.convertToInvoice')}
            icon="💰"
            onPress={handleConvertToInvoice}
            variant="success"
            colors={colors}
          />
        )}

        {/* Edit button */}
        {canEditQuote(quote.status) && onEdit && (
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.background.primary, borderColor: colors.border.default }]}
            onPress={() => onEdit(quote)}
          >
            <Text variant="body" weight="semibold" style={{ color: colors.primary[600] }}>
              ✏️ {t('common.edit')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete button */}
        {canDeleteQuote(quote.status) && onDelete && (
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.background.primary, borderColor: colors.error[200] }]}
            onPress={handleDelete}
            disabled={actionLoading === 'delete'}
          >
            {actionLoading === 'delete' ? (
              <ActivityIndicator size="small" color={colors.error[500]} />
            ) : (
              <Text variant="body" weight="semibold" style={{ color: colors.error[500] }}>
                🗑️ {t('common.delete')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Reactivate button (for EXPIRED quotes) */}
        {canReactivateQuote(quote.status) && (
          <ActionButton
            label={t('quotes.reactivateQuote') || 'Reativar Orçamento'}
            icon="🔄"
            onPress={handleReactivateQuote}
            loading={actionLoading === 'DRAFT'}
            variant="primary"
            colors={colors}
          />
        )}
      </View>
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
  content: {
    padding: spacing[4],
    paddingBottom: spacing[20],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: spacing[4],
  },
  headerContent: {
    gap: spacing[2],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    marginTop: spacing[2],
  },
  description: {
    marginTop: spacing[1],
  },
  card: {
    marginBottom: spacing[3],
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    marginBottom: spacing[1],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing[1],
  },
  infoIcon: {
    marginRight: spacing[3],
    fontSize: 16,
  },
  infoContent: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  totalsContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[2],
    borderTopWidth: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  actionsContainer: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
  actionButton: {
    paddingVertical: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  secondaryButton: {
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

export default QuoteDetailScreen;
