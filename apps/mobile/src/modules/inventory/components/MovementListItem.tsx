/**
 * MovementListItem
 *
 * Componente para exibir uma movimentação de estoque.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryMovement } from '../InventoryRepository';

interface Props {
  movement: InventoryMovement;
}

const TYPE_CONFIG = {
  ADJUSTMENT_IN: {
    label: 'Entrada Manual',
    icon: 'add-circle' as const,
    color: '#22c55e',
  },
  ADJUSTMENT_OUT: {
    label: 'Saída Manual',
    icon: 'remove-circle' as const,
    color: '#ef4444',
  },
  WORK_ORDER_OUT: {
    label: 'Baixa por OS',
    icon: 'construct' as const,
    color: '#f59e0b',
  },
  INITIAL: {
    label: 'Saldo Inicial',
    icon: 'flag' as const,
    color: '#3b82f6',
  },
};

export function MovementListItem({ movement }: Props) {
  const config = TYPE_CONFIG[movement.type] || TYPE_CONFIG.ADJUSTMENT_IN;
  const isPositive = movement.quantity > 0;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatQuantity = (qty: number) => {
    const formatted = qty % 1 === 0 ? Math.abs(qty).toString() : Math.abs(qty).toFixed(2);
    return isPositive ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      <View style={styles.content}>
        <View style={styles.mainRow}>
          <View style={styles.info}>
            <Text style={styles.productName} numberOfLines={1}>
              {movement.itemName || 'Produto'}
            </Text>
            <Text style={styles.type}>{config.label}</Text>
          </View>

          <View style={styles.quantityInfo}>
            <Text
              style={[
                styles.quantity,
                { color: isPositive ? '#22c55e' : '#ef4444' },
              ]}
            >
              {formatQuantity(movement.quantity)}
            </Text>
            <Text style={styles.balanceAfter}>
              Saldo: {movement.balanceAfter.toFixed(0)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.date}>{formatDate(movement.createdAt)}</Text>
          {movement.notes && (
            <Text style={styles.notes} numberOfLines={1}>
              {movement.notes}
            </Text>
          )}
        </View>

        {movement.syncStatus === 'pending' && (
          <View style={styles.syncBadge}>
            <Ionicons name="cloud-upload-outline" size={12} color="#f59e0b" />
            <Text style={styles.syncText}>Pendente sync</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  type: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quantityInfo: {
    alignItems: 'flex-end',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '700',
  },
  balanceAfter: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  date: {
    fontSize: 11,
    color: '#9ca3af',
  },
  notes: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    flex: 1,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  syncText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '500',
  },
});

export default MovementListItem;
