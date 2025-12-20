// @ts-nocheck
/**
 * CatalogItemCard - Card de item do catálogo
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CatalogItem, ItemType } from '../../../db/schema';

interface CatalogItemCardProps {
  item: CatalogItem;
  onPress: (item: CatalogItem) => void;
  showCategory?: boolean;
}

// Configurações por tipo
const TYPE_CONFIG: Record<ItemType, { label: string; color: string; icon: string }> = {
  PRODUCT: { label: 'Produto', color: '#3B82F6', icon: 'cube-outline' },
  SERVICE: { label: 'Serviço', color: '#10B981', icon: 'construct-outline' },
  BUNDLE: { label: 'Kit', color: '#8B5CF6', icon: 'layers-outline' },
};

// Formatar preço
function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

export function CatalogItemCard({
  item,
  onPress,
  showCategory = true,
}: CatalogItemCardProps) {
  const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.PRODUCT;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* Ícone do tipo */}
      <View style={[styles.iconContainer, { backgroundColor: `${typeConfig.color}15` }]}>
        <Ionicons
          name={typeConfig.icon as any}
          size={24}
          color={typeConfig.color}
        />
      </View>

      {/* Informações do item */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.sku && (
            <Text style={styles.sku}>SKU: {item.sku}</Text>
          )}
        </View>

        <View style={styles.badges}>
          {/* Badge do tipo */}
          <View style={[styles.typeBadge, { backgroundColor: `${typeConfig.color}15` }]}>
            <Text style={[styles.typeBadgeText, { color: typeConfig.color }]}>
              {typeConfig.label}
            </Text>
          </View>

          {/* Badge da categoria */}
          {showCategory && item.categoryName && (
            <View
              style={[
                styles.categoryBadge,
                item.categoryColor && { backgroundColor: `${item.categoryColor}15` },
              ]}
            >
              {item.categoryColor && (
                <View
                  style={[styles.categoryDot, { backgroundColor: item.categoryColor }]}
                />
              )}
              <Text
                style={[
                  styles.categoryBadgeText,
                  item.categoryColor && { color: item.categoryColor },
                ]}
                numberOfLines={1}
              >
                {item.categoryName}
              </Text>
            </View>
          )}
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>

      {/* Preço */}
      <View style={styles.priceContainer}>
        <Text style={styles.price}>{formatPrice(item.basePrice)}</Text>
        {item.unit && (
          <Text style={styles.unit}>/{item.unit}</Text>
        )}
      </View>

      {/* Seta */}
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  sku: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    maxWidth: 100,
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  priceContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  unit: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

export default CatalogItemCard;
