/**
 * WorkOrderDetailScreen
 *
 * Tela de detalhes da Ordem de Serviço.
 * Permite visualizar dados e mudar status (offline-first).
 * Base preparada para checklist e assinatura digital.
 */

import React, { useState, useCallback } from 'react';
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
import { Button } from '../../design-system/components/Button';
import { colors, spacing, borderRadius, shadows, theme } from '../../design-system/tokens';
import { WorkOrder, WorkOrderStatus } from '../../db/schema';
import { workOrderService } from './WorkOrderService';
import { getAllowedNextStatuses, canEditWorkOrder, canDeleteWorkOrder } from './WorkOrderSyncConfig';
import { ShareService } from '../../services';
import { SignatureSection } from './components/SignatureSection';
import { useTranslation } from '../../i18n';

// =============================================================================
// TYPES
// =============================================================================

interface WorkOrderDetailScreenProps {
  workOrder: WorkOrder;
  onStatusChange?: (updatedWorkOrder: WorkOrder) => void;
  onEdit?: (workOrder: WorkOrder) => void;
  onDelete?: () => void;
  onBack?: () => void;
  onShareWhatsApp?: (workOrder: WorkOrder) => void;
  onCreateCharge?: (workOrder: WorkOrder) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: WorkOrderStatus): string {
  return theme.statusColors.workOrder[status] || colors.gray[500];
}

function getStatusBadgeVariant(status: WorkOrderStatus) {
  switch (status) {
    case 'DONE': return 'success';
    case 'IN_PROGRESS': return 'warning';
    case 'CANCELED': return 'error';
    default: return 'default';
  }
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canShareWorkOrder(status: WorkOrderStatus): boolean {
  // Pode compartilhar quando concluída
  return status === 'DONE';
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

const StatusButton: React.FC<{
  status: WorkOrderStatus;
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}> = ({ status, label, onPress, loading, variant = 'primary' }) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'danger':
        return { backgroundColor: colors.error[500] };
      case 'secondary':
        return { backgroundColor: colors.gray[500] };
      default:
        return { backgroundColor: getStatusColor(status) };
    }
  };

  return (
    <TouchableOpacity
      style={[styles.statusButton, getButtonStyle()]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Text variant="body" weight="semibold" style={{ color: colors.white }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const WorkOrderDetailScreen: React.FC<WorkOrderDetailScreenProps> = ({
  workOrder: initialWorkOrder,
  onStatusChange,
  onEdit,
  onDelete,
  onBack,
  onShareWhatsApp,
  onCreateCharge,
}) => {
  const { t } = useTranslation();
  const [workOrder, setWorkOrder] = useState(initialWorkOrder);
  const [loading, setLoading] = useState<WorkOrderStatus | 'delete' | 'share' | null>(null);

  const allowedNextStatuses = getAllowedNextStatuses(workOrder.status);
  const canEdit = canEditWorkOrder(workOrder.status);
  const canDelete = canDeleteWorkOrder(workOrder.status);

  // Get status label for the work order
  const getStatusLabel = useCallback((status: WorkOrderStatus): string => {
    const labels: Record<WorkOrderStatus, string> = {
      SCHEDULED: t('workOrders.statusScheduled'),
      IN_PROGRESS: t('workOrders.statusInProgress'),
      DONE: t('workOrders.statusCompleted'),
      CANCELED: t('workOrders.statusCancelled'),
    };
    return labels[status];
  }, [t]);

  const handleStatusChange = useCallback(async (newStatus: WorkOrderStatus) => {
    try {
      setLoading(newStatus);
      const updated = await workOrderService.updateStatus(workOrder.id, newStatus);
      setWorkOrder(updated);
      onStatusChange?.(updated);
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error.message || t('workOrders.statusUpdateError'),
      );
    } finally {
      setLoading(null);
    }
  }, [workOrder.id, onStatusChange, t]);

  const handleStartWorkOrder = () => {
    Alert.alert(
      t('workOrders.startOrder'),
      t('workOrders.startOrderConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workOrders.start'), onPress: () => handleStatusChange('IN_PROGRESS') },
      ],
    );
  };

  const handleCompleteWorkOrder = () => {
    Alert.alert(
      t('workOrders.completeOrder'),
      t('workOrders.completeOrderConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workOrders.complete'), onPress: () => handleStatusChange('DONE') },
      ],
    );
  };

  const handleCancelWorkOrder = () => {
    Alert.alert(
      t('workOrders.cancelOrder'),
      t('workOrders.cancelOrderConfirm'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('workOrders.cancelOrder'),
          style: 'destructive',
          onPress: () => handleStatusChange('CANCELED'),
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('workOrders.deleteOrder'),
      t('workOrders.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading('delete');
              await workOrderService.deleteWorkOrder(workOrder.id);
              onDelete?.();
            } catch (error: any) {
              Alert.alert(t('common.error'), error.message || t('workOrders.deleteError'));
            } finally {
              setLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleShareWhatsApp = async () => {
    if (!workOrder.clientPhone) {
      Alert.alert(
        t('common.error'),
        t('workOrders.noClientPhone'),
      );
      return;
    }

    try {
      setLoading('share');
      await ShareService.shareWorkOrderViaWhatsApp(
        workOrder.id,
        workOrder.clientPhone,
        workOrder.clientName || t('workOrders.client'),
        workOrder.title,
      );
    } catch (error: any) {
      console.error('Error sharing work order:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('workOrders.shareError'),
      );
    } finally {
      setLoading(null);
    }
  };

  const scheduledDate = workOrder.scheduledDate || workOrder.scheduledStartTime;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card variant="elevated" style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Badge
              label={getStatusLabel(workOrder.status)}
              variant={getStatusBadgeVariant(workOrder.status)}
            />
            {workOrder.totalValue && (
              <Text variant="h4" weight="bold" style={{ color: colors.success[600] }}>
                R$ {workOrder.totalValue.toFixed(2)}
              </Text>
            )}
          </View>

          <Text variant="h3" weight="bold" style={styles.title}>
            {workOrder.title}
          </Text>

          {workOrder.description && (
            <Text variant="body" color="secondary" style={styles.description}>
              {workOrder.description}
            </Text>
          )}
        </View>
      </Card>

      {/* Client Info */}
      <Card style={styles.card}>
        <InfoSection title={t('workOrders.client')}>
          <InfoRow
            icon=""
            label={t('common.name')}
            value={workOrder.clientName || t('workOrders.notDefined')}
          />
          {workOrder.clientPhone && (
            <InfoRow icon="" label={t('workOrders.phone')} value={workOrder.clientPhone} />
          )}
        </InfoSection>
      </Card>

      {/* Schedule Info */}
      <Card style={styles.card}>
        <InfoSection title={t('workOrders.scheduledDate')}>
          {scheduledDate && (
            <InfoRow
              icon=""
              label={t('common.date')}
              value={formatDate(scheduledDate)}
            />
          )}
          {workOrder.scheduledStartTime && (
            <InfoRow
              icon=""
              label={t('common.time')}
              value={workOrderService.formatDateRange(workOrder)}
            />
          )}
          {workOrder.address && (
            <InfoRow icon="" label={t('workOrders.address')} value={workOrder.address} />
          )}
        </InfoSection>
      </Card>

      {/* Execution Info (if started) */}
      {(workOrder.executionStart || workOrder.executionEnd) && (
        <Card style={styles.card}>
          <InfoSection title={t('workOrders.execution')}>
            {workOrder.executionStart && (
              <InfoRow
                icon=""
                label={t('workOrders.startedAt')}
                value={formatDateTime(workOrder.executionStart)}
              />
            )}
            {workOrder.executionEnd && (
              <InfoRow
                icon=""
                label={t('workOrders.completedAt')}
                value={formatDateTime(workOrder.executionEnd)}
              />
            )}
          </InfoSection>
        </Card>
      )}

      {/* Notes */}
      {workOrder.notes && (
        <Card style={styles.card}>
          <InfoSection title={t('workOrders.notes')}>
            <Text variant="body">{workOrder.notes}</Text>
          </InfoSection>
        </Card>
      )}

      {/* TODO: Checklist Section (DIA 4) */}
      <Card style={[styles.card, styles.placeholderCard]}>
        <View style={styles.placeholder}>
          <Text variant="body" color="tertiary">
            {t('workOrders.checklistComingSoon')}
          </Text>
        </View>
      </Card>

      {/* Signature Section */}
      <SignatureSection
        workOrderId={workOrder.id}
        clientId={workOrder.clientId}
        clientName={workOrder.clientName}
        status={workOrder.status}
        readOnly={workOrder.status === 'DONE' || workOrder.status === 'CANCELED'}
      />

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Primary status actions */}
        {workOrder.status === 'SCHEDULED' && allowedNextStatuses.includes('IN_PROGRESS') && (
          <StatusButton
            status="IN_PROGRESS"
            label={t('workOrders.startOrder')}
            onPress={handleStartWorkOrder}
            loading={loading === 'IN_PROGRESS'}
          />
        )}

        {workOrder.status === 'IN_PROGRESS' && allowedNextStatuses.includes('DONE') && (
          <StatusButton
            status="DONE"
            label={t('workOrders.completeOrder')}
            onPress={handleCompleteWorkOrder}
            loading={loading === 'DONE'}
          />
        )}

        {/* Share via WhatsApp (when DONE) */}
        {canShareWorkOrder(workOrder.status) && workOrder.clientPhone && (
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: '#25D366' }]}
            onPress={handleShareWhatsApp}
            disabled={loading === 'share'}
          >
            {loading === 'share' ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text variant="body" weight="semibold" style={{ color: colors.white }}>
                {t('workOrders.shareReport')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Reopen button (when DONE) */}
        {workOrder.status === 'DONE' && (
          <TouchableOpacity
            style={[styles.secondaryButton]}
            onPress={() => {
              Alert.alert(
                t('workOrders.reopenOrder'),
                t('workOrders.reopenConfirm'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('workOrders.reopen'), onPress: () => handleStatusChange('IN_PROGRESS') },
                ],
              );
            }}
            disabled={loading === 'IN_PROGRESS'}
          >
            {loading === 'IN_PROGRESS' ? (
              <ActivityIndicator size="small" color={colors.primary[600]} />
            ) : (
              <Text variant="body" weight="semibold" style={{ color: colors.primary[600] }}>
                {t('workOrders.reopenOrder')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Create Charge button (when DONE and has value) */}
        {workOrder.status === 'DONE' && workOrder.totalValue && workOrder.totalValue > 0 && onCreateCharge && (
          <TouchableOpacity
            style={[styles.statusButton, { backgroundColor: colors.success[600] }]}
            onPress={() => onCreateCharge(workOrder)}
          >
            <Text variant="body" weight="semibold" style={{ color: colors.white }}>
              {t('workOrders.createCharge')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        {allowedNextStatuses.includes('CANCELED') && (
          <StatusButton
            status="CANCELED"
            label={t('workOrders.cancelOrder')}
            onPress={handleCancelWorkOrder}
            loading={loading === 'CANCELED'}
            variant="danger"
          />
        )}

        {/* Edit button */}
        {canEdit && onEdit && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => onEdit(workOrder)}
          >
            <Text variant="body" weight="semibold" style={{ color: colors.primary[600] }}>
              {t('common.edit')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete button */}
        {canDelete && onDelete && (
          <TouchableOpacity
            style={[styles.secondaryButton, styles.dangerButton]}
            onPress={handleDelete}
            disabled={loading === 'delete'}
          >
            {loading === 'delete' ? (
              <ActivityIndicator size="small" color={colors.error[500]} />
            ) : (
              <Text variant="body" weight="semibold" style={{ color: colors.error[500] }}>
                {t('common.delete')}
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
  placeholderCard: {
    opacity: 0.5,
  },
  placeholder: {
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  actionsContainer: {
    marginTop: spacing[4],
    gap: spacing[3],
  },
  statusButton: {
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

export default WorkOrderDetailScreen;
