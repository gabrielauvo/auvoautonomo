/**
 * ExpenseDetailScreen
 *
 * Tela de detalhes da despesa com ações de editar, marcar como paga, cancelar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../design-system/components/Text';
import { Card } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { Button } from '../../design-system/components/Button';
import { Divider } from '../../design-system/components/Divider';
import { spacing, borderRadius, shadows } from '../../design-system/tokens';
import { useColors } from '../../design-system/ThemeProvider';
import { useTranslation } from '../../i18n';
import { ExpenseService } from './ExpenseService';
import type { Expense, ExpenseStatus, ExpensePaymentMethod } from './types';
import {
  expenseStatusLabels,
  paymentMethodLabels,
  isExpenseOverdue,
  canMarkAsPaid,
  canCancelExpense,
} from './types';

// Type for colors from theme
type ThemeColors = ReturnType<typeof useColors>;

// =============================================================================
// TYPES
// =============================================================================

interface ExpenseDetailScreenProps {
  expenseId: string;
  onBack?: () => void;
  onEdit?: (expense: Expense) => void;
  onDeleted?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getStatusColor(status: ExpenseStatus, isOverdue: boolean, colors: ThemeColors): string {
  if (isOverdue) return colors.error[500];
  const statusColors: Record<ExpenseStatus, string> = {
    PENDING: colors.warning[500],
    PAID: colors.success[500],
    CANCELED: colors.gray[400],
  };
  return statusColors[status] || colors.gray[500];
}

function getStatusBadgeVariant(
  status: ExpenseStatus,
  isOverdue: boolean
): 'default' | 'success' | 'error' | 'warning' {
  if (isOverdue) return 'error';
  switch (status) {
    case 'PAID':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'CANCELED':
      return 'default';
    default:
      return 'default';
  }
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(
    locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  );
}

function formatCurrency(value: number, locale: string): string {
  const currency = locale === 'pt-BR' ? 'BRL' : locale === 'es' ? 'EUR' : 'USD';
  return new Intl.NumberFormat(
    locale === 'pt-BR' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US',
    {
      style: 'currency',
      currency,
    }
  ).format(value);
}

// =============================================================================
// COMPONENTS
// =============================================================================

const DetailRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  colors: ThemeColors;
  valueColor?: string;
}> = ({ icon, label, value, colors, valueColor }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLabel}>
      <Ionicons name={icon as any} size={20} color={colors.text.tertiary} />
      <Text variant="body" color="secondary" style={{ marginLeft: spacing[2] }}>
        {label}
      </Text>
    </View>
    <Text variant="body" weight="medium" style={{ color: valueColor || colors.text.primary }}>
      {value}
    </Text>
  </View>
);

const PaymentMethodSelector: React.FC<{
  selectedMethod: ExpensePaymentMethod;
  onSelect: (method: ExpensePaymentMethod) => void;
  colors: ThemeColors;
}> = ({ selectedMethod, onSelect, colors }) => {
  const methods: ExpensePaymentMethod[] = [
    'PIX',
    'CASH',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'BANK_TRANSFER',
    'BOLETO',
    'OTHER',
  ];

  return (
    <View style={styles.paymentMethodGrid}>
      {methods.map((method) => (
        <TouchableOpacity
          key={method}
          style={[
            styles.paymentMethodButton,
            { borderColor: colors.border.light },
            selectedMethod === method && { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
          ]}
          onPress={() => onSelect(method)}
        >
          <Text
            variant="caption"
            weight={selectedMethod === method ? 'semibold' : 'normal'}
            style={{ color: selectedMethod === method ? colors.primary[600] : colors.text.secondary }}
          >
            {paymentMethodLabels[method]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ExpenseDetailScreen: React.FC<ExpenseDetailScreenProps> = ({
  expenseId,
  onBack,
  onEdit,
  onDeleted,
}) => {
  const { locale } = useTranslation();
  const colors = useColors();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<ExpensePaymentMethod>('PIX');
  const [error, setError] = useState<string | null>(null);

  const loadExpense = useCallback(async () => {
    try {
      setError(null);
      const data = await ExpenseService.getExpenseById(expenseId);
      setExpense(data);
      if (data.paymentMethod) {
        setSelectedPaymentMethod(data.paymentMethod);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar despesa');
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    loadExpense();
  }, [loadExpense]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExpense();
    setRefreshing(false);
  };

  const handleMarkAsPaid = async () => {
    if (!expense) return;

    setActionLoading(true);
    try {
      const updatedExpense = await ExpenseService.markExpenseAsPaid(expense.id, {
        paymentMethod: selectedPaymentMethod,
        paidAt: new Date().toISOString().split('T')[0],
      });
      setExpense(updatedExpense);
      setShowPaymentModal(false);
      Alert.alert('Sucesso', 'Despesa marcada como paga!');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao marcar como paga');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = () => {
    if (!expense) return;

    Alert.alert(
      'Cancelar Despesa',
      'Tem certeza que deseja cancelar esta despesa?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await ExpenseService.updateExpense(expense.id, {
                status: 'CANCELED',
              });
              setExpense(updated);
              Alert.alert('Sucesso', 'Despesa cancelada!');
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao cancelar');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!expense) return;

    Alert.alert(
      'Excluir Despesa',
      'Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Excluir',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await ExpenseService.deleteExpense(expense.id);
              Alert.alert('Sucesso', 'Despesa excluída!', [
                { text: 'OK', onPress: onDeleted },
              ]);
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Erro ao excluir');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background.secondary }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !expense) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background.secondary }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error[400]} />
        <Text variant="body" weight="semibold" align="center" style={{ marginTop: spacing[4] }}>
          {error || 'Despesa não encontrada'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary[600] }]}
          onPress={loadExpense}
        >
          <Text variant="body" weight="semibold" style={{ color: colors.white }}>
            Tentar novamente
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const overdue = isExpenseOverdue(expense);
  const statusLabel = overdue ? 'Vencida' : expenseStatusLabels[expense.status];

  return (
    <View style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Header Card */}
        <Card variant="elevated" style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Badge
              label={statusLabel}
              variant={getStatusBadgeVariant(expense.status, overdue)}
              size="medium"
            />
            {expense.category && (
              <View style={styles.categoryBadge}>
                <View
                  style={[styles.categoryDot, { backgroundColor: expense.category.color || colors.gray[400] }]}
                />
                <Text variant="caption" color="secondary">
                  {expense.category.name}
                </Text>
              </View>
            )}
          </View>

          <Text variant="h3" weight="bold" style={{ marginTop: spacing[4] }}>
            {expense.description}
          </Text>

          <Text
            variant="h1"
            weight="bold"
            style={{
              marginTop: spacing[2],
              color: expense.status === 'PAID' ? colors.success[600] : colors.text.primary,
            }}
          >
            {formatCurrency(expense.amount, locale)}
          </Text>

          {expense.notes && (
            <Text variant="body" color="secondary" style={{ marginTop: spacing[3] }}>
              {expense.notes}
            </Text>
          )}
        </Card>

        {/* Details Card */}
        <Card variant="elevated" style={styles.detailsCard}>
          <Text variant="h5" weight="semibold" style={{ marginBottom: spacing[4] }}>
            Detalhes
          </Text>

          <DetailRow
            icon="calendar-outline"
            label="Vencimento"
            value={formatDate(expense.dueDate, locale)}
            colors={colors}
            valueColor={overdue ? colors.error[500] : undefined}
          />

          {expense.paidAt && (
            <>
              <Divider style={styles.divider} />
              <DetailRow
                icon="checkmark-circle-outline"
                label="Data de Pagamento"
                value={formatDate(expense.paidAt, locale)}
                colors={colors}
                valueColor={colors.success[600]}
              />
            </>
          )}

          {expense.paymentMethod && (
            <>
              <Divider style={styles.divider} />
              <DetailRow
                icon="card-outline"
                label="Forma de Pagamento"
                value={paymentMethodLabels[expense.paymentMethod]}
                colors={colors}
              />
            </>
          )}

          {expense.supplier && (
            <>
              <Divider style={styles.divider} />
              <DetailRow
                icon="business-outline"
                label="Fornecedor"
                value={expense.supplier.name}
                colors={colors}
              />
            </>
          )}

          {expense.workOrder && (
            <>
              <Divider style={styles.divider} />
              <DetailRow
                icon="construct-outline"
                label="Ordem de Serviço"
                value={expense.workOrder.title}
                colors={colors}
              />
            </>
          )}

          <Divider style={styles.divider} />
          <DetailRow
            icon="time-outline"
            label="Criado em"
            value={formatDate(expense.createdAt, locale)}
            colors={colors}
          />
        </Card>

        {/* Payment Method Selection (when marking as paid) */}
        {showPaymentModal && (
          <Card variant="elevated" style={styles.paymentCard}>
            <Text variant="h5" weight="semibold" style={{ marginBottom: spacing[3] }}>
              Forma de Pagamento
            </Text>
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onSelect={setSelectedPaymentMethod}
              colors={colors}
            />
            <View style={styles.paymentActions}>
              <Button
                variant="outline"
                onPress={() => setShowPaymentModal(false)}
                style={{ flex: 1, marginRight: spacing[2] }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onPress={handleMarkAsPaid}
                loading={actionLoading}
                style={{ flex: 1, marginLeft: spacing[2] }}
              >
                Confirmar
              </Button>
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {canMarkAsPaid(expense) && !showPaymentModal && (
            <Button
              variant="primary"
              onPress={() => setShowPaymentModal(true)}
              loading={actionLoading}
              icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />}
              style={styles.actionButton}
            >
              Marcar como Paga
            </Button>
          )}

          {onEdit && expense.status !== 'CANCELED' && (
            <Button
              variant="outline"
              onPress={() => onEdit(expense)}
              icon={<Ionicons name="create-outline" size={20} color={colors.primary[600]} />}
              style={styles.actionButton}
            >
              Editar
            </Button>
          )}

          {canCancelExpense(expense) && (
            <Button
              variant="outline"
              onPress={handleCancel}
              loading={actionLoading}
              icon={<Ionicons name="close-circle-outline" size={20} color={colors.warning[600]} />}
              style={[styles.actionButton, { borderColor: colors.warning[500] }]}
            >
              <Text style={{ color: colors.warning[600] }}>Cancelar Despesa</Text>
            </Button>
          )}

          <Button
            variant="outline"
            onPress={handleDelete}
            loading={actionLoading}
            icon={<Ionicons name="trash-outline" size={20} color={colors.error[600]} />}
            style={[styles.actionButton, { borderColor: colors.error[500] }]}
          >
            <Text style={{ color: colors.error[600] }}>Excluir</Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  retryButton: {
    marginTop: spacing[6],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[8],
  },
  headerCard: {
    marginBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing[2],
  },
  detailsCard: {
    marginBottom: spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    marginVertical: spacing[2],
  },
  paymentCard: {
    marginBottom: spacing[4],
  },
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  paymentMethodButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  paymentActions: {
    flexDirection: 'row',
    marginTop: spacing[4],
  },
  actionsContainer: {
    gap: spacing[3],
  },
  actionButton: {
    width: '100%',
  },
});

export default ExpenseDetailScreen;
