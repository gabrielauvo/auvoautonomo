// @ts-nocheck
/**
 * CategoryFilter - Filtro de categorias horizontal
 *
 * Design moderno com chips compactos seguindo o design system Auvo (roxo)
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProductCategory } from '../../../db/schema';
import { useColors } from '../../../design-system/ThemeProvider';

interface CategoryFilterProps {
  categories: ProductCategory[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

export function CategoryFilter({
  categories,
  selectedId,
  onSelect,
}: CategoryFilterProps) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Opção "Todas" */}
      <TouchableOpacity
        style={[
          styles.chip,
          {
            backgroundColor: selectedId === null ? colors.primary[600] : colors.gray[100],
            borderColor: selectedId === null ? colors.primary[600] : colors.gray[200],
          },
        ]}
        onPress={() => onSelect(null)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="apps-outline"
          size={14}
          color={selectedId === null ? '#FFFFFF' : colors.gray[500]}
          style={styles.chipIcon}
        />
        <Text
          style={[
            styles.chipText,
            { color: selectedId === null ? '#FFFFFF' : colors.gray[700] },
          ]}
        >
          Todas
        </Text>
      </TouchableOpacity>

      {/* Categorias */}
      {categories.map((category) => {
        const isSelected = selectedId === category.id;
        const categoryColor = category.color || colors.primary[600];

        return (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? categoryColor : colors.gray[100],
                borderColor: isSelected ? categoryColor : colors.gray[200],
              },
            ]}
            onPress={() => onSelect(category.id)}
            activeOpacity={0.7}
          >
            {/* Color indicator */}
            {!isSelected && category.color && (
              <View
                style={[styles.colorDot, { backgroundColor: category.color }]}
              />
            )}
            <Text
              style={[
                styles.chipText,
                { color: isSelected ? '#FFFFFF' : colors.gray[700] },
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
            {isSelected && (
              <Ionicons
                name="checkmark"
                size={14}
                color="#FFFFFF"
                style={styles.checkIcon}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipIcon: {
    marginRight: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  checkIcon: {
    marginLeft: 4,
  },
});

export default CategoryFilter;
