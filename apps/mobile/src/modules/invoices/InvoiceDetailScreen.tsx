/**
 * InvoiceDetailScreen
 *
 * Tela de detalhes da Fatura.
 * Permite visualizar dados e mudar status (offline-first).
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
import { colors, spacing, borderRadius, shadows } from '../../design-system/tokens';
import { Invoice, InvoiceStatus } from '../../db/schema';
import { InvoiceService } from './InvoiceService';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceDetailScreenProps {
  invoiceId: string;
  onStatusChange?: (updatedInvoice: Invoice) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: () => void;
  onBack?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: InvoiceStatus): string {
  const statusColors: Record<InvoiceStatus, string> = {
    PENDING: colors.warning[500],
    PAID: colors.success[500],
    OVERDUE: colors.error[500],
    CANCELLED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: InvoiceStatus): 'default' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'PAID': return 'success';
    case 'OVERDUE': return 'error';
    case 'PENDING': return 'warning';
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

function canEditInvoice(status: InvoiceStatus): boolean {
  return status === 'PENDING';
}

function canDeleteInvoice(status: InvoiceStatus): boolean {
  return status === 'PENDING';
}

function canMarkAsPaid(status: InvoiceStatus): boolean {
  return status === 'PENDING' || status === 'OVERDUE';
}

function canCancel(status: InvoiceStatus): boolean {
  return status === 'PENDING' || status === 'OVERDUE';
}

function isOverdue(invoice: Invoice): boolean {
  if (invoice.status !== 'PENDING') return false;
  const dueDate = new Date(invoice.dueDate);
  return dueDate < new Date();
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
  valueColor?: string;
}> = ({ icon, label, value, valueColor }) => (
  <View style={styles.infoRow}>
    <Text variant="body" style={styles.infoIcon}>{icon}</Text>
    <View style={styles.infoContent}>
      <Text variant="caption" color="secondary">{label}</Text>
      <Text variant="body" style={valueColor ? { color: valueColor } : undefined}>{value}</Text>
    </View>
  </View>
);

const ActionButton: React.FC<{
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  icon?: string;
}> = ({ label, onPress, loading, variant = 'primary', icon }) => {
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

export const InvoiceDetailScreen: React.FC<InvoiceDetailScreenProps> = ({
  invoiceId,
  onStatusChange,
  onEdit,
  onDelete,
  onBack,
}) => {
  const { t, locale } = useTranslation();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Load invoice
  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const data = await InvoiceService.getInvoice(invoiceId);
      setInvoice(data);
    } catch (error) {
      console.error('Error loading invoice:', error);
      Alert.alert(t('common.error'), t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = useCallback(async () => {
    if (!invoice) return;

    Alert.alert(
      t('invoices.markAsPaid'),
      t('invoices.markAsPaid') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              setActionLoading('PAID');
              const updated = await InvoiceService.markAsPaid(invoice.id);
              if (updated) {
                setInvoice(updated);
                onStatusChange?.(updated);
              }
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('errors.generic'));
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [invoice, onStatusChange, t]);

  const handleCancel = useCallback(async () => {
    if (!invoice) return;

    Alert.alert(
      t('invoices.cancelInvoice'),
      t('invoices.cancelInvoice') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('CANCELLED');
              const updated = await InvoiceService.cancelInvoice(invoice.id);
              if (updated) {
                setInvoice(updated);
                onStatusChange?.(updated);
              }
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('errors.generic'));
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  }, [invoice, onStatusChange, t]);

  const handleDelete = useCallback(async () => {
    if (!invoice) return;

    Alert.alert(
      t('common.delete'),
      t('invoices.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('delete');
              await InvoiceService.deleteInvoice(invoice.id);
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
  }, [invoice, onDelete, t]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.emptyContainer}>
        <Text variant="body" color="secondary">{t('errors.notFound')}</Text>
      </View>
    );
  }

  const statusLabel = t(`invoices.${invoice.status.toLowerCase()}`);
  const overdue = isOverdue(invoice);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card variant="elevated" style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Badge
              label={overdue ? t('invoices.overdue') : statusLabel}
              variant={overdue ? 'error' : getStatusBadgeVariant(invoice.status)}
            />
            <Text variant="bodySmall" color="secondary">
              #{invoice.invoiceNumber}
            </Text>
          </View>

          <Text variant="h3" weight="bold" style={styles.title}>
            {invoice.clientName || t('invoices.client')}
          </Text>

          <Text variant="h2" weight="bold" style={{ color: colors.success[600] }}>
            {formatCurrency(invoice.total, locale)}
          </Text>

          {invoice.notes && (
            <Text variant="body" color="secondary" style={styles.description}>
              {invoice.notes}
            </Text>
          )}
        </View>
      </Card>

      {/* Values */}
      <Card style={styles.card}>
        <InfoSection title={t('common.value')}>
          <View style={styles.valueRow}>
            <Text variant="body" color="secondary">{t('common.subtotal')}</Text>
            <Text variant="body">{formatCurrency(invoice.subtotal, locale)}</Text>
          </View>
          {invoice.tax > 0 && (
            <View style={styles.valueRow}>
              <Text variant="body" color="secondary">{t('common.tax')}</Text>
              <Text variant="body">{formatCurrency(invoice.tax, locale)}</Text>
            </View>
          )}
          {invoice.discount > 0 && (
            <View style={styles.valueRow}>
              <Text variant="body" color="secondary">{t('common.discount')}</Text>
              <Text variant="body" style={{ color: colors.error[500] }}>
                -{formatCurrency(invoice.discount, locale)}
              </Text>
            </View>
          )}
          <View style={[styles.valueRow, styles.totalRow]}>
            <Text variant="body" weight="bold">{t('common.total')}</Text>
            <Text variant="body" weight="bold" style={{ color: colors.success[600] }}>
              {formatCurrency(invoice.total, locale)}
            </Text>
          </View>
        </InfoSection>
      </Card>

      {/* Dates */}
      <Card style={styles.card}>
        <InfoSection title={t('common.date')}>
          <InfoRow
            icon="📅"
            label={t('common.date')}
            value={formatDate(invoice.createdAt, locale)}
          />
          <InfoRow
            icon="⏰"
            label={t('invoices.dueDate')}
            value={formatDate(invoice.dueDate, locale)}
            valueColor={overdue ? colors.error[500] : undefined}
          />
          {invoice.paidDate && (
            <InfoRow
              icon="✅"
              label={t('invoices.paidDate')}
              value={formatDateTime(invoice.paidDate, locale)}
              valueColor={colors.success[500]}
            />
          )}
        </InfoSection>
      </Card>

      {/* Overdue Warning */}
      {overdue && (
        <Card style={[styles.card, styles.warningCard]}>
          <View style={styles.warningContent}>
            <Text variant="body" style={{ color: colors.error[700] }}>
              ⚠️ {t('invoices.overdue')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.error[600] }}>
              {t('invoices.dueDate')}: {formatDate(invoice.dueDate, locale)}
            </Text>
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Mark as Paid */}
        {canMarkAsPaid(invoice.status) && (
          <ActionButton
            label={t('invoices.markAsPaid')}
            icon="💰"
            onPress={handleMarkAsPaid}
            loading={actionLoading === 'PAID'}
            variant="success"
          />
        )}

        {/* Cancel Invoice */}
        {canCancel(invoice.status) && (
          <ActionButton
            label={t('invoices.cancelInvoice')}
            icon="❌"
            onPress={handleCancel}
            loading={actionLoading === 'CANCELLED'}
            variant="danger"
          />
        )}

        {/* Edit button */}
        {canEditInvoice(invoice.status) && onEdit && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => onEdit(invoice)}
          >
            <Text variant="body" weight="semibold" style={{ color: colors.primary[600] }}>
              ✏️ {t('common.edit')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete button */}
        {canDeleteInvoice(invoice.status) && onDelete && (
          <TouchableOpacity
            style={[styles.secondaryButton, styles.dangerButton]}
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
    backgroundColor: colors.background.secondary,
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
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  totalRow: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 2,
    borderTopColor: colors.border.default,
  },
  warningCard: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
    borderWidth: 1,
  },
  warningContent: {
    gap: spacing[1],
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
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  dangerButton: {
    borderColor: colors.error[200],
  },
});

export default InvoiceDetailScreen;
