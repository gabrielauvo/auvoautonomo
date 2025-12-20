// @ts-nocheck
/**
 * CategoryFilter - Filtro de categorias horizontal
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ProductCategory } from '../../../db/schema';

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
          selectedId === null && styles.chipSelected,
        ]}
        onPress={() => onSelect(null)}
      >
        <Text
          style={[
            styles.chipText,
            selectedId === null && styles.chipTextSelected,
          ]}
        >
          Todas
        </Text>
      </TouchableOpacity>

      {/* Categorias */}
      {categories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.chip,
            selectedId === category.id && styles.chipSelected,
            category.color && selectedId === category.id && {
              backgroundColor: category.color,
              borderColor: category.color,
            },
          ]}
          onPress={() => onSelect(category.id)}
        >
          {category.color && selectedId !== category.id && (
            <View
              style={[styles.colorDot, { backgroundColor: category.color }]}
            />
          )}
          <Text
            style={[
              styles.chipText,
              selectedId === category.id && styles.chipTextSelected,
            ]}
            numberOfLines={1}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
});

export default CategoryFilter;
