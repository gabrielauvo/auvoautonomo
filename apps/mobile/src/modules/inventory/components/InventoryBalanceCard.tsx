/**
 * InventoryBalanceCard
 *
 * Componente para exibir saldo de estoque de um produto.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InventoryBalance } from '../InventoryRepository';

interface Props {
  balance: InventoryBalance;
  onPress?: () => void;
  onAdjust?: () => void;
  lowStockThreshold?: number;
}

export function InventoryBalanceCard({
  balance,
  onPress,
  onAdjust,
  lowStockThreshold = 5,
}: Props) {
  const isLowStock = balance.quantity <= lowStockThreshold;
  const isOutOfStock = balance.quantity <= 0;

  const getStockStatusColor = () => {
    if (isOutOfStock) return '#ef4444';
    if (isLowStock) return '#f59e0b';
    return '#22c55e';
  };

  const getStockStatusLabel = () => {
    if (isOutOfStock) return 'Sem estoque';
    if (isLowStock) return 'Estoque baixo';
    return 'Em estoque';
  };

  const formatQuantity = (qty: number) => {
    return qty % 1 === 0 ? qty.toString() : qty.toFixed(2);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.mainContent}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {balance.itemName || 'Produto sem nome'}
          </Text>
          {balance.itemSku && (
            <Text style={styles.sku}>SKU: {balance.itemSku}</Text>
          )}
        </View>

        <View style={styles.quantityContainer}>
          <Text style={[styles.quantity, { color: getStockStatusColor() }]}>
            {formatQuantity(balance.quantity)}
          </Text>
          {balance.itemUnit && (
            <Text style={styles.unit}>{balance.itemUnit}</Text>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStockStatusColor() + '20' },
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: getStockStatusColor() }]}
          />
          <Text style={[styles.statusText, { color: getStockStatusColor() }]}>
            {getStockStatusLabel()}
          </Text>
        </View>

        {onAdjust && (
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={onAdjust}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="create-outline" size={18} color="#6366f1" />
            <Text style={styles.adjustText}>Ajustar</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  sku: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  quantityContainer: {
    alignItems: 'flex-end',
  },
  quantity: {
    fontSize: 24,
    fontWeight: '700',
  },
  unit: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  adjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adjustText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
});

export default InventoryBalanceCard;
